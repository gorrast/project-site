import type { PlayPilotRating } from '@/components/playpilot/types';

const ATLAS_HOST = 'https://atlas.playpilot.tech';
const PAGE_SIZE = 250;
const MAX_PAGES = 50; // safety cap against runaway pagination, per region
const PAGE_RETRY_ATTEMPTS = 3;
const PAGE_RETRY_BASE_DELAY_MS = 400;

const REQUEST_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json',
};

// A rating is only visible via `titles/browse` if the title is currently in that
// region's catalog. Titles without a Swedish provider (often just recently released,
// not yet region-tagged) silently drop out of a region=se-only query even though the
// rating itself still exists. Querying a few more regions and merging by the title's
// stable `sid` recovers most of those. A smaller remainder — titles delisted from
// PlayPilot's catalog entirely — isn't recoverable this way regardless of region.
const SECONDARY_REGIONS: { region: string; language: string }[] = [
  { region: 'us', language: 'en-US' },
  { region: 'uk', language: 'en-GB' },
  { region: 'au', language: 'en-AU' },
  { region: 'no', language: 'nb-NO' },
  { region: 'dk', language: 'da-DK' },
];

interface TitlesBrowseItem {
  sid?: string;
  title?: string;
  original_title?: string;
  rating_scores?: Record<string, number>;
  type?: string;
  year?: number;
  genres?: string[];
}

interface TitlesBrowseResponse {
  count?: number;
  next: string | null;
  results?: TitlesBrowseItem[];
}

interface GenreEntry {
  slug: string;
  name: string;
}

interface RawRating {
  id: string;
  title: string;
  score: number;
  type: 'movie' | 'series' | null;
  year: number | null;
  genreSlugs: string[];
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchJsonWithRetry<T>(url: string): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= PAGE_RETRY_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, { headers: REQUEST_HEADERS });
      if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
      return (await res.json()) as T;
    } catch (err) {
      lastError = err;
      if (attempt < PAGE_RETRY_ATTEMPTS) {
        await sleep(PAGE_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
      }
    }
  }
  throw lastError;
}

// Genre names come back in English regardless of the `language` param, so a single
// fetch covers every region — the numeric genre slugs themselves are region-agnostic.
async function fetchGenreMap(): Promise<Map<string, string>> {
  try {
    const data = await fetchJsonWithRetry<GenreEntry[]>(
      `${ATLAS_HOST}/api/v1/genres/browse/?region=se&language=sv-SE`
    );
    return new Map(data.map(g => [g.slug, g.name]));
  } catch {
    return new Map();
  }
}

function extractItems(data: TitlesBrowseResponse, uuid: string, region: string): RawRating[] {
  const items: RawRating[] = [];
  for (const item of data.results ?? []) {
    const score = item.rating_scores?.[uuid];
    if (typeof score === 'number') {
      items.push({
        id: item.sid ?? `${region}:${item.title ?? item.original_title ?? ''}`,
        title: item.title ?? item.original_title ?? 'Unknown title',
        score,
        type: item.type === 'movie' || item.type === 'series' ? item.type : null,
        year: item.year ?? null,
        genreSlugs: item.genres ?? [],
      });
    }
  }
  return items;
}

function buildBrowseUrl(uuid: string, region: string, language: string, page: number): string {
  const params = new URLSearchParams({
    region,
    language,
    include_count: 'true',
    exclude_hidden_titles: 'true',
    device: 'desktop',
    rated_by: uuid,
    rating_score_min: '1',
    include_ratings_by: uuid,
    page_size: String(PAGE_SIZE),
    ordering: '-rated_at,-score',
    page: String(page),
  });
  return `${ATLAS_HOST}/api/v1/titles/browse/?${params.toString()}`;
}

// Fetches page 1 to learn the total item count, then fires every remaining page for
// this region in parallel (rather than following `next` one page at a time) — the
// pages are independently addressable via `?page=N`, so there's no need to wait on
// each one before requesting the next.
async function fetchRegionRatings(uuid: string, region: string, language: string): Promise<RawRating[]> {
  const firstPage = await fetchJsonWithRetry<TitlesBrowseResponse>(buildBrowseUrl(uuid, region, language, 1));
  const items = extractItems(firstPage, uuid, region);

  const totalCount = typeof firstPage.count === 'number' ? firstPage.count : items.length;
  const totalPages = Math.min(Math.ceil(totalCount / PAGE_SIZE), MAX_PAGES);

  if (totalPages > 1) {
    const restPages = await Promise.allSettled(
      Array.from({ length: totalPages - 1 }, (_, i) =>
        fetchJsonWithRetry<TitlesBrowseResponse>(buildBrowseUrl(uuid, region, language, i + 2))
      )
    );

    let failedPages = 0;
    for (const result of restPages) {
      if (result.status === 'fulfilled') {
        items.push(...extractItems(result.value, uuid, region));
      } else {
        failedPages++;
      }
    }
    if (failedPages > 0) {
      console.error(
        `PlayPilot ratings: region "${region}" — ${failedPages}/${totalPages - 1} pages failed after retries`
      );
    }
  }

  return items;
}

export async function fetchAllRatings(
  uuid: string,
  { region = 'se', language = 'sv-SE' }: { region?: string; language?: string } = {}
): Promise<PlayPilotRating[]> {
  const genreMapPromise = fetchGenreMap();

  // Primary region listed first so its localized titles win the merge below; all
  // regions are fetched concurrently rather than waiting on the primary to finish.
  const allRegions = [{ region, language }, ...SECONDARY_REGIONS];
  const results = await Promise.allSettled(
    allRegions.map(({ region: r, language: l }) => fetchRegionRatings(uuid, r, l))
  );

  const merged = new Map<string, RawRating>();
  let primaryCount = 0;

  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      for (const item of result.value) {
        if (!merged.has(item.id)) merged.set(item.id, item);
      }
      if (i === 0) primaryCount = result.value.length;
    } else {
      console.error(`PlayPilot ratings: region "${allRegions[i].region}" failed:`, result.reason);
    }
  });

  console.log(
    `PlayPilot ratings diagnostic — uuid: ${uuid} — primary region (${region}) items: ${primaryCount} — ` +
    `merged total after ${SECONDARY_REGIONS.length} secondary regions: ${merged.size} — ` +
    `recovered via secondary regions: ${merged.size - primaryCount}`
  );

  const genreMap = await genreMapPromise;

  return Array.from(merged.values()).map(r => ({
    title: r.title,
    score: r.score,
    type: r.type,
    year: r.year,
    genres: r.genreSlugs.map(slug => genreMap.get(slug) ?? slug),
  }));
}
