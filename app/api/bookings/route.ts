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

    // 1. Fetch user bookings + child rows strictly isolated by user_id
    const { data: rawBookings, error: bErr } = await supabase
      .from("bookings")
      .select("*, booking_passengers(*), booking_seats(*)")
      .eq("user_id", user.userId)
      .order("created_at", { ascending: false })

    if (bErr) {
      console.error("BOOKINGS GET ERROR:", bErr)
      return NextResponse.json({ error: bErr.message }, { status: 500 })
    }

    // 2. Fetch associated flight instances and flights
    const instanceIds = Array.from(
      new Set(
        (rawBookings || [])
          .flatMap((b) => [b.depart_flight_instance_id, b.return_flight_instance_id])
          .filter(Boolean)
      )
    )

    let instanceMap = new Map<string, any>()
    if (instanceIds.length > 0) {
      const { data: instances, error: instErr } = await supabase
        .from("flight_instances")
        .select("*, flights(*)")
        .in("id", instanceIds)

      if (!instErr && instances) {
        instanceMap = new Map(instances.map((i) => [i.id, i]))
      }
    }

    // 3. Map into clean frontend Booking objects
    const bookings = (rawBookings || []).map((b: any) => {
      const depInst = instanceMap.get(b.depart_flight_instance_id)
      const depFlight = depInst?.flights
      const retInst = b.return_flight_instance_id ? instanceMap.get(b.return_flight_instance_id) : null
      const retFlight = retInst?.flights
      const isRoundTrip = !!retInst

      const legs = [
        depInst && {
          legLabel: isRoundTrip ? "Departure" : null,
          flightInstanceId: depInst.id,
          airline: depFlight?.airline || "Navigo Airlines",
          origin: depFlight?.origin || "DEL",
          destination: depFlight?.destination || "BLR",
          travelDate: depInst.travel_date,
          departureTime: depFlight?.departure_time || undefined,
          arrivalTime: depFlight?.arrival_time || undefined,
          aircraft: depFlight?.aircraft || undefined,
          gate: depInst.gate || "G4",
          operationalStatus: depInst.status || "SCHEDULED",
        },
        retInst && {
          legLabel: "Return",
          flightInstanceId: retInst.id,
          airline: retFlight?.airline || "Navigo Airlines",
          origin: retFlight?.origin || "BLR",
          destination: retFlight?.destination || "DEL",
          travelDate: retInst.travel_date,
          departureTime: retFlight?.departure_time || undefined,
          arrivalTime: retFlight?.arrival_time || undefined,
          aircraft: retFlight?.aircraft || undefined,
          gate: retInst.gate || "G4",
          operationalStatus: retInst.status || "SCHEDULED",
        },
      ].filter(Boolean)

      const passengers = (b.booking_passengers || [])
        .slice()
        .sort((a: any, bb: any) => (a.is_primary_contact === bb.is_primary_contact ? 0 : a.is_primary_contact ? -1 : 1))
        .map((p: any) => ({
          id: p.id,
          name: `${p.title ? p.title + " " : ""}${p.first_name || ""} ${p.last_name || ""}`.trim() || "Traveler",
          type: p.passenger_type || "adult",
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
      }, null as string | null) || depInst?.travel_date || b.created_at?.split("T")[0]

      return {
        id: b.id,
        pnr: b.pnr || undefined,
        status: b.status,
        totalPrice: b.total_price ?? b.paid_amount ?? undefined,
        paidAmount: b.paid_amount ?? b.total_price ?? undefined,
        paymentMethod: b.payment_method ?? undefined,
        paidAt: b.paid_at ?? undefined,
        createdAt: b.created_at ?? undefined,
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