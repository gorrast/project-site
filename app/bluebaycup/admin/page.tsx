'use client'

import { useState, useEffect, useCallback, useId } from 'react'
import { Pencil } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect as Select } from '@/components/ui/native-select'
import { Segmented } from '@/components/ui/segmented'
import { LoginCard } from '@/components/LoginCard'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'seasons' | 'gameweek'

interface Player { player_id: number; name: string }
interface SeasonRow { season_id: number; year: string; prize_pool: number; high_score_prize: number | null; league_api_id: number | null }
interface TeamRow { team_id: number; team_name: string; player_id: number; player_name: string; api_entry_id: number | null; draft_pick: number | null }
interface ParticipantRow { playerId: number | null; teamName: string; apiEntryId: string; draftPick: string }
interface FplEntry { entryId: number; teamName: string; draftPick: number | null }
interface PairSlot { teamAId: number | null; teamBId: number | null; teamAScore: string; teamBScore: string; isBye: boolean }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const labelClass = 'text-[13px] font-medium text-ink-2'

function Field({ label, error, ...props }: React.ComponentProps<'input'> & { label: string; error?: string }) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={labelClass}>{label}</label>
      <Input id={id} aria-invalid={error ? true : undefined} {...props} />
      {error && <span className="text-[13px] text-neg">{error}</span>}
    </div>
  )
}

function SelectField({ label, ...props }: React.ComponentProps<typeof Select> & { label: string }) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={labelClass}>{label}</label>
      <Select id={id} {...props} />
    </div>
  )
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-2xl border border-line bg-surface p-[clamp(16px,4vw,24px)]', className)}>
      {children}
    </div>
  )
}

const statusText = { error: 'text-neg', success: 'text-pos', info: 'text-ink-2' }

function StatusMsg({ msg, type }: { msg: string; type: 'error' | 'success' | 'info' }) {
  const wash = {
    error: 'bg-[color-mix(in_srgb,var(--neg)_12%,transparent)]',
    success: 'bg-[color-mix(in_srgb,var(--pos)_12%,transparent)]',
    info: 'bg-surface-2',
  }
  return <div role={type === 'error' ? 'alert' : 'status'} className={cn('rounded-[10px] px-3.5 py-3 text-[13px]', wash[type], statusText[type])}>{msg}</div>
}

function InlineStatus({ msg, type }: { msg: string; type: 'error' | 'success' }) {
  return <span role="status" className={cn('text-xs', statusText[type])}>{msg}</span>
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" size="sm" onClick={onClick} className="-ml-3.5 self-start">
      ← Back to seasons
    </Button>
  )
}

const muted = <p className="text-sm text-ink-3">Loading…</p>

// ─── Seasons Tab ──────────────────────────────────────────────────────────────

