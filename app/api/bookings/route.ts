import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/auth"

// POST /api/bookings
//
// Creates (or updates, if bookingId is passed) a draft booking row plus its
// passenger rows. Requires a logged-in user — the booking is always tied to
// the caller's user_id, and updates are scoped to bookings that user
// actually owns, so one user can never edit or overwrite another user's
// draft by guessing a bookingId.
//
// ✅ FIX (passengers/response): this route used to insert `passengerRows`
// and then just discard them — the response was only `{ bookingId }`. The
// Passengers page reads the response as `data.passengers` and stores it in
// sessionStorage under `savedPassengers`, which the Payment page later uses
// to generate one boarding pass per passenger. Now selects the inserted
// rows back and includes them in the response.
//
// ✅ FIX (stale bookingId crash): when the client sends a `bookingId` for a
// booking that's no longer `status = 'draft'` (e.g. it was already paid and
// confirmed in an earlier session, and a stale id is still sitting in
// sessionStorage), the update below matches zero rows, and the code
// correctly decides to create a fresh booking instead — resetting
// `bookingId` to `undefined`. But the passenger-delete step right after it
// used to run unconditionally with that now-`undefined` id, which
// Supabase-js serializes as the literal string "undefined", which Postgres
// then rejects with "invalid input syntax for type uuid: undefined" — a
// 500 before the "create a new booking" branch was ever reached. The
// delete now only runs when the update actually succeeded against a real,
// existing booking.

type PassengerPayload = {
  type: string
  age?: number
  title: string
  firstName: string
  middleName?: string
  lastName: string
  dob: string
  gender: string
  nationality: string
  frequentFlyer?: string
  email?: string
  countryCode?: string
  mobile?: string
  isPrimaryContact: boolean
}

type BookingPayload = {
  bookingId?: string
  departFlightInstanceId: string
  returnFlightInstanceId?: string | null
  passengers: PassengerPayload[]
  baseFare: number
  taxesAndFees: number
  seatSelectionPrice: number
  mealsPrice: number
  totalPrice: number
  saveForNextTime?: boolean // optional: also upsert into saved_passengers
}

