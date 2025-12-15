'use client'

import React, { useRef, useEffect } from 'react'
import { TeamGameweekData } from './types'

interface ClusteredColumnChartProps {
  data: TeamGameweekData[];
  teamName: string;
}

export default function ClusteredColumnChart({ data, teamName }: ClusteredColumnChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [tooltip, setTooltip] = React.useState<{
    visible: boolean;
    x: number;
    y: number;
    content: string;
  }>({ visible: false, x: 0, y: 0, content: '' })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    // Clear canvas
    ctx.clearRect(0, 0, rect.width, rect.height)

    // Chart dimensions
    const padding = { top: 50, right: 20, bottom: 60, left: 50 }
    const chartWidth = rect.width - padding.left - padding.right
    const chartHeight = rect.height - padding.top - padding.bottom

    // Create array for all 38 gameweeks
    const totalGameweeks = 38
    const gameweekData = Array.from({ length: totalGameweeks }, (_, i) => {
      const gw = i + 1
      const existingData = data.find(d => d.gameweek === gw)
      return {
        gameweek: gw,
        pointsFor: existingData?.pointsFor || 0,
        pointsAgainst: existingData?.pointsAgainst || 0,
        hasData: !!existingData
      }
    })

    // Get max value for scaling (only from existing data)
    const allValues = data.flatMap(d => [d.pointsFor, d.pointsAgainst])
    const maxValue = allValues.length > 0 ? Math.max(...allValues) : 100
    const yScale = chartHeight / maxValue

    // Calculate bar dimensions based on 38 gameweeks
    const groupWidth = chartWidth / totalGameweeks
    const barWidth = (groupWidth * 0.8) / 2
    const gap = groupWidth * 0.1

    // Draw grid lines
    ctx.strokeStyle = '#e5e7eb'
    ctx.lineWidth = 1
    for (let i = 0; i <= 5; i++) {
      const y = padding.top + (chartHeight / 5) * i
      ctx.beginPath()
      ctx.moveTo(padding.left, y)
      ctx.lineTo(padding.left + chartWidth, y)
      ctx.stroke()
    }

    // Draw axes
    ctx.strokeStyle = '#374151'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(padding.left, padding.top)
    ctx.lineTo(padding.left, padding.top + chartHeight)
    ctx.lineTo(padding.left + chartWidth, padding.top + chartHeight)
    ctx.stroke()

    // Draw bars for all gameweeks
    gameweekData.forEach((point, index) => {
      const groupX = padding.left + (groupWidth * index) + gap

      // Only draw bars if data exists
      if (point.hasData) {
        // Points For bar (blue)
        const pfHeight = point.pointsFor * yScale
        ctx.fillStyle = '#3b82f6'
        ctx.fillRect(
          groupX,
          padding.top + chartHeight - pfHeight,
          barWidth,
          pfHeight
        )

        // Points Against bar (red)
        const paHeight = point.pointsAgainst * yScale
        ctx.fillStyle = '#ef4444'
        ctx.fillRect(
          groupX + barWidth,
          padding.top + chartHeight - paHeight,
          barWidth,
          paHeight
        )
      }

      // Draw gameweek labels (every even gameweek)
      if (point.gameweek % 2 === 0) {
        ctx.fillStyle = '#374151'
        ctx.font = '10px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(
          `GW${point.gameweek}`,
          groupX + barWidth,
          padding.top + chartHeight + 20
        )
      }
    })

    // Draw Y-axis labels
    ctx.fillStyle = '#374151'
    ctx.font = '12px sans-serif'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    for (let i = 0; i <= 5; i++) {
      const value = (maxValue / 5) * (5 - i)
      const y = padding.top + (chartHeight / 5) * i
      ctx.fillText(Math.round(value).toString(), padding.left - 10, y)
    }

    // Draw title
    ctx.font = 'bold 16px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(`${teamName} - Points For vs Against by Gameweek`, rect.width / 2, 25)

    // Draw legend
    const legendY = rect.height - 25
    ctx.font = '12px sans-serif'
    
    ctx.fillStyle = '#3b82f6'
    ctx.fillRect(rect.width / 2 - 100, legendY, 15, 15)
    ctx.fillStyle = '#374151'
    ctx.textAlign = 'left'
    ctx.fillText('Points For', rect.width / 2 - 80, legendY + 12)
    
    ctx.fillStyle = '#ef4444'
    ctx.fillRect(rect.width / 2 + 10, legendY, 15, 15)
    ctx.fillStyle = '#374151'
    ctx.fillText('Points Against', rect.width / 2 + 30, legendY + 12)

  }, [data, teamName])

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    // Chart dimensions
    const padding = { top: 50, right: 20, bottom: 60, left: 50 }
    const chartWidth = rect.width - padding.left - padding.right
    const chartHeight = rect.height - padding.top - padding.bottom

    const totalGameweeks = 38
    const groupWidth = chartWidth / totalGameweeks
    const barWidth = (groupWidth * 0.8) / 2
    const gap = groupWidth * 0.1

    // Create gameweek data
    const gameweekData = Array.from({ length: totalGameweeks }, (_, i) => {
      const gw = i + 1
      const existingData = data.find(d => d.gameweek === gw)
      return {
        gameweek: gw,
        pointsFor: existingData?.pointsFor || 0,
        pointsAgainst: existingData?.pointsAgainst || 0,
        hasData: !!existingData
      }
    })

    // Check if mouse is over any bar
    for (let index = 0; index < gameweekData.length; index++) {
      const point = gameweekData[index]
      if (!point.hasData) continue

      const groupX = padding.left + (groupWidth * index) + gap

      // Check Points For bar
      if (x >= groupX && x <= groupX + barWidth &&
          y >= padding.top && y <= rect.height - padding.bottom) {
        setTooltip({
          visible: true,
          x: event.clientX,
          y: event.clientY,
          content: `GW${point.gameweek}\nPoints For: ${point.pointsFor}`
        })
        return
      }

      // Check Points Against bar
      if (x >= groupX + barWidth && x <= groupX + 2 * barWidth &&
          y >= padding.top && y <= rect.height - padding.bottom) {
        setTooltip({
          visible: true,
          x: event.clientX,
          y: event.clientY,
          content: `GW${point.gameweek}\nPoints Against: ${point.pointsAgainst}`
        })
        return
      }
    }

    setTooltip({ visible: false, x: 0, y: 0, content: '' })
  }

  const handleMouseLeave = () => {
    setTooltip({ visible: false, x: 0, y: 0, content: '' })
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100 hover:shadow-2xl transition-shadow duration-300 relative">
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '400px' }}
        className="w-full"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />
      {tooltip.visible && (
        <div
          className="absolute bg-gray-900 text-white text-sm px-3 py-2 rounded shadow-lg pointer-events-none whitespace-pre-line z-10"
          style={{
            left: `${tooltip.x}px`,
            top: `${tooltip.y - 60}px`,
            transform: 'translateX(-50%)'
          }}
        >
          {tooltip.content}
        </div>
      )}
    </div>
  )
}
