import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

// POST /api/bookings/[bookingId]/seats
//
// Saves the traveler's seat picks for a draft booking. Called from the Seat
// Selection page when the traveler clicks "Continue to Add-ons".
//
// ✅ Seats are real rows in `booking_seats`, not a jsonb blob on
// `bookings.selected_seats`. `booking_seats` has a unique constraint on
// (flight_instance_id, seat_number) — see migration_seat_hold.sql — so two
// different bookings can no longer both "claim" the same physical seat.
//
// ✅ On a successful save, bookings.hold_expires_at is set to
// now() + 15 minutes. The Add-ons and Payment pages read this to run the
// countdown / redirect back to seat selection if it lapses.
//
// ✅ FIXED: two ways available_seats could get stuck too low, causing
// false "not enough seats" errors even when seats were genuinely free:
//   1. Expired holds never released their seats — a 15-min-lapsed draft
//      booking kept its seats locked forever. Now swept at the top of
//      every request for the flight instances involved.
//   2. Re-saving seats for a booking that already held some (e.g. going
//      back and re-picking, or doing departure then return) checked the
//      NEW pick count against available_seats without first giving back
//      what THIS booking already held — so it looked short even when it
//      wasn't. Now restored before the availability check runs.
//
// ✅ FIXED: restoreSeats() used to .select(<dynamic column string>),
// which breaks Supabase's TS type inference (ts 2352 GenericStringError)
// and can fail a type-checked build — meaning the fixes above may never
// have actually shipped. Now selects the literal columns instead.

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

const HOLD_MINUTES = 15

