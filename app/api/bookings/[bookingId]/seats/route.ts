import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

// POST /api/bookings/[bookingId]/seats
//
// Saves the traveler's seat picks for a draft booking. Called from the Seat
// Selection page when the traveler clicks "Continue to Add-ons".
//
// This project has no per-seat table — seat numbers are generated on the
// fly from flight_instance_classes.seat_layout / total_seats (see
// app/api/flights/[instanceId]/seats). So instead of inserting seat rows,
// this route:
//   1. Writes the full selection as JSON onto bookings.selected_seats
//      (requires migration_booking_seats_column.sql to have been run)
//   2. Rolls the total price into bookings.seat_selection_price
//   3. Decrements flight_instance_classes.available_seats for each cabin
//      class actually used, so displayed availability moves
//
// KNOWN LIMITATION: because there's no per-seat row to uniquely claim,
// there is no protection against two different bookings independently
// "selecting" the same seat number — the only safeguard here is the
// available_seats count not going negative. If real seat-level locking is
// ever needed, this needs an actual seat-claims table behind it.
//
// NOTE: seat.passengerId here is expected to be a booking_passenger.id
// (uuid string) coming from the frontend's `passengers` array, which in
// turn should be sourced from selection.savedPassengers. No change needed
// in this file for the "names not showing" issue — that's fixed upstream
// in the passengers POST route and the seats page's read of savedPassengers.

type SeatSelectionPayload = {
  legs: {
    flightInstanceId: string
    seats: {
      passengerId: string
      seatId: string // e.g. "economy-12A" — synthetic, format: `${cabinClass}-${seatNumber}`
      seatNumber: string
      price: number
    }[]
  }[]
}

function cabinClassFromSeatId(seatId: string): string | null {
  // seatId is `${cabinClass}-${seatNumber}`, e.g. "premium_economy-3B"
  // cabin_class itself can contain underscores but never a hyphen, and
  // seatNumber is always rowNumber + column letters with no hyphen either,
  // so the LAST hyphen reliably separates the two parts.
  const lastDash = seatId.lastIndexOf("-")
  if (lastDash === -1) return null
  return seatId.slice(0, lastDash)
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  try {
    const { bookingId } = await params
    const body = (await req.json()) as SeatSelectionPayload

    if (!bookingId) {
      return NextResponse.json({ error: "Missing booking id" }, { status: 400 })
    }

    if (!Array.isArray(body.legs) || body.legs.length === 0) {
      return NextResponse.json({ error: "Missing seat selection" }, { status: 400 })
    }

    // Confirm the booking exists and is still a draft before touching it
    // — never let a confirmed/paid booking's seats be silently rewritten.
    const { data: booking, error: bookingFetchError } = await supabase
      .from("bookings")
      .select("id, status")
      .eq("id", bookingId)
      .single()

    if (bookingFetchError || !booking) {
      console.error("SEAT SAVE - BOOKING LOOKUP ERROR:", bookingFetchError)
      return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    }

    if (booking.status !== "draft") {
      return NextResponse.json(
        { error: "Booking is no longer a draft and cannot be modified" },
        { status: 409 }
      )
    }

    const allPicks = body.legs.flatMap((leg) =>
      leg.seats.map((seat) => {
        const cabinClass = cabinClassFromSeatId(seat.seatId)
        return {
          passengerId: seat.passengerId,
          flightInstanceId: leg.flightInstanceId,
          cabinClass,
          seatNumber: seat.seatNumber,
          price: seat.price,
        }
      })
    )

    if (allPicks.length === 0) {
      return NextResponse.json({ error: "No seats provided" }, { status: 400 })
    }

    if (allPicks.some((p) => !p.cabinClass)) {
      return NextResponse.json({ error: "Invalid seat id in selection" }, { status: 400 })
    }

    // Tally how many seats are being newly claimed per (flightInstanceId, cabinClass)
    const usageByClass = new Map<string, number>()
    for (const pick of allPicks) {
      const key = `${pick.flightInstanceId}::${pick.cabinClass}`
      usageByClass.set(key, (usageByClass.get(key) || 0) + 1)
    }

    // Decrement available_seats per cabin class, never going below 0.
    // This is a best-effort count update, not a row-level lock — see the
    // limitation note at the top of this file.
    for (const [key, count] of usageByClass.entries()) {
      const [flightInstanceId, cabinClass] = key.split("::")

      const { data: classRow, error: classFetchError } = await supabase
        .from("flight_instance_classes")
        .select("available_seats")
        .eq("flight_instance_id", flightInstanceId)
        .eq("cabin_class", cabinClass)
        .single()

      if (classFetchError || !classRow) {
        console.error("SEAT SAVE - CLASS LOOKUP ERROR:", classFetchError)
        return NextResponse.json(
          { error: `Couldn't find ${cabinClass} availability for this flight` },
          { status: 404 }
        )
      }

      if (classRow.available_seats < count) {
        return NextResponse.json(
          {
            error: `Not enough ${cabinClass.replace("_", " ")} seats left. Please pick again.`,
            conflict: true,
          },
          { status: 409 }
        )
      }

      const { error: decrementError } = await supabase
        .from("flight_instance_classes")
        .update({ available_seats: classRow.available_seats - count })
        .eq("flight_instance_id", flightInstanceId)
        .eq("cabin_class", cabinClass)

      if (decrementError) {
        console.error("SEAT SAVE - DECREMENT ERROR:", decrementError)
        return NextResponse.json({ error: decrementError.message }, { status: 500 })
      }
    }

    const seatSelectionPrice = allPicks.reduce((sum, p) => sum + Number(p.price || 0), 0)

    const { error: updateError } = await supabase
      .from("bookings")
      .update({
        selected_seats: allPicks,
        seat_selection_price: seatSelectionPrice,
      })
      .eq("id", bookingId)
      .eq("status", "draft")

    if (updateError) {
      console.error("BOOKING SEAT UPDATE ERROR:", updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ bookingId, seatSelectionPrice })
  } catch (err) {
    console.error("SEATS SAVE SERVER ERROR:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}