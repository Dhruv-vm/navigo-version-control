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

  // ✅ FIXED — frontend sends the outbound date as `depart` (matches roundtrip's
  // `return` param naming), not `date`. Accept `depart` as primary, fall back
  // to `date` in case any other caller uses that name.
  const date = searchParams.get('depart') || searchParams.get('date')

  // ✅ FIXED — a flight search is meaningless without a date, since seat
  // inventory is per flight_instance, not per flight. Reject early instead
  // of silently returning every date for the route.
  if (!date) {
    return NextResponse.json(
      { error: 'A travel date is required to search flights.' },
      { status: 400 }
    )
  }

  let query = supabase
    .from("flights")
    // ✅ FIXED — `!inner` makes this an INNER JOIN, so a flight is only
    // returned if it has a matching flight_instances row. Previously this
    // was a left join with no date filter, so flights with zero instances
    // for the searched date (or any date) were still returned, and the code
    // below just grabbed flight_instances[0] — whatever instance happened
    // to be first, regardless of the date the user searched.
    .select(`
      *,
      flight_instances!inner (
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
    // ✅ FIXED — filter the joined instance by the requested date
    .eq('flight_instances.travel_date', date)

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
    // ✅ Safe now — thanks to the inner join + eq filter above, this array
    // is guaranteed to contain exactly the instance for the searched date.
    const instance = flight.flight_instances?.[0]

    const demandFactor = Math.random() * 0.3 + 1

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
      duration,
      duration_minutes: durationMins,
    }
  })

  // 🔥 STEP 2: Ranking (Best Flights)
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