import type { FplPlayer, TeamRosterResponse } from './types'
import PlayerCard from './PlayerCard'

type Position = 'GKP' | 'DEF' | 'MID' | 'FWD'

function groupByPosition(players: FplPlayer[]): Record<Position, FplPlayer[]> {
  const groups: Record<Position, FplPlayer[]> = { GKP: [], DEF: [], MID: [], FWD: [] }
  for (const p of players) {
    if (p.position === 'GKP' || p.position === 'DEF' || p.position === 'MID' || p.position === 'FWD') {
      groups[p.position].push(p)
    }
  }
  return groups
}

function PositionRow({ players }: { players: FplPlayer[] }) {
  if (players.length === 0) return null
  return (
    <div className="relative flex w-full justify-around py-1.5">
      {players.map(p => (
        <PlayerCard key={p.code} player={p} dark />
      ))}
    </div>
  )
}

function BenchStrip({ title, players }: { title: string; players: FplPlayer[] }) {
  return (
    <div className="bg-gray-50 px-3 py-2 dark:bg-gray-900/40">
      <div className="mb-1.5 text-[11px] font-semibold tracking-wide text-gray-400 uppercase dark:text-gray-500">
        {title}
      </div>
      <div className="flex gap-2 overflow-x-auto">
        {players.map(p => (
          <PlayerCard key={p.code} player={p} dark={false} />
        ))}
      </div>
    </div>
  )
}

function PredictionsNotice() {
  return (
    <p className="mx-3 mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
      No predictions available yet for the next gameweek — showing roster only.
    </p>
  )
}

function PitchMarkings() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full text-white/25"
      viewBox="0 0 100 140"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <rect x="2" y="2" width="96" height="136" fill="none" stroke="currentColor" strokeWidth="0.6" />
      <line x1="2" y1="70" x2="98" y2="70" stroke="currentColor" strokeWidth="0.6" />
      <circle cx="50" cy="70" r="12" fill="none" stroke="currentColor" strokeWidth="0.6" />
      <rect x="25" y="2" width="50" height="18" fill="none" stroke="currentColor" strokeWidth="0.6" />
      <rect x="25" y="120" width="50" height="18" fill="none" stroke="currentColor" strokeWidth="0.6" />
    </svg>
  )
}

function TeamHeader({ label, data }: { label: string; data: TeamRosterResponse | null }) {
  return (
    <div className="flex items-baseline justify-between gap-2 px-3 py-2">
      <span className="truncate font-bold text-gray-900 dark:text-gray-100">{label}</span>
      <div className="flex shrink-0 items-center gap-2 text-xs text-gray-400">
        {data && <span>roster as of GW{data.gw_used}</span>}
        {data?.total_adjusted_xpts != null && (
          <span className="font-bold text-blue-600 dark:text-blue-400">{data.total_adjusted_xpts.toFixed(1)} xPts</span>
        )}
      </div>
    </div>
  )
}

export default function Pitch({
  myTeam,
  myLoading,
  myError,
  opponentTeam,
  opponentLoading,
  opponentError,
  opponentName,
}: {
  myTeam: TeamRosterResponse | null
  myLoading: boolean
  myError: string | null
  opponentTeam: TeamRosterResponse | null
  opponentLoading: boolean
  opponentError: string | null
  opponentName: string | null
}) {
  const myGroups = groupByPosition(myTeam?.starting_xi ?? [])
  const oppGroups = groupByPosition(opponentTeam?.starting_xi ?? [])
  const expectingOpponent = opponentName !== null || opponentLoading || !!opponentError

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow dark:border-gray-700 dark:bg-gray-800">
      <TeamHeader label="My Team" data={myTeam} />
      {myLoading && <p className="px-3 pb-2 text-sm text-gray-400">Loading…</p>}
      {myError && <p className="px-3 pb-2 text-sm text-red-600 dark:text-red-400">{myError}</p>}
      {myTeam && !myTeam.predictions_available && <PredictionsNotice />}
      {myTeam && <BenchStrip title="Bench" players={myTeam.bench} />}

      <div className="relative bg-gradient-to-b from-green-600 to-green-700 py-2 dark:from-green-800 dark:to-green-950">
        <PitchMarkings />

        {myTeam && (
          <div className="relative flex flex-col gap-1">
            <PositionRow players={myGroups.GKP} />
            <PositionRow players={myGroups.DEF} />
            <PositionRow players={myGroups.MID} />
            <PositionRow players={myGroups.FWD} />
          </div>
        )}

        {expectingOpponent && (
          <div className="relative my-1 flex items-center gap-2 px-3">
            <div className="flex-1 border-t-2 border-white/40" />
            <span className="text-[10px] font-bold tracking-wide text-white/90 uppercase">
              {opponentName ? `Opponent — ${opponentName}` : 'Opponent'}
            </span>
            <div className="flex-1 border-t-2 border-white/40" />
          </div>
        )}

        {opponentLoading && <p className="relative py-2 text-center text-sm text-white/80">Loading…</p>}
        {opponentError && <p className="relative py-2 text-center text-sm text-red-200">{opponentError}</p>}

        {opponentTeam && (
          <div className="relative flex flex-col gap-1">
            <PositionRow players={oppGroups.FWD} />
            <PositionRow players={oppGroups.MID} />
            <PositionRow players={oppGroups.DEF} />
            <PositionRow players={oppGroups.GKP} />
          </div>
        )}
      </div>

      {opponentTeam && !opponentTeam.predictions_available && <PredictionsNotice />}
      {opponentTeam && <BenchStrip title="Opponent Bench" players={opponentTeam.bench} />}
      {opponentTeam && <TeamHeader label={`Opponent — ${opponentName ?? ''}`} data={opponentTeam} />}
    </div>
  )
}
