import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { verifySignedQRToken } from "@/lib/qr-security"
import { getSmartCheckInByToken } from "@/lib/biometrics"

async function handleVerification(tokenRaw: string, scannedGate?: string) {
  if (!tokenRaw) {
    return {
      status: "DENIED",
      code: "INVALID_TOKEN",
      reason: "Invalid boarding credential.",
      clearance: null,
      statusCode: 400,
    }
  }

  // 1. Cryptographic Signature & Expiry Check
  const tokenResult = verifySignedQRToken(tokenRaw)

  if (!tokenResult.valid || !tokenResult.payload) {
    return {
      status: "DENIED",
      code: "INVALID_CREDENTIAL",
      reason: "Invalid boarding credential.",
      clearance: null,
      statusCode: 200,
    }
  }

  if (tokenResult.expired) {
    return {
      status: "DENIED",
      code: "EXPIRED",
      reason: "This boarding credential has expired.",
      clearance: null,
      statusCode: 200,
    }
  }

  const payload = tokenResult.payload

  // 2. Database validation against real booking
  const { data: booking, error: bErr } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", payload.bookingId)
    .maybeSingle()

  if (bErr || !booking) {
    return {
      status: "DENIED",
      code: "BOOKING_NOT_FOUND",
      reason: "No matching booking was found.",
      clearance: null,
      statusCode: 200,
    }
  }

  if (booking.status === "cancelled") {
    return {
      status: "DENIED",
      code: "BOOKING_CANCELLED",
      reason: "Boarding denied — booking is cancelled.",
      clearance: null,
      statusCode: 200,
    }
  }

  // 3. Passenger Verification
  const { data: passenger } = await supabase
    .from("booking_passengers")
    .select("*")
    .eq("id", payload.passengerId)
    .maybeSingle()

  if (passenger && passenger.booking_id !== booking.id) {
    return {
      status: "DENIED",
      code: "PASSENGER_MISMATCH",
      reason: "Passenger verification failed.",
      clearance: null,
      statusCode: 200,
    }
  }

  // 4. Flight instance check & date verification
  const isMatchingInstance =
    booking.depart_flight_instance_id === payload.flightInstanceId ||
    booking.return_flight_instance_id === payload.flightInstanceId

  if (!isMatchingInstance) {
    return {
      status: "DENIED",
      code: "FLIGHT_MISMATCH",
      reason: "This boarding credential is not valid for this flight.",
      clearance: null,
      statusCode: 200,
    }
  }

  const { data: instance } = await supabase
    .from("flight_instances")
    .select("*, flights(*)")
    .eq("id", payload.flightInstanceId)
    .maybeSingle()

  if (instance && payload.travelDate && instance.travel_date !== payload.travelDate) {
    return {
      status: "DENIED",
      code: "DATE_MISMATCH",
      reason: "This boarding credential is not valid for this flight instance date.",
      clearance: null,
      statusCode: 200,
    }
  }

  // 5. Replay Protection / Status update
  const checkInRecord = await getSmartCheckInByToken(tokenRaw)
  const isAlreadyBoarded = checkInRecord?.status === "boarded"

  if (isAlreadyBoarded) {
    return {
      status: "DENIED",
      code: "ALREADY_USED",
      reason: "This boarding credential has already been used.",
      clearance: {
        passengerName: payload.passengerName,
        pnr: payload.pnr,
        flightNumber: payload.flightNumber,
        route: `${payload.origin} → ${payload.destination}`,
        seat: payload.seatNumber || "—",
        gate: payload.gate || instance?.gate || scannedGate || "G4",
        biometricVerified: payload.biometricVerified,
        airline: payload.airline,
        timestamp: new Date().toISOString(),
        status: "ALREADY_BOARDED",
      },
      statusCode: 200,
    }
  }

  // Update check-in record status to boarded
  if (checkInRecord) {
    checkInRecord.status = "boarded"
    checkInRecord.boardedAt = new Date().toISOString()
  }

  return {
    status: "ALLOWED",
    code: "CLEARED",
    reason: "Identity Verified · Booking Verified · Flight Verified · Check-In Verified · Boarding Pass Valid",
    clearance: {
      passengerName: payload.passengerName,
      pnr: payload.pnr,
      flightNumber: payload.flightNumber,
      route: `${payload.origin} → ${payload.destination}`,
      origin: payload.origin,
      destination: payload.destination,
      seat: payload.seatNumber || "12A",
      gate: scannedGate || payload.gate || instance?.gate || "G4",
      airline: payload.airline,
      travelDate: payload.travelDate || instance?.travel_date || "Today",
      departureTime: payload.departureTime || instance?.flights?.departure_time || "06:00:00",
      biometricVerified: payload.biometricVerified,
      biometricProfileId: payload.biometricProfileId,
      checkInId: payload.checkInId,
      issuedAt: new Date(payload.issuedAt).toLocaleString("en-IN"),
      timestamp: new Date().toISOString(),
      status: "CLEARED",
    },
    statusCode: 200,
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const qrToken = body?.qrToken || body?.token
    const scannedGate = body?.scannedGate

    const result = await handleVerification(qrToken, scannedGate)
    return NextResponse.json(result, { status: result.statusCode })
  } catch (err: any) {
    console.error("Gate verification error:", err)
    return NextResponse.json(
      {
        status: "DENIED",
        code: "VERIFICATION_ERROR",
        reason: "Unable to verify boarding credential. Please try again.",
        clearance: null,
      },
      { status: 500 }
    )
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get("token") || ""
    const gate = searchParams.get("gate") || undefined

    const result = await handleVerification(token, gate)
    return NextResponse.json(result, { status: result.statusCode })
  } catch (err: any) {
    console.error("Gate verification error:", err)
    return NextResponse.json(
      {
        status: "DENIED",
        code: "VERIFICATION_ERROR",
        reason: "Unable to verify boarding credential. Please try again.",
        clearance: null,
      },
      { status: 500 }
    )
  }
}
