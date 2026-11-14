'use client'

import React, { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { RevealHeading, calmTransition } from '@/components/ui/Motion'
import { Segmented } from '@/components/ui/segmented'
import SeasonView from './SeasonView'
import AllTimeView from './AllTimeView'
import SectionSkeleton from './SectionSkeleton'
import {
  PlayerOverallStats,
  Season,
  SeasonStats,
  HeadToHeadData,
  TrophySeasonEntry,
} from './types'

type ViewTab = 'season' | 'alltime'
const VIEWS: { value: ViewTab; label: string }[] = [
  { value: 'alltime', label: 'All-time' },
  { value: 'season', label: 'Season' },
]

async function getJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init)
  if (!response.ok) throw new Error(`${url} responded ${response.status}`)
  return response.json()
}

export default function BlueBayCup() {
  const [activeTab, setActiveTab] = useState<ViewTab>('alltime')

  const [seasons, setSeasons] = useState<Season[]>([])
  const [latestSeasonId, setLatestSeasonId] = useState<string>('')
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('')
  const [overallData, setOverallData] = useState<PlayerOverallStats[]>([])
  const [trophyHistory, setTrophyHistory] = useState<TrophySeasonEntry[]>([])
  // Per season, so the all-time view can keep showing the latest season
  // while another one is open, and switching back does not refetch.
  const [seasonStats, setSeasonStats] = useState<Record<string, SeasonStats>>({})
  const requestedSeasons = useRef(new Set<string>())
  const [headToHead, setHeadToHead] = useState<HeadToHeadData>({})

  const [isLoading, setIsLoading] = useState(true)
  const [failed, setFailed] = useState<string | null>(null)
  const [headToHeadLoaded, setHeadToHeadLoaded] = useState(false)

  const reduced = useReducedMotion()

  useEffect(() => {
    fetchOverallData()
  }, [])

  useEffect(() => {
    if (selectedSeasonId && !requestedSeasons.current.has(selectedSeasonId)) {
      requestedSeasons.current.add(selectedSeasonId)
      fetchSeasonData(selectedSeasonId)
    }
  }, [selectedSeasonId])

  // Head-to-head is only needed for the All-Time view — fetch lazily the
  // first time the user switches there, not at initial mount.
  useEffect(() => {
    if (activeTab === 'alltime' && !headToHeadLoaded) fetchHeadToHeadData()
  }, [activeTab, headToHeadLoaded])

  const fetchOverallData = async () => {
    try {
      const data = await getJson('/api/bluebaycup/overall')
      setOverallData(data.overallStats)
      setSeasons(data.seasons)
      setTrophyHistory(data.trophyHistory ?? [])

      if (data.latestSeason) {
        setLatestSeasonId(data.latestSeason.seasonId)
        setSelectedSeasonId(data.latestSeason.seasonId)
      }
    } catch (error) {
      console.error('Error fetching overall data:', error)
      setFailed('the standings')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchSeasonData = async (seasonId: string) => {
    try {
      const data = await getJson('/api/bluebaycup/season_stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seasonId }),
      })
      setSeasonStats(prev => ({
        ...prev,
        [seasonId]: {
          standings: data.standings,
          progressData: data.progressData,
          maxGameweek: data.maxGameweek,
          highScoreData: data.highScoreData || null,
        },
      }))
    } catch (error) {
      console.error('Error fetching season data:', error)
      requestedSeasons.current.delete(seasonId)
      setFailed('that season')
    }
  }

  const fetchHeadToHeadData = async () => {
    try {
      const data = await getJson('/api/bluebaycup/head_to_head')
      setHeadToHead(data.headToHead ?? {})
    } catch (error) {
      console.error('Error fetching head-to-head data:', error)
    } finally {
      setHeadToHeadLoaded(true)
    }
  }

  const selectedSeason = seasons.find(s => s.seasonId === selectedSeasonId)
  const latestSeason = seasons.find(s => s.seasonId === latestSeasonId)
  const latestStats = seasonStats[latestSeasonId]
  const seasonsNewestFirst = [...seasons].sort((a, b) => Number(b.seasonId) - Number(a.seasonId))
  const view = isLoading ? 'loading' : activeTab

  return (
    <div className="mx-auto max-w-[1200px] px-[clamp(16px,5vw,40px)] pb-[120px]">
      <section className="flex flex-wrap items-end justify-between gap-6 pt-[clamp(40px,8vw,72px)] pb-12">
        <div className="flex min-w-0 flex-col gap-3.5">
          <div className="font-mono text-[11px] tracking-[0.08em] text-ink-3 uppercase">
            Fantasy Draft Premier League{seasons.length > 0 && ` · ${seasons.length} seasons`}
          </div>
          <RevealHeading as="h1" className="text-[clamp(40px,9vw,60px)] leading-none font-semibold tracking-[-0.035em]">
            Blue Bay Cup
          </RevealHeading>
        </div>
        {/* Project navigation lives in the hero, never in the shell. */}
        <div className="flex max-w-full items-center gap-2.5">
          <Segmented label="View" options={VIEWS} value={activeTab} onChange={setActiveTab} />
          {activeTab === 'season' && seasons.length > 0 && (
            <div className="relative">
              <select
                aria-label="Season"
                value={selectedSeasonId}
                onChange={e => { setFailed(null); setSelectedSeasonId(e.target.value) }}
                className="h-10 cursor-pointer appearance-none rounded-full border border-line-strong bg-surface pr-[38px] pl-4 text-sm font-medium text-ink"
              >
                {seasonsNewestFirst.map(s => (
                  <option key={s.seasonId} value={s.seasonId}>
                    {s.seasonName}{s.isFinished ? '' : ' · live'}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute top-[13px] right-3.5 size-3.5 text-ink-3" />
            </div>
          )}
        </div>
      </section>

      {failed && (
        <p role="alert" className="mb-8 text-[13px] text-neg">
          Couldn&apos;t load {failed}. Reload the page to try again.
        </p>
      )}

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={view}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ ...calmTransition, duration: reduced ? 0 : 0.5 }}
        >
          {view === 'loading' ? (
            <div className="flex flex-col gap-20">
              <SectionSkeleton />
              <SectionSkeleton />
              <SectionSkeleton />
            </div>
          ) : seasons.length === 0 ? null : view === 'season' ? (
            selectedSeason && <SeasonView season={selectedSeason} stats={seasonStats[selectedSeasonId]} />
          ) : (
            <AllTimeView
              overallData={overallData}
              headToHead={headToHead}
              trophyHistory={trophyHistory}
              seasons={seasons}
              latest={latestSeason && latestStats ? { season: latestSeason, stats: latestStats } : null}
              onOpenLatest={() => { setSelectedSeasonId(latestSeasonId); setActiveTab('season') }}
              isHeadToHeadLoading={!headToHeadLoaded}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
