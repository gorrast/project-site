'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import Pitch from './Pitch'
import PlayersTable from './PlayersTable'
import { DEFAULT_LEAGUE_ID } from '@/lib/fpl/config'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { MetricGroup, RevealHeading, RevealSection, quietItemProps } from '@/components/ui/Motion'
import { SectionHeading } from '@/components/SectionHeading'
import { cn } from '@/lib/utils'
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

  const myCodes = useMemo(() => rosterCodes(myTeam), [myTeam])
  const opponentCodes = useMemo(() => rosterCodes(opponentTeam), [opponentTeam])
  const myName = league?.teams.find(t => t.team_id === selectedTeamId)?.name ?? 'Your team'
  const gw = league?.upcoming_gw ?? null

  return (
    <div className="mx-auto max-w-[1200px] px-[clamp(16px,5vw,40px)] pb-[120px]">
      <section className="flex flex-col gap-3.5 pt-[clamp(40px,8vw,72px)] pb-12">
        <div className="font-mono text-[11px] tracking-[0.08em] text-ink-3 uppercase">
          Fantasy Draft Premier League{gw && ` · Gameweek ${gw} predictions`}
        </div>
        <RevealHeading as="h1" className="text-[clamp(40px,9vw,60px)] leading-none font-semibold tracking-[-0.035em]">
          FPL Predictions
        </RevealHeading>
        <p className="max-w-[640px] text-lg leading-relaxed text-pretty text-ink-2">
          Model-predicted points for every player in your Draft league, and the starting XI that scores the most.
        </p>
        <form
          className="mt-3 flex flex-wrap items-end gap-3"
          onSubmit={e => { e.preventDefault(); handleLeagueIdSubmit() }}
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium">League ID</span>
            <Input
              type="text"
              inputMode="numeric"
              value={leagueIdInput}
              onChange={e => setLeagueIdInput(e.target.value)}
              className="w-[140px] font-mono"
            />
          </label>
          <Button type="submit">Load league</Button>
          <label className="flex min-w-[min(100%,240px)] flex-col gap-1.5">
            <span className="text-[13px] font-medium">My team</span>
            <NativeSelect
              value={selectedTeamId ?? ''}
              onChange={e => setSelectedTeamId(e.target.value ? Number(e.target.value) : null)}
              disabled={!league}
            >
              <option value="">Select a team…</option>
              {league?.teams.map(t => (
                <option key={t.team_id} value={t.team_id}>
                  {t.name}
                </option>
              ))}
            </NativeSelect>
          </label>
        </form>
        {leagueLoading && <p className="text-sm text-ink-3">Loading league…</p>}
        {leagueError && (
          <p role="alert" className="text-[13px] text-neg">
            Couldn&apos;t load league {leagueId}: {leagueError}. Check the ID and try again.
          </p>
        )}
      </section>

      <div className="flex flex-col gap-20">
        {selectedTeamId === null ? (
          league && (
            <p className="rounded-2xl border border-dashed border-line-strong px-6 py-8 text-center text-sm text-ink-3">
              Pick your team above to see your starting XI and this gameweek&apos;s opponent.
            </p>
          )
        ) : (
          <>
            <section className="flex flex-col gap-3">
              <MetricGroup className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-3">
                <StatCard
                  label="Your XI"
                  dot="bg-accent"
                  name={myName}
                  value={myTeam?.total_adjusted_xpts ?? null}
                  foot={myTeam && `${formation(myTeam)} · roster as of GW ${myTeam.gw_used}`}
                />
                {opponentTeamId !== null && (
                  <StatCard
                    label={`Opponent${gw ? ` · GW ${gw}` : ''}`}
                    dot="bg-series-muted"
                    name={opponentName ?? ''}
                    value={opponentTeam?.total_adjusted_xpts ?? null}
                    foot={opponentTeam && `${formation(opponentTeam)} · roster as of GW ${opponentTeam.gw_used}`}
                  />
                )}
                {myTeam?.total_adjusted_xpts != null && opponentTeam?.total_adjusted_xpts != null && (
                  <EdgeCard mine={myTeam.total_adjusted_xpts} theirs={opponentTeam.total_adjusted_xpts} opponentName={opponentName ?? 'Your opponent'} />
                )}
              </MetricGroup>
              {myTeam && (
                <p className="max-w-[760px] text-[13px] leading-normal text-ink-3">
                  Rosters come from the last completed gameweek (GW {myTeam.gw_used}). A trade or waiver made since then
                  shows up here once GW {myTeam.gw_used + 1} is finished.
                </p>
              )}
            </section>

            <RevealSection>
              <SectionHeading
                title="Starting XI"
                caption="The best-scoring valid formation from each 15-man roster. A warning dot means the player is under 100% to play and his points are discounted by that chance."
              />
              <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,440px),1fr))] gap-4">
                <Pitch title={myName} mine data={myTeam} loading={myTeamLoading} error={myTeamError} />
                {opponentTeamId !== null && (
                  <Pitch
                    title={`vs ${opponentName ?? ''}`}
                    mine={false}
                    data={opponentTeam}
                    loading={opponentTeamLoading}
                    error={opponentTeamError}
                  />
                )}
              </div>
            </RevealSection>
          </>
        )}

        <RevealSection>
          <PlayersTable
            players={playersData?.players ?? []}
            predictionsAvailable={playersData?.predictions_available ?? false}
            loading={playersLoading}
            error={playersError}
            gameweek={gw}
            myCodes={myCodes}
            opponentCodes={opponentCodes}
          />
        </RevealSection>
      </div>
    </div>
  )
}

