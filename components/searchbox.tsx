"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { DateRange } from "react-date-range"
import "react-date-range/dist/styles.css"
import "react-date-range/dist/theme/default.css"

// ✅ FIXED — `.toISOString()` converts a LOCAL midnight Date into UTC,
// which rolls it back to the previous calendar day for any timezone
// ahead of UTC (e.g. IST, UTC+5:30). Picking "23 June" in the calendar
// produced `2026-06-22T18:30:00.000Z` — a day early — which is exactly
// why the return-leg flight lookup against Supabase's `travel_date`
// came back empty. This helper builds a plain "YYYY-MM-DD" string from
// the Date's LOCAL year/month/day, never touching UTC at all.
function toDateOnly(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export default function SearchBox() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [tripType, setTripType] = useState("roundtrip")
  const [from, setFrom] = useState("DEL")
  const [to, setTo] = useState("BLR")
  const [passengers, setPassengers] = useState(1)
  const [showCalendar, setShowCalendar] = useState(false)

  const [range, setRange] = useState<any>({
    startDate: new Date(),
    endDate: new Date(),
    key: "selection",
  })

  // ✅ PREFILL FROM URL
  useEffect(() => {
    const originParam = searchParams.get("origin")
    const destParam = searchParams.get("destination")
    const departParam = searchParams.get("depart")
    const returnParam = searchParams.get("return")
    const paxParam = searchParams.get("pax")
    const modeParam = searchParams.get("mode")

    if (originParam) setFrom(originParam)
    if (destParam) setTo(destParam)
    if (paxParam) setPassengers(Number(paxParam))

    if (modeParam === "roundtrip") setTripType("roundtrip")
    if (modeParam === "oneway") setTripType("oneway")

    if (departParam) {
      // ✅ departParam/returnParam now arrive as plain "YYYY-MM-DD".
      // New Date("2026-06-23") parses as UTC midnight, which can still
      // display as the previous day in a negative-offset timezone, so
      // we parse the components manually to build a LOCAL Date instead.
      const parseLocalDate = (value: string) => {
        const [y, m, d] = value.split("-").map(Number)
        if (!y || !m || !d) return new Date(value)
        return new Date(y, m - 1, d)
      }

      const start = parseLocalDate(departParam)
      const end = returnParam ? parseLocalDate(returnParam) : start

      setRange({
        startDate: start,
        endDate: end,
        key: "selection",
      })
    }
  }, [searchParams])

  const swap = () => {
    setFrom(to)
    setTo(from)
  }

  // ✅ SEARCH (CLEAN + SAFE) — sends plain calendar dates, no UTC shift
  const search = () => {
    let url = `/flights?origin=${from}&destination=${to}&depart=${toDateOnly(range.startDate)}&pax=${passengers}&mode=${tripType}`

    if (tripType === "roundtrip") {
      url += `&return=${toDateOnly(range.endDate)}`
    }

    router.push(url)
  }

  const days =
    range.startDate && range.endDate
      ? Math.max(
          0,
          Math.ceil(
            (range.endDate.getTime() - range.startDate.getTime()) /
              (1000 * 60 * 60 * 24)
          )
        )
      : 0

  return (
    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-xl relative">

      {/* TOP BAR */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex gap-4 text-sm">

          {[
            { key: "roundtrip", label: "✈️ Round Trip" },
            { key: "oneway", label: "→ One Way" },
            { key: "multi", label: "⟳ Multi City" },
          ].map((type) => (
            <button
              key={type.key}
              onClick={() => setTripType(type.key)}
              className={`px-4 py-2 rounded-full transition ${
                tripType === type.key
                  ? "bg-blue-500/20 text-blue-300"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {type.label}
            </button>
          ))}

        </div>

        <div className="flex items-center gap-4">
          <span className="text-gray-300 text-sm">Economy</span>

          <div className="flex items-center gap-3 bg-black/40 px-4 py-2 rounded-xl border border-white/10">
            <button onClick={() => setPassengers(Math.max(1, passengers - 1))}>-</button>
            <span>{passengers}</span>
            <button onClick={() => setPassengers(Math.min(10, passengers + 1))}>+</button>
          </div>
        </div>
      </div>

      {/* MAIN ROW */}
      <div className="flex flex-col md:flex-row gap-4 items-center">

        <div className="flex items-center gap-3 flex-1 w-full">

          <div className="bg-black/40 p-4 rounded-xl border border-white/10 flex-1">
            <p className="text-xs text-gray-400">FROM</p>
            <input
              value={from}
              onChange={(e) => setFrom(e.target.value.toUpperCase())}
              className="bg-transparent outline-none text-lg font-semibold w-full"
            />
          </div>

          <button onClick={swap} className="bg-white/10 hover:bg-white/20 p-3 rounded-full shrink-0">
            ⇄
          </button>

          <div className="bg-black/40 p-4 rounded-xl border border-white/10 flex-1">
            <p className="text-xs text-gray-400">TO</p>
            <input
              value={to}
              onChange={(e) => setTo(e.target.value.toUpperCase())}
              className="bg-transparent outline-none text-lg font-semibold w-full"
            />
          </div>
        </div>

        {/* DATE */}
        <div className="w-full md:w-[320px]">
          <div
            onClick={() => setShowCalendar(true)}
            className="bg-black/40 p-4 rounded-xl border border-white/10 cursor-pointer"
          >
            <p className="text-xs text-gray-400">
              {tripType === "oneway" ? "DEPART" : "DEPART - RETURN"}
            </p>

            <p className="text-lg font-semibold">
              {toDateOnly(range.startDate)}
              {tripType !== "oneway" &&
                ` - ${toDateOnly(range.endDate)}`}
            </p>

            {tripType !== "oneway" && (
              <p className="text-blue-400 text-sm">
                {days} days trip
              </p>
            )}
          </div>
        </div>

        {/* BUTTON */}
        <button
          onClick={search}
          className="w-full md:w-auto px-8 py-4 rounded-xl font-semibold 
          bg-gradient-to-r from-blue-500 via-cyan-400 to-yellow-400 
          text-black hover:opacity-90"
        >
          Search Flights →
        </button>
      </div>

      {/* CALENDAR */}
      {showCalendar && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-32 bg-black/30"
          onClick={() => setShowCalendar(false)}
        >
          <div
            className="bg-white text-black rounded-xl shadow-2xl w-fit max-w-[95vw] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <DateRange
              ranges={[range]}
              onChange={(item: any) => setRange(item.selection)}
              moveRangeOnFirstSelection={false}
              months={2}
              direction="horizontal"
              minDate={new Date()}
              rangeColors={["#3b82f6"]}
            />
          </div>
        </div>
      )}
    </div>
  )
}