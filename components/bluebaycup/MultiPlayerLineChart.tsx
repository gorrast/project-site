'use client'

import React, { useRef, useEffect } from 'react'
import { PlayerProgressData } from './types'

interface MultiPlayerLineChartProps {
  playersData: PlayerProgressData[];
  title: string;
}

export default function MultiPlayerLineChart({ playersData, title }: MultiPlayerLineChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [tooltip, setTooltip] = React.useState<{
    visible: boolean;
    x: number;
    y: number;
    content: string;
  }>({ visible: false, x: 0, y: 0, content: '' })

  const playerColors = [
    '#3b82f6', // blue
    '#ef4444', // red
    '#10b981', // green
    '#f59e0b', // amber
    '#8b5cf6', // purple
    '#ec4899', // pink
  ]

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || playersData.length === 0) return

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
    const padding = { top: 50, right: 30, bottom: 80, left: 60 }
    const chartWidth = rect.width - padding.left - padding.right
    const chartHeight = rect.height - padding.top - padding.bottom

    // Get all gameweeks (assuming all players have same gameweeks)
    const gameweeks = playersData[0]?.gameweeks || []
    const maxGameweek = gameweeks.length

    // Find min and max ranks (inverted for Y-axis)
    const allRanks = playersData.flatMap(p => p.gameweeks.map(gw => gw.rank).filter((r): r is number => r !== null))
    const minRank = Math.min(...allRanks)
    const maxRank = Math.max(...allRanks)

    // Draw grid lines
    ctx.strokeStyle = '#e5e7eb'
    ctx.lineWidth = 1
    for (let i = minRank; i <= maxRank; i++) {
      const y = padding.top + ((i - minRank) / (maxRank - minRank)) * chartHeight
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

    // Draw lines for each player
    playersData.forEach((player, playerIndex) => {
      const color = playerColors[playerIndex % playerColors.length]
      
      // Draw line
      ctx.strokeStyle = color
      ctx.lineWidth = 3
      ctx.beginPath()
      
      player.gameweeks.forEach((point, index) => {
        if (point.rank === null) return;
        const x = padding.left + (chartWidth / (maxGameweek - 1)) * index
        const y = padding.top + ((point.rank - minRank) / (maxRank - minRank)) * chartHeight

        if (index === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      })
      ctx.stroke()

      // Draw points
      ctx.fillStyle = color
      player.gameweeks.forEach((point, index) => {
        if (point.rank === null) return;
        const x = padding.left + (chartWidth / (maxGameweek - 1)) * index
        const y = padding.top + ((point.rank - minRank) / (maxRank - minRank)) * chartHeight

        ctx.beginPath()
        ctx.arc(x, y, 4, 0, 2 * Math.PI)
        ctx.fill()
      })
    })

    // Draw X-axis labels (gameweeks)
    ctx.fillStyle = '#374151'
    ctx.font = '12px sans-serif'
    ctx.textAlign = 'center'
    
    gameweeks.forEach((point, index) => {
      if (index % Math.ceil(maxGameweek / 10) === 0 || index === maxGameweek - 1) {
        const x = padding.left + (chartWidth / (maxGameweek - 1)) * index
        ctx.fillText(`GW${point.gameweek}`, x, rect.height - padding.bottom + 25)
      }
    })

    // Draw Y-axis labels (ranks)
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    for (let i = minRank; i <= maxRank; i++) {
      const y = padding.top + ((i - minRank) / (maxRank - minRank)) * chartHeight
      ctx.fillText(i.toString(), padding.left - 10, y)
    }

    // Draw title
    ctx.font = 'bold 18px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(title, rect.width / 2, 25)

    // Draw legend
    const legendY = rect.height - padding.bottom + 50
    const legendItemWidth = Math.min(150, rect.width / playersData.length)
    const totalLegendWidth = legendItemWidth * playersData.length
    const legendStartX = (rect.width - totalLegendWidth) / 2

    ctx.font = '12px sans-serif'
    ctx.textAlign = 'left'

    playersData.forEach((player, index) => {
      const color = playerColors[index % playerColors.length]
      const x = legendStartX + (index * legendItemWidth)
      
      // Draw color box
      ctx.fillStyle = color
      ctx.fillRect(x, legendY - 5, 15, 15)
      
      // Draw player name
      ctx.fillStyle = '#374151'
      ctx.fillText(player.playerName, x + 20, legendY + 5)
    })

  }, [playersData, title])

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas || playersData.length === 0) return

    const rect = canvas.getBoundingClientRect()
    const mouseX = event.clientX - rect.left
    const mouseY = event.clientY - rect.top

    // Chart dimensions
    const padding = { top: 50, right: 30, bottom: 80, left: 60 }
    const chartWidth = rect.width - padding.left - padding.right
    const chartHeight = rect.height - padding.top - padding.bottom

    const gameweeks = playersData[0]?.gameweeks || []
    const maxGameweek = gameweeks.length

    const allRanks = playersData.flatMap(p => p.gameweeks.map(gw => gw.rank).filter((r): r is number => r !== null))
    const minRank = Math.min(...allRanks)
    const maxRank = Math.max(...allRanks)

    // Check each player's points
    for (let playerIndex = 0; playerIndex < playersData.length; playerIndex++) {
      const player = playersData[playerIndex]
      
      for (let index = 0; index < player.gameweeks.length; index++) {
        const point = player.gameweeks[index]
        if (point.rank === null) continue;
        const x = padding.left + (chartWidth / (maxGameweek - 1)) * index
        const y = padding.top + ((point.rank - minRank) / (maxRank - minRank)) * chartHeight

        // Check if mouse is near this point (within 8px radius)
        const distance = Math.sqrt(Math.pow(mouseX - x, 2) + Math.pow(mouseY - y, 2))
        if (distance < 8) {
          setTooltip({
            visible: true,
            x: event.clientX,
            y: event.clientY,
            content: `${player.playerName}\nGW${point.gameweek}\nRank: ${point.rank}\nPoints: ${point.totalPoints}\nPF: ${point.pointsFor} | PA: ${point.pointsAgainst}`
          })
          return
        }
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
        style={{ width: '100%', height: '500px' }}
        className="w-full"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />
      {tooltip.visible && (
        <div
          className="absolute bg-gray-900 text-white text-sm px-3 py-2 rounded shadow-lg pointer-events-none whitespace-pre-line z-10"
          style={{
            left: `${tooltip.x}px`,
            top: `${tooltip.y - 80}px`,
            transform: 'translateX(-50%)'
          }}
        >
          {tooltip.content}
        </div>
      )}
    </div>
  )
}
