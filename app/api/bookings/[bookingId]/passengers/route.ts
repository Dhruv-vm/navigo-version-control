import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/auth"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const user = getUserFromRequest(req)
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const { bookingId } = await params
  if (!bookingId) {
    return NextResponse.json({ error: "Missing bookingId" }, { status: 400 })
  }

  // ✅ Confirm this booking actually belongs to the requesting user BEFORE
  // returning any passenger data. This is the check that was missing.
  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select("id, user_id")
    .eq("id", bookingId)
    .single()

  if (bookingError || !booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 })
  }

  if (booking.user_id !== user.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { data, error } = await supabase
    .from("booking_passengers")
    .select("*")
    .eq("booking_id", bookingId)
    .order("passenger_index", { ascending: true })

  if (error) {
    console.error("[GET /api/bookings/:id/passengers]", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ passengers: data ?? [] })
}