'use client'

import React, { useState, useEffect, useRef } from 'react'
import OverallTable from './OverallTable'
import SeasonTable from './SeasonTable'
import MultiPlayerLineChart from './MultiPlayerLineChart'
import ClusteredColumnChart from './ClusteredColumnChart'
import {
  PlayerOverallStats,
  PlayerSeasonStats,
  PlayerProgressData,
  TeamGameweekData,
  Season,
  HighScoreData
} from './types'


export default function BlueBayCup() {
  const [seasons, setSeasons] = useState<Season[]>([])
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('')
  const [overallData, setOverallData] = useState<PlayerOverallStats[]>([])
  const [seasonData, setSeasonData] = useState<PlayerSeasonStats[]>([])
  const [progressData, setProgressData] = useState<PlayerProgressData[]>([])
  const [selectedTeamForChart, setSelectedTeamForChart] = useState<string>('')
  const [teamGameweekData, setTeamGameweekData] = useState<TeamGameweekData[]>([])
  const [highScoreData, setHighScoreData] = useState<HighScoreData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSeasonLoading, setIsSeasonLoading] = useState(false)
  const [isSticky, setIsSticky] = useState(false)
  const selectorRef = useRef<HTMLElement>(null)

  // Fetch overall data and seasons on mount
  useEffect(() => {
    // console.log('Hello1');
    fetchOverallData()
  }, [])

  // Fetch season-specific data when season changes
  useEffect(() => {
    if (selectedSeasonId) {
      // console.log('SelectedSeasonId: ', selectedSeasonId, 'Fetching data...')
      fetchSeasonData(selectedSeasonId)
    }
  }, [selectedSeasonId])

  // Show sticky season bar once the selector scrolls out of view above
  useEffect(() => {
    if (isLoading) return
    const el = selectorRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => setIsSticky(!entry.isIntersecting && entry.boundingClientRect.top < 0),
      { threshold: 0 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [isLoading])

  // Fetch team-specific gameweek data
  useEffect(() => {
    if (selectedSeasonId && selectedTeamForChart) {
      fetchTeamGameweekData(selectedSeasonId, selectedTeamForChart)
    }
  }, [selectedSeasonId, selectedTeamForChart])

  const fetchOverallData = async () => {
    // console.log('Hello2');
    try {
      const response = await fetch('/api/bluebaycup/overall')
      const data = await response.json()
      // console.log('Hello3');
      // console.log(response);
      // Set overall stats and seasons
      setOverallData(data.overallStats)
      setSeasons(data.seasons)
      // console.log(data);
      
      // Automatically select latest season
      if (data.latestSeason) {
        setSelectedSeasonId(data.latestSeason.seasonId)
      }
      
      setIsLoading(false)
    } catch (error) {
      // console.error('Error fetching overall data:', error)
      setIsLoading(false)
    }
  }

  const fetchSeasonData = async (seasonId: string) => {
    setIsSeasonLoading(true)
    try {
      const response = await fetch('/api/bluebaycup/season_stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seasonId })
      })
      const data = await response.json()

      setSeasonData(data.standings)
      setProgressData(data.progressData)
      setHighScoreData(data.highScoreData || null)

      // Set first team as default for team chart
      if (data.progressData.length > 0) {
        setSelectedTeamForChart(data.progressData[0].teamId)
      }
    } catch (error) {
      console.error('Error fetching season data:', error)
    } finally {
      setIsSeasonLoading(false)
    }
  }

  const fetchTeamGameweekData = async (seasonId: string, teamId: string) => {
    try {
      const teamProgress = progressData.find(p => p.teamId === teamId)
      if (!teamProgress) return

      const sortedGws = [...teamProgress.gameweeks].sort((a, b) => a.gameweek - b.gameweek)

      // Pre-compute per-GW points_for for every other player (data is cumulative)
      const otherGwScores: Record<string, Record<number, number>> = {}
      for (const other of progressData) {
        if (other.teamId === teamId) continue
        const otherSorted = [...other.gameweeks].sort((a, b) => a.gameweek - b.gameweek)
        otherGwScores[other.teamId] = {}
        otherSorted.forEach((gw, i) => {
          const prev = otherSorted[i - 1]
          otherGwScores[other.teamId][gw.gameweek] = prev ? gw.pointsFor - prev.pointsFor : gw.pointsFor
        })
      }

      const gameweekData = sortedGws.map((gw, i) => {
        const prev = sortedGws[i - 1]
        const myGwPointsAgainst = prev ? gw.pointsAgainst - prev.pointsAgainst : gw.pointsAgainst

        // Opponent is the player whose per-GW points_for equals our per-GW points_against
        const opponent = progressData.find(
          other => other.teamId !== teamId &&
            otherGwScores[other.teamId]?.[gw.gameweek] === myGwPointsAgainst
        )

        return {
          gameweek: gw.gameweek,
          pointsFor: gw.pointsFor,
          pointsAgainst: gw.pointsAgainst,
          opponentName: opponent?.playerName ?? ''
        }
      })
      setTeamGameweekData(gameweekData)
    } catch (error) {
      console.error('Error fetching team gameweek data:', error)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-linear-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
        <div className="text-center">
          <span className="inline-block animate-spin text-6xl mb-4">⚽</span>
          {/* <p className="text-xl font-semibold text-gray-700 dark:text-gray-300">Loading data...</p> */}
        </div>
      </div>
    )
  }

  const selectedSeason = seasons.find(s => s.seasonId === selectedSeasonId)

  const seasonButtons = [...seasons].reverse()

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">

      {/*####################  STICKY SEASON BAR  #####################*/}
      {isSticky && seasons.length > 0 && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 pr-24 flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 shrink-0">Season</span>
            {/* Desktop: pill buttons */}
            <div className="hidden sm:flex flex-wrap gap-2">
              {seasonButtons.map(season => (
                <button
                  key={season.seasonId}
                  onClick={() => setSelectedSeasonId(season.seasonId)}
                  className={`px-3 py-1 rounded-lg text-sm font-bold transition-all duration-150 cursor-pointer ${
                    selectedSeasonId === season.seasonId
                      ? 'bg-linear-to-r from-blue-600 to-purple-600 text-white shadow'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {season.seasonName}
                </button>
              ))}
            </div>
            {/* Mobile: select dropdown */}
            <select
              value={selectedSeasonId}
              onChange={e => setSelectedSeasonId(e.target.value)}
              className="sm:hidden flex-1 px-2 py-1 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-semibold cursor-pointer"
            >
              {seasonButtons.map(season => (
                <option key={season.seasonId} value={season.seasonId}>{season.seasonName}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-block mb-4">
            <div className="bg-linear-to-r from-blue-600 to-purple-600 text-transparent bg-clip-text">
              <h1 className="text-5xl md:text-6xl font-extrabold mb-3">Blue Bay Cup</h1>
            </div>
          </div>
          <p className="text-lg text-gray-600 dark:text-gray-400 font-medium">Fantasy Draft Premier League</p>
          <div className="mt-4 h-1 w-24 bg-linear-to-r from-blue-600 to-purple-600 mx-auto rounded-full"></div>
        </div>

        {/*####################  OVERALL TABLE  #####################*/}
        <section className="mb-16">
          <div className="flex items-center mb-6">
            <div className="shrink-0 w-1 h-8 bg-linear-to-b from-blue-600 to-purple-600 rounded-full mr-4"></div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Overall Standings</h2>
          </div>
          <div className="transform hover:scale-[1.01] transition-transform duration-200">
            <OverallTable data={overallData} />
          </div>
        </section>

        {/*####################  SEASON SELECTOR  #####################*/}
        <section ref={selectorRef} className="mb-16">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-5 border border-gray-100 dark:border-gray-700">
            <h2 className="text-lg font-bold mb-3 text-center text-gray-900 dark:text-gray-100">Select Season</h2>
            <div className="flex flex-wrap justify-center gap-3">
              {[...seasons].reverse().map(season => (
                <button
                  key={season.seasonId}
                  onClick={() => setSelectedSeasonId(season.seasonId)}
                  className={`px-5 py-2.5 rounded-lg font-bold transition-all duration-200 transform hover:scale-105 cursor-pointer ${
                    selectedSeasonId === season.seasonId
                      ? 'bg-linear-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/30'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 hover:shadow-md'
                  }`}
                >
                  {season.seasonName}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/*####################  SEASON DATA  #####################*/}
        {selectedSeason && (
          isSeasonLoading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <span className="inline-block animate-spin text-5xl">⚽</span>
              {/* <p className="text-base font-semibold text-gray-500 dark:text-gray-400">Loading season data...</p> */}
            </div>
          ) : (
            <>
              {/*####################  SEASON TABLE  #####################*/}
              <section className="mb-16">
                <div className="flex items-center mb-6">
                  <div className="shrink-0 w-1 h-8 bg-linear-to-b from-green-600 to-emerald-600 rounded-full mr-4"></div>
                  <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Season Standings</h2>
                </div>
                <div className="transform hover:scale-[1.01] transition-transform duration-200">
                  <SeasonTable data={seasonData} seasonName={selectedSeason.seasonName} />
                </div>
                {/*----------  HIGHEST GW SCORE  ----------*/}
                {highScoreData && (
                  <div className="mt-4 flex flex-col items-center gap-1 px-12 py-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-center mx-auto w-fit min-w-64">
                    <span className="text-sm font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-400">Highest GW Score</span>
                    <span className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">{highScoreData.playerName}</span>
                    <span className="text-base font-medium text-gray-700 dark:text-gray-300"><span className="font-bold text-amber-600 dark:text-amber-400">{highScoreData.score}</span> points in <span className="font-bold text-amber-600 dark:text-amber-400">GW{highScoreData.gameweek}</span></span>
                  </div>
                )}
              </section>

              {/*####################  RANK DEV CHART  #####################*/}
              {progressData.length > 0 && (
                <section className="mb-16">
                  <div className="flex items-center mb-8">
                    <div className="shrink-0 w-1 h-8 bg-linear-to-b from-purple-600 to-pink-600 rounded-full mr-4"></div>
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Rank Development</h2>
                  </div>
                  <div className="transform hover:scale-[1.01] transition-transform duration-200">
                    <MultiPlayerLineChart
                      playersData={progressData}
                      title={`${selectedSeason.seasonName} - Rank Development`}
                      dataKey="rank"
                      invertYAxis
                    />
                  </div>
                </section>
              )}

              {/*####################  TOTAL POINTS DEV CHART  #####################*/}
              {progressData.length > 0 && (
                <section className="mb-16">
                  <div className="flex items-center mb-8">
                    <div className="shrink-0 w-1 h-8 bg-linear-to-b from-purple-600 to-pink-600 rounded-full mr-4"></div>
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Total Points Development</h2>
                  </div>
                  <div className="transform hover:scale-[1.01] transition-transform duration-200">
                    <MultiPlayerLineChart
                      playersData={progressData}
                      title={`${selectedSeason.seasonName} - Points Development`}
                      dataKey="totalPoints"
                    />
                  </div>
                </section>
              )}

              {/*####################  POINTS FOR DEV CHART  #####################*/}
              {progressData.length > 0 && (
                <section className="mb-16">
                  <div className="flex items-center mb-8">
                    <div className="shrink-0 w-1 h-8 bg-linear-to-b from-purple-600 to-pink-600 rounded-full mr-4"></div>
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Avg. Points For Development</h2>
                  </div>
                  <div className="transform hover:scale-[1.01] transition-transform duration-200">
                    <MultiPlayerLineChart
                      playersData={progressData}
                      title={`${selectedSeason.seasonName} - Avg. Points For Development`}
                      dataKey="pointsFor"
                    />
                  </div>
                </section>
              )}

              {/*####################  POINTS AGAINST DEV CHART  #####################*/}
              {progressData.length > 0 && (
                <section className="mb-16">
                  <div className="flex items-center mb-8">
                    <div className="shrink-0 w-1 h-8 bg-linear-to-b from-purple-600 to-pink-600 rounded-full mr-4"></div>
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Avg. Points Against Development</h2>
                  </div>
                  <div className="transform hover:scale-[1.01] transition-transform duration-200">
                    <MultiPlayerLineChart
                      playersData={progressData}
                      title={`${selectedSeason.seasonName} - Avg. Points Against Development`}
                      dataKey="pointsAgainst"
                    />
                  </div>
                </section>
              )}

              {/*####################  TEAM GAMEWEEK CHART  #####################*/}
              {progressData.length > 0 && (
                <section className="mb-16">
                  <div className="flex items-center mb-8">
                    <div className="shrink-0 w-1 h-8 bg-linear-to-b from-orange-600 to-red-600 rounded-full mr-4"></div>
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Team Points by Gameweek</h2>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 mb-8 border border-gray-100 dark:border-gray-700">
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">Select Team:</label>
                    <select
                      value={selectedTeamForChart}
                      onChange={(e) => setSelectedTeamForChart(e.target.value)}
                      className="w-full md:w-80 px-5 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50 dark:bg-gray-700 font-semibold text-gray-900 dark:text-gray-100 transition-all duration-200 hover:border-blue-300 dark:hover:border-blue-500"
                    >
                      {progressData.map(player => (
                        <option key={player.teamId} value={player.teamId}>
                          {player.playerName}
                        </option>
                      ))}
                    </select>
                  </div>
                  {teamGameweekData.length > 0 && (
                    <div className="transform hover:scale-[1.01] transition-transform duration-200">
                      <ClusteredColumnChart
                        data={teamGameweekData}
                        teamName={progressData.find(p => p.teamId === selectedTeamForChart)?.playerName || ''}
                      />
                    </div>
                  )}
                </section>
              )}
            </>
          )
        )}
      </div>
    </div>
  )
}
