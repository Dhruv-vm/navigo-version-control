"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { DateRange } from "react-date-range"
import "react-date-range/dist/styles.css"
import "react-date-range/dist/theme/default.css"

export default function SearchBox() {
  const router = useRouter()

  const [tripType, setTripType] = useState("round")
  const [from, setFrom] = useState("DEL")
  const [to, setTo] = useState("BLR")
  const [passengers, setPassengers] = useState(1)
  const [showCalendar, setShowCalendar] = useState(false)

  const [range, setRange] = useState<any>({
    startDate: new Date(),
    endDate: new Date(),
    key: "selection",
  })

  const swap = () => {
    setFrom(to)
    setTo(from)
  }

  const search = () => {
    router.push(
      `/flights?origin=${from}&destination=${to}&depart=${range.startDate.toISOString()}&return=${range.endDate.toISOString()}&pax=${passengers}`
    )
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
          {["round", "oneway", "multi"].map((type) => (
            <button
              key={type}
              onClick={() => setTripType(type)}
              className={`px-4 py-2 rounded-full transition ${
                tripType === type
                  ? "bg-blue-500/20 text-blue-300"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {type === "round"
                ? "✈️ Round Trip"
                : type === "oneway"
                ? "→ One Way"
                : "⟳ Multi City"}
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
              {range.startDate.toISOString().split("T")[0]}
              {tripType !== "oneway" &&
                ` - ${range.endDate.toISOString().split("T")[0]}`}
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

      {/* 🔥 CLEAN CALENDAR */}
      {showCalendar && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-32 bg-black/30"
          onClick={() => setShowCalendar(false)}
        >
          <div
            className="
              bg-white
              text-black
              rounded-xl
              shadow-2xl

              w-fit
              max-w-[95vw]

              overflow-hidden
            "
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