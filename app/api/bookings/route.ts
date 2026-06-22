import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

// POST /api/bookings
//
// Creates (or updates, if bookingId is passed) a draft booking row plus its
// passenger rows. Called from the Passenger Details page when the traveler
// clicks "Continue to Seat Selection" — by that point all fields have
// already passed client-side validation, so this is a straightforward
// upsert, not a place to re-derive business rules.
//
// This intentionally does NOT generate a PNR. bookings.pnr stays null until
// the payment/confirmation step writes it — see migration_bookings.sql.

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
  bookingId?: string // present when updating an existing draft
  departFlightInstanceId: string
  returnFlightInstanceId?: string | null
  passengers: PassengerPayload[]
  baseFare: number
  taxesAndFees: number
  seatSelectionPrice: number
  mealsPrice: number
  totalPrice: number
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as BookingPayload

    if (!body.departFlightInstanceId || !Array.isArray(body.passengers) || body.passengers.length === 0) {
      return NextResponse.json({ error: "Missing required booking fields" }, { status: 400 })
    }

    const primaryContact = body.passengers.find((p) => p.isPrimaryContact)

    const bookingRow = {
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
      // Update existing draft (e.g. traveler went back and edited details)
      const { error: updateError } = await supabase
        .from("bookings")
        .update(bookingRow)
        .eq("id", bookingId)
        .eq("status", "draft") // never overwrite a booking past draft stage

      if (updateError) {
        console.error("BOOKING UPDATE ERROR:", updateError)
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }

      // Replace passengers wholesale — simplest correct approach for a draft
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

    return NextResponse.json({ bookingId })
  } catch (err) {
    console.error("BOOKINGS SERVER ERROR:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}