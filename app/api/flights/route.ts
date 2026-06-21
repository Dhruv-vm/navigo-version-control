import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { computeDynamicPrice, TOTAL_SEATS } from "@/lib/pricing"

// ✅ FIXED — the old code did:
//   new Date(depart).toISOString().split("T")[0]
// `new Date("2026-06-22")` is parsed as UTC midnight. `.toISOString()`
// then converts back to UTC — which silently shifts the date by a day
// whenever the incoming string carries a timezone offset, or whenever
// the server isn't running in UTC. Now that SearchBox sends plain
// "YYYY-MM-DD" strings, the regex branch below handles them directly
// and this Date fallback only exists as a defensive safety net.
function toDateOnly(value: string): string {
  const plainMatch = value.match(/^(\d{4}-\d{2}-\d{2})/)
  if (plainMatch) return plainMatch[1]

  const d = new Date(value)
  if (isNaN(d.getTime())) return value

  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const origin = searchParams.get("origin")
    const destination = searchParams.get("destination")
    const depart = searchParams.get("depart")

    if (!origin || !destination || !depart) {
      return NextResponse.json(
        { error: "Missing params" },
        { status: 400 }
      )
    }

    // ✅ timezone-safe date normalization (see toDateOnly above)
    const departDate = toDateOnly(depart)

    const { data, error } = await supabase
      .from("flight_instances")
      .select(`
        id,
        travel_date,
        available_seats,
        flights!inner (
          id,
          airline,
          origin,
          destination,
          departure_time,
          arrival_time,
          aircraft,
          base_price,
          stops
        )
      `)
      .eq("travel_date", departDate)
      .eq("flights.origin", origin.toUpperCase())
      .eq("flights.destination", destination.toUpperCase())

    if (error) {
      console.error("SUPABASE ERROR:", error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    console.log("[/api/flights] query:", {
      origin: origin.toUpperCase(),
      destination: destination.toUpperCase(),
      departDate,
      rowsFound: data?.length ?? 0,
    })

    // ✅ FIX RELATION (array → object) + ✅ DYNAMIC PRICING
    const flights = (data || [])
      .map((item: any) => {
        const f = Array.isArray(item.flights)
          ? item.flights[0]
          : item.flights

        if (!f) return null

        const basePrice = f.base_price && f.base_price > 0 ? f.base_price : 5000
        const availableSeats =
          typeof item.available_seats === "number" ? item.available_seats : TOTAL_SEATS

        // 🧠 DYNAMIC PRICING — replaces the old flat `final_price = base_price`.
        // Factors in how full the flight is, how close departure is, day
        // of week, and a small per-instance jitter. See lib/pricing.ts for
        // the full breakdown of each factor.
        const pricing = computeDynamicPrice({
          basePrice,
          availableSeats,
          totalSeats: TOTAL_SEATS,
          travelDate: item.travel_date,
        })

        return {
          id: item.id,
          airline: f.airline,
          origin: f.origin,
          destination: f.destination,
          // ✅ combine date + time
          departure_time: `${item.travel_date}T${f.departure_time}`,
          arrival_time: `${item.travel_date}T${f.arrival_time}`,
          aircraft: f.aircraft,
          stops: f.stops ?? 0,
          final_price: pricing.finalPrice,
          // 🧠 extra fields the "AI Box" / Price Insight widget can use
          // directly without recomputing anything client-side
          base_price: basePrice,
          available_seats: availableSeats,
          occupancy_pct: pricing.occupancyPct,
          days_until_departure: pricing.daysUntilDeparture,
          price_factor: Math.round(pricing.combinedMultiplier * 100) / 100,
        }
      })
      .filter(Boolean)

    return NextResponse.json({ flights })
  } catch (err) {
    console.error("SERVER ERROR:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}