const rosterCodes = (t: TeamRosterResponse | null) =>
  new Set([...(t?.starting_xi ?? []), ...(t?.bench ?? [])].map(p => p.code))

function formation(t: TeamRosterResponse) {
  const n = (pos: string) => t.starting_xi.filter(p => p.position === pos).length
  return `${n('DEF')}-${n('MID')}-${n('FWD')}`
}

const cardClass = 'flex min-w-0 flex-col gap-2 rounded-2xl border border-line bg-surface px-[22px] pt-[22px] pb-5'
const labelClass = 'flex items-center gap-2 font-mono text-[11px] tracking-[0.08em] text-ink-3 uppercase'

function Value({ v, className }: { v: string; className?: string }) {
  return (
    <span className={cn('font-mono text-[32px] leading-[1.1] font-medium tracking-[-0.02em]', className)}>
      {v}
      <span className="ml-1.5 text-[13px] text-ink-3">xPts</span>
    </span>
  )
}

function StatCard({ label, dot, name, value, foot }: { label: string; dot: string; name: string; value: number | null; foot: string | null }) {
  return (
    <motion.div {...quietItemProps} className={cardClass}>
      <span className={labelClass}>
        <span className={cn('size-2 rounded-full', dot)} />
        {label}
      </span>
      <span className="truncate font-display text-xl font-semibold tracking-[-0.01em]">{name}</span>
      <Value v={value !== null ? value.toFixed(1) : '–'} />
      <span className="text-xs text-ink-3">{foot ?? 'Loading roster…'}</span>
    </motion.div>
  )
}

function EdgeCard({ mine, theirs, opponentName }: { mine: number; theirs: number; opponentName: string }) {
  const diff = mine - theirs
  const level = Math.abs(diff) < 0.05
  return (
    <motion.div {...quietItemProps} className={cardClass}>
      <span className={labelClass}>Projected edge</span>
      <span className="truncate font-display text-xl font-semibold tracking-[-0.01em]">
        {level ? 'Too close to call' : diff > 0 ? 'You are favoured' : `${opponentName} is favoured`}
      </span>
      <Value
        v={`${diff >= 0 ? '+' : '−'}${Math.abs(diff).toFixed(1)}`}
        className={level ? 'text-ink' : diff > 0 ? 'text-pos' : 'text-neg'}
      />
      <span aria-hidden="true" className="mt-1 flex h-1.5 overflow-hidden rounded-[3px] bg-surface-3">
        <span className="block h-full bg-accent" style={{ width: `${(mine / (mine + theirs || 1)) * 100}%` }} />
      </span>
    </motion.div>
  )
}
