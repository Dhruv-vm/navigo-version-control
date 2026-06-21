// lib/pricing.ts
//
// Dynamic pricing engine for flight instances.
//
// final_price = base_price × demand_factor × days_factor × dow_factor × jitter_factor
//
// Each factor is a multiplier centered around 1.0, then the combined
// multiplier is clamped to a sane range so prices never spike or crash
// unrealistically. This is intentionally a pure function (no DB/network
// calls) so it's easy to unit test and easy to reuse once per-cabin-class
// seat buckets (economy/business/first) replace the current single
// `available_seats` column — at that point this same function can just be
// called once per cabin with that cabin's own seats + base price.

export const TOTAL_SEATS = 180 // constant cabin capacity until a real column exists

export type PricingInput = {
  basePrice: number
  availableSeats: number
  totalSeats?: number
  travelDate: string // "YYYY-MM-DD"
  today?: Date // injectable for testing; defaults to now
}

export type PricingBreakdown = {
  finalPrice: number
  basePrice: number
  demandFactor: number
  daysFactor: number
  dowFactor: number
  jitterFactor: number
  combinedMultiplier: number
  occupancyPct: number // 0–100, how full the flight is
  daysUntilDeparture: number
}

// --- individual factor calculations -----------------------------------

// Fuller flights cost more. Scales from ~0.9 (mostly empty) to ~1.45
// (nearly sold out), with a steep ramp in the last 10% of seats — that's
// the "few seats left, price is climbing fast" feeling.
function getDemandFactor(availableSeats: number, totalSeats: number): number {
  const occupancy = clamp(1 - availableSeats / totalSeats, 0, 1)

  if (occupancy < 0.5) return 0.9 + occupancy * 0.2 // 0.90 → 1.00
  if (occupancy < 0.85) return 1.0 + (occupancy - 0.5) * 0.571 // 1.00 → 1.20
  return 1.2 + (occupancy - 0.85) * 1.667 // 1.20 → 1.45 as it nears full
}

// Classic "book early, save money" curve. Far out = cheaper, last few
// days = noticeably pricier, same-day = most expensive.
function getDaysFactor(daysUntilDeparture: number): number {
  if (daysUntilDeparture <= 0) return 1.6
  if (daysUntilDeparture <= 2) return 1.45
  if (daysUntilDeparture <= 5) return 1.25
  if (daysUntilDeparture <= 10) return 1.1
  if (daysUntilDeparture <= 21) return 1.0
  if (daysUntilDeparture <= 45) return 0.92
  return 0.85 // booked far in advance
}

// Friday/Sunday (peak leisure + return-to-work travel) cost a bit more;
// midweek is cheapest.
function getDowFactor(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number)
  const date = new Date(y, (m || 1) - 1, d || 1)
  const dow = date.getDay() // 0 = Sun ... 6 = Sat

  const factorsByDow: Record<number, number> = {
    0: 1.12, // Sunday
    1: 0.95, // Monday
    2: 0.92, // Tuesday
    3: 0.92, // Wednesday
    4: 0.98, // Thursday
    5: 1.15, // Friday
    6: 1.05, // Saturday
  }

  return factorsByDow[dow] ?? 1.0
}

// Small deterministic-ish wobble so prices don't feel robotic. Seeded
// from the date + seats so the SAME flight instance returns the SAME
// jitter on every request (no flickering price between page reloads),
// while still varying across instances/dates.
function getJitterFactor(seed: string): number {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i)
    hash |= 0
  }
  const normalized = (Math.abs(hash) % 1000) / 1000 // 0..1
  return 0.97 + normalized * 0.06 // 0.97 → 1.03
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function daysBetween(today: Date, travelDateStr: string): number {
  const [y, m, d] = travelDateStr.split("-").map(Number)
  const travel = new Date(y, (m || 1) - 1, d || 1)

  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const diffMs = travel.getTime() - todayMidnight.getTime()
  return Math.round(diffMs / (1000 * 60 * 60 * 24))
}

// --- public entry point -------------------------------------------------

export function computeDynamicPrice(input: PricingInput): PricingBreakdown {
  const totalSeats = input.totalSeats ?? TOTAL_SEATS
  const availableSeats = clamp(input.availableSeats, 0, totalSeats)
  const today = input.today ?? new Date()

  const daysUntilDeparture = daysBetween(today, input.travelDate)
  const occupancyPct = Math.round((1 - availableSeats / totalSeats) * 100)

  const demandFactor = getDemandFactor(availableSeats, totalSeats)
  const daysFactor = getDaysFactor(daysUntilDeparture)
  const dowFactor = getDowFactor(input.travelDate)
  const jitterFactor = getJitterFactor(`${input.travelDate}-${availableSeats}`)

  // Clamp the COMBINED multiplier (not each factor individually) so the
  // worst-case stacking (full flight + last-minute + Friday + jitter high)
  // still lands in a believable range — roughly 0.8x to 2.0x base price.
  const rawMultiplier = demandFactor * daysFactor * dowFactor * jitterFactor
  const combinedMultiplier = clamp(rawMultiplier, 0.8, 2.0)

  const finalPrice = Math.round((input.basePrice * combinedMultiplier) / 10) * 10 // round to nearest ₹10

  return {
    finalPrice,
    basePrice: input.basePrice,
    demandFactor,
    daysFactor,
    dowFactor,
    jitterFactor,
    combinedMultiplier,
    occupancyPct,
    daysUntilDeparture,
  }
}