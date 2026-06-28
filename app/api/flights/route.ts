import { supabase } from '@/lib/supabase'
import { NextResponse } from 'next/server'

// ✅ FIXED — departure_time / arrival_time are "HH:MM:SS" strings, NOT ISO datetimes.
// Parsing them as `new Date("06:00:00")` gives Invalid Date → NaN duration.
// We now compute duration by splitting on ":" and doing pure arithmetic.
function parsTimeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number)
  return h * 60 + (m || 0)
}

function getDurationMinutes(flight: any): number {
  const dep = parsTimeToMinutes(flight.departure_time || "00:00")
  let arr = parsTimeToMinutes(flight.arrival_time || "00:00")
  // Handle overnight flights (arrival next day)
  if (arr < dep) arr += 24 * 60
  return arr - dep
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

// GET flights
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)

  const origin = searchParams.get('origin')
  const destination = searchParams.get('destination')

  let query = supabase
    .from("flights")
    .select(`
      *,
      flight_instances (
        id,
        travel_date,
        available_seats,
        seats_economy,
        seats_premium_economy,
        seats_business,
        seats_first,
        tax_amount,
        fee_amount
      )
    `)

  if (origin) query = query.eq('origin', origin)
  if (destination) query = query.eq('destination', destination)

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!data || data.length === 0) {
    return NextResponse.json([])
  }

  // 🔥 STEP 1: Dynamic Pricing
  const enhancedData = data.map((flight) => {
    const instance = flight.flight_instances?.[0]
    const demandFactor = Math.random() * 0.3 + 1

    // ✅ FIXED — don't use `new Date()` on a bare time string for hoursLeft either.
    // We compare today's date + departure time vs now. If your DB stores a full
    // travel_date on the instance, use that; otherwise we approximate with today.
    const travelDate = instance?.travel_date
      ? new Date(instance.travel_date)
      : new Date()

    const [depH, depM] = (flight.departure_time || "00:00").split(":").map(Number)
    const departure = new Date(travelDate)
    departure.setHours(depH, depM || 0, 0, 0)

    const hoursLeft = (departure.getTime() - Date.now()) / (1000 * 60 * 60)

    let timeFactor = 1
    if (hoursLeft < 24) timeFactor = 1.5
    else if (hoursLeft < 72) timeFactor = 1.2

    const final_price = Math.round(flight.base_price * demandFactor * timeFactor)

    // ✅ FIXED — duration is now a human-readable string ("2h 30m"), not NaN milliseconds
    const durationMins = getDurationMinutes(flight)
    const duration = formatDuration(durationMins)

    return {
      ...flight,
      flight_instance_id: instance?.id,
      travel_date: instance?.travel_date,
      available_seats: instance?.available_seats,
      seats_economy: instance?.seats_economy,
      seats_premium_economy: instance?.seats_premium_economy,
      seats_business: instance?.seats_business,
      seats_first: instance?.seats_first,
      tax_amount: instance?.tax_amount,
      fee_amount: instance?.fee_amount,
      final_price,
      duration,           // ✅ now "2h 30m" instead of NaN
      duration_minutes: durationMins,  // ✅ keep numeric version for sorting
    }
  })

  // 🔥 STEP 2: Ranking (Best Flights) — use duration_minutes for sorting
  const rankedFlights = [...enhancedData].sort((a, b) => {
    const priceWeight = 0.7
    const durationWeight = 0.3
    const scoreA = a.final_price * priceWeight + a.duration_minutes * durationWeight
    const scoreB = b.final_price * priceWeight + b.duration_minutes * durationWeight
    return scoreA - scoreB
  })

  // 🔥 STEP 3: Find Cheapest & Fastest
  const cheapest = [...enhancedData].sort((a, b) => a.final_price - b.final_price)[0]
  const fastest = [...enhancedData].sort((a, b) => a.duration_minutes - b.duration_minutes)[0]

  // 🔥 STEP 4: Tagging
  const taggedFlights = rankedFlights.map((flight, index) => {
    const tags: string[] = []
    if (index === 0) tags.push("Best")
    if (flight.id === cheapest.id) tags.push("Cheapest")
    if (flight.id === fastest.id) tags.push("Fastest")
    if (tags.length === 0) tags.push("Recommended")
    return { ...flight, tags }
  })

  console.log("FIRST FLIGHT sample:", {
    departure_time: taggedFlights[0]?.departure_time,
    arrival_time: taggedFlights[0]?.arrival_time,
    duration: taggedFlights[0]?.duration,
    duration_minutes: taggedFlights[0]?.duration_minutes,
    final_price: taggedFlights[0]?.final_price,
  })

  return NextResponse.json(taggedFlights)
}

// CREATE flight
export async function POST(req: Request) {
  const body = await req.json()

  const { data, error } = await supabase
    .from('flights')
    .insert([body])
    .select()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}