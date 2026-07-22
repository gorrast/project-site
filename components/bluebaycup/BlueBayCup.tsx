'use client'

import React, { useEffect, useState } from 'react'
import Header, { ViewTab } from './Header'
import Hero from './Hero'
import SeasonView from './SeasonView'
import AllTimeView from './AllTimeView'
import SectionSkeleton from './SectionSkeleton'
import {
  PlayerOverallStats,
  PlayerSeasonStats,
  PlayerProgressData,
  Season,
  HighScoreData,
  HeadToHeadData,
  TrophySeasonEntry,
} from './types'

export default function BlueBayCup() {
  const [activeTab, setActiveTab] = useState<ViewTab>('alltime')

  const [seasons, setSeasons] = useState<Season[]>([])
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('')
  const [overallData, setOverallData] = useState<PlayerOverallStats[]>([])
  const [trophyHistory, setTrophyHistory] = useState<TrophySeasonEntry[]>([])
  const [seasonData, setSeasonData] = useState<PlayerSeasonStats[]>([])
  const [progressData, setProgressData] = useState<PlayerProgressData[]>([])
  const [highScoreData, setHighScoreData] = useState<HighScoreData | null>(null)
  const [headToHead, setHeadToHead] = useState<HeadToHeadData>({})

  const [isLoading, setIsLoading] = useState(true)
  const [isSeasonLoading, setIsSeasonLoading] = useState(false)
  const [isHeadToHeadLoading, setIsHeadToHeadLoading] = useState(false)
  const [headToHeadLoaded, setHeadToHeadLoaded] = useState(false)

  useEffect(() => {
    fetchOverallData()
  }, [])

  useEffect(() => {
    if (selectedSeasonId) fetchSeasonData(selectedSeasonId)
  }, [selectedSeasonId])

  // Head-to-head is only needed for the All-Time view — fetch lazily the
  // first time the user switches there, not at initial mount.
  useEffect(() => {
    if (activeTab === 'alltime' && !headToHeadLoaded) fetchHeadToHeadData()
  }, [activeTab, headToHeadLoaded])

  const fetchOverallData = async () => {
    try {
      const response = await fetch('/api/bluebaycup/overall')
      const data = await response.json()
      setOverallData(data.overallStats)
      setSeasons(data.seasons)
      setTrophyHistory(data.trophyHistory ?? [])

      if (data.latestSeason) {
        setSelectedSeasonId(data.latestSeason.seasonId)
      }
      setIsLoading(false)
    } catch {
      setIsLoading(false)
    }
  }

  const fetchSeasonData = async (seasonId: string) => {
    setIsSeasonLoading(true)
    try {
      const response = await fetch('/api/bluebaycup/season_stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seasonId }),
      })
      const data = await response.json()
      setSeasonData(data.standings)
      setProgressData(data.progressData)
      setHighScoreData(data.highScoreData || null)
    } catch (error) {
      console.error('Error fetching season data:', error)
    } finally {
      setIsSeasonLoading(false)
    }
  }

  const fetchHeadToHeadData = async () => {
    setIsHeadToHeadLoading(true)
    try {
      const response = await fetch('/api/bluebaycup/head_to_head')
      const data = await response.json()
      setHeadToHead(data.headToHead ?? {})
    } catch (error) {
      console.error('Error fetching head-to-head data:', error)
    } finally {
      setIsHeadToHeadLoading(false)
      setHeadToHeadLoaded(true)
    }
  }

  const selectedSeason = seasons.find(s => s.seasonId === selectedSeasonId)

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <Header
        seasons={seasons}
        selectedSeasonId={selectedSeasonId}
        onSelectSeason={setSelectedSeasonId}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
      />

      <div className="max-w-[1080px] mx-auto px-5 py-11">
        <Hero seasonCount={seasons.length} />

        {isLoading ? (
          <div className="flex flex-col gap-16">
            <SectionSkeleton />
            <SectionSkeleton />
            <SectionSkeleton />
          </div>
        ) : activeTab === 'season' ? (
          <SeasonView
            seasonName={selectedSeason?.seasonName ?? ''}
            seasonData={seasonData}
            progressData={progressData}
            highScoreData={highScoreData}
            isLoading={isSeasonLoading}
          />
        ) : (
          <AllTimeView
            overallData={overallData}
            headToHead={headToHead}
            trophyHistory={trophyHistory}
            isLoading={isHeadToHeadLoading && !headToHeadLoaded}
          />
        )}
      </div>
    </div>
  )
}
