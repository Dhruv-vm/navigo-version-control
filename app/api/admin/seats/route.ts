import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { recordAdminAuditLog } from "@/lib/admin-auth"
import { getBlockedSeatsForInstance, setSeatBlockState } from "@/lib/seats"

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const flightInstanceId = searchParams.get("flightInstanceId")

    if (!flightInstanceId) {
      return NextResponse.json({ error: "flightInstanceId parameter is required" }, { status: 400 })
    }

    // 1. Fetch flight instance details
    const { data: instance, error: iErr } = await supabase
      .from("flight_instances")
      .select("*, flights(*)")
      .eq("id", flightInstanceId)
      .single()

    if (iErr || !instance) {
      return NextResponse.json({ error: "Flight instance not found" }, { status: 404 })
    }

    // 2. Fetch booked seats from booking_seats
    const { data: bookedRows } = await supabase
      .from("booking_seats")
      .select("*, booking_passengers(*)")
      .eq("flight_instance_id", flightInstanceId)

    const bookedMap = new Map((bookedRows || []).map((b) => [b.seat_number, b]))

    // 3. Get blocked seats
    const blockedSeats = getBlockedSeatsForInstance(flightInstanceId)

    const aircraft = instance.flights?.aircraft || "Airbus A320neo"

    return NextResponse.json({
      flightInstanceId,
      aircraft,
      airline: instance.flights?.airline || "Navigo",
      travelDate: instance.travel_date,
      bookedSeats: Array.from(bookedMap.keys()),
      blockedSeats,
      bookedDetails: (bookedRows || []).map((b) => ({
        seatNumber: b.seat_number,
        cabinClass: b.cabin_class,
        passengerName: b.booking_passengers
          ? `${b.booking_passengers.first_name || ""} ${b.booking_passengers.last_name || ""}`.trim()
          : "Booked Traveler",
        bookingId: b.booking_id,
        price: b.price,
      })),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to load seat map" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { flightInstanceId, seatNumber, action } = body // action: "BLOCK" | "UNBLOCK"

    if (!flightInstanceId || !seatNumber) {
      return NextResponse.json({ error: "flightInstanceId and seatNumber required" }, { status: 400 })
    }

    const isBlock = action !== "UNBLOCK"
    const blockedSeats = setSeatBlockState(flightInstanceId, seatNumber, isBlock)

    recordAdminAuditLog(
      { id: "adm-ops", name: "Seat Controller", role: "FLIGHT_OPERATIONS" },
      isBlock ? "BLOCK_SEAT" : "UNBLOCK_SEAT",
      `Seat ${seatNumber} (Instance: ${flightInstanceId})`
    )

    return NextResponse.json({
      success: true,
      message: isBlock ? `Seat ${seatNumber} blocked for operations` : `Seat ${seatNumber} unblocked`,
      blockedSeats,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to modify seat block state" }, { status: 500 })
  }
}
