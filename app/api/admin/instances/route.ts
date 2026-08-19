import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { recordAdminAuditLog } from "@/lib/admin-auth"
import { deriveFlightNumber } from "@/app/checkout/payment/bookingUtils"

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const date = searchParams.get("date")
    const flightId = searchParams.get("flightId")
    const search = searchParams.get("q")

    let query = supabase
      .from("flight_instances")
      .select("*, flights(*)")
      .order("travel_date", { ascending: true })

    if (date) query = query.eq("travel_date", date)
    if (flightId) query = query.eq("flight_id", flightId)

    const { data: instances, error } = await query

    if (error) throw error

    // Fetch actual booked seats per instance
    const { data: seatCounts } = await supabase
      .from("booking_seats")
      .select("flight_instance_id")

    const bookingSeatCountMap = new Map<string, number>()
    for (const s of seatCounts || []) {
      if (s.flight_instance_id) {
        bookingSeatCountMap.set(s.flight_instance_id, (bookingSeatCountMap.get(s.flight_instance_id) || 0) + 1)
      }
    }

    const todayStr = "2026-08-19"

    let list = (instances || []).map((inst) => {
      const f = inst.flights
      const flightNumber = deriveFlightNumber(f?.airline || "Navigo", inst.id)
      const totalSeats =
        (Number(inst.seats_economy) || 144) +
        (Number(inst.seats_premium_economy) || 18) +
        (Number(inst.seats_business) || 12) +
        (Number(inst.seats_first) || 6)
      
      const realBookedCount = bookingSeatCountMap.get(inst.id) || 0
      const available = Math.max(0, totalSeats - realBookedCount)
      const occupancyPct = totalSeats > 0 ? Math.round((realBookedCount / totalSeats) * 100) : 0

      const isPast = inst.travel_date < todayStr
      const isToday = inst.travel_date === todayStr
      const isUpcoming = inst.travel_date > todayStr
      const status = isPast && (!inst.status || inst.status === "SCHEDULED") ? "DEPARTED" : (inst.status || "SCHEDULED")

      return {
        id: inst.id,
        flightId: inst.flight_id,
        travelDate: inst.travel_date,
        airline: f?.airline || "Navigo Airlines",
        flightNumber,
        origin: f?.origin || "DEL",
        destination: f?.destination || "BLR",
        departureTime: f?.departure_time || "06:00:00",
        arrivalTime: f?.arrival_time || "08:30:00",
        aircraft: f?.aircraft || "Airbus A320neo",
        basePrice: f?.base_price || 4500,
        gate: inst.gate || "G4",
        status,
        isPast,
        isToday,
        isUpcoming,
        totalSeats,
        availableSeats: available,
        bookedSeats: realBookedCount,
        occupancyPct,
        seatsEconomy: inst.seats_economy,
        seatsPremiumEconomy: inst.seats_premium_economy,
        seatsBusiness: inst.seats_business,
        seatsFirst: inst.seats_first,
        taxAmount: inst.tax_amount,
        feeAmount: inst.fee_amount,
      }
    })

    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        (i) =>
          i.flightNumber.toLowerCase().includes(q) ||
          i.airline.toLowerCase().includes(q) ||
          i.origin.toLowerCase().includes(q) ||
          i.destination.toLowerCase().includes(q) ||
          i.travelDate.includes(q)
      )
    }

    return NextResponse.json({ instances: list })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to load flight instances" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { flightId, startDate, endDate, seatsEconomy, seatsPremium, seatsBusiness, seatsFirst, gate } = body

    if (!flightId || !startDate) {
      return NextResponse.json({ error: "Flight ID and Start Date required" }, { status: 400 })
    }

    const { data: flight, error: fErr } = await supabase.from("flights").select("*").eq("id", flightId).single()
    if (fErr || !flight) return NextResponse.json({ error: "Flight not found" }, { status: 404 })

    const start = new Date(startDate)
    const end = endDate ? new Date(endDate) : new Date(startDate)
    const dates: string[] = []

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split("T")[0])
    }

    const econ = Number(seatsEconomy) || 144
    const prem = Number(seatsPremium) || 18
    const biz = Number(seatsBusiness) || 12
    const first = Number(seatsFirst) || 6
    const total = econ + prem + biz + first

    const rows = dates.map((travelDate) => ({
      flight_id: flight.id,
      travel_date: travelDate,
      available_seats: total,
      seats_economy: econ,
      seats_premium_economy: prem,
      seats_business: biz,
      seats_first: first,
      tax_amount: Math.round(flight.base_price * 0.12),
      fee_amount: 450,
      gate: gate || "G4",
    }))

    const { data, error } = await supabase.from("flight_instances").insert(rows).select()
    if (error) throw error

    recordAdminAuditLog(
      { id: "adm-ops", name: "Flight Operations Admin", role: "FLIGHT_OPERATIONS" },
      "GENERATE_INSTANCES",
      `${flight.airline} (${flight.origin} → ${flight.destination}) across ${dates.length} dates`,
      { count: data?.length }
    )

    return NextResponse.json({ success: true, count: data?.length, instances: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to generate instances" }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    const { id, status, gate, available_seats } = body

    if (!id) return NextResponse.json({ error: "Instance ID required" }, { status: 400 })

    const updates: Record<string, any> = {}
    if (status) updates.status = status
    if (gate) updates.gate = gate
    if (available_seats !== undefined) updates.available_seats = Number(available_seats)

    const { data, error } = await supabase
      .from("flight_instances")
      .update(updates)
      .eq("id", id)
      .select("*, flights(*)")
      .single()

    if (error) throw error

    recordAdminAuditLog(
      { id: "adm-ops", name: "Flight Operations Admin", role: "FLIGHT_OPERATIONS" },
      "UPDATE_INSTANCE_STATUS",
      `Instance ID ${id}`,
      updates
    )

    return NextResponse.json({ success: true, instance: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update instance" }, { status: 500 })
  }
}