export async function POST(req: Request) {
  try {
    const user = getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const body = (await req.json()) as BookingPayload

    if (!body.departFlightInstanceId || !Array.isArray(body.passengers) || body.passengers.length === 0) {
      return NextResponse.json({ error: "Missing required booking fields" }, { status: 400 })
    }

    const primaryContact = body.passengers.find((p) => p.isPrimaryContact)

    const bookingRow = {
      user_id: user.userId, // ✅ booking is now always linked to the logged-in user
      depart_flight_instance_id: body.departFlightInstanceId,
      return_flight_instance_id: body.returnFlightInstanceId || null,
      passenger_count: body.passengers.length,
      base_fare: body.baseFare,
      taxes_and_fees: body.taxesAndFees,
      seat_selection_price: body.seatSelectionPrice,
      meals_price: body.mealsPrice,
      total_price: body.totalPrice,
      status: "draft" as const,
      contact_email: primaryContact?.email || null,
      contact_mobile: primaryContact?.mobile || null,
    }

    let bookingId = body.bookingId

    if (bookingId) {
      // ✅ scoped to user_id — a user can only ever update their own draft
      const { error: updateError, data: updated } = await supabase
        .from("bookings")
        .update(bookingRow)
        .eq("id", bookingId)
        .eq("user_id", user.userId)
        .eq("status", "draft")
        .select("id")

      if (updateError) {
        console.error("BOOKING UPDATE ERROR:", updateError)
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }

      if (!updated || updated.length === 0) {
        // Stale, not-ours, or already-confirmed booking id (the exact
        // "booked once, can't book again" scenario) — fall through to
        // creating a brand new draft below instead of erroring. bookingId
        // is reset here specifically so the delete step is skipped; it
        // only makes sense for a booking we just successfully updated.
        console.warn(
          `Draft booking ${bookingId} not found/owned/draft for user ${user.userId}. Creating a new draft instead.`
        )
        bookingId = undefined
      } else {
        const { error: deleteError } = await supabase
          .from("booking_passengers")
          .delete()
          .eq("booking_id", bookingId)

        if (deleteError) {
          console.error("PASSENGER DELETE ERROR:", deleteError)
          return NextResponse.json({ error: deleteError.message }, { status: 500 })
        }
      }
    }

    if (!bookingId) {
      const { data: inserted, error: insertError } = await supabase
        .from("bookings")
        .insert(bookingRow)
        .select("id")
        .single()

      if (insertError || !inserted) {
        console.error("BOOKING INSERT ERROR:", insertError)
        return NextResponse.json({ error: insertError?.message || "Failed to create booking" }, { status: 500 })
      }

      bookingId = inserted.id
    }

    const passengerRows = body.passengers.map((p, index) => ({
      booking_id: bookingId,
      passenger_index: index,
      passenger_type: p.type || "adult",
      age: p.age ?? null,
      title: p.title,
      first_name: p.firstName,
      middle_name: p.middleName || null,
      last_name: p.lastName,
      date_of_birth: p.dob || null,
      gender: p.gender,
      nationality: p.nationality,
      frequent_flyer: p.frequentFlyer || null,
      email: p.email || null,
      country_code: p.countryCode || null,
      mobile: p.mobile || null,
      is_primary_contact: p.isPrimaryContact,
    }))

    // ✅ .select() so we get the inserted rows (with their generated ids)
    // back, instead of just performing a blind insert. This is what the
    // frontend needs for savedPassengers → boarding pass generation.
    const { data: insertedPassengers, error: passengerError } = await supabase
      .from("booking_passengers")
      .insert(passengerRows)
      .select("id, passenger_index, passenger_type, title, first_name, middle_name, last_name, date_of_birth, gender, nationality, frequent_flyer, is_primary_contact")

    if (passengerError) {
      console.error("PASSENGER INSERT ERROR:", passengerError)
      return NextResponse.json({ error: passengerError.message }, { status: 500 })
    }

    // ✅ Optionally save/update this user's passenger book for next time.
    // This is a SEPARATE table from booking_passengers, so it never touches
    // the historical record of this (or any past) booking.
    if (body.saveForNextTime) {
      const savedRows = body.passengers.map((p) => ({
        user_id: user.userId,
        title: p.title,
        first_name: p.firstName,
        middle_name: p.middleName || null,
        last_name: p.lastName,
        date_of_birth: p.dob || null,
        gender: p.gender,
        nationality: p.nationality,
        frequent_flyer: p.frequentFlyer || null,
        updated_at: new Date().toISOString(),
      }))

      const { error: savedError } = await supabase
        .from("saved_passengers")
        .upsert(savedRows, { onConflict: "user_id,first_name,last_name,date_of_birth" })

      if (savedError) {
        // Non-fatal — the booking itself already succeeded, just log it.
        console.error("SAVED PASSENGER UPSERT ERROR:", savedError)
      }
    }

    // Keep insertion order stable (passenger_index) regardless of what
    // order Supabase happens to return rows in.
    const orderedPassengers = (insertedPassengers || []).sort(
      (a, b) => (a.passenger_index ?? 0) - (b.passenger_index ?? 0)
    )

    return NextResponse.json({ bookingId, passengers: orderedPassengers })
  } catch (err) {
    console.error("BOOKINGS SERVER ERROR:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// GET /api/bookings
//
// ⚠️ Best-effort scaffold — the foreign-key constraint names used below
// (`bookings_depart_flight_instance_id_fkey`, `bookings_return_flight_instance_id_fkey`)
// and the `booking_seats` column names are inferred from Postgres/Supabase
// convention, not confirmed against your actual schema. If this 500s with
// a "could not find relationship" or "column does not exist" error, paste
// that error (or the real constraint/column names) and I'll correct the
// query precisely instead of guessing again.
//
// Returns each of the user's bookings with EVERY leg (departure, and
// return if it's a round trip) and EVERY passenger, plus each passenger's
// per-leg seat. This is what the dashboard needs to build leg/passenger
// tabs instead of a single flattened row.
//
// Deliberately NOT included here (neither is stored on the booking):
//   - gate       → fetched client-side from /api/flights/gate, same as
//                  the payment page already does
//   - flightNumber → derived client-side via deriveFlightNumber() from
//                  bookingUtils.ts, same as the payment page already does
// ---------------------------------------------------------------------------
export async function GET(req: Request) {
  try {
    const user = getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const { data, error } = await supabase
      .from("bookings")
      .select(`
        id,
        pnr,
        status,
        created_at,
        depart:flight_instances!bookings_depart_flight_instance_id_fkey (
          id, travel_date, flights ( airline, origin, destination, departure_time )
        ),
        return:flight_instances!bookings_return_flight_instance_id_fkey (
          id, travel_date, flights ( airline, origin, destination, departure_time )
        ),
        booking_passengers ( id, first_name, last_name, is_primary_contact ),
        booking_seats ( flight_instance_id, passenger_id, seat_number )
      `)
      .eq("user_id", user.userId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("BOOKINGS GET ERROR:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const bookings = (data || []).map((b: any) => {
      const isRoundTrip = !!b.return

      const legs = [
        b.depart && {
          legLabel: isRoundTrip ? "Departure" : null,
          flightInstanceId: b.depart.id,
          airline: b.depart.flights?.airline || "—",
          origin: b.depart.flights?.origin || "—",
          destination: b.depart.flights?.destination || "—",
          travelDate: b.depart.travel_date,
          departureTime: b.depart.flights?.departure_time || undefined,
        },
        b.return && {
          legLabel: "Return",
          flightInstanceId: b.return.id,
          airline: b.return.flights?.airline || "—",
          origin: b.return.flights?.origin || "—",
          destination: b.return.flights?.destination || "—",
          travelDate: b.return.travel_date,
          departureTime: b.return.flights?.departure_time || undefined,
        },
      ].filter(Boolean)

      const passengers = (b.booking_passengers || [])
        .slice()
        .sort((a: any, bb: any) => (a.is_primary_contact === bb.is_primary_contact ? 0 : a.is_primary_contact ? -1 : 1))
        .map((p: any) => ({
          id: p.id,
          name: `${p.first_name} ${p.last_name}`.trim(),
          isPrimary: !!p.is_primary_contact,
        }))

      const seats = (b.booking_seats || []).map((s: any) => ({
        flightInstanceId: s.flight_instance_id,
        passengerId: s.passenger_id,
        seatNumber: s.seat_number,
      }))

      // earliest leg date drives upcoming/past classification on the dashboard
      const earliestTravelDate = legs.reduce((min: string | null, leg: any) => {
        if (!leg?.travelDate) return min
        return !min || leg.travelDate < min ? leg.travelDate : min
      }, null as string | null)

      return {
        id: b.id,
        pnr: b.pnr || undefined,
        status: b.status,
        travelDate: earliestTravelDate,
        legs,
        passengers,
        seats,
      }
    })

    return NextResponse.json(bookings)
  } catch (err) {
    console.error("BOOKINGS GET SERVER ERROR:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}