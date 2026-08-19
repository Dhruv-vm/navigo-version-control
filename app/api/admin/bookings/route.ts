import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { recordAdminAuditLog } from "@/lib/admin-auth"
import { deriveFlightNumber } from "@/app/checkout/payment/bookingUtils"

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status")
    const search = searchParams.get("q")

    let query = supabase
      .from("bookings")
      .select("*, booking_passengers(*), booking_seats(*)")
      .order("created_at", { ascending: false })

    if (status && status !== "ALL") {
      query = query.eq("status", status)
    }

    const { data: bookings, error } = await query
    if (error) throw error

    // Fetch instances
    const instanceIds = Array.from(
      new Set(
        (bookings || [])
          .flatMap((b) => [b.depart_flight_instance_id, b.return_flight_instance_id])
          .filter(Boolean)
      )
    )

    const { data: instances } = await supabase
      .from("flight_instances")
      .select("*, flights(*)")
      .in("id", instanceIds)

    const instanceMap = new Map((instances || []).map((i) => [i.id, i]))

    let list = (bookings || []).map((b) => {
      const depInst = instanceMap.get(b.depart_flight_instance_id)
      const depFlight = depInst?.flights
      const primaryPax = b.booking_passengers?.[0]
      const paxName = primaryPax
        ? `${primaryPax.title ? primaryPax.title + " " : ""}${primaryPax.first_name || ""} ${primaryPax.last_name || ""}`.trim()
        : "Traveler"

      const flightNumber = depFlight ? deriveFlightNumber(depFlight.airline, depInst?.id || b.id) : "NVG-102"
      const route = depFlight ? `${depFlight.origin} → ${depFlight.destination}` : "DEL → BLR"
      const seat = b.booking_seats?.[0]?.seat_number || "12A"

      return {
        id: b.id,
        pnr: b.pnr || "NVG999",
        status: b.status || "confirmed",
        passengerName: paxName,
        passengerCount: b.passenger_count || b.booking_passengers?.length || 1,
        email: b.contact_email || primaryPax?.email || "customer@navigo.app",
        mobile: b.contact_mobile || primaryPax?.mobile || "—",
        flightNumber,
        airline: depFlight?.airline || "Navigo Airlines",
        route,
        travelDate: depInst?.travel_date || "2026-08-26",
        departureTime: depFlight?.departure_time || "06:00:00",
        seat,
        cabinClass: b.booking_seats?.[0]?.cabin_class || "Economy",
        baseFare: b.base_fare || 4500,
        taxesAndFees: b.taxes_and_fees || 850,
        seatPrice: b.seat_selection_price || 0,
        mealsPrice: b.meals_price || 0,
        totalPrice: b.total_price || 5350,
        paidAmount: b.paid_amount || b.total_price || 5350,
        paymentMethod: b.payment_method || "Credit Card",
        paidAt: b.paid_at || b.created_at,
        createdAt: b.created_at,
        passengers: (b.booking_passengers || []).map((p: any) => ({
          id: p.id,
          name: `${p.first_name || ""} ${p.last_name || ""}`.trim(),
          type: p.passenger_type || "Adult",
          gender: p.gender || "—",
          dob: p.date_of_birth || "—",
          frequentFlyer: p.frequent_flyer || "—",
        })),
        seats: (b.booking_seats || []).map((s: any) => ({
          seatNumber: s.seat_number,
          cabinClass: s.cabin_class,
          price: s.price,
        })),
      }
    })

    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        (b) =>
          b.pnr.toLowerCase().includes(q) ||
          b.passengerName.toLowerCase().includes(q) ||
          b.email.toLowerCase().includes(q) ||
          b.flightNumber.toLowerCase().includes(q) ||
          b.route.toLowerCase().includes(q)
      )
    }

    return NextResponse.json({ bookings: list })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch bookings" }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    const { id, status, reason } = body

    if (!id || !status) {
      return NextResponse.json({ error: "Booking ID and new status required" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("bookings")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single()

    if (error) throw error

    recordAdminAuditLog(
      { id: "adm-booking", name: "Booking Operations Agent", role: "BOOKING_AGENT" },
      `BOOKING_STATUS_${status.toUpperCase()}`,
      `PNR ${data.pnr} (ID: ${id})`,
      { reason, newStatus: status }
    )

    return NextResponse.json({ success: true, booking: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update booking status" }, { status: 500 })
  }
}
