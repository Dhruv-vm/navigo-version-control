import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const search = searchParams.get("q")

    const { data: passengers, error } = await supabase
      .from("booking_passengers")
      .select("*, bookings(*)")
      .order("created_at", { ascending: false })

    if (error) throw error

    let list = (passengers || []).map((p) => {
      const b = p.bookings
      const fullName = `${p.title ? p.title + " " : ""}${p.first_name || ""} ${p.last_name || ""}`.trim()

      return {
        id: p.id,
        bookingId: p.booking_id,
        pnr: b?.pnr || "—",
        name: fullName || "Traveler",
        firstName: p.first_name,
        lastName: p.last_name,
        email: p.email || b?.contact_email || "—",
        mobile: p.mobile || b?.contact_mobile || "—",
        gender: p.gender || "—",
        dob: p.date_of_birth || "—",
        nationality: p.nationality || "India",
        frequentFlyer: p.frequent_flyer || "—",
        passengerType: p.passenger_type || "Adult",
        bookingStatus: b?.status || "confirmed",
        paidAmount: b?.paid_amount || b?.total_price || 0,
        createdAt: p.created_at,
        smartCheckInStatus: "REGISTERED_ACTIVE",
      }
    })

    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.pnr.toLowerCase().includes(q) ||
          p.email.toLowerCase().includes(q) ||
          p.mobile.includes(q)
      )
    }

    return NextResponse.json({ passengers: list })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch passenger registry" }, { status: 500 })
  }
}
