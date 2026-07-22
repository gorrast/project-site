'use client'

import { useState, useEffect, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'seasons' | 'gameweek'

interface Player { player_id: number; name: string }
interface SeasonRow { season_id: number; year: string; prize_pool: number; high_score_prize: number | null; league_api_id: number | null }
interface TeamRow { team_id: number; team_name: string; player_id: number; player_name: string; api_entry_id: number | null }
interface ParticipantRow { playerId: number | null; teamName: string; apiEntryId: string }
interface PairSlot { teamAId: number | null; teamBId: number | null; teamAScore: string; teamBScore: string; isBye: boolean }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Input({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
      <input
        {...props}
        className="border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  )
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 ${className}`}>
      {children}
    </div>
  )
}

function StatusMsg({ msg, type }: { msg: string; type: 'error' | 'success' | 'info' }) {
  const colors = {
    error: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300',
    success: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300',
    info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300',
  }
  return <div className={`border rounded p-3 text-sm ${colors[type]}`}>{msg}</div>
}

// ─── Login ────────────────────────────────────────────────────────────────────

function LoginForm({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/bluebaycup/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      if (res.ok) { onLogin() }
      else { const d = await res.json(); setError(d.error ?? 'Login failed') }
    } catch { setError('Network error') }
    finally { setLoading(false) }
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-gray-50 dark:bg-gray-900">
      <Card className="w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-6 dark:text-gray-100">Admin Login</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input label="Username" type="text" value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" required />
          <Input label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required />
          {error && <StatusMsg msg={error} type="error" />}
          <button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2 px-4 rounded font-medium text-sm">
            {loading ? 'Logging in…' : 'Log In'}
          </button>
        </form>
      </Card>
    </div>
  )
}

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
  const [fplEntries, setFplEntries] = useState<{ entryId: number; teamName: string }[] | null>(null)
  const [fplFetchLoading, setFplFetchLoading] = useState(false)
  const [fplFetchError, setFplFetchError] = useState('')

  // Manage teams (api_entry_id) state
  const [teamsSeasonId, setTeamsSeasonId] = useState<number | null>(null)
  const [seasonTeams, setSeasonTeams] = useState<TeamRow[]>([])
  const [teamsLoading, setTeamsLoading] = useState(false)
  const [teamEditValues, setTeamEditValues] = useState<Record<number, string>>({})
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
        return [...prev, ...Array.from({ length: count - prev.length }, () => ({ playerId: null as number | null, teamName: '', apiEntryId: '' }))]
      }
      return prev.slice(0, count)
    })
  }

  const updateRow = (i: number, patch: Partial<ParticipantRow>) =>
    setParticipantRows(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r))

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
    try {
      const res = await fetch(`/api/bluebaycup/admin/fpl-league-entries?leagueId=${encodeURIComponent(newLeagueApiId.trim())}`)
      const d = await res.json()
      if (res.ok) {
        setFplEntries(d.entries ?? [])
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
          apiEntryId: r.apiEntryId.trim() ? Number(r.apiEntryId) : null,
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
      setFplEntries(null); setFplFetchError('')
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
      setTeamEditValues(Object.fromEntries(teams.map(t => [t.team_id, String(t.api_entry_id ?? '')])))
    } else {
      setSeasonTeams([])
    }
    setTeamsLoading(false)
  }

  const saveTeamApiId = async (teamId: number) => {
    const value = teamEditValues[teamId]
    if (!value?.trim()) {
      setTeamStatus(prev => ({ ...prev, [teamId]: { msg: 'Enter an API entry ID', type: 'error' } }))
      return
    }
    setTeamSaving(teamId)
    const res = await fetch(`/api/bluebaycup/admin/teams/${teamId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_entry_id: Number(value) }),
    })
    setTeamSaving(null)
    if (res.ok) {
      setTeamStatus(prev => ({ ...prev, [teamId]: { msg: 'Saved', type: 'success' } }))
      setSeasonTeams(prev => prev.map(t => t.team_id === teamId ? { ...t, api_entry_id: Number(value) } : t))
    } else {
      const d = await res.json()
      setTeamStatus(prev => ({ ...prev, [teamId]: { msg: d.error ?? 'Failed to save', type: 'error' } }))
    }
  }

  if (loading) return <p className="text-sm text-gray-500">Loading…</p>

  // ── Add Season form ──
  if (view === 'add') {
    return (
      <div className="flex flex-col gap-6">
        <button onClick={() => setView('list')} className="self-start text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400">
          ← Back to seasons
        </button>

        <form onSubmit={handleCreateSeason} className="flex flex-col gap-6">
          <h2 className="text-lg font-semibold dark:text-gray-100">New Season</h2>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Input label="Season year (e.g. 2025/2026)" value={newYear} onChange={e => setNewYear(e.target.value)} required placeholder="2025/2026" />
            <Input label="Prize pool (kr)" type="number" min={0} value={newPrizePool} onChange={e => setNewPrizePool(e.target.value)} required placeholder="1000" />
            <Input label="High score prize (kr)" type="number" min={0} value={newHighScorePrize} onChange={e => setNewHighScorePrize(e.target.value)} placeholder="100" />
            <Input label="League API ID" type="number" min={0} value={newLeagueApiId} onChange={e => { setNewLeagueApiId(e.target.value); setFplEntries(null); setFplFetchError('') }} required placeholder="e.g. 314159" />
          </div>

          <div>
            <button
              type="button"
              onClick={handleFetchFplEntries}
              disabled={!newLeagueApiId.trim() || fplFetchLoading}
              className="text-sm border border-gray-300 dark:border-gray-600 py-1.5 px-3 rounded font-medium disabled:opacity-50 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              {fplFetchLoading ? 'Fetching…' : 'Fetch entry IDs'}
            </button>

            {fplFetchError && <div className="mt-2"><StatusMsg msg={fplFetchError} type="error" /></div>}

            {fplEntries && (
              fplEntries.length === 0 ? (
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">No entries found for this league.</p>
              ) : (
                <div className="mt-2 overflow-x-auto rounded border border-gray-200 dark:border-gray-700">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
                        <th className="text-left py-1.5 px-3 font-medium text-gray-600 dark:text-gray-400">Team name</th>
                        <th className="text-left py-1.5 px-3 font-medium text-gray-600 dark:text-gray-400">Entry ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fplEntries.map(entry => (
                        <tr key={entry.entryId} className="border-b border-gray-100 dark:border-gray-800 last:border-0">
                          <td className="py-1.5 px-3 dark:text-gray-200">{entry.teamName}</td>
                          <td className="py-1.5 px-3 text-gray-600 dark:text-gray-400 font-mono">{entry.entryId}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>

          <div className="flex flex-col gap-1 max-w-[160px]">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Number of participants</label>
            <select
              value={participantCount ?? ''}
              onChange={e => handleCountChange(Number(e.target.value))}
              className="border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-100"
              required
            >
              <option value="">— select —</option>
              {Array.from({ length: 9 }, (_, i) => i + 6).map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          {participantRows.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-3 gap-3 pb-1 text-xs font-medium text-gray-500 dark:text-gray-400">
              <span>Player</span>
              <span>Team name</span>
              <span>API entry ID (optional)</span>
            </div>
            {participantRows.map((row, i) => (
              <div key={i} className="grid grid-cols-3 gap-3">
                <select
                  value={row.playerId ?? ''}
                  onChange={e => updateRow(i, { playerId: Number(e.target.value) || null })}
                  className="border border-gray-300 dark:border-gray-600 rounded px-2 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-100"
                  required
                >
                  <option value="">— select player —</option>
                  {players.map(p => <option key={p.player_id} value={p.player_id}>{p.name}</option>)}
                </select>
                <input
                  value={row.teamName}
                  onChange={e => updateRow(i, { teamName: e.target.value })}
                  placeholder="Team name"
                  className="border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-100"
                  required
                />
                <input
                  type="number"
                  min={0}
                  value={row.apiEntryId}
                  onChange={e => updateRow(i, { apiEntryId: e.target.value })}
                  placeholder="e.g. 12345"
                  className="border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-100"
                />
              </div>
            ))}
          </div>
          )}

          {/* Add Player */}
          <div>
            {!addingPlayer ? (
              <button type="button" onClick={() => setAddingPlayer(true)} className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400">
                + Add Player
              </button>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  value={newPlayerName}
                  onChange={e => { setNewPlayerName(e.target.value); setAddPlayerError('') }}
                  placeholder="Player name"
                  className="border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-100 w-40"
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddPlayer() } }}
                  autoFocus
                />
                <button type="button" onClick={handleAddPlayer} className="bg-blue-600 text-white px-3 py-2 rounded text-sm hover:bg-blue-700">Add</button>
                <button type="button" onClick={() => { setAddingPlayer(false); setNewPlayerName(''); setAddPlayerError('') }} className="text-gray-500 hover:text-gray-700 text-sm px-2 py-2">Cancel</button>
                {addPlayerError && <span className="text-xs text-red-600">{addPlayerError}</span>}
              </div>
            )}
          </div>

          {createStatus && <StatusMsg {...createStatus} />}

          <div className="flex gap-3">
            <button type="submit" disabled={createLoading} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2 px-6 rounded font-medium text-sm">
              {createLoading ? 'Creating…' : 'Create Season'}
            </button>
            <button type="button" onClick={() => setView('list')} className="border border-gray-300 dark:border-gray-600 py-2 px-4 rounded text-sm dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
              Cancel
            </button>
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
        <button onClick={() => setView('list')} className="self-start text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400">
          ← Back to seasons
        </button>

        <h2 className="text-lg font-semibold dark:text-gray-100">
          Team API Entry IDs {season ? `— ${season.year}` : ''}
        </h2>

        {teamsLoading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : seasonTeams.length === 0 ? (
          <p className="text-sm text-gray-500">No teams found for this season.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 pr-4 font-medium text-gray-600 dark:text-gray-400">Player</th>
                  <th className="text-left py-2 pr-4 font-medium text-gray-600 dark:text-gray-400">Team</th>
                  <th className="text-left py-2 pr-4 font-medium text-gray-600 dark:text-gray-400">API entry ID</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {seasonTeams.map(team => (
                  <tr key={team.team_id} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-2 pr-4 dark:text-gray-200">{team.player_name}</td>
                    <td className="py-2 pr-4 text-gray-600 dark:text-gray-400">{team.team_name}</td>
                    <td className="py-2 pr-4">
                      <input
                        type="number"
                        min={0}
                        value={teamEditValues[team.team_id] ?? ''}
                        onChange={e => setTeamEditValues(prev => ({ ...prev, [team.team_id]: e.target.value }))}
                        placeholder="e.g. 12345"
                        className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800 dark:text-gray-100 w-32"
                      />
                    </td>
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => saveTeamApiId(team.team_id)}
                          disabled={teamSaving === team.team_id}
                          className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
                        >
                          {teamSaving === team.team_id ? 'Saving…' : 'Save'}
                        </button>
                        {teamStatus[team.team_id] && (
                          <span className={`text-xs ${teamStatus[team.team_id].type === 'error' ? 'text-red-600' : 'text-green-600'}`}>
                            {teamStatus[team.team_id].msg}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  // ── Seasons list ──
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold dark:text-gray-100">Seasons</h2>
        <button onClick={() => setView('add')} className="bg-blue-600 hover:bg-blue-700 text-white py-1.5 px-4 rounded text-sm font-medium">
          + Add Season
        </button>
      </div>

      {seasons.length === 0 ? (
        <p className="text-sm text-gray-500">No seasons yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-2 pr-4 font-medium text-gray-600 dark:text-gray-400">Season</th>
                <th className="text-left py-2 pr-4 font-medium text-gray-600 dark:text-gray-400">Prize pool</th>
                <th className="text-left py-2 pr-4 font-medium text-gray-600 dark:text-gray-400">High score prize</th>
                <th className="text-left py-2 pr-4 font-medium text-gray-600 dark:text-gray-400">League API ID</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {seasons.map(season =>
                editingId === season.season_id ? (
                  <tr key={season.season_id} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-2 pr-2">
                      <input
                        value={editValues.year}
                        onChange={e => setEditValues(v => ({ ...v, year: e.target.value }))}
                        className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800 dark:text-gray-100 w-28"
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        type="number" min={0}
                        value={editValues.prizePool}
                        onChange={e => setEditValues(v => ({ ...v, prizePool: e.target.value }))}
                        className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800 dark:text-gray-100 w-24"
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        type="number" min={0}
                        value={editValues.highScorePrize}
                        onChange={e => setEditValues(v => ({ ...v, highScorePrize: e.target.value }))}
                        className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800 dark:text-gray-100 w-24"
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        type="number" min={0}
                        value={editValues.leagueApiId}
                        onChange={e => setEditValues(v => ({ ...v, leagueApiId: e.target.value }))}
                        className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800 dark:text-gray-100 w-28"
                      />
                    </td>
                    <td className="py-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button onClick={saveEdit} disabled={editLoading} className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-50">Save</button>
                        <button onClick={cancelEdit} className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 px-2 py-1">Cancel</button>
                        {confirmDeleteId !== season.season_id ? (
                          <button onClick={() => setConfirmDeleteId(season.season_id)} className="text-sm text-red-600 hover:text-red-800 px-2 py-1">Delete</button>
                        ) : (
                          <>
                            <span className="text-xs text-gray-500 dark:text-gray-400">Delete &quot;{season.year}&quot;?</span>
                            <button onClick={() => deleteSeason(season.season_id)} disabled={editLoading} className="text-sm bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 disabled:opacity-50">Yes, Delete</button>
                            <button onClick={() => setConfirmDeleteId(null)} className="text-sm text-gray-500 px-2 py-1">No, Keep</button>
                          </>
                        )}
                        {editStatus && (
                          <span className={`text-xs ${editStatus.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>
                            {editStatus.msg}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={season.season_id} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-2 pr-4 dark:text-gray-200">{season.year}</td>
                    <td className="py-2 pr-4 text-gray-600 dark:text-gray-400">{season.prize_pool} kr</td>
                    <td className="py-2 pr-4 text-gray-600 dark:text-gray-400">{season.high_score_prize ?? 0} kr</td>
                    <td className="py-2 pr-4 text-gray-600 dark:text-gray-400">{season.league_api_id ?? '—'}</td>
                    <td className="py-2">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openTeamsView(season.season_id)} className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-1 text-xs border border-gray-200 dark:border-gray-700 rounded px-2 py-1" title="Manage team API entry IDs">
                          Teams
                        </button>
                        <button onClick={() => startEdit(season)} className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-1 text-base" title="Edit">✏️</button>
                      </div>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Season</label>
          <select
            value={selectedSeasonId ?? ''}
            onChange={e => { setSelectedSeasonId(Number(e.target.value) || null); setStatus(null) }}
            className="border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-100"
            required
          >
            <option value="">— select season —</option>
            {seasons.map(s => <option key={s.season_id} value={s.season_id}>{s.year}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Gameweek (0–38)</label>
          <input
            type="number"
            min={0}
            max={38}
            step={1}
            value={gameweek}
            onChange={e => { setGameweek(e.target.value); if (gameweekError) validateGameweek(e.target.value) }}
            onBlur={e => { if (e.target.value) validateGameweek(e.target.value) }}
            className="border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
            placeholder="e.g. 12"
          />
          {gameweekError && <span className="text-xs text-red-600">{gameweekError}</span>}
        </div>
      </div>

      {loadingTeams && <p className="text-sm text-gray-500">Loading teams…</p>}

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
              <div key={i} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 flex flex-col gap-2">
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-2 items-center">
                  <div className="flex gap-2">
                    <select
                      value={slot.teamAId ?? ''}
                      onChange={e => updateSlot(i, { teamAId: Number(e.target.value) || null })}
                      className="flex-1 border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-800 dark:text-gray-100"
                      required
                    >
                      <option value="">— team —</option>
                      {availableA.map(t => <option key={t.team_id} value={t.team_id}>{t.player_name} ({t.team_name})</option>)}
                    </select>
                    <input
                      type="number" min={0}
                      value={slot.teamAScore}
                      onChange={e => updateSlot(i, { teamAScore: e.target.value })}
                      placeholder="pts"
                      className="w-20 border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-800 dark:text-gray-100"
                      required
                    />
                  </div>

                  <span className="text-xs font-semibold text-gray-400 text-center">vs</span>

                  <div className="flex gap-2">
                    {slot.isBye ? (
                      <span className="flex-1 flex items-center px-2 py-1.5 text-sm text-gray-400 italic">no opponent</span>
                    ) : (
                      <>
                        <select
                          value={slot.teamBId ?? ''}
                          onChange={e => updateSlot(i, { teamBId: Number(e.target.value) || null })}
                          className="flex-1 border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-800 dark:text-gray-100"
                          required
                        >
                          <option value="">— team —</option>
                          {availableB.map(t => <option key={t.team_id} value={t.team_id}>{t.player_name} ({t.team_name})</option>)}
                        </select>
                        <input
                          type="number" min={0}
                          value={slot.teamBScore}
                          onChange={e => updateSlot(i, { teamBScore: e.target.value })}
                          placeholder="pts"
                          className="w-20 border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-800 dark:text-gray-100"
                          required
                        />
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                    <input type="checkbox" checked={slot.isBye} onChange={e => toggleBye(i, e.target.checked)} />
                    Bye (no opponent this week)
                  </label>
                  {resultLabel && <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">{resultLabel}</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {status && <StatusMsg {...status} />}

      <button
        type="submit"
        disabled={loading || !slots.length || !!gameweekError}
        className="self-start bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2 px-6 rounded font-medium text-sm"
      >
        {loading ? 'Submitting…' : 'Submit Gameweek'}
      </button>
    </form>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function AdminDashboard({ username }: { username: string }) {
  const [activeTab, setActiveTab] = useState<Tab>('seasons')

  const handleLogout = async () => {
    await fetch('/api/bluebaycup/admin/logout', { method: 'POST' })
    window.location.reload()
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'seasons', label: 'Seasons' },
    { id: 'gameweek', label: 'Gameweek Data' },
  ]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold dark:text-gray-100">Admin Dashboard</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Logged in as {username}</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm text-red-600 hover:text-red-800 dark:text-red-400 border border-red-200 dark:border-red-800 rounded px-3 py-1.5"
          >
            Log out
          </button>
        </div>

        <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-700">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === t.id
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <Card>
          {activeTab === 'seasons' && <SeasonsTab />}
          {activeTab === 'gameweek' && <GameweekTab />}
        </Card>
      </div>
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
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <p className="text-gray-500 text-sm">Loading…</p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <LoginForm
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
