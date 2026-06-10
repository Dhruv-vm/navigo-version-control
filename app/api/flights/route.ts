import { supabase } from '@/lib/supabase'
import { NextResponse } from 'next/server'

// 🧠 helper: calculate duration
const getDuration = (flight: any) => {
  return (
    new Date(flight.arrival_time).getTime() -
    new Date(flight.departure_time).getTime()
  )
}

// GET flights
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)

  const origin = searchParams.get('origin')
  const destination = searchParams.get('destination')

  let query = supabase.from('flights').select('*')

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
    const demandFactor = Math.random() * 0.3 + 1

    const departure = new Date(flight.departure_time)
    const now = new Date()

    const hoursLeft =
      (departure.getTime() - now.getTime()) / (1000 * 60 * 60)

    let timeFactor = 1
    if (hoursLeft < 24) timeFactor = 1.5
    else if (hoursLeft < 72) timeFactor = 1.2

    const final_price = Math.round(
      flight.base_price * demandFactor * timeFactor
    )

    return {
      ...flight,
      final_price,
      duration: getDuration(flight),
    }
  })

  // 🔥 STEP 2: Ranking (Best Flights)
  const rankedFlights = [...enhancedData].sort((a, b) => {
    const priceWeight = 0.7
    const durationWeight = 0.3

    const scoreA =
      a.final_price * priceWeight + a.duration * durationWeight

    const scoreB =
      b.final_price * priceWeight + b.duration * durationWeight

    return scoreA - scoreB
  })

  // 🔥 STEP 3: Find Cheapest & Fastest (ONLY ONCE)
  const cheapest = [...enhancedData].sort(
    (a, b) => a.final_price - b.final_price
  )[0]

  const fastest = [...enhancedData].sort(
    (a, b) => a.duration - b.duration
  )[0]

  // 🔥 STEP 4: Tagging
  const taggedFlights = rankedFlights.map((flight, index) => {
    const tags: string[] = []

    if (index === 0) tags.push("Best")
    if (flight.id === cheapest.id) tags.push("Cheapest")
    if (flight.id === fastest.id) tags.push("Fastest")

    if (tags.length === 0) tags.push("Recommended")

    return {
      ...flight,
      tags,
    }
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