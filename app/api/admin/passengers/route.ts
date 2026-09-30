import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const search = searchParams.get("q")

    let passengers: any[] = []
    const { data: pData, error } = await supabase
      .from("booking_passengers")
      .select("*, bookings(*)")
      .order("created_at", { ascending: false })

    if (error || !pData) {
      console.warn("ADMIN PASSENGERS - Relation join failed, falling back to separate queries:", error?.message)
      const { data: rawPax } = await supabase
        .from("booking_passengers")
        .select("*")
        .order("created_at", { ascending: false })

      const bIds = Array.from(new Set((rawPax || []).map((p: any) => p.booking_id).filter(Boolean)))
      let bMap = new Map<string, any>()
      if (bIds.length > 0) {
        const { data: bList } = await supabase.from("bookings").select("*").in("id", bIds)
        if (bList) bMap = new Map(bList.map((b) => [b.id, b]))
      }

      passengers = (rawPax || []).map((p) => ({
        ...p,
        bookings: bMap.get(p.booking_id) || null,
      }))
    } else {
      passengers = pData
    }

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
