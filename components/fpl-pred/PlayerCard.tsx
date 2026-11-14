import type { FplPlayer } from './types'
import { shirtUrl } from './shirts'
import { cn } from '@/lib/utils'

const xp = (v: number | null) => (v !== null ? v.toFixed(1) : '–')

/** Under 100% to play: the FPL feed gives null for "no news", which is fit. */
export const doubtful = (p: FplPlayer) => p.chance_of_playing !== null && p.chance_of_playing < 100

export function playerTitle(p: FplPlayer) {
  return doubtful(p)
    ? `${p.name} · ${p.chance_of_playing}% to play · ${xp(p.xpts_mean)} raw, ${xp(p.adjusted_xpts)} discounted`
    : `${p.name} · ${xp(p.adjusted_xpts)} xPts`
}

/**
 * A player on the pitch or bench. Keeps the club jersey from FPL's kit CDN in
 * place of DESIGN.md's club-code circle; the warning dot sits on the jersey.
 */
export default function PlayerCard({
  player,
  bench = false,
  mine = false,
}: {
  player: FplPlayer
  bench?: boolean
  mine?: boolean
}) {
  const shirt = shirtUrl(player.team_code, player.position)
  const fixture = player.opponent_team_short
    ? `${player.opponent_team_short} (${player.was_home ? 'H' : 'A'})`
    : null

  return (
    <div title={playerTitle(player)} className="flex w-[76px] min-w-0 flex-col items-center gap-1 text-center">
      <span className={cn('relative block flex-none', bench ? 'size-8' : 'size-10')}>
        {shirt ? (
          // FPL's own kit CDN — see components/fpl-pred/shirts.ts
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shirt} alt={player.team} className="size-full object-contain" />
        ) : (
          <span className="block size-full rounded-full border border-line-strong bg-surface-2" />
        )}
        {doubtful(player) && (
          <span className="absolute -top-px -right-px size-[9px] rounded-full bg-warn shadow-[0_0_0_2px_var(--surface)]" />
        )}
      </span>
      <span className={cn('max-w-full truncate text-xs leading-[1.2]', bench ? 'text-ink-2' : 'font-medium')}>
        {player.web_name}
      </span>
      {bench ? (
        <span className="font-mono text-[11px] text-ink-3">
          {player.position} · {xp(player.adjusted_xpts)}
        </span>
      ) : (
        <>
          <span className={cn('rounded-md px-[7px] py-px font-mono text-xs font-medium', mine ? 'bg-accent-soft' : 'bg-surface-3')}>
            {xp(player.adjusted_xpts)}
          </span>
          {fixture && (
            <span className="font-mono text-[10px] whitespace-nowrap text-ink-3">
              {fixture}
              {doubtful(player) && ` · ${player.chance_of_playing}%`}
            </span>
          )}
        </>
      )}
    </div>
  )
}
