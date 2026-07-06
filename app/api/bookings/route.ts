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
    // TEMP DEBUG — remove after
    const { data: debugUser, error: debugUserError } = await supabase
      .from("users")
      .select("id")
      .eq("id", user.userId)
      .single()

    console.log("🔍 DEBUG — does this Supabase client see the user?", { debugUser, debugUserError })
    console.log("🔍 DEBUG — Supabase URL in use:", process.env.NEXT_PUBLIC_SUPABASE_URL)

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
        // Either it doesn't exist, isn't theirs, or isn't a draft anymore.
        return NextResponse.json({ error: "Booking not found" }, { status: 404 })
      }

      const { error: deleteError } = await supabase
        .from("booking_passengers")
        .delete()
        .eq("booking_id", bookingId)

      if (deleteError) {
        console.error("PASSENGER DELETE ERROR:", deleteError)
        return NextResponse.json({ error: deleteError.message }, { status: 500 })
      }
    } else {
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

    const { error: passengerError } = await supabase
      .from("booking_passengers")
      .insert(passengerRows)

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

    return NextResponse.json({ bookingId })
  } catch (err) {
    console.error("BOOKINGS SERVER ERROR:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}