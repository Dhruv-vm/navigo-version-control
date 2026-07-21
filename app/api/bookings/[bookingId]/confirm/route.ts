import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

// POST /api/bookings/[bookingId]/confirm
//
// ✅ CHANGED: the PNR is now generated HERE, not on the client. Previously
// the payment page generated a PNR locally and sent it to this route to
// store — meaning what the traveler saw on screen (and in their PDF) was
// only ever a guess about what actually landed in Supabase, not a
// guaranteed reflection of it. Now this route is the single source of
// truth: it generates the PNR, writes it, and returns it — the client
// only ever displays what this response contains, and the idempotent
// "already confirmed" branch below returns the PNR that's actually in the
// row rather than risking a second, different value.
//
// ⚠️ Requires migration_confirm_booking.sql to have been run once.
// If your `status` column doesn't accept "confirmed", change
// CONFIRMED_STATUS below to match your schema.

const CONFIRMED_STATUS = "confirmed"

// No ambiguous glyphs (no 0/O, 1/I) — reads clean on a boarding pass.
// Duplicated from bookingUtils.ts on purpose: that file lives under
// app/checkout/payment/ and this route lives under a different branch of
// the app router, so it's a tiny (6-line) copy rather than a cross-tree
// import.
function generatePnr(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let out = ""
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

type ConfirmPayload = {
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
    if (typeof body.amountPaid !== "number") {
      return NextResponse.json({ error: "Missing amountPaid" }, { status: 400 })
    }

    const { data: booking, error: fetchError } = await supabase
      .from("bookings")
      .select("id, status, pnr")
      .eq("id", bookingId)
      .single()

    if (fetchError || !booking) {
      console.error("CONFIRM BOOKING - LOOKUP ERROR:", fetchError)
      return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    }

    // Idempotent — a retried request (e.g. after a network blip on the
    // client) always gets back the PNR that's genuinely in the row,
    // never a freshly generated one.
    if (booking.status === CONFIRMED_STATUS) {
      return NextResponse.json({ bookingId, status: CONFIRMED_STATUS, pnr: booking.pnr, alreadyConfirmed: true })
    }

    if (booking.status !== "draft") {
      return NextResponse.json(
        { error: `Booking is in "${booking.status}" state and can't be confirmed` },
        { status: 409 }
      )
    }

    // Generate + write, retrying only on an actual PNR collision against
    // the unique index from migration_confirm_booking.sql (astronomically
    // unlikely at 33^6 possibilities, but cheap to guard anyway).
    let finalPnr = ""
    let lastError: { code?: string; message: string } | null = null

    for (let attempt = 0; attempt < 5; attempt++) {
      finalPnr = generatePnr()
      const { error } = await supabase
        .from("bookings")
        .update({
          status: CONFIRMED_STATUS,
          hold_expires_at: null,
          pnr: finalPnr,
          payment_method: body.paymentMethod,
          paid_amount: body.amountPaid,
          paid_at: new Date().toISOString(),
        })
        .eq("id", bookingId)
        .eq("status", "draft") // guards against a race with a concurrent confirm

      if (!error) {
        lastError = null
        break
      }
      lastError = error
      if (error.code !== "23505") break // only retry on a PNR collision
    }

    if (lastError) {
      console.error("CONFIRM BOOKING - UPDATE ERROR:", lastError)
      return NextResponse.json({ error: lastError.message }, { status: 500 })
    }

    return NextResponse.json({ bookingId, status: CONFIRMED_STATUS, pnr: finalPnr })
  } catch (err) {
    console.error("CONFIRM BOOKING - SERVER ERROR:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}