function SeasonsTab() {
  const [view, setView] = useState<'list' | 'add' | 'teams'>('list')
  const [players, setPlayers] = useState<Player[]>([])
  const [seasons, setSeasons] = useState<SeasonRow[]>([])
  const [loading, setLoading] = useState(true)

  // Inline edit state
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editValues, setEditValues] = useState({ year: '', prizePool: '', highScorePrize: '', leagueApiId: '' })
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [editStatus, setEditStatus] = useState<{ msg: string; type: 'error' | 'success' } | null>(null)
  const [editLoading, setEditLoading] = useState(false)

  // New season form state
  const [newYear, setNewYear] = useState('')
  const [newPrizePool, setNewPrizePool] = useState('')
  const [newHighScorePrize, setNewHighScorePrize] = useState('')
  const [newLeagueApiId, setNewLeagueApiId] = useState('')
  const [participantCount, setParticipantCount] = useState<number | null>(null)
  const [participantRows, setParticipantRows] = useState<ParticipantRow[]>([])
  const [addingPlayer, setAddingPlayer] = useState(false)
  const [newPlayerName, setNewPlayerName] = useState('')
  const [addPlayerError, setAddPlayerError] = useState('')
  const [createStatus, setCreateStatus] = useState<{ msg: string; type: 'error' | 'success' } | null>(null)
  const [createLoading, setCreateLoading] = useState(false)

  // FPL entry ID lookup, keyed off newLeagueApiId
  const [fplEntries, setFplEntries] = useState<FplEntry[] | null>(null)
  const [fplFetchLoading, setFplFetchLoading] = useState(false)
  const [fplFetchError, setFplFetchError] = useState('')
  const [fplDraftPickAvailable, setFplDraftPickAvailable] = useState(true)

  // Manage teams (api_entry_id / draft_pick) state
  const [teamsSeasonId, setTeamsSeasonId] = useState<number | null>(null)
  const [seasonTeams, setSeasonTeams] = useState<TeamRow[]>([])
  const [teamsLoading, setTeamsLoading] = useState(false)
  const [teamEditValues, setTeamEditValues] = useState<Record<number, { apiEntryId: string; draftPick: string }>>({})
  const [teamStatus, setTeamStatus] = useState<Record<number, { msg: string; type: 'error' | 'success' }>>({})
  const [teamSaving, setTeamSaving] = useState<number | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [pr, sr] = await Promise.all([
      fetch('/api/bluebaycup/admin/players'),
      fetch('/api/bluebaycup/admin/season'),
    ])
    if (pr.ok) setPlayers((await pr.json()).players ?? [])
    if (sr.ok) setSeasons((await sr.json()).seasons ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const handleCountChange = (count: number) => {
    if (!count) {
      setParticipantCount(null)
      setParticipantRows([])
      return
    }
    setParticipantCount(count)
    setParticipantRows(prev => {
      if (count > prev.length) {
        return [...prev, ...Array.from({ length: count - prev.length }, () => ({ playerId: null as number | null, teamName: '', apiEntryId: '', draftPick: '' }))]
      }
      return prev.slice(0, count)
    })
  }

  // Case-insensitive, trimmed match against the fetched FPL entries by team name.
  const matchFplEntry = (teamName: string, entries: FplEntry[] | null) => {
    const needle = teamName.trim().toLowerCase()
    if (!needle || !entries) return null
    return entries.find(e => e.teamName.trim().toLowerCase() === needle) ?? null
  }

  // Fills apiEntryId/draftPick from a matched FPL entry, without clobbering values already typed in.
  const withFplAutoFill = (row: ParticipantRow, entries: FplEntry[] | null): ParticipantRow => {
    const match = matchFplEntry(row.teamName, entries)
    if (!match) return row
    return {
      ...row,
      apiEntryId: row.apiEntryId.trim() ? row.apiEntryId : String(match.entryId),
      draftPick: !row.draftPick.trim() && match.draftPick != null ? String(match.draftPick) : row.draftPick,
    }
  }

  const updateRow = (i: number, patch: Partial<ParticipantRow>) =>
    setParticipantRows(prev => prev.map((r, idx) => {
      if (idx !== i) return r
      const merged = { ...r, ...patch }
      return patch.teamName !== undefined ? withFplAutoFill(merged, fplEntries) : merged
    }))

  const startEdit = (s: SeasonRow) => {
    setEditingId(s.season_id)
    setEditValues({
      year: s.year,
      prizePool: String(s.prize_pool),
      highScorePrize: String(s.high_score_prize ?? 0),
      leagueApiId: String(s.league_api_id ?? ''),
    })
    setConfirmDeleteId(null)
    setEditStatus(null)
  }

  const cancelEdit = () => { setEditingId(null); setConfirmDeleteId(null); setEditStatus(null) }

  const saveEdit = async () => {
    if (!editingId) return
    setEditLoading(true)
    const res = await fetch(`/api/bluebaycup/admin/season/${editingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        year: editValues.year,
        prizePool: Number(editValues.prizePool),
        highScorePrize: Number(editValues.highScorePrize || 0),
        league_api_id: Number(editValues.leagueApiId),
      }),
    })
    setEditLoading(false)
    if (res.ok) {
      setEditStatus({ msg: 'Saved', type: 'success' })
      await fetchAll()
      setTimeout(() => { setEditingId(null); setEditStatus(null) }, 1000)
    } else {
      const d = await res.json()
      setEditStatus({ msg: d.error ?? 'Failed to save', type: 'error' })
    }
  }

  const deleteSeason = async (id: number) => {
    setEditLoading(true)
    const res = await fetch(`/api/bluebaycup/admin/season/${id}`, { method: 'DELETE' })
    setEditLoading(false)
    if (res.ok) { setEditingId(null); setConfirmDeleteId(null); await fetchAll() }
    else { const d = await res.json(); setEditStatus({ msg: d.error ?? 'Delete failed', type: 'error' }) }
  }

  const handleAddPlayer = async () => {
    if (!newPlayerName.trim()) return
    const res = await fetch('/api/bluebaycup/admin/players', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newPlayerName.trim() }),
    })
    if (res.ok) {
      const { player } = await res.json()
      setPlayers(prev => [...prev, player].sort((a, b) => a.name.localeCompare(b.name)))
      setNewPlayerName('')
      setAddingPlayer(false)
      setAddPlayerError('')
    } else {
      setAddPlayerError('Failed to add player')
    }
  }

  const handleFetchFplEntries = async () => {
    if (!newLeagueApiId.trim()) return
    setFplFetchLoading(true)
    setFplFetchError('')
    setFplEntries(null)
    setFplDraftPickAvailable(true)
    try {
      const res = await fetch(`/api/bluebaycup/admin/fpl-league-entries?leagueId=${encodeURIComponent(newLeagueApiId.trim())}`)
      const d = await res.json()
      if (res.ok) {
        const entries: FplEntry[] = d.entries ?? []
        setFplEntries(entries)
        setFplDraftPickAvailable(Boolean(d.draftPickAvailable))
        setParticipantRows(prev => prev.map(r => withFplAutoFill(r, entries)))
      } else {
        setFplFetchError(d.error ?? 'Failed to fetch entry IDs')
      }
    } catch {
      setFplFetchError('Network error')
    } finally {
      setFplFetchLoading(false)
    }
  }

  const handleCreateSeason = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newLeagueApiId.trim()) { setCreateStatus({ msg: 'League API ID is required', type: 'error' }); return }
    if (!participantCount || participantRows.length === 0) { setCreateStatus({ msg: 'Select the number of participants', type: 'error' }); return }
    for (const r of participantRows) {
      if (!r.playerId) { setCreateStatus({ msg: 'Select a player for each row', type: 'error' }); return }
      if (!r.teamName.trim()) { setCreateStatus({ msg: 'Enter a team name for each participant', type: 'error' }); return }
      if (!r.apiEntryId.trim()) { setCreateStatus({ msg: 'Enter an API entry ID for each participant', type: 'error' }); return }
      if (!r.draftPick.trim()) { setCreateStatus({ msg: 'Enter a draft pick for each participant', type: 'error' }); return }
    }
    setCreateLoading(true)
    setCreateStatus(null)
    const res = await fetch('/api/bluebaycup/admin/season', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        year: newYear,
        prizePool: Number(newPrizePool),
        highScorePrize: Number(newHighScorePrize || 0),
        league_api_id: Number(newLeagueApiId),
        participants: participantRows.map(r => ({
          type: 'existing',
          playerId: r.playerId,
          teamName: r.teamName.trim(),
          apiEntryId: Number(r.apiEntryId),
          draftPick: Number(r.draftPick),
        })),
      }),
    })
    const d = await res.json()
    setCreateLoading(false)
    if (res.ok) {
      setCreateStatus({ msg: `Season created (ID: ${d.seasonId})`, type: 'success' })
      setNewYear(''); setNewPrizePool(''); setNewHighScorePrize(''); setNewLeagueApiId('')
      setParticipantCount(null)
      setParticipantRows([])
      setFplEntries(null); setFplFetchError(''); setFplDraftPickAvailable(true)
      await fetchAll()
      setTimeout(() => { setView('list'); setCreateStatus(null) }, 1200)
    } else {
      setCreateStatus({ msg: d.error ?? 'Failed to create season', type: 'error' })
    }
  }

  const openTeamsView = async (seasonId: number) => {
    setTeamsSeasonId(seasonId)
    setView('teams')
    setTeamsLoading(true)
    setTeamStatus({})
    const res = await fetch(`/api/bluebaycup/admin/season/${seasonId}`)
    if (res.ok) {
      const d = await res.json()
      const teams: TeamRow[] = d.teams ?? []
      setSeasonTeams(teams)
      setTeamEditValues(Object.fromEntries(teams.map(t => [
        t.team_id,
        { apiEntryId: String(t.api_entry_id ?? ''), draftPick: String(t.draft_pick ?? '') },
      ])))
    } else {
      setSeasonTeams([])
    }
    setTeamsLoading(false)
  }

  const saveTeamRow = async (teamId: number) => {
    const value = teamEditValues[teamId]
    if (!value?.apiEntryId.trim()) {
      setTeamStatus(prev => ({ ...prev, [teamId]: { msg: 'Enter an API entry ID', type: 'error' } }))
      return
    }
    if (!value?.draftPick.trim()) {
      setTeamStatus(prev => ({ ...prev, [teamId]: { msg: 'Enter a draft pick', type: 'error' } }))
      return
    }
    setTeamSaving(teamId)
    const res = await fetch(`/api/bluebaycup/admin/teams/${teamId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_entry_id: Number(value.apiEntryId), draft_pick: Number(value.draftPick) }),
    })
    setTeamSaving(null)
    if (res.ok) {
      setTeamStatus(prev => ({ ...prev, [teamId]: { msg: 'Saved', type: 'success' } }))
      setSeasonTeams(prev => prev.map(t => t.team_id === teamId
        ? { ...t, api_entry_id: Number(value.apiEntryId), draft_pick: Number(value.draftPick) }
        : t))
    } else {
      const d = await res.json()
      setTeamStatus(prev => ({ ...prev, [teamId]: { msg: d.error ?? 'Failed to save', type: 'error' } }))
    }
  }

  if (loading) return muted

  // ── Add Season form ──
  if (view === 'add') {
    return (
      <div className="flex flex-col gap-6">
        <BackLink onClick={() => setView('list')} />

        <form onSubmit={handleCreateSeason} className="flex flex-col gap-6">
          <h2 className="text-xl font-semibold tracking-[-0.01em]">New season</h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Season year" value={newYear} onChange={e => setNewYear(e.target.value)} required placeholder="2025/2026" />
            <Field label="Prize pool (kr)" type="number" min={0} value={newPrizePool} onChange={e => setNewPrizePool(e.target.value)} required placeholder="1000" />
            <Field label="High score prize (kr)" type="number" min={0} value={newHighScorePrize} onChange={e => setNewHighScorePrize(e.target.value)} placeholder="100" />
            <Field label="League API ID" type="number" min={0} value={newLeagueApiId} onChange={e => { setNewLeagueApiId(e.target.value); setFplEntries(null); setFplFetchError('') }} required placeholder="314159" />
          </div>

          <div className="flex flex-col gap-3">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleFetchFplEntries}
              disabled={!newLeagueApiId.trim() || fplFetchLoading}
              className="self-start"
            >
              {fplFetchLoading ? 'Fetching…' : 'Fetch entry IDs'}
            </Button>

            {fplFetchError && <StatusMsg msg={fplFetchError} type="error" />}

            {fplEntries && fplEntries.length > 0 && !fplDraftPickAvailable && (
              <StatusMsg msg="Draft picks aren't available yet for this league (the draft hasn't completed). Enter them by hand." type="info" />
            )}

            {fplEntries && (
              fplEntries.length === 0 ? (
                <p className="text-sm text-ink-3">No entries found for this league.</p>
              ) : (
                <div className="rounded-xl border border-line">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="pl-4">Team name</TableHead>
                        <TableHead>Entry ID</TableHead>
                        <TableHead className="pr-4">Draft pick</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fplEntries.map(entry => (
                        <TableRow key={entry.entryId}>
                          <TableCell className="pl-4 text-ink">{entry.teamName}</TableCell>
                          <TableCell className="font-mono text-ink-2">{entry.entryId}</TableCell>
                          <TableCell className="pr-4 font-mono text-ink-2">{entry.draftPick ?? '–'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )
            )}
          </div>

          <SelectField
            label="Number of participants"
            value={participantCount ?? ''}
            onChange={e => handleCountChange(Number(e.target.value))}
            className="max-w-[180px]"
            required
          >
            <option value="">Select…</option>
            {Array.from({ length: 9 }, (_, i) => i + 6).map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </SelectField>

          {participantRows.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="hidden grid-cols-4 gap-3 pb-1 font-mono text-[11px] tracking-[0.06em] text-ink-3 uppercase sm:grid">
              <span>Player</span>
              <span>Team name</span>
              <span>API entry ID</span>
              <span>Draft pick</span>
            </div>
            {participantRows.map((row, i) => (
              <div key={i} className="grid grid-cols-2 gap-2 border-t border-line pt-2 first-of-type:border-0 sm:grid-cols-4 sm:gap-3 sm:border-0 sm:pt-0">
                <Select
                  aria-label={`Player ${i + 1}`}
                  value={row.playerId ?? ''}
                  onChange={e => updateRow(i, { playerId: Number(e.target.value) || null })}
                  required
                >
                  <option value="">Select player…</option>
                  {players.map(p => <option key={p.player_id} value={p.player_id}>{p.name}</option>)}
                </Select>
                <Input
                  aria-label={`Team name ${i + 1}`}
                  value={row.teamName}
                  onChange={e => updateRow(i, { teamName: e.target.value })}
                  placeholder="Team name"
                  required
                />
                <Input
                  aria-label={`API entry ID ${i + 1}`}
                  type="number"
                  min={0}
                  value={row.apiEntryId}
                  onChange={e => updateRow(i, { apiEntryId: e.target.value })}
                  placeholder="API entry ID"
                  required
                />
                <Input
                  aria-label={`Draft pick ${i + 1}`}
                  type="number"
                  min={1}
                  value={row.draftPick}
                  onChange={e => updateRow(i, { draftPick: e.target.value })}
                  placeholder="Draft pick"
                  required
                />
              </div>
            ))}
          </div>
          )}

          {/* Add Player */}
          <div>
            {!addingPlayer ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setAddingPlayer(true)} className="-ml-3.5">
                + Add player
              </Button>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  aria-label="New player name"
                  value={newPlayerName}
                  onChange={e => { setNewPlayerName(e.target.value); setAddPlayerError('') }}
                  placeholder="Player name"
                  className="w-48"
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddPlayer() } }}
                  autoFocus
                />
                <Button type="button" variant="secondary" size="sm" onClick={handleAddPlayer}>Add</Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => { setAddingPlayer(false); setNewPlayerName(''); setAddPlayerError('') }}>Cancel</Button>
                {addPlayerError && <InlineStatus msg={addPlayerError} type="error" />}
              </div>
            )}
          </div>

          {createStatus && <StatusMsg {...createStatus} />}

          <div className="flex gap-3">
            <Button type="submit" disabled={createLoading}>
              {createLoading ? 'Creating…' : 'Create season'}
            </Button>
            <Button type="button" variant="outline" onClick={() => setView('list')}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    )
  }

  // ── Manage team API entry IDs ──
  if (view === 'teams') {
    const season = seasons.find(s => s.season_id === teamsSeasonId)
    return (
      <div className="flex flex-col gap-6">
        <BackLink onClick={() => setView('list')} />

        <h2 className="text-xl font-semibold tracking-[-0.01em]">
          Entry IDs and draft picks{season ? `, ${season.year}` : ''}
        </h2>

        {teamsLoading ? (
          muted
        ) : seasonTeams.length === 0 ? (
          <p className="text-sm text-ink-3">No teams found for this season.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Player</TableHead>
                <TableHead>Team</TableHead>
                <TableHead>API entry ID</TableHead>
                <TableHead>Draft pick</TableHead>
                <TableHead><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {seasonTeams.map(team => (
                <TableRow key={team.team_id}>
                  <TableCell className="text-ink">{team.player_name}</TableCell>
                  <TableCell className="text-ink-2">{team.team_name}</TableCell>
                  <TableCell>
                    <Input
                      aria-label={`API entry ID for ${team.player_name}`}
                      type="number"
                      min={0}
                      value={teamEditValues[team.team_id]?.apiEntryId ?? ''}
                      onChange={e => setTeamEditValues(prev => ({
                        ...prev,
                        [team.team_id]: { ...prev[team.team_id], apiEntryId: e.target.value, draftPick: prev[team.team_id]?.draftPick ?? '' },
                      }))}
                      placeholder="12345"
                      className="h-8 w-32"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      aria-label={`Draft pick for ${team.player_name}`}
                      type="number"
                      min={1}
                      value={teamEditValues[team.team_id]?.draftPick ?? ''}
                      onChange={e => setTeamEditValues(prev => ({
                        ...prev,
                        [team.team_id]: { ...prev[team.team_id], draftPick: e.target.value, apiEntryId: prev[team.team_id]?.apiEntryId ?? '' },
                      }))}
                      placeholder="3"
                      className="h-8 w-20"
                    />
                  </TableCell>
                  <TableCell className="sticky right-0 bg-surface [tr:hover>&]:bg-surface-2">
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => saveTeamRow(team.team_id)}
                        disabled={teamSaving === team.team_id}
                      >
                        {teamSaving === team.team_id ? 'Saving…' : 'Save'}
                      </Button>
                      {teamStatus[team.team_id] && <InlineStatus {...teamStatus[team.team_id]} />}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    )
  }

  // ── Seasons list ──
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold tracking-[-0.01em]">Seasons</h2>
        <Button size="sm" onClick={() => setView('add')}>
          + Add season
        </Button>
      </div>

      {seasons.length === 0 ? (
        <p className="text-sm text-ink-3">No seasons yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Season</TableHead>
              <TableHead>Prize pool</TableHead>
              <TableHead>High score prize</TableHead>
              <TableHead>League API ID</TableHead>
              <TableHead><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {seasons.map(season =>
              editingId === season.season_id ? (
                <TableRow key={season.season_id} data-state="selected">
                  <TableCell>
                    <Input aria-label="Season year" value={editValues.year} onChange={e => setEditValues(v => ({ ...v, year: e.target.value }))} className="h-8 w-28" />
                  </TableCell>
                  <TableCell>
                    <Input aria-label="Prize pool" type="number" min={0} value={editValues.prizePool} onChange={e => setEditValues(v => ({ ...v, prizePool: e.target.value }))} className="h-8 w-24" />
                  </TableCell>
                  <TableCell>
                    <Input aria-label="High score prize" type="number" min={0} value={editValues.highScorePrize} onChange={e => setEditValues(v => ({ ...v, highScorePrize: e.target.value }))} className="h-8 w-24" />
                  </TableCell>
                  <TableCell>
                    <Input aria-label="League API ID" type="number" min={0} value={editValues.leagueApiId} onChange={e => setEditValues(v => ({ ...v, leagueApiId: e.target.value }))} className="h-8 w-28" />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button size="sm" onClick={saveEdit} disabled={editLoading}>Save</Button>
                      <Button size="sm" variant="ghost" onClick={cancelEdit}>Cancel</Button>
                      {confirmDeleteId !== season.season_id ? (
                        <Button size="sm" variant="ghost" onClick={() => setConfirmDeleteId(season.season_id)} className="text-neg hover:text-neg">Delete</Button>
                      ) : (
                        <>
                          <span className="text-xs text-ink-2">Delete &quot;{season.year}&quot;?</span>
                          <Button size="sm" variant="outline" onClick={() => deleteSeason(season.season_id)} disabled={editLoading} className="border-neg text-neg hover:text-neg">Yes, delete</Button>
                          <Button size="sm" variant="ghost" onClick={() => setConfirmDeleteId(null)}>No, keep</Button>
                        </>
                      )}
                      {editStatus && <InlineStatus {...editStatus} />}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                <TableRow key={season.season_id}>
                  <TableCell className="text-ink">{season.year}</TableCell>
                  <TableCell className="font-mono text-ink-2">{season.prize_pool} kr</TableCell>
                  <TableCell className="font-mono text-ink-2">{season.high_score_prize ?? 0} kr</TableCell>
                  <TableCell className="font-mono text-ink-2">{season.league_api_id ?? '–'}</TableCell>
                  {/* Pinned so the actions stay in view when the table scrolls sideways on phones. */}
                  <TableCell className="sticky right-0 bg-surface [tr:hover>&]:bg-surface-2">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="outline" onClick={() => openTeamsView(season.season_id)} title="Manage team API entry IDs">
                        Teams
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => startEdit(season)} aria-label={`Edit ${season.year}`}>
                        <Pencil />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            )}
          </TableBody>
        </Table>
      )}
    </div>
  )
}

// ─── Gameweek Tab ─────────────────────────────────────────────────────────────

function emptySlots(teamCount: number): PairSlot[] {
  const slotCount = Math.ceil(teamCount / 2)
  return Array.from({ length: slotCount }, () => ({ teamAId: null, teamBId: null, teamAScore: '', teamBScore: '', isBye: false }))
}

function GameweekTab() {
  const [seasons, setSeasons] = useState<SeasonRow[]>([])
  const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null)
  const [gameweek, setGameweek] = useState('')
  const [gameweekError, setGameweekError] = useState('')
  const [allTeams, setAllTeams] = useState<TeamRow[]>([])
  const [slots, setSlots] = useState<PairSlot[]>([])
  const [loadingTeams, setLoadingTeams] = useState(false)
  const [status, setStatus] = useState<{ msg: string; type: 'error' | 'success' | 'info' } | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/bluebaycup/admin/season')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setSeasons(d.seasons ?? []) })
  }, [])

  const loadTeams = useCallback(async (id: number) => {
    setLoadingTeams(true)
    setAllTeams([])
    setSlots([])
    const res = await fetch(`/api/bluebaycup/admin/season/${id}`)
    if (res.ok) {
      const d = await res.json()
      const teams: TeamRow[] = d.teams ?? []
      setAllTeams(teams)
      setSlots(emptySlots(teams.length))
    } else {
      setStatus({ msg: 'Failed to load teams', type: 'error' })
    }
    setLoadingTeams(false)
  }, [])

  useEffect(() => { if (selectedSeasonId) loadTeams(selectedSeasonId) }, [selectedSeasonId, loadTeams])

  const updateSlot = (index: number, patch: Partial<PairSlot>) =>
    setSlots(prev => prev.map((s, i) => i === index ? { ...s, ...patch } : s))

  const toggleBye = (index: number, isBye: boolean) =>
    setSlots(prev => prev.map((s, i) => i === index ? { ...s, isBye, teamBId: isBye ? null : s.teamBId, teamBScore: isBye ? '' : s.teamBScore } : s))

  // Teams unavailable for a given slot/side: used by any OTHER slot, or by
  // the other side of this same slot (can't play yourself).
  const unavailableTeamIds = (slotIndex: number, side: 'A' | 'B'): Set<number> => {
    const used = new Set<number>()
    slots.forEach((s, i) => {
      if (i === slotIndex) {
        if (side === 'A' && s.teamBId != null) used.add(s.teamBId)
        if (side === 'B' && s.teamAId != null) used.add(s.teamAId)
        return
      }
      if (s.teamAId != null) used.add(s.teamAId)
      if (s.teamBId != null) used.add(s.teamBId)
    })
    return used
  }

  const teamLabel = (teamId: number | null) => {
    const t = allTeams.find(t => t.team_id === teamId)
    return t ? `${t.player_name} (${t.team_name})` : ''
  }

  const validateGameweek = (val: string): boolean => {
    const n = Number(val)
    if (val === '' || !Number.isInteger(n) || n < 0 || n > 38) {
      setGameweekError('Must be a whole number between 0 and 38')
      return false
    }
    setGameweekError('')
    return true
  }

  const validateSlots = (): string | null => {
    const expectedByes = allTeams.length % 2 === 1 ? 1 : 0
    const byeCount = slots.filter(s => s.isBye).length
    if (byeCount !== expectedByes) {
      return `Expected ${expectedByes} bye${expectedByes === 1 ? '' : 's'} for ${allTeams.length} teams, got ${byeCount}`
    }
    const assigned: number[] = []
    for (const s of slots) {
      if (s.teamAId == null) return 'Every match needs a team selected'
      assigned.push(s.teamAId)
      if (!s.isBye) {
        if (s.teamBId == null) return 'Every non-bye match needs two teams selected'
        assigned.push(s.teamBId)
        if (s.teamAScore.trim() === '' || s.teamBScore.trim() === '') return 'Every non-bye match needs both scores'
      } else if (s.teamAScore.trim() === '') {
        return 'Bye teams still need their FPL score entered'
      }
    }
    if (new Set(assigned).size !== assigned.length) return 'A team is assigned to more than one match'
    if (assigned.length !== allTeams.length) return 'Every team must be assigned to exactly one match'
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSeasonId) return
    if (!validateGameweek(gameweek)) return
    const slotsError = validateSlots()
    if (slotsError) { setStatus({ msg: slotsError, type: 'error' }); return }

    setLoading(true)
    setStatus(null)
    try {
      const res = await fetch('/api/bluebaycup/admin/gameweek', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seasonId: selectedSeasonId,
          gameweek: Number(gameweek),
          matches: slots.map(s => ({
            teamAId: s.teamAId,
            teamBId: s.isBye ? null : s.teamBId,
            teamAScore: Number(s.teamAScore),
            teamBScore: s.isBye ? null : Number(s.teamBScore),
          })),
        }),
      })
      const d = await res.json()
      if (res.ok) {
        setStatus({ msg: `Gameweek ${gameweek} submitted`, type: 'success' })
        setGameweek('')
        setSlots(emptySlots(allTeams.length))
      } else {
        setStatus({ msg: d.error ?? 'Failed to submit', type: 'error' })
      }
    } catch { setStatus({ msg: 'Network error', type: 'error' }) }
    finally { setLoading(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SelectField
          label="Season"
          value={selectedSeasonId ?? ''}
          onChange={e => { setSelectedSeasonId(Number(e.target.value) || null); setStatus(null) }}
          required
        >
          <option value="">Select season…</option>
          {seasons.map(s => <option key={s.season_id} value={s.season_id}>{s.year}</option>)}
        </SelectField>

        <Field
          label="Gameweek (0–38)"
          type="number"
          min={0}
          max={38}
          step={1}
          value={gameweek}
          onChange={e => { setGameweek(e.target.value); if (gameweekError) validateGameweek(e.target.value) }}
          onBlur={e => { if (e.target.value) validateGameweek(e.target.value) }}
          error={gameweekError}
          required
          placeholder="12"
        />
      </div>

      {loadingTeams && <p className="text-sm text-ink-3">Loading teams…</p>}

      {slots.length > 0 && (
        <div className="flex flex-col gap-3">
          {slots.map((slot, i) => {
            const availableA = allTeams.filter(t => !unavailableTeamIds(i, 'A').has(t.team_id))
            const availableB = allTeams.filter(t => !unavailableTeamIds(i, 'B').has(t.team_id))
            const scoreA = Number(slot.teamAScore)
            const scoreB = Number(slot.teamBScore)
            const resultLabel = slot.isBye
              ? 'Bye'
              : slot.teamAScore.trim() === '' || slot.teamBScore.trim() === ''
                ? ''
                : scoreA === scoreB
                  ? 'Draw'
                  : scoreA > scoreB
                    ? `${teamLabel(slot.teamAId)} wins`
                    : `${teamLabel(slot.teamBId)} wins`

            return (
              <div key={i} className="flex flex-col gap-3 rounded-xl border border-line bg-surface-2 p-3.5">
                <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[1fr_auto_1fr]">
                  <div className="flex gap-2">
                    <Select
                      aria-label={`Match ${i + 1}, team A`}
                      value={slot.teamAId ?? ''}
                      onChange={e => updateSlot(i, { teamAId: Number(e.target.value) || null })}
                      className="flex-1"
                      required
                    >
                      <option value="">Team…</option>
                      {availableA.map(t => <option key={t.team_id} value={t.team_id}>{t.player_name} ({t.team_name})</option>)}
                    </Select>
                    <Input
                      aria-label={`Match ${i + 1}, team A points`}
                      type="number" min={0}
                      value={slot.teamAScore}
                      onChange={e => updateSlot(i, { teamAScore: e.target.value })}
                      placeholder="pts"
                      className="w-20 font-mono"
                      required
                    />
                  </div>

                  <span className="text-center font-mono text-[11px] tracking-[0.06em] text-ink-3 uppercase">vs</span>

                  <div className="flex gap-2">
                    {slot.isBye ? (
                      <span className="flex h-10 flex-1 items-center px-3.5 text-sm text-ink-3">No opponent</span>
                    ) : (
                      <>
                        <Select
                          aria-label={`Match ${i + 1}, team B`}
                          value={slot.teamBId ?? ''}
                          onChange={e => updateSlot(i, { teamBId: Number(e.target.value) || null })}
                          className="flex-1"
                          required
                        >
                          <option value="">Team…</option>
                          {availableB.map(t => <option key={t.team_id} value={t.team_id}>{t.player_name} ({t.team_name})</option>)}
                        </Select>
                        <Input
                          aria-label={`Match ${i + 1}, team B points`}
                          type="number" min={0}
                          value={slot.teamBScore}
                          onChange={e => updateSlot(i, { teamBScore: e.target.value })}
                          placeholder="pts"
                          className="w-20 font-mono"
                          required
                        />
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <label className="flex cursor-pointer items-center gap-2 text-[13px] text-ink-2">
                    <input type="checkbox" checked={slot.isBye} onChange={e => toggleBye(i, e.target.checked)} className="size-4 accent-(--accent)" />
                    Bye (no opponent this week)
                  </label>
                  {resultLabel && <span className="text-right text-[13px] font-medium text-ink">{resultLabel}</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {status && <StatusMsg {...status} />}

      <Button
        type="submit"
        disabled={loading || !slots.length || !!gameweekError}
        className="self-start"
      >
        {loading ? 'Submitting…' : 'Submit gameweek'}
      </Button>
    </form>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

const TABS: { value: Tab; label: string }[] = [
  { value: 'seasons', label: 'Seasons' },
  { value: 'gameweek', label: 'Gameweek results' },
]

function AdminDashboard({ username }: { username: string }) {
  const [activeTab, setActiveTab] = useState<Tab>('seasons')

  const handleLogout = async () => {
    await fetch('/api/bluebaycup/admin/logout', { method: 'POST' })
    window.location.reload()
  }

  return (
    <div className="mx-auto max-w-[960px] px-[clamp(16px,5vw,40px)] pb-[120px]">
      <section className="flex flex-wrap items-end justify-between gap-4 pt-[clamp(40px,8vw,72px)] pb-8">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="font-mono text-[11px] tracking-[0.08em] text-ink-3 uppercase">
            Blue Bay Cup · signed in as {username}
          </div>
          <h1 className="text-[clamp(32px,7vw,44px)] leading-none font-semibold tracking-[-0.03em]">Admin</h1>
        </div>
        <Button variant="outline" size="sm" onClick={handleLogout}>
          Sign out
        </Button>
      </section>

      <Segmented label="Section" options={TABS} value={activeTab} onChange={setActiveTab} className="mb-6" />

      <Card>
        {activeTab === 'seasons' && <SeasonsTab />}
        {activeTab === 'gameweek' && <GameweekTab />}
      </Card>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [username, setUsername] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetch('/api/bluebaycup/admin/check')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.authenticated) { setIsAuthenticated(true); setUsername(d.username) } })
      .finally(() => setIsLoading(false))
  }, [])

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100dvh-64px)] items-center justify-center">
        {muted}
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <LoginCard
        eyebrow="Blue Bay Cup"
        title="Admin sign-in"
        endpoint="/api/bluebaycup/admin/login"
        onLogin={() => {
          fetch('/api/bluebaycup/admin/check')
            .then(r => r.json())
            .then(d => { setUsername(d.username); setIsAuthenticated(true) })
        }}
      />
    )
  }

  return <AdminDashboard username={username} />
}
