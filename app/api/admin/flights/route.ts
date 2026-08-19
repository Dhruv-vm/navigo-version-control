import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { recordAdminAuditLog } from "@/lib/admin-auth"

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const airline = searchParams.get("airline")
    const origin = searchParams.get("origin")
    const destination = searchParams.get("destination")
    const search = searchParams.get("q")

    let query = supabase.from("flights").select("*").order("airline", { ascending: true })

    if (airline) query = query.eq("airline", airline)
    if (origin) query = query.eq("origin", origin.toUpperCase())
    if (destination) query = query.eq("destination", destination.toUpperCase())

    const { data: flights, error } = await query

    if (error) throw error

    let list = flights || []
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        (f) =>
          f.airline?.toLowerCase().includes(q) ||
          f.origin?.toLowerCase().includes(q) ||
          f.destination?.toLowerCase().includes(q) ||
          f.aircraft?.toLowerCase().includes(q)
      )
    }

    return NextResponse.json({ flights: list })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch flights" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      airline,
      origin,
      destination,
      departure_time,
      arrival_time,
      duration,
      aircraft,
      base_price,
      stops = 0,
      stop_airport,
    } = body

    if (!airline || !origin || !destination || !departure_time || !arrival_time || !base_price) {
      return NextResponse.json({ error: "Missing required flight attributes" }, { status: 400 })
    }

    const newFlight = {
      airline,
      origin: origin.toUpperCase(),
      destination: destination.toUpperCase(),
      departure_time,
      arrival_time,
      duration: duration || "2h 30m",
      aircraft: aircraft || "Airbus A320neo",
      base_price: Number(base_price),
      stops: Number(stops) || 0,
      stop_airport: stop_airport || null,
      rating: 4.8,
      rating_count: 120,
      on_time_pct: 94,
    }

    const { data, error } = await supabase.from("flights").insert(newFlight).select().single()

    if (error) throw error

    recordAdminAuditLog(
      { id: "adm-ops", name: "Flight Operations Admin", role: "FLIGHT_OPERATIONS" },
      "CREATE_FLIGHT",
      `${airline} (${origin} → ${destination})`,
      data
    )

    return NextResponse.json({ success: true, flight: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create flight" }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    const { id, ...updates } = body

    if (!id) return NextResponse.json({ error: "Flight ID required" }, { status: 400 })

    const { data, error } = await supabase
      .from("flights")
      .update(updates)
      .eq("id", id)
      .select()
      .single()

    if (error) throw error

    recordAdminAuditLog(
      { id: "adm-ops", name: "Flight Operations Admin", role: "FLIGHT_OPERATIONS" },
      "UPDATE_FLIGHT",
      `Flight ${id}`,
      updates
    )

    return NextResponse.json({ success: true, flight: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update flight" }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")

    if (!id) return NextResponse.json({ error: "Flight ID required" }, { status: 400 })

    const { error } = await supabase.from("flights").delete().eq("id", id)
    if (error) throw error

    recordAdminAuditLog(
      { id: "adm-super", name: "Super Admin", role: "SUPER_ADMIN" },
      "DELETE_FLIGHT",
      `Flight ID ${id}`
    )

    return NextResponse.json({ success: true, message: `Flight ${id} removed` })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to delete flight" }, { status: 500 })
  }
}
