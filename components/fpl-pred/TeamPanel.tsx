import type { FplPlayer, TeamRosterResponse } from './types'

function PlayerRow({ player }: { player: FplPlayer }) {
  return (
    <li className="flex items-center justify-between gap-2 py-1.5 text-sm">
      <div className="min-w-0">
        <span className="font-medium text-gray-900 dark:text-gray-100">{player.name}</span>
        <span className="ml-2 text-xs text-gray-400">
          {player.position} · {player.team}
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {player.chance_of_playing !== null && player.chance_of_playing < 100 && (
          <span
            className="text-[11px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400"
            title={`xPts ${player.xpts_mean !== null ? player.xpts_mean.toFixed(1) : '—'} discounted by chance of playing`}
          >
            {player.chance_of_playing}%
          </span>
        )}
        <span className="font-semibold text-gray-900 dark:text-gray-100 w-10 text-right">
          {player.adjusted_xpts !== null ? player.adjusted_xpts.toFixed(1) : '—'}
        </span>
      </div>
    </li>
  )
}

export default function TeamPanel({
  title,
  data,
  loading,
  error,
}: {
  title: string
  data: TeamRosterResponse | null
  loading: boolean
  error: string | null
}) {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow p-4">
      <div className="flex items-baseline justify-between mb-2 gap-2">
        <h2 className="font-bold text-lg text-gray-900 dark:text-gray-100 truncate">{title}</h2>
        {data && <span className="text-xs text-gray-400 shrink-0">roster as of GW{data.gw_used}</span>}
      </div>

      {loading && <p className="text-sm text-gray-400">Loading…</p>}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {data && (
        <>
          {!data.predictions_available && (
            <p className="text-xs text-amber-700 dark:text-amber-400 mb-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">
              No predictions available yet for the next gameweek — showing roster only.
            </p>
          )}

          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">Starting XI</span>
            {data.total_adjusted_xpts !== null && (
              <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                {data.total_adjusted_xpts.toFixed(1)} xPts
              </span>
            )}
          </div>
          <ul className="divide-y divide-gray-100 dark:divide-gray-700 mb-4">
            {data.starting_xi.map(p => (
              <PlayerRow key={p.code} player={p} />
            ))}
          </ul>

          <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">Bench</span>
          <ul className="divide-y divide-gray-100 dark:divide-gray-700 mt-1">
            {data.bench.map(p => (
              <PlayerRow key={p.code} player={p} />
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
