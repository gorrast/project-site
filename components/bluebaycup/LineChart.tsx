'use client'

import React, { useRef, useEffect } from 'react'
import { GameweekData } from './types'

interface LineChartProps {
  data: GameweekData[];
  dataKey: 'rank' | 'totalPoints' | 'pointsFor' | 'pointsAgainst';
  title: string;
  color: string;
  playerName: string;
  invertYAxis?: boolean;
}

export default function LineChart({ 
  data, 
  dataKey, 
  title, 
  color, 
  playerName,
  invertYAxis = false 
}: LineChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || data.length === 0) return

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
    const padding = { top: 40, right: 20, bottom: 40, left: 50 }
    const chartWidth = rect.width - padding.left - padding.right
    const chartHeight = rect.height - padding.top - padding.bottom

    // Get data values
    const values = data.map(d => d[dataKey])
    const minValue = Math.min(...values)
    const maxValue = Math.max(...values)
    const valueRange = maxValue - minValue || 1

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

    // Draw line
    ctx.strokeStyle = color
    ctx.lineWidth = 3
    ctx.beginPath()
    
    data.forEach((point, index) => {
      const x = padding.left + (chartWidth / (data.length - 1)) * index
      const normalizedValue = (point[dataKey] - minValue) / valueRange
      let y = padding.top + chartHeight - (normalizedValue * chartHeight)
      
      if (invertYAxis) {
        y = padding.top + (normalizedValue * chartHeight)
      }

      if (index === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    })
    ctx.stroke()

    // Draw points
    ctx.fillStyle = color
    data.forEach((point, index) => {
      const x = padding.left + (chartWidth / (data.length - 1)) * index
      const normalizedValue = (point[dataKey] - minValue) / valueRange
      let y = padding.top + chartHeight - (normalizedValue * chartHeight)
      
      if (invertYAxis) {
        y = padding.top + (normalizedValue * chartHeight)
      }

      ctx.beginPath()
      ctx.arc(x, y, 4, 0, 2 * Math.PI)
      ctx.fill()
    })

    // Draw labels
    ctx.fillStyle = '#374151'
    ctx.font = '12px sans-serif'
    ctx.textAlign = 'center'
    
    // X-axis labels (gameweeks)
    data.forEach((point, index) => {
      if (index % Math.ceil(data.length / 10) === 0 || index === data.length - 1) {
        const x = padding.left + (chartWidth / (data.length - 1)) * index
        ctx.fillText(`GW${point.gameweek}`, x, rect.height - 20)
      }
    })

    // Y-axis labels
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    for (let i = 0; i <= 5; i++) {
      const value = minValue + (valueRange / 5) * (invertYAxis ? 5 - i : i)
      const y = padding.top + (chartHeight / 5) * i
      ctx.fillText(Math.round(value).toString(), padding.left - 10, y)
    }

    // Draw title
    ctx.font = 'bold 14px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(title, rect.width / 2, 20)

  }, [data, dataKey, color, title, invertYAxis])

  return (
    <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100 hover:shadow-2xl transition-shadow duration-300">
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '300px' }}
        className="w-full"
      />
    </div>
  )
}
