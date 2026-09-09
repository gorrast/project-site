'use client'

import { useEffect, useMemo, useState } from 'react'
import TeamPanel from './TeamPanel'
import PlayersTable from './PlayersTable'
import { DEFAULT_LEAGUE_ID } from '@/lib/fpl/config'
import type { LeagueResponse, TeamRosterResponse, PlayersResponse } from './types'

const STORAGE_KEY_PREFIX = 'fpl-pred:selectedTeamId'

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error((body && body.error) || `Request failed (${res.status})`)
  }
  return res.json()
}

export default function FplPred() {
  const [leagueIdInput, setLeagueIdInput] = useState(String(DEFAULT_LEAGUE_ID))
  const [leagueId, setLeagueId] = useState(DEFAULT_LEAGUE_ID)

  const [league, setLeague] = useState<LeagueResponse | null>(null)
  // Starts true (not false) — the effect below fires a fetch immediately on
  // mount, and defaulting to false would flash the empty/error UI for one
  // render before that fetch's loading state lands.
  const [leagueLoading, setLeagueLoading] = useState(true)
  const [leagueError, setLeagueError] = useState<string | null>(null)

  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null)

  const [myTeam, setMyTeam] = useState<TeamRosterResponse | null>(null)
  const [myTeamLoading, setMyTeamLoading] = useState(false)
  const [myTeamError, setMyTeamError] = useState<string | null>(null)

  const [opponentTeam, setOpponentTeam] = useState<TeamRosterResponse | null>(null)
  const [opponentTeamLoading, setOpponentTeamLoading] = useState(false)
  const [opponentTeamError, setOpponentTeamError] = useState<string | null>(null)

  const [playersData, setPlayersData] = useState<PlayersResponse | null>(null)
  const [playersLoading, setPlayersLoading] = useState(true) // see leagueLoading comment above
  const [playersError, setPlayersError] = useState<string | null>(null)

  // League + players list load together whenever the league id changes.
  useEffect(() => {
    let cancelled = false

    async function run() {
      setLeagueLoading(true)
      setLeagueError(null)
      setLeague(null)
      setSelectedTeamId(null)
      try {
        const data = await fetchJson<LeagueResponse>(`/api/fpl/league/${leagueId}`)
        if (cancelled) return
        setLeague(data)
        let stored: string | null = null
        try {
          stored = window.localStorage.getItem(`${STORAGE_KEY_PREFIX}:${leagueId}`)
        } catch {
          // localStorage unavailable (private browsing, blocked) — fall back to no selection
        }
        const storedId = stored ? Number(stored) : null
        if (storedId && data.teams.some(t => t.team_id === storedId)) {
          setSelectedTeamId(storedId)
        }
      } catch (err) {
        if (!cancelled) setLeagueError(err instanceof Error ? err.message : String(err))
      } finally {
        if (!cancelled) setLeagueLoading(false)
      }
    }
    run()

    async function runPlayers() {
      setPlayersLoading(true)
      setPlayersError(null)
      setPlayersData(null)
      try {
        const data = await fetchJson<PlayersResponse>(`/api/fpl/players?league_id=${leagueId}`)
        if (!cancelled) setPlayersData(data)
      } catch (err) {
        if (!cancelled) setPlayersError(err instanceof Error ? err.message : String(err))
      } finally {
        if (!cancelled) setPlayersLoading(false)
      }
    }
    runPlayers()

    return () => {
      cancelled = true
    }
  }, [leagueId])

  // My team roster loads whenever the selected team changes.
  useEffect(() => {
    let cancelled = false

    async function run() {
      if (selectedTeamId === null) {
        setMyTeam(null)
        return
      }
      try {
        window.localStorage.setItem(`${STORAGE_KEY_PREFIX}:${leagueId}`, String(selectedTeamId))
      } catch {
        // ignore — persistence is a convenience, not a requirement
      }

      setMyTeamLoading(true)
      setMyTeamError(null)
      try {
        const data = await fetchJson<TeamRosterResponse>(`/api/fpl/team/${selectedTeamId}`)
        if (!cancelled) setMyTeam(data)
      } catch (err) {
        if (!cancelled) setMyTeamError(err instanceof Error ? err.message : String(err))
      } finally {
        if (!cancelled) setMyTeamLoading(false)
      }
    }
    run()

    return () => {
      cancelled = true
    }
  }, [selectedTeamId, leagueId])

  const opponentTeamId = useMemo(() => {
    if (!league || selectedTeamId === null) return null
    const entry = league.schedule.find(s => s.team_id === selectedTeamId)
    return entry ? entry.opponent_team_id : null
  }, [league, selectedTeamId])

  const opponentName = useMemo(() => {
    if (!league || opponentTeamId === null) return null
    return league.teams.find(t => t.team_id === opponentTeamId)?.name ?? `Team ${opponentTeamId}`
  }, [league, opponentTeamId])

  // Opponent roster loads whenever the resolved opponent changes.
  useEffect(() => {
    let cancelled = false

    async function run() {
      if (opponentTeamId === null) {
        setOpponentTeam(null)
        return
      }
      setOpponentTeamLoading(true)
      setOpponentTeamError(null)
      try {
        const data = await fetchJson<TeamRosterResponse>(`/api/fpl/team/${opponentTeamId}`)
        if (!cancelled) setOpponentTeam(data)
      } catch (err) {
        if (!cancelled) setOpponentTeamError(err instanceof Error ? err.message : String(err))
      } finally {
        if (!cancelled) setOpponentTeamLoading(false)
      }
    }
    run()

    return () => {
      cancelled = true
    }
  }, [opponentTeamId])

  function handleLeagueIdSubmit() {
    const parsed = Number(leagueIdInput)
    if (Number.isFinite(parsed) && parsed > 0) {
      setLeagueId(parsed)
    }
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-8">
          <div className="bg-linear-to-r from-blue-600 to-purple-600 text-transparent bg-clip-text">
            <h1 className="text-4xl md:text-5xl font-extrabold mb-2">FPL Points Predictions</h1>
          </div>
          <p className="text-base text-gray-500 dark:text-gray-400">
            Model-predicted points for your Draft league, with an optimized starting XI.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
          <label htmlFor="fpl-pred-league-id" className="text-sm font-medium text-gray-600 dark:text-gray-300">
            League ID
          </label>
          <input
            id="fpl-pred-league-id"
            type="text"
            inputMode="numeric"
            value={leagueIdInput}
            onChange={e => setLeagueIdInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLeagueIdSubmit()}
            className="w-28 px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleLeagueIdSubmit}
            className="px-3 py-1.5 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors cursor-pointer"
          >
            Load
          </button>

          {league && (
            <>
              <label htmlFor="fpl-pred-team" className="text-sm font-medium text-gray-600 dark:text-gray-300 ml-4">
                My team
              </label>
              <select
                id="fpl-pred-team"
                value={selectedTeamId ?? ''}
                onChange={e => setSelectedTeamId(e.target.value ? Number(e.target.value) : null)}
                className="px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a team…</option>
                {league.teams.map(t => (
                  <option key={t.team_id} value={t.team_id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>

        {leagueLoading && <p className="text-sm text-gray-400 text-center mb-6">Loading league…</p>}
        {leagueError && <p className="text-sm text-red-600 dark:text-red-400 text-center mb-6">{leagueError}</p>}

        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6 items-start">
          <div className="flex flex-col gap-6">
            {selectedTeamId === null ? (
              <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-600 p-6 text-center text-sm text-gray-400">
                Select your team above to see your starting XI.
              </div>
            ) : (
              <TeamPanel title="My Team" data={myTeam} loading={myTeamLoading} error={myTeamError} />
            )}
            {selectedTeamId !== null && opponentTeamId !== null && (
              <TeamPanel
                title={`Opponent — ${opponentName}`}
                data={opponentTeam}
                loading={opponentTeamLoading}
                error={opponentTeamError}
              />
            )}
          </div>

          <PlayersTable
            players={playersData?.players ?? []}
            predictionsAvailable={playersData?.predictions_available ?? false}
            loading={playersLoading}
            error={playersError}
          />
        </div>
      </div>
    </div>
  )
}
