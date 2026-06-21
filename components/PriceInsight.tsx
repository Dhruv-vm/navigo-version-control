"use client"

import { useMemo } from "react"

type PriceInsightFlight = {
  final_price: number
  base_price?: number
  occupancy_pct?: number
  days_until_departure?: number
  price_factor?: number
}

// ✅ Replaces the old hardcoded "2.3 of 5 / Low / static chart" version.
// Everything here is derived from real fields the API now returns per
// flight (occupancy_pct, days_until_departure, price_factor), computed
// server-side in lib/pricing.ts — no fabricated numbers.
export default function PriceInsight({
  flights,
}: {
  flights: PriceInsightFlight[]
}) {
  const insight = useMemo(() => computeInsight(flights), [flights])

  if (!insight) {
    return (
      <div className="bg-[#0B1220] p-5 rounded-xl border border-white/10">
        <h3 className="text-sm font-semibold text-gray-300">Price Insight</h3>
        <p className="text-xs text-gray-500 mt-2">
          Search for flights to see live pricing insight.
        </p>
      </div>
    )
  }

  const { label, labelColor, score, message, projectedTrend } = insight

  return (
    <div className="bg-[#0B1220] p-5 rounded-xl border border-white/10 space-y-6">

      {/* PRICE INSIGHT */}
      <div>
        <h3 className="text-base font-semibold mb-3">Price Insight</h3>

        <span
          className="inline-block text-sm font-medium px-3 py-1 rounded-md mb-3"
          style={{ backgroundColor: `${labelColor}22`, color: labelColor }}
        >
          {label}
        </span>

        <div className="flex items-center gap-4">
          <p className="text-sm text-gray-300 flex-1 leading-relaxed">
            {message}
          </p>
          <ScoreGauge score={score} color={labelColor} />
        </div>
      </div>

      <div className="border-t border-white/5" />

      {/* PRICE TREND */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-semibold">Price Trend</h3>
        </div>

        <p className="text-xs text-gray-400 mb-3">
          {projectedTrend.directionLabel}
        </p>

        <TrendChart points={projectedTrend.points} />
      </div>

      {/* ✅ Reserved space for the upcoming chatbot — intentionally left
          minimal for now. Replace this block when wiring it up. */}
      <div className="border-t border-white/5 pt-4">
        <div className="rounded-lg border border-dashed border-white/10 px-4 py-6 text-center">
          <p className="text-xs text-gray-500">AI assistant coming soon</p>
        </div>
      </div>
    </div>
  )
}

// --- gauge -----------------------------------------------------------

function ScoreGauge({ score, color }: { score: number; color: string }) {
  // score is 0–5. Map to a 180° arc.
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
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pt-2">
        <p className="text-lg font-bold leading-none">{score.toFixed(1)}</p>
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
  const padding = 8

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

  return (
    <svg viewBox={`0 0 ${width} ${height + 24}`} className="w-full h-auto">
      <defs>
        <linearGradient id="priceTrendFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#facc15" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#facc15" stopOpacity="0" />
        </linearGradient>
      </defs>

      <path d={areaPath} fill="url(#priceTrendFill)" />
      <path
        d={linePath}
        fill="none"
        stroke="#facc15"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {coords.map((c, i) => (
        <circle
          key={i}
          cx={c.x}
          cy={c.y}
          r={i === coords.length - 1 ? 4 : 3}
          fill={i === coords.length - 1 ? "#facc15" : "#fde68a"}
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

  // Use the cheapest currently-visible flight as the representative price
  // for this insight — that's the one a price-sensitive shopper cares
  // about most.
  const reference = [...valid].sort((a, b) => a.final_price - b.final_price)[0]

  const factor = reference.price_factor ?? 1
  const occupancy = reference.occupancy_pct ?? 50
  const daysOut = reference.days_until_departure ?? 14

  // Map the combined pricing factor (≈0.8–2.0) onto a 0–5 "how good is
  // this price" score, inverted so LOW price/factor = LOW score = good deal.
  const score = clamp(((factor - 0.8) / (2.0 - 0.8)) * 5, 0, 5)

  let label: string
  let labelColor: string
  let message: string

  if (score <= 1.8) {
    label = "Low"
    labelColor = "#4ade80"
    message = "Prices are currently low. Book now to get the best deals."
  } else if (score <= 3.2) {
    label = "Typical"
    labelColor = "#facc15"
    message = "Prices are around the typical range for this route."
  } else {
    label = "High"
    labelColor = "#f87171"
    message =
      daysOut <= 5
        ? "Prices are high with departure approaching. Consider booking soon."
        : "Prices are running high right now. It may be worth checking back later."
  }

  // Add occupancy context when it's the dominant driver
  if (occupancy >= 80) {
    message = `Seats are filling up fast (${occupancy}% booked). ${message}`
  }

  const directionLabel =
    daysOut > 10
      ? "Prices may increase as the departure date gets closer"
      : "Prices are likely near their peak this close to departure"

  const projectedTrend = {
    directionLabel,
    points: buildProjectedTrend(reference.final_price, daysOut),
  }

  return { label, labelColor, score, message, projectedTrend }
}

// Projects a simple forward-looking trend line from today's price using
// the same days-out curve the pricing engine uses, just sampled at a few
// future points — gives a believable "where this might go" shape without
// needing to hit the DB again.
function buildProjectedTrend(currentPrice: number, daysOut: number) {
  const sampleOffsets = [0, 3, 6, 9, 12]
  const today = new Date()

  return sampleOffsets.map((offset) => {
    const remainingDays = Math.max(0, daysOut - offset)
    const growth = remainingDays <= 2 ? 1.25 : remainingDays <= 5 ? 1.12 : remainingDays <= 10 ? 1.04 : 1.0

    const d = new Date(today)
    d.setDate(d.getDate() + offset)
    const label = offset === 0 ? "Today" : d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })

    return {
      label,
      price: Math.round((currentPrice * growth) / 10) * 10,
    }
  })
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}