const PROFILE_HOST = 'https://www.playpilot.com';
const MAX_ATTEMPTS = 4;
const BASE_DELAY_MS = 1000;

export interface ResolveProfileRetryInfo {
  attempt: number;
  maxAttempts: number;
  status: number;
  waitMs: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Finds the index just past the closing '}' that matches the '{' at startIndex,
// tracking string literals so braces inside quoted strings aren't counted.
function findMatchingBraceEnd(text: string, startIndex: number): number {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = startIndex; i < text.length; i++) {
    const char = text[i];

    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') inString = true;
    else if (char === '{') depth++;
    else if (char === '}') {
      depth--;
      if (depth === 0) return i + 1;
    }
  }

  throw new Error('Could not find matching closing brace for embedded profile data');
}

// PlayPilot embeds a `window.playpilot = {...}` hydration blob directly in the
// server-rendered profile page HTML. The `profiles/by-username/<username>` entry
// within it is well-formed JSON (unlike the outer object, which has unquoted
// top-level keys), so we locate and parse just that piece rather than the whole blob.
//
// The profile page is intermittently blocked (Cloudflare 403/404) depending on
// which egress IP the request happens to come from, so failed HTTP responses are
// retried with backoff; a page that loads fine but genuinely lacks the profile
// marker is treated as a real "not found" and is not retried.
export async function resolveProfileUuid(
  username: string,
  options: { locale?: string; onRetry?: (info: ResolveProfileRetryInfo) => void } = {}
): Promise<string> {
  const { locale = 'se', onRetry } = options;
  const url = `${PROFILE_HOST}/${locale}/user/${encodeURIComponent(username)}/`;

  let lastStatus = 0;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
      },
    });

    if (res.ok) {
      const html = await res.text();
      const marker = `"profiles/by-username/${username}":`;
      const markerIndex = html.indexOf(marker);

      if (markerIndex === -1) {
        throw new Error('Profile not found (invalid username or private profile)');
      }

      const braceStart = html.indexOf('{', markerIndex + marker.length);
      const braceEnd = findMatchingBraceEnd(html, braceStart);
      const profileData = JSON.parse(html.slice(braceStart, braceEnd));
      const uuid = profileData?.profile?.uuid;

      if (!uuid) {
        throw new Error('Profile UUID missing from embedded profile data');
      }

      return uuid as string;
    }

    lastStatus = res.status;
    const bodySnippet = (await res.text().catch(() => '')).slice(0, 300);
    console.error(
      `PlayPilot profile page attempt ${attempt}/${MAX_ATTEMPTS} — ${res.status} ${res.statusText} — final url: ${res.url} — headers: ${JSON.stringify(
        Object.fromEntries(res.headers.entries())
      )} — body: ${bodySnippet}`
    );

    if (attempt < MAX_ATTEMPTS) {
      const waitMs = BASE_DELAY_MS * 2 ** (attempt - 1);
      onRetry?.({ attempt, maxAttempts: MAX_ATTEMPTS, status: res.status, waitMs });
      await sleep(waitMs);
    }
  }

  throw new Error(`Profile page request failed with status ${lastStatus}`);
}
