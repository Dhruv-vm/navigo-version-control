import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

// POST /api/bookings/[bookingId]/confirm
//
// Called once the (sandboxed) payment gateway reports success. This is the
// step that was MISSING before — the payment page only updated local React
// state + sessionStorage, so the booking stayed `status = 'draft'` in the
// database with its original 15-minute hold_expires_at untouched. A
// 'draft' booking whose hold has lapsed is indistinguishable from an
// abandoned one, so the seats route's expired-hold sweep (see
// /api/bookings/[bookingId]/seats) was still eligible to release its
// seats back into inventory — even after the traveler had actually paid.
// That's exactly why it kept bouncing back to seat selection.
//
// This route flips status to 'confirmed' and nulls hold_expires_at, which
// removes the booking from that sweep entirely (it's no longer 'draft').
//
// ⚠️ Requires migration_confirm_booking.sql to have been run once.
// If your `status` column is an enum/check-constraint that doesn't accept
// "confirmed", change CONFIRMED_STATUS below to match your schema.

const CONFIRMED_STATUS = "confirmed"

type ConfirmPayload = {
  pnr: string
  amountPaid: number
  paymentMethod: "card" | "upi"
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  try {
    const { bookingId } = await params
    const body = (await req.json()) as ConfirmPayload

    if (!bookingId) {
      return NextResponse.json({ error: "Missing booking id" }, { status: 400 })
    }
    if (!body.pnr || typeof body.amountPaid !== "number") {
      return NextResponse.json({ error: "Missing pnr or amountPaid" }, { status: 400 })
    }

    const { data: booking, error: fetchError } = await supabase
      .from("bookings")
      .select("id, status")
      .eq("id", bookingId)
      .single()

    if (fetchError || !booking) {
      console.error("CONFIRM BOOKING - LOOKUP ERROR:", fetchError)
      return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    }

    // Idempotent — if this booking was already confirmed (e.g. the client
    // retried after a network blip), just report success instead of
    // erroring, so a "retry" button on the frontend is always safe to
    // press more than once.
    if (booking.status === CONFIRMED_STATUS) {
      return NextResponse.json({ bookingId, alreadyConfirmed: true })
    }

    if (booking.status !== "draft") {
      return NextResponse.json(
        { error: `Booking is in "${booking.status}" state and can't be confirmed` },
        { status: 409 }
      )
    }

    const { error: updateError } = await supabase
      .from("bookings")
      .update({
        status: CONFIRMED_STATUS,
        hold_expires_at: null, // finalized — no longer needs a hold
        pnr: body.pnr,
        payment_method: body.paymentMethod,
        paid_amount: body.amountPaid,
        paid_at: new Date().toISOString(),
      })
      .eq("id", bookingId)
      .eq("status", "draft") // guards against a race with a concurrent confirm

    if (updateError) {
      console.error("CONFIRM BOOKING - UPDATE ERROR:", updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ bookingId, status: CONFIRMED_STATUS, pnr: body.pnr })
  } catch (err) {
    console.error("CONFIRM BOOKING - SERVER ERROR:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}