import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
// ⚠️ This assumes lib/supabase.ts does `export const supabase = createClient(...)`
// and hands back an already-configured client. If it instead does
// `export default createClient(...)`, change the import above to:
//   import supabase from "@/lib/supabase"
// If it exports a function like `createClient()` that you have to call
// yourself, change the import to that name and add `const supabase = createClient()`
// as the first line inside GET below. Open lib/supabase.ts to check which
// of these three shapes it actually is.

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const { bookingId } = await params

  if (!bookingId) {
    return NextResponse.json({ error: "Missing bookingId" }, { status: 400 })
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