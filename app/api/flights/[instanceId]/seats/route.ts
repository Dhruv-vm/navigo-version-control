import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

// GET /api/flights/[instanceId]/seats?bookingId=<uuid>
//
// Returns a generated seat map for a flight instance, built from
// flight_instance_classes (cabin_class, seat_layout, total_seats,
// available_seats, class_base_price). There is no per-seat table in this
// project — seat numbers (e.g. "12A") are generated here on the fly from
// seat_layout + total_seats, not read from individual rows.
//
// IMPORTANT LIMITATION: because seats aren't individually tracked in the
// database, "taken" status is a deterministic VISUAL approximation, not a
// real per-seat fact. We mark the first (total_seats - available_seats)
// generated seats as taken, in a stable generation order, so the map looks
// consistent across reloads/passengers rather than randomizing each call.
// This means two different travelers could each see the same seat as
// available and both pick it — there is currently no row-level lock
// preventing that collision. If/when real seat-level booking integrity is
// needed, this needs a seat-claims table behind it.

type CabinClassRow = {
  cabin_class: string
  seat_layout: string
  price_multiplier: number
  available_seats: number
  total_seats: number
  class_base_price: number
}

type GeneratedSeat = {
  id: string // synthetic, stable: `${cabinClass}-${seatNumber}`
  seatNumber: string
  row: number
  col: string
  cabinClass: string
  seatType: string
  price: number
  isWindow: boolean
  isAisle: boolean
  isAvailable: boolean
  isMine: boolean
  myPassengerId: string | null
}

// Parses "3-3" -> [3, 3], "1-2-1" -> [1, 2, 1], "1-1-1-1" -> [1,1,1,1]
function parseSeatLayout(layout: string): number[] {
  return layout
    .split("-")
    .map((n) => parseInt(n.trim(), 10))
    .filter((n) => !isNaN(n) && n > 0)
}

// Builds column letters for a layout's groups, e.g. [3,3] -> ["A","B","C","D","E","F"]
function buildColumns(groups: number[]): { columns: string[]; aisleAfterCol: Set<string> } {
  const columns: string[] = []
  const aisleAfterCol = new Set<string>()
  let letterIndex = 0
  const letters = "ABCDEFGHIJKL"

  groups.forEach((groupSize, groupIdx) => {
    for (let i = 0; i < groupSize; i++) {
      columns.push(letters[letterIndex])
      letterIndex++
    }
    // mark an aisle gap after the last column of every group except the final one
    if (groupIdx < groups.length - 1) {
      aisleAfterCol.add(columns[columns.length - 1])
    }
  })

  return { columns, aisleAfterCol }
}

function generateSeatsForClass(
  classRow: CabinClassRow,
  rowOffset: number,
  takenByBooking: Map<string, string> // seatNumber (within this class) -> bookingId, for "mine" lookups
): { seats: GeneratedSeat[]; rowsUsed: number } {
  const groups = parseSeatLayout(classRow.seat_layout)
  if (groups.length === 0) {
    return { seats: [], rowsUsed: 0 }
  }

  const { columns, aisleAfterCol } = buildColumns(groups)
  const perRow = columns.length
  const totalSeats = Math.max(0, classRow.total_seats || 0)
  const rowsNeeded = Math.ceil(totalSeats / perRow)

  const takenCount = Math.max(
    0,
    Math.min(totalSeats, totalSeats - (classRow.available_seats ?? totalSeats))
  )

  const seatType =
    classRow.cabin_class === "economy" && classRow.price_multiplier <= 1
      ? "standard"
      : classRow.cabin_class === "economy"
      ? "extra_legroom"
      : classRow.cabin_class // premium_economy / business / first surfaced as their own type

  const price = Number(classRow.class_base_price || 0)

  const seats: GeneratedSeat[] = []
  let generatedIndex = 0

  for (let r = 0; r < rowsNeeded; r++) {
    for (let c = 0; c < perRow; c++) {
      if (generatedIndex >= totalSeats) break

      const rowNum = rowOffset + r + 1
      const col = columns[c]
      const seatNumber = `${rowNum}${col}`
      const syntheticId = `${classRow.cabin_class}-${seatNumber}`

      // stable "taken" assignment: the first N generated seats, in
      // generation order, are considered taken — see limitation note above
      const isTakenVisually = generatedIndex < takenCount
      const mineBookingId = takenByBooking.get(seatNumber)

      seats.push({
        id: syntheticId,
        seatNumber,
        row: rowNum,
        col,
        cabinClass: classRow.cabin_class,
        seatType,
        price,
        isWindow: c === 0 || c === perRow - 1,
        isAisle: aisleAfterCol.has(col),
        isAvailable: !isTakenVisually || !!mineBookingId,
        isMine: !!mineBookingId,
        myPassengerId: null, // no per-seat passenger tracking exists yet
      })

      generatedIndex++
    }
  }

  return { seats, rowsUsed: rowsNeeded }
}

export async function GET(req: Request, { params }: { params: Promise<{ instanceId: string }> }) {
  try {
    const { instanceId } = await params
    const { searchParams } = new URL(req.url)
    const bookingId = searchParams.get("bookingId")

    if (!instanceId) {
      return NextResponse.json({ error: "Missing flight instance id" }, { status: 400 })
    }

    const { data: classRows, error: classError } = await supabase
      .from("flight_instance_classes")
      .select("cabin_class, seat_layout, price_multiplier, available_seats, total_seats, class_base_price")
      .eq("flight_instance_id", instanceId)

    if (classError) {
      console.error("FLIGHT INSTANCE CLASSES FETCH ERROR:", classError)
      return NextResponse.json({ error: classError.message }, { status: 500 })
    }

    if (!classRows || classRows.length === 0) {
      // No cabin class data for this flight instance — nothing to render.
      return NextResponse.json({ seats: [], hasSeatMap: false })
    }

    // Order classes economy -> premium_economy -> business -> first so row
    // numbers read naturally top to bottom in a single combined map.
    const classOrder = ["economy", "premium_economy", "business", "first"]
    const sortedClasses = [...classRows].sort(
      (a, b) => classOrder.indexOf(a.cabin_class) - classOrder.indexOf(b.cabin_class)
    )

    let rowOffset = 0
    const allSeats: GeneratedSeat[] = []

    for (const classRow of sortedClasses) {
      // No per-seat "mine" tracking exists yet (see limitation note above),
      // so this map is always empty for now — kept as a seam for when a
      // seat-claims table exists.
      const takenByBooking = new Map<string, string>()

      const { seats, rowsUsed } = generateSeatsForClass(classRow, rowOffset, takenByBooking)
      allSeats.push(...seats)
      rowOffset += rowsUsed
    }

    return NextResponse.json({ seats: allSeats, hasSeatMap: true })
  } catch (err) {
    console.error("SEATS SERVER ERROR:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}