// available_seats on flight_instance_classes is a VIEW (joins
// flight_instances + flights + cabin_layouts) — Postgres refuses direct
// UPDATEs on it (55000: "Views that do not select from a single table ...
// are not automatically updatable"). Writes go to flight_instances instead.
const CABIN_COLUMN: Record<string, string> = {
  economy: "seats_economy",
  premium_economy: "seats_premium_economy",
  business: "seats_business",
  first: "seats_first",
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

// Adds `count` seats back to flight_instances.<cabin column> for one
// (flightInstanceId, cabinClass). Used by the expired-hold sweep, the
// "restore this booking's own prior picks" step, and the DELETE
// (release-seats) handler below.
async function restoreSeats(flightInstanceId: string, cabinClass: string, count: number) {
  if (count <= 0) return { error: null as string | null }
  const column = CABIN_COLUMN[cabinClass]
  if (!column) return { error: `Unknown cabin class: ${cabinClass}` }

  // Select all four literal columns (not the dynamic `column` var) so
  // Supabase can actually infer a real type here. Passing a runtime
  // string straight into .select() defeats its type inference — it falls
  // back to a GenericStringError type, which is what threw the ts(2352)
  // "Conversion ... may be a mistake" error. Functionally the old code
  // still ran fine against Postgres, but if your build has type-checking
  // on (the Next.js default), this error could have been failing the
  // build — meaning the restore logic below may never have shipped.
  const { data: instanceRow, error: fetchError } = await supabase
    .from("flight_instances")
    .select("seats_economy, seats_premium_economy, seats_business, seats_first")
    .eq("id", flightInstanceId)
    .single()

  if (fetchError || !instanceRow) {
    return { error: `Couldn't look up seat count to restore for ${flightInstanceId}` }
  }

  // Route through `unknown` first — that's the standard fix for
  // "neither type sufficiently overlaps" — then index by the resolved
  // column name.
  const current = Number((instanceRow as unknown as Record<string, number>)[column] ?? 0)
  const { error: updateError } = await supabase
    .from("flight_instances")
    .update({ [column]: current + count })
    .eq("id", flightInstanceId)

  return { error: updateError ? updateError.message : null }
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

    const flightInstanceIds = [...new Set(allPicks.map((p) => p.flightInstanceId))]

    // ── Step 1: sweep expired holds for these flight instances ─────────
    // Any OTHER draft booking whose 15-min hold has lapsed is still
    // sitting on seats it no longer has a claim to. Release them first so
    // this request sees accurate availability.
    const { data: expiredHolders, error: expiredFetchError } = await supabase
      .from("bookings")
      .select("id")
      .eq("status", "draft")
      .lt("hold_expires_at", new Date().toISOString())
      .neq("id", bookingId)

    if (expiredFetchError) {
      console.error("SEAT SAVE - EXPIRED HOLDS LOOKUP ERROR:", expiredFetchError)
    } else if (expiredHolders && expiredHolders.length > 0) {
      const expiredIds = expiredHolders.map((b) => b.id)
      const { data: expiredSeats, error: expiredSeatsError } = await supabase
        .from("booking_seats")
        .select("id, flight_instance_id, cabin_class")
        .in("booking_id", expiredIds)
        .in("flight_instance_id", flightInstanceIds)

      if (expiredSeatsError) {
        console.error("SEAT SAVE - EXPIRED SEATS LOOKUP ERROR:", expiredSeatsError)
      } else if (expiredSeats && expiredSeats.length > 0) {
        const restoreTally = new Map<string, number>()
        for (const row of expiredSeats) {
          if (!row.cabin_class) continue // pre-migration rows have no cabin_class — can't safely restore, skip
          const key = `${row.flight_instance_id}::${row.cabin_class}`
          restoreTally.set(key, (restoreTally.get(key) || 0) + 1)
        }
        for (const [key, count] of restoreTally.entries()) {
          const [fid, cabin] = key.split("::")
          const { error } = await restoreSeats(fid, cabin, count)
          if (error) console.error("SEAT SAVE - EXPIRED RESTORE ERROR:", error)
        }
        const { error: deleteExpiredError } = await supabase
          .from("booking_seats")
          .delete()
          .in("booking_id", expiredIds)
          .in("flight_instance_id", flightInstanceIds)
        if (deleteExpiredError) console.error("SEAT SAVE - EXPIRED DELETE ERROR:", deleteExpiredError)
      }
    }

    // ── Step 2: restore THIS booking's own prior picks before re-checking ──
    // Covers going back and re-picking seats, or saving departure then
    // return separately — without this, the check below sees availability
    // already reduced by this booking's own earlier hold.
    const { data: ownPriorSeats, error: ownPriorError } = await supabase
      .from("booking_seats")
      .select("flight_instance_id, cabin_class")
      .eq("booking_id", bookingId)
      .in("flight_instance_id", flightInstanceIds)

    if (ownPriorError) {
      console.error("SEAT SAVE - OWN PRIOR SEATS LOOKUP ERROR:", ownPriorError)
      return NextResponse.json({ error: ownPriorError.message }, { status: 500 })
    }

    if (ownPriorSeats && ownPriorSeats.length > 0) {
      const ownTally = new Map<string, number>()
      for (const row of ownPriorSeats) {
        if (!row.cabin_class) continue
        const key = `${row.flight_instance_id}::${row.cabin_class}`
        ownTally.set(key, (ownTally.get(key) || 0) + 1)
      }
      for (const [key, count] of ownTally.entries()) {
        const [fid, cabin] = key.split("::")
        const { error } = await restoreSeats(fid, cabin, count)
        if (error) console.error("SEAT SAVE - OWN RESTORE ERROR:", error)
      }
    }

    // Now clear this booking's old picks for these flight instances —
    // safe to do after restoring their counts above.
    const { error: deleteError } = await supabase
      .from("booking_seats")
      .delete()
      .eq("booking_id", bookingId)
      .in("flight_instance_id", flightInstanceIds)

    if (deleteError) {
      console.error("SEAT SAVE - CLEANUP OLD PICKS ERROR:", deleteError)
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    // ── Step 3: check + decrement availability for the NEW picks ────────
    const usageByClass = new Map<string, number>()
    for (const pick of allPicks) {
      const key = `${pick.flightInstanceId}::${pick.cabinClass}`
      usageByClass.set(key, (usageByClass.get(key) || 0) + 1)
    }

    for (const [key, count] of usageByClass.entries()) {
      const [flightInstanceId, cabinClass] = key.split("::")
      const column = CABIN_COLUMN[cabinClass]

      if (!column) {
        return NextResponse.json({ error: `Unknown cabin class: ${cabinClass}` }, { status: 400 })
      }

      // Try flight_instance_classes view first
      const { data: classRow } = await supabase
        .from("flight_instance_classes")
        .select("available_seats")
        .eq("flight_instance_id", flightInstanceId)
        .eq("cabin_class", cabinClass)
        .maybeSingle()

      let availableSeats = classRow?.available_seats

      // Fallback: check flight_instances table directly
      if (typeof availableSeats !== "number") {
        const { data: instRow } = await supabase
          .from("flight_instances")
          .select("seats_economy, seats_premium_economy, seats_business, seats_first")
          .eq("id", flightInstanceId)
          .maybeSingle()

        if (instRow) {
          availableSeats = Number((instRow as any)[column] ?? 40)
        } else {
          // Synthetic instance or missing row — provide fallback availability
          availableSeats = 50
        }
      }

      if (availableSeats < count) {
        return NextResponse.json(
          {
            error: `Not enough ${cabinClass.replace("_", " ")} seats left. Please pick again.`,
            conflict: true,
          },
          { status: 409 }
        )
      }

      const { error: decrementError } = await supabase
        .from("flight_instances")
        .update({ [column]: Math.max(0, availableSeats - count) })
        .eq("id", flightInstanceId)

      if (decrementError) {
        console.warn("SEAT SAVE - DECREMENT WARN:", decrementError.message)
      }
    }

    // ── Step 4: insert the new picks, now including cabin_class ────────
    const { error: insertError } = await supabase.from("booking_seats").insert(
      allPicks.map((p) => ({
        booking_id: bookingId,
        passenger_id: p.passengerId,
        flight_instance_id: p.flightInstanceId,
        seat_number: p.seatNumber,
        cabin_class: p.cabinClass,
        price: p.price,
      }))
    )

    if (insertError) {
      // 23505 = unique_violation — someone else grabbed one of these
      // seats between the availability check above and this insert.
      if (insertError.code === "23505") {
        return NextResponse.json(
          { error: "One of the selected seats was just taken. Please pick again.", conflict: true },
          { status: 409 }
        )
      }
      console.error("SEAT SAVE - INSERT ERROR:", insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    const seatSelectionPrice = allPicks.reduce((sum, p) => sum + Number(p.price || 0), 0)
    const holdExpiresAt = new Date(Date.now() + HOLD_MINUTES * 60 * 1000).toISOString()

    const { error: updateError } = await supabase
      .from("bookings")
      .update({
        seat_selection_price: seatSelectionPrice,
        hold_expires_at: holdExpiresAt,
      })
      .eq("id", bookingId)
      .eq("status", "draft")

    if (updateError) {
      console.error("BOOKING SEAT UPDATE ERROR:", updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ bookingId, seatSelectionPrice, holdExpiresAt })
  } catch (err) {
    console.error("SEATS SAVE SERVER ERROR:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// GET /api/bookings/[bookingId]/seats
//
// Returns the real seat assignments for a booking, keyed by
// (flightInstanceId, passengerId) on the client side. This is what the
// boarding pass needed and didn't have — previously the seat field always
// showed "TBA" because nothing ever fetched it back out of `booking_seats`
// after the seats page saved it.

export async function GET(
  req: Request,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  try {
    const { bookingId } = await params
    if (!bookingId) {
      return NextResponse.json({ error: "Missing booking id" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("booking_seats")
      .select("flight_instance_id, passenger_id, seat_number, cabin_class")
      .eq("booking_id", bookingId)

    if (error) {
      console.error("SEATS GET (by booking) ERROR:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      seats: (data || []).map((row) => ({
        flightInstanceId: row.flight_instance_id,
        passengerId: row.passenger_id,
        seatNumber: row.seat_number,
        cabinClass: row.cabin_class,
      })),
    })
  } catch (err) {
    console.error("SEATS GET (by booking) SERVER ERROR:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE /api/bookings/[bookingId]/seats
//
// Releases every seat this (still-draft) booking currently holds: deletes
// its booking_seats rows and restores the seat-count columns those rows
// had decremented (same restoreSeats() helper used above). Called from
// "Edit Flight" on the add-ons/payment pages so a traveler who backs out
// to search again doesn't leave seats locked for the full 15-minute hold
// window — they're freed immediately for other travelers.
//
// Deliberately does NOT touch bookings.status or bookings.hold_expires_at:
// this only releases seats, it doesn't cancel the draft booking itself,
// since the traveler may come back and pick a new flight for the same
// booking rather than starting over entirely.

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  try {
    const { bookingId } = await params
    if (!bookingId) {
      return NextResponse.json({ error: "Missing booking id" }, { status: 400 })
    }

    const { data: ownSeats, error: ownSeatsError } = await supabase
      .from("booking_seats")
      .select("flight_instance_id, cabin_class")
      .eq("booking_id", bookingId)

    if (ownSeatsError) {
      console.error("SEATS RELEASE - LOOKUP ERROR:", ownSeatsError)
      return NextResponse.json({ error: ownSeatsError.message }, { status: 500 })
    }

    if (!ownSeats || ownSeats.length === 0) {
      // Nothing held — not an error, just nothing to release.
      return NextResponse.json({ released: 0 })
    }

    // Restore the seat-count columns these rows had decremented, grouped
    // by (flight_instance_id, cabin_class) — same tally pattern used by
    // the expired-hold sweep and own-prior-picks restore in POST above.
    const tally = new Map<string, number>()
    for (const row of ownSeats) {
      if (!row.cabin_class) continue // pre-migration rows have no cabin_class — can't safely restore, skip
      const key = `${row.flight_instance_id}::${row.cabin_class}`
      tally.set(key, (tally.get(key) || 0) + 1)
    }
    for (const [key, count] of tally.entries()) {
      const [flightInstanceId, cabinClass] = key.split("::")
      const { error } = await restoreSeats(flightInstanceId, cabinClass, count)
      if (error) console.error("SEATS RELEASE - RESTORE ERROR:", error)
    }

    const { error: deleteError } = await supabase
      .from("booking_seats")
      .delete()
      .eq("booking_id", bookingId)

    if (deleteError) {
      console.error("SEATS RELEASE - DELETE ERROR:", deleteError)
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ released: ownSeats.length })
  } catch (err) {
    console.error("SEATS RELEASE SERVER ERROR:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}