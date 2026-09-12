import type { FplPlayer } from './types'
import { shirtUrl } from './shirts'

export default function PlayerCard({ player, dark }: { player: FplPlayer; dark: boolean }) {
  const shirt = shirtUrl(player.team_code, player.position)
  const oppLabel = player.opponent_team_short
    ? `${player.opponent_team_short} (${player.was_home ? 'H' : 'A'})`
    : null

  return (
    <div className="flex w-16 shrink-0 flex-col items-center text-center">
      {shirt ? (
        // FPL's own kit CDN — see components/fpl-pred/shirts.ts
        // eslint-disable-next-line @next/next/no-img-element
        <img src={shirt} alt={player.team} className="h-9 w-9 object-contain drop-shadow-md" />
      ) : (
        <div className="h-9 w-9 rounded-full bg-gray-300 dark:bg-gray-600" />
      )}
      <span
        className={`mt-0.5 max-w-16 truncate text-[10px] leading-tight font-semibold ${
          dark ? 'text-white drop-shadow-sm' : 'text-gray-900 dark:text-gray-100'
        }`}
        title={player.name}
      >
        {player.name}
      </span>
      <span
        className={`rounded px-1 text-[10px] leading-tight font-bold ${
          dark ? 'bg-black/35 text-white' : 'text-blue-600 dark:text-blue-400'
        }`}
      >
        {player.adjusted_xpts !== null ? player.adjusted_xpts.toFixed(1) : '—'}
      </span>
      {oppLabel && (
        <span className={`text-[9px] leading-tight ${dark ? 'text-white/80' : 'text-gray-400'}`}>{oppLabel}</span>
      )}
    </div>
  )
}
