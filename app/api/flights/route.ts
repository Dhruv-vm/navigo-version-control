import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)

  const origin = searchParams.get("origin")
  const destination = searchParams.get("destination")
  const depart = searchParams.get("depart")

  if (!origin || !destination || !depart) {
    return NextResponse.json(
      { error: "Missing params" },
      { status: 400 }
    )
  }

  // 🔥 FILTER BY DATE RANGE
  const start = new Date(depart)
  start.setHours(0, 0, 0, 0)

  const end = new Date(depart)
  end.setHours(23, 59, 59, 999)

  const { data, error } = await supabase
    .from("flights")
    .select("*")
    .eq("origin", origin)
    .eq("destination", destination)
    .gte("departure_time", start.toISOString())
    .lte("departure_time", end.toISOString())

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ flights: data })
}