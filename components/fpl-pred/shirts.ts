// FPL's own official CDN — the same one fantasy.premierleague.com's frontend
// uses for kit icons. Keyed by each club's `code` (not the sequential team
// id), with a separate "_1" suffix for the goalkeeper kit variant.
export function shirtUrl(teamCode: number | null, position: string): string | null {
  if (teamCode === null) return null
  const variant = position === 'GKP' ? '_1' : ''
  return `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${teamCode}${variant}-66.png`
}
