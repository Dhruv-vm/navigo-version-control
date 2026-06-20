import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

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

    // ✅ convert ISO → YYYY-MM-DD
    const departDate = new Date(depart).toISOString().split("T")[0]

    const { data, error } = await supabase
      .from("flight_instances")
      .select(`
        id,
        travel_date,
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

    // ✅ FIX RELATION (array → object)
    const flights = (data || [])
      .map((item: any) => {
        const f = Array.isArray(item.flights)
          ? item.flights[0]
          : item.flights

        if (!f) return null

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

          // ✅ FINAL PRICE FIX
          final_price:
            f.base_price && f.base_price > 0
              ? f.base_price
              : 5000, // fallback safety
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