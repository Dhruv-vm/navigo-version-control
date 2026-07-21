import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

// GET /api/flights/gate?ids=<uuid>,<uuid>,...
//
// Returns { gates: { [flightInstanceId]: gate } } for the requested
// flight instances. Gates are assigned automatically (random 1–35) by a
// DB trigger on flight_instances — see migration_flight_gate.sql. This
// route just reads what the trigger already wrote; it doesn't generate
// anything itself.

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const idsParam = searchParams.get("ids")
    if (!idsParam) {
      return NextResponse.json({ error: "Missing ids" }, { status: 400 })
    }
    const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean)
    if (ids.length === 0) {
      return NextResponse.json({ error: "Missing ids" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("flight_instances")
      .select("id, gate")
      .in("id", ids)

    if (error) {
      console.error("FLIGHT GATE LOOKUP ERROR:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const gates: Record<string, string> = {}
    for (const row of data || []) {
      if (row.gate) gates[row.id] = row.gate
    }
    return NextResponse.json({ gates })
  } catch (err) {
    console.error("FLIGHT GATE LOOKUP SERVER ERROR:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}