"use client"

import { useEffect, useMemo, useState } from "react"

export type PriceInsightFlight = {
  final_price: number
  base_price?: number
  occupancy_pct?: number
  days_until_departure?: number
  price_factor?: number
  airline?: string
}

export default function PriceInsight({
  flights,
}: {
  flights: PriceInsightFlight[]
}) {
  const insight = useMemo(() => computeInsight(flights), [flights])

  if (!insight) {
    return (
      <div className="relative bg-gradient-to-b from-[#0D1A2C] to-[#0A1424] p-5 rounded-2xl border border-white/[0.08] ticket-edge overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-400 via-amber-400 to-amber-300" />
        <h3 className="text-sm font-semibold text-gray-300">Price Insight</h3>
        <p className="text-xs text-gray-500 mt-2">
          Search for flights to see live pricing insight.
        </p>
      </div>
    )
  }

  const {
    label,
    labelColor,
    score,
    message,
    advice,
    lowestPrice,
    avgPrice,
    occupancy,
    projectedTrend,
  } = insight

  return (
    <div className="relative bg-gradient-to-b from-[#0D1A2C] to-[#0A1424] p-5 rounded-2xl border border-white/[0.08] space-y-5 ticket-edge overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-400 via-amber-400 to-amber-300" />

      {/* PRICE INSIGHT HEADER & GAUGE */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="font-display text-base font-bold text-white">Price Insight</h3>
          <span
            className={`inline-block text-xs font-semibold px-3 py-1 rounded-full ${
              label === "Low" ? "insight-badge-pulse" : ""
            }`}
            style={{
              backgroundColor: `${labelColor}22`,
              color: labelColor,
              border: `1px solid ${labelColor}40`,
            }}
          >
            {label} Price
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex-1">
            <p className="text-sm text-gray-200 font-medium leading-snug">
              {advice}
            </p>
            <p className="text-xs text-gray-400 mt-1 leading-relaxed">
              {message}
            </p>
          </div>
          <ScoreGauge score={score} color={labelColor} />
        </div>

        {/* METRICS STRIP */}
        <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-white/[0.06]">
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-2.5">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Lowest Fare</p>
            <p className="font-display text-sm font-bold text-[#E8C766]">₹{lowestPrice.toLocaleString("en-IN")}</p>
          </div>
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-2.5">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Route Average</p>
            <p className="font-display text-sm font-bold text-slate-300">₹{avgPrice.toLocaleString("en-IN")}</p>
          </div>
        </div>
      </div>

      <div className="border-t border-dashed border-white/[0.1]" />

      {/* PRICE TREND */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <h3 className="font-display text-base font-bold text-white">Price Trend & Forecast</h3>
          <span className="text-[10px] font-mono text-cyan-300/90 bg-cyan-400/10 px-2 py-0.5 rounded-full border border-cyan-400/20">
            {occupancy}% Booked
          </span>
        </div>

        <p className="text-xs text-gray-400 mb-3 leading-relaxed">
          {projectedTrend.directionLabel}
        </p>

        <TrendChart points={projectedTrend.points} />
      </div>

      {/* NAVBOT PROMPT WIDGET */}
      <div className="border-t border-dashed border-white/[0.1] pt-3">
        <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/[0.04] px-4 py-3.5 flex items-center gap-3">
          <span className="text-lg shrink-0">🤖</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-cyan-300">Smart Price Alert</p>
            <p className="text-[11px] text-slate-400 truncate">Tracking real-time fare updates for this route.</p>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes insightBadgePulse {
          0%,
          100% {
            box-shadow: 0 0 0 0 rgba(74, 222, 128, 0.25);
          }
          50% {
            box-shadow: 0 0 0 6px rgba(74, 222, 128, 0);
          }
        }
        .insight-badge-pulse {
          animation: insightBadgePulse 2.2s ease-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .insight-badge-pulse {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  )
}

// --- gauge -----------------------------------------------------------

function ScoreGauge({ score, color }: { score: number; color: string }) {
  const pct = Math.min(1, Math.max(0, score / 5))
  const angle = pct * 180
  const radius = 36
  const cx = 44
  const cy = 44

  const startAngle = 180 // left
  const endAngle = 180 - angle
  const toRad = (deg: number) => (deg * Math.PI) / 180

  const x1 = cx + radius * Math.cos(toRad(startAngle))
  const y1 = cy - radius * Math.sin(toRad(startAngle))
  const x2 = cx + radius * Math.cos(toRad(endAngle))
  const y2 = cy - radius * Math.sin(toRad(endAngle))

  const largeArc = angle > 180 ? 1 : 0

  const [drawn, setDrawn] = useState(false)
  useEffect(() => {
    setDrawn(false)
    const t = requestAnimationFrame(() => requestAnimationFrame(() => setDrawn(true)))
    return () => cancelAnimationFrame(t)
  }, [score])

  return (
    <div className="relative w-[88px] h-[60px] shrink-0">
      <svg viewBox="0 0 88 50" className="w-full h-full overflow-visible">
        {/* track */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={6}
          strokeLinecap="round"
        />
        {/* value arc */}
        <path
          d={`M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`}
          fill="none"
          stroke={color}
          strokeWidth={6}
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={100}
          strokeDashoffset={drawn ? 0 : 100}
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pt-2">
        <p className="font-display text-lg font-extrabold leading-none">{score.toFixed(1)}</p>
        <p className="text-[10px] text-gray-500">of 5</p>
      </div>
    </div>
  )
}

// --- trend chart -------------------------------------------------------

function TrendChart({ points }: { points: { label: string; price: number }[] }) {
  if (!points.length) return null

  const width = 280
  const height = 110
  const padding = 12

  const prices = points.map((p) => p.price)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const span = max - min || 1

  const coords = points.map((p, i) => {
    const x = padding + (i / (points.length - 1 || 1)) * (width - padding * 2)
    const y = height - padding - ((p.price - min) / span) * (height - padding * 2)
    return { x, y, ...p }
  })

  const linePath = coords
    .map((c, i) => (i === 0 ? `M ${c.x} ${c.y}` : `L ${c.x} ${c.y}`))
    .join(" ")

  const areaPath = `${linePath} L ${coords[coords.length - 1].x} ${height} L ${coords[0].x} ${height} Z`

  const [drawn, setDrawn] = useState(false)
  useEffect(() => {
    setDrawn(false)
    const t = requestAnimationFrame(() => requestAnimationFrame(() => setDrawn(true)))
    return () => cancelAnimationFrame(t)
  }, [points.map((p) => p.price).join(",")])

  return (
    <svg viewBox={`0 0 ${width} ${height + 24}`} className="w-full h-auto">
      <defs>
        <linearGradient id="priceTrendFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#facc15" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#facc15" stopOpacity="0" />
        </linearGradient>
      </defs>

      <path
        d={areaPath}
        fill="url(#priceTrendFill)"
        style={{ opacity: drawn ? 1 : 0, transition: "opacity 500ms ease-out 500ms" }}
      />
      <path
        d={linePath}
        fill="none"
        stroke="#facc15"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={100}
        strokeDasharray={100}
        strokeDashoffset={drawn ? 0 : 100}
        style={{ transition: "stroke-dashoffset 700ms cubic-bezier(0.22,1,0.36,1)" }}
      />

      {coords.map((c, i) => (
        <circle
          key={i}
          cx={c.x}
          cy={c.y}
          r={i === coords.length - 1 ? 4 : 3}
          fill={i === coords.length - 1 ? "#facc15" : "#fde68a"}
          style={{
            transformOrigin: `${c.x}px ${c.y}px`,
            transform: drawn ? "scale(1)" : "scale(0)",
            opacity: drawn ? 1 : 0,
            transition: `transform 300ms cubic-bezier(0.34,1.56,0.64,1) ${500 + i * 90}ms, opacity 200ms ease-out ${
              500 + i * 90
            }ms`,
          }}
        />
      ))}

      {coords.map((c, i) => (
        <text
          key={`label-${i}`}
          x={c.x}
          y={height + 18}
          textAnchor="middle"
          fontSize="9"
          fill="#9ca3af"
          style={{ opacity: drawn ? 1 : 0, transition: `opacity 250ms ease-out ${500 + i * 90}ms` }}
        >
          {c.label}
        </text>
      ))}
    </svg>
  )
}

// --- insight derivation --------------------------------------------------

function computeInsight(flights: PriceInsightFlight[]) {
  const valid = flights.filter((f) => typeof f.final_price === "number")
  if (!valid.length) return null

  const sortedByPrice = [...valid].sort((a, b) => a.final_price - b.final_price)
  const reference = sortedByPrice[0]

  const lowestPrice = reference.final_price
  const avgPrice = Math.round(
    valid.reduce((sum, f) => sum + f.final_price, 0) / valid.length
  )

  const daysOut = typeof reference.days_until_departure === "number" ? reference.days_until_departure : 14
  const occupancy = typeof reference.occupancy_pct === "number" ? reference.occupancy_pct : 60
  const factor = typeof reference.price_factor === "number" ? reference.price_factor : lowestPrice / (reference.base_price || 3500)

  // Compute realistic 0–5 price score:
  // - Close departure (<= 2 days) or high factor (>= 1.3) pushes score to High (3.5 - 5.0)
  // - Medium departure (3–7 days) or factor 1.1–1.3 -> Moderate (2.2 - 3.4)
  // - Early booking (> 7 days) and factor < 1.1 -> Low/Great Deal (0.8 - 2.0)
  let rawScore = 2.5
  if (daysOut <= 1) {
    rawScore = 4.8
  } else if (daysOut <= 3) {
    rawScore = 4.2
  } else if (daysOut <= 7) {
    rawScore = 3.1
  } else if (daysOut <= 14) {
    rawScore = 1.9
  } else {
    rawScore = 1.2
  }

  // Adjust by occupancy and factor
  if (occupancy > 80) rawScore += 0.5
  if (factor > 1.25) rawScore += 0.4
  if (factor < 0.95) rawScore -= 0.3

  const score = clamp(rawScore, 0.6, 4.9)

  let label: string
  let labelColor: string
  let advice: string
  let message: string

  if (score <= 2.1) {
    label = "Low"
    labelColor = "#4ade80" // Green
    advice = "Best time to book."
    message = `Fares for this travel date are at a competitive low. Book now to lock in this rate.`
  } else if (score <= 3.4) {
    label = "Typical"
    labelColor = "#facc15" // Amber
    advice = "Fair market price."
    message = `Prices are in the typical range for this route. Fares are predicted to rise as departure nears.`
  } else {
    label = "High"
    labelColor = "#f87171" // Red
    advice = "High demand period."
    message = daysOut <= 3
      ? `Seats are filling rapidly with departure approaching in ${daysOut} ${daysOut === 1 ? "day" : "days"}. Book immediately to avoid further price spikes.`
      : `Prices are currently elevated due to high route demand (${occupancy}% capacity).`
  }

  const directionLabel =
    daysOut <= 3
      ? "Prices are near peak and will increase as departure nears"
      : daysOut <= 10
      ? "Fares predicted to rise by ~15-25% over the next 4–6 days"
      : "Prices expected to remain steady then rise 2 weeks before departure"

  const projectedTrend = {
    directionLabel,
    points: buildProjectedTrend(lowestPrice, daysOut),
  }

  return {
    label,
    labelColor,
    score,
    advice,
    message,
    lowestPrice,
    avgPrice,
    occupancy,
    projectedTrend,
  }
}

function buildProjectedTrend(currentPrice: number, daysOut: number) {
  // If departure is very close (e.g. 0–3 days)
  if (daysOut <= 3) {
    return [
      { label: "Today", price: currentPrice },
      { label: "+12h", price: Math.round((currentPrice * 1.08) / 10) * 10 },
      { label: "+24h", price: Math.round((currentPrice * 1.18) / 10) * 10 },
      { label: "Gate", price: Math.round((currentPrice * 1.32) / 10) * 10 },
    ]
  }

  // If departure is in 4–10 days
  if (daysOut <= 10) {
    const today = new Date()
    return [0, 2, 4, daysOut].map((offset, idx) => {
      const growth = idx === 0 ? 1.0 : idx === 1 ? 1.07 : idx === 2 ? 1.18 : 1.30
      const d = new Date(today)
      d.setDate(d.getDate() + offset)
      const label = idx === 0 ? "Today" : d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })
      return {
        label,
        price: Math.round((currentPrice * growth) / 10) * 10,
      }
    })
  }

  // Standard multi-week trend projection
  const sampleOffsets = [0, 4, 8, 12, daysOut]
  const today = new Date()

  return sampleOffsets.map((offset, idx) => {
    const growth = idx === 0 ? 1.0 : idx === 1 ? 1.04 : idx === 2 ? 1.12 : idx === 3 ? 1.22 : 1.38
    const d = new Date(today)
    d.setDate(d.getDate() + offset)
    const label = idx === 0 ? "Today" : d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })

    return {
      label,
      price: Math.round((currentPrice * growth) / 10) * 10,
    }
  })
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}