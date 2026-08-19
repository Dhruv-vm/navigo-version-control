import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/auth"
import { getBiometricProfile } from "@/lib/biometrics"
import { deriveFlightNumber } from "@/app/checkout/payment/bookingUtils"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const pnr = (body?.pnr || "").trim().toUpperCase()
    const lastName = (body?.lastName || "").trim().toLowerCase()

    if (!pnr) {
      return NextResponse.json({ error: "Please provide a valid 6-character PNR reference" }, { status: 400 })
    }

    // 1. Fetch booking record
    const { data: booking, error: bErr } = await supabase
      .from("bookings")
      .select("*")
      .eq("pnr", pnr)
      .single()

    if (bErr || !booking) {
      return NextResponse.json(
        { error: `No active booking found for PNR ${pnr}. Please verify your reference code.` },
        { status: 404 }
      )
    }

    // 2. Fetch passengers
    const { data: passengers } = await supabase
      .from("booking_passengers")
      .select("*")
      .eq("booking_id", booking.id)
      .order("passenger_index", { ascending: true })

    const paxList = passengers || []
    if (lastName && paxList.length > 0) {
      const match = paxList.some((p) => (p.last_name || "").toLowerCase() === lastName)
      if (!match) {
        return NextResponse.json(
          { error: `Last name "${lastName}" does not match booking record for PNR ${pnr}.` },
          { status: 400 }
        )
      }
    }

    // 3. Fetch flight instances & flights
    const instanceIds = [booking.depart_flight_instance_id, booking.return_flight_instance_id].filter(Boolean)
    const { data: instances } = await supabase
      .from("flight_instances")
      .select("*, flights(*)")
      .in("id", instanceIds)

    const instanceMap = new Map((instances || []).map((inst) => [inst.id, inst]))

    // 4. Fetch seats
    const { data: seats } = await supabase
      .from("booking_seats")
      .select("*")
      .eq("booking_id", booking.id)

    // 5. Build legs
    const legs = []
    if (booking.depart_flight_instance_id && instanceMap.has(booking.depart_flight_instance_id)) {
      const inst = instanceMap.get(booking.depart_flight_instance_id)
      const f = inst.flights
      legs.push({
        legLabel: booking.return_flight_instance_id ? "Departure" : null,
        flightInstanceId: inst.id,
        airline: f?.airline || "Navigo Airlines",
        flightNumber: deriveFlightNumber(f?.airline || "Navigo", inst.id),
        origin: f?.origin || "DEL",
        destination: f?.destination || "BLR",
        travelDate: inst.travel_date,
        departureTime: f?.departure_time,
        arrivalTime: f?.arrival_time,
        aircraft: f?.aircraft || "Airbus A320neo",
        gate: inst.gate || "TBA",
      })
    }

    if (booking.return_flight_instance_id && instanceMap.has(booking.return_flight_instance_id)) {
      const inst = instanceMap.get(booking.return_flight_instance_id)
      const f = inst.flights
      legs.push({
        legLabel: "Return",
        flightInstanceId: inst.id,
        airline: f?.airline || "Navigo Airlines",
        flightNumber: deriveFlightNumber(f?.airline || "Navigo", inst.id),
        origin: f?.origin || "BLR",
        destination: f?.destination || "DEL",
        travelDate: inst.travel_date,
        departureTime: f?.departure_time,
        arrivalTime: f?.arrival_time,
        aircraft: f?.aircraft || "Airbus A320neo",
        gate: inst.gate || "TBA",
      })
    }

    // 6. Check Biometric Profile for user
    const authUser = getUserFromRequest(req)
    const userIdToCheck = booking.user_id || authUser?.userId
    let biometricProfile = null
    if (userIdToCheck) {
      biometricProfile = await getBiometricProfile(userIdToCheck)
    }

    const formattedPassengers = paxList.map((p) => ({
      id: p.id,
      name: `${p.title ? p.title + " " : ""}${p.first_name} ${p.last_name}`.trim(),
      firstName: p.first_name,
      lastName: p.last_name,
      email: p.email || booking.contact_email,
      isPrimary: p.is_primary_contact,
      type: p.passenger_type,
    }))

    const formattedSeats = (seats || []).map((s) => ({
      flightInstanceId: s.flight_instance_id,
      passengerId: s.passenger_id,
      seatNumber: s.seat_number,
      cabinClass: s.cabin_class,
    }))

    return NextResponse.json({
      success: true,
      booking: {
        id: booking.id,
        pnr: booking.pnr,
        status: booking.status,
        totalPrice: booking.total_price,
        travelDate: legs[0]?.travelDate || null,
        legs,
        passengers: formattedPassengers,
        seats: formattedSeats,
      },
      hasBiometricProfile: !!biometricProfile && biometricProfile.isActive,
      biometricProfile: biometricProfile
        ? {
            biometricProfileId: biometricProfile.biometricProfileId,
            lastVerifiedAt: biometricProfile.lastVerifiedAt,
            isActive: biometricProfile.isActive,
          }
        : null,
      canSmartCheckIn: true,
    })
  } catch (err: any) {
    console.error("Check-in PNR verification error:", err)
    return NextResponse.json({ error: err.message || "Failed to verify booking PNR" }, { status: 500 })
  }
}
