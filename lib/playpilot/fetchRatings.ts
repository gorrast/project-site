export interface PlayPilotRating {
  title: string;
  score: number;
}

const ATLAS_HOST = 'https://atlas.playpilot.tech';
const MAX_PAGES = 50; // safety cap against runaway pagination

interface TitlesBrowseItem {
  title?: string;
  original_title?: string;
  rating_scores?: Record<string, number>;
}

interface TitlesBrowseResponse {
  next: string | null;
  results?: TitlesBrowseItem[];
}

export async function fetchAllRatings(
  uuid: string,
  { region = 'se', language = 'sv-SE' }: { region?: string; language?: string } = {}
): Promise<PlayPilotRating[]> {
  const ratings: PlayPilotRating[] = [];

  const params = new URLSearchParams({
    region,
    language,
    include_count: 'false',
    exclude_hidden_titles: 'true',
    device: 'desktop',
    rated_by: uuid,
    rating_score_min: '1',
    include_ratings_by: uuid,
    page_size: '250',
    ordering: '-rated_at,-score',
  });

  let url: string | null = `${ATLAS_HOST}/api/v1/titles/browse/?${params.toString()}`;
  let pages = 0;

  while (url && pages < MAX_PAGES) {
    const res: Response = await fetch(url);
    if (!res.ok) {
      throw new Error(`Ratings request failed with status ${res.status}`);
    }

    const data: TitlesBrowseResponse = await res.json();

    for (const item of data.results ?? []) {
      const score = item.rating_scores?.[uuid];
      if (typeof score === 'number') {
        ratings.push({ title: item.title ?? item.original_title ?? 'Unknown title', score });
      }
    }

    url = data.next;
    pages++;
  }

  return ratings;
}
