'use client'

import React, { useState, useEffect } from 'react'
import OverallTable from './OverallTable'
import SeasonTable from './SeasonTable'
import MultiPlayerLineChart from './MultiPlayerLineChart'
import ClusteredColumnChart from './ClusteredColumnChart'
import {
  PlayerOverallStats,
  PlayerSeasonStats,
  PlayerProgressData,
  TeamGameweekData,
  Season
} from './types'

export default function BlueBayCup() {
  const [seasons, setSeasons] = useState<Season[]>([])
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('')
  const [overallData, setOverallData] = useState<PlayerOverallStats[]>([])
  const [seasonData, setSeasonData] = useState<PlayerSeasonStats[]>([])
  const [progressData, setProgressData] = useState<PlayerProgressData[]>([])
  const [selectedTeamForChart, setSelectedTeamForChart] = useState<string>('')
  const [teamGameweekData, setTeamGameweekData] = useState<TeamGameweekData[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Fetch overall data and seasons on mount
  useEffect(() => {
    fetchOverallData()
  }, [])

  // Fetch season-specific data when season changes
  useEffect(() => {
    if (selectedSeasonId) {
      fetchSeasonData(selectedSeasonId)
    }
  }, [selectedSeasonId])

  // Fetch team-specific gameweek data
  useEffect(() => {
    if (selectedSeasonId && selectedTeamForChart) {
      fetchTeamGameweekData(selectedSeasonId, selectedTeamForChart)
    }
  }, [selectedSeasonId, selectedTeamForChart])

  const fetchOverallData = async () => {
    try {
      const response = await fetch('/api/bluebaycup/overall')
      const data = await response.json()
      
      // Set overall stats and seasons
      setOverallData(data.overallStats)
      setSeasons(data.seasons)
      
      // Automatically select latest season
      if (data.latestSeason) {
        setSelectedSeasonId(data.latestSeason.seasonId)
      }
      
      setIsLoading(false)
    } catch (error) {
      console.error('Error fetching overall data:', error)
      setIsLoading(false)
    }
  }

  const fetchSeasonData = async (seasonId: string) => {
    try {
      const response = await fetch('/api/bluebaycup/season_stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seasonId })
      })
      const data = await response.json()
      
      // The endpoint now returns: { standings, progressData, maxGameweek }
      setSeasonData(data.standings)
      setProgressData(data.progressData)
      
      // Set first team as default for team chart
      if (data.progressData.length > 0) {
        setSelectedTeamForChart(data.progressData[0].teamId)
      }
    } catch (error) {
      console.error('Error fetching season data:', error)
    }
  }

  const fetchTeamGameweekData = async (seasonId: string, teamId: string) => {
    try {
      // Find team data from progressData
      const teamProgress = progressData.find(p => p.teamId === teamId)
      if (teamProgress) {
        const gameweekData = teamProgress.gameweeks.map(gw => ({
          gameweek: gw.gameweek,
          pointsFor: gw.pointsFor,
          pointsAgainst: gw.pointsAgainst
        }))
        setTeamGameweekData(gameweekData)
      }
    } catch (error) {
      console.error('Error fetching team gameweek data:', error)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-linear-to-br from-blue-50 via-white to-purple-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-xl font-semibold text-gray-700">Loading Blue Bay Cup data...</p>
        </div>
      </div>
    )
  }

  const selectedSeason = seasons.find(s => s.seasonId === selectedSeasonId)

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 via-white to-purple-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-block mb-4">
            <div className="bg-linear-to-r from-blue-600 to-purple-600 text-transparent bg-clip-text">
              <h1 className="text-5xl md:text-6xl font-extrabold mb-3">Blue Bay Cup</h1>
            </div>
          </div>
          <p className="text-lg text-gray-600 font-medium">Fantasy Draft Premier League</p>
          <div className="mt-4 h-1 w-24 bg-linear-to-r from-blue-600 to-purple-600 mx-auto rounded-full"></div>
        </div>

        {/* Overall Table */}
        <section className="mb-16">
          <div className="flex items-center mb-6">
            <div className="shrink-0 w-1 h-8 bg-linear-to-b from-blue-600 to-purple-600 rounded-full mr-4"></div>
            <h2 className="text-3xl font-bold text-gray-900">Overall Standings</h2>
          </div>
          <div className="transform hover:scale-[1.01] transition-transform duration-200">
            <OverallTable data={overallData} />
          </div>
        </section>

        {/* Season Selector Banner */}
        <section className="mb-16">
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            <h2 className="text-2xl font-bold mb-6 text-center text-gray-900">Select Season</h2>
            <div className="flex flex-wrap justify-center gap-4">
              {seasons.map(season => (
                <button
                  key={season.seasonId}
                  onClick={() => setSelectedSeasonId(season.seasonId)}
                  className={`px-8 py-4 rounded-xl font-bold transition-all duration-200 transform hover:scale-105 ${
                    selectedSeasonId === season.seasonId
                      ? 'bg-linear-to-r from-blue-600 to-purple-600 text-white shadow-2xl shadow-blue-500/50'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-lg'
                  }`}
                >
                  {season.seasonName}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Season Table */}
        {selectedSeason && (
          <section className="mb-16">
            <div className="flex items-center mb-6">
              <div className="shrink-0 w-1 h-8 bg-linear-to-b from-green-600 to-emerald-600 rounded-full mr-4"></div>
              <h2 className="text-3xl font-bold text-gray-900">Season Standings</h2>
            </div>
            <div className="transform hover:scale-[1.01] transition-transform duration-200">
              <SeasonTable data={seasonData} seasonName={selectedSeason.seasonName} />
            </div>
          </section>
        )}

        {/* Rank Development Chart */}
        {progressData.length > 0 && (
          <section className="mb-16">
            <div className="flex items-center mb-8">
              <div className="shrink-0 w-1 h-8 bg-linear-to-b from-purple-600 to-pink-600 rounded-full mr-4"></div>
              <h2 className="text-3xl font-bold text-gray-900">Rank Development</h2>
            </div>
            <div className="transform hover:scale-[1.01] transition-transform duration-200">
              <MultiPlayerLineChart
                playersData={progressData}
                title={`${selectedSeason?.seasonName || 'Season'} - Rank Development`}
              />
            </div>
          </section>
        )}

        {/* Total Points Development Chart */}
        {progressData.length > 0 && (
          <section className="mb-16">
            <div className="flex items-center mb-8">
              <div className="shrink-0 w-1 h-8 bg-linear-to-b from-purple-600 to-pink-600 rounded-full mr-4"></div>
              <h2 className="text-3xl font-bold text-gray-900">Total Points Development</h2>
            </div>
            <div className="transform hover:scale-[1.01] transition-transform duration-200">
              <MultiPlayerLineChart
                playersData={progressData}
                title={`${selectedSeason?.seasonName || 'Season'} - Points Development`}
              />
            </div>
          </section>
        )}
        {/* Avg Points For Development Chart */}
        {progressData.length > 0 && (
          <section className="mb-16">
            <div className="flex items-center mb-8">
              <div className="shrink-0 w-1 h-8 bg-linear-to-b from-purple-600 to-pink-600 rounded-full mr-4"></div>
              <h2 className="text-3xl font-bold text-gray-900">Avg. Points For Development</h2>
            </div>
            <div className="transform hover:scale-[1.01] transition-transform duration-200">
              <MultiPlayerLineChart
                playersData={progressData}
                title={`${selectedSeason?.seasonName || 'Season'} - Avg. Points For Development`}
              />
            </div>
          </section>
        )}
        {/* Avg Points Against Development Chart */}
        {progressData.length > 0 && (
          <section className="mb-16">
            <div className="flex items-center mb-8">
              <div className="shrink-0 w-1 h-8 bg-linear-to-b from-purple-600 to-pink-600 rounded-full mr-4"></div>
              <h2 className="text-3xl font-bold text-gray-900">Avg. Points Against Development</h2>
            </div>
            <div className="transform hover:scale-[1.01] transition-transform duration-200">
              <MultiPlayerLineChart
                playersData={progressData}
                title={`${selectedSeason?.seasonName || 'Season'} - Avg. Points Against Development`}
              />
            </div>
          </section>
        )}

        {/* Team Gameweek Comparison Chart */}
        {progressData.length > 0 && (
          <section className="mb-16">
            <div className="flex items-center mb-8">
              <div className="shrink-0 w-1 h-8 bg-linear-to-b from-orange-600 to-red-600 rounded-full mr-4"></div>
              <h2 className="text-3xl font-bold text-gray-900">Team Points by Gameweek</h2>
            </div>
            
            {/* Team Selector */}
            <div className="bg-white rounded-2xl shadow-xl p-6 mb-8 border border-gray-100">
              <label className="block text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">Select Team:</label>
              <select
                value={selectedTeamForChart}
                onChange={(e) => setSelectedTeamForChart(e.target.value)}
                className="w-full md:w-80 px-5 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50 font-semibold text-gray-900 transition-all duration-200 hover:border-blue-300"
              >
                {progressData.map(player => (
                  <option key={player.playerId} value={player.playerId}>
                    {player.playerName}
                  </option>
                ))}
              </select>
            </div>

            {/* Clustered Column Chart */}
            {teamGameweekData.length > 0 && (
              <div className="transform hover:scale-[1.01] transition-transform duration-200">
                <ClusteredColumnChart
                  data={teamGameweekData}
                  teamName={progressData.find(p => p.playerId === selectedTeamForChart)?.playerName || ''}
                />
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  )
}
