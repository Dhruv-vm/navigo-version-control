"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import Navbar from "@/components/navbar"
import FlightCard from "@/components/FlightCard"

function formatDate(dateStr: string | null) {
  if (!dateStr) return { date: "", day: "" }

  const d = new Date(dateStr)

  return {
    date: d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
    day: d.toLocaleDateString("en-IN", { weekday: "short" }),
  }
}

export default function FlightsPage() {
  const searchParams = useSearchParams()

  const origin = searchParams.get("origin")
  const destination = searchParams.get("destination")
  const depart = searchParams.get("depart")

  const passengers = Number(searchParams.get("pax")) || 1

  const formattedDepart = formatDate(depart)

  const [flights, setFlights] = useState<any[]>([])

  useEffect(() => {
    if (!origin || !destination || !depart) return

    fetch(
      `/api/flights?origin=${origin}&destination=${destination}&depart=${depart}`
    )
      .then((res) => res.json())
      .then((data) => {
        console.log("FLIGHTS DATA:", data.flights) // 🔥 DEBUG
        setFlights(data.flights || [])
      })
  }, [origin, destination, depart])

  return (
    <div className="min-h-screen bg-[#020617] text-white">

      <Navbar />

      {/* TOP BAR */}
      <div className="max-w-7xl mx-auto px-6 pt-24 pb-6">
        <div className="bg-gradient-to-r from-[#0B1220] via-[#0f1c2e] to-[#0B1220] border border-white/10 rounded-2xl px-8 py-6 flex items-center justify-between">

          <div className="flex items-center gap-10">

            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <span>⇄</span>
              <span>Round Trip</span>
            </div>

            <div>
              <p className="text-xs text-gray-400">From</p>
              <p className="text-lg font-semibold">{origin}</p>
            </div>

            <div className="w-10 h-10 flex items-center justify-center rounded-full border border-white/10 bg-white/5">
              ↔
            </div>

            <div>
              <p className="text-xs text-gray-400">To</p>
              <p className="text-lg font-semibold text-yellow-400">
                {destination}
              </p>
            </div>

            <div className="h-10 w-px bg-white/10"></div>

            <div>
              <p className="text-xs text-gray-400">Depart</p>
              <p className="text-sm font-medium">
                {formattedDepart.date}
              </p>
              <p className="text-xs text-gray-500">
                {formattedDepart.day}
              </p>
            </div>

            <div>
              <p className="text-xs text-gray-400">Passengers</p>
              <p className="text-sm font-medium">
                {passengers} Passenger{passengers > 1 ? "s" : ""}
              </p>
              <p className="text-xs text-gray-500">Economy</p>
            </div>

          </div>

          <button className="px-5 py-2 rounded-lg border border-white/20 bg-white/5 hover:bg-white/10 transition">
            ✏️ Edit Search
          </button>

        </div>
      </div>

      {/* MAIN GRID */}
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-12 gap-6">

        <div className="col-span-3">
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <p className="text-gray-300">Filters Sidebar</p>
          </div>
        </div>

        <div className="col-span-6 space-y-4">

          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white/5 p-3 rounded-lg border border-white/10">Best</div>
            <div className="bg-white/5 p-3 rounded-lg border border-white/10">Cheapest</div>
            <div className="bg-white/5 p-3 rounded-lg border border-white/10">Fastest</div>
            <div className="bg-white/5 p-3 rounded-lg border border-white/10">Best Value</div>
          </div>

          {flights.length === 0 && (
            <p className="text-gray-400 text-center mt-6">
              No flights found
            </p>
          )}

          {flights.map((flight) => {
            const durationHours = Math.round(
              (new Date(flight.arrival_time).getTime() -
                new Date(flight.departure_time).getTime()) /
                (1000 * 60 * 60)
            )

            return (
              <FlightCard
                key={flight.id}
                flight={{
                  airline: flight.airline,
                  origin: flight.origin,
                  destination: flight.destination,
                  departure_time: flight.departure_time,
                  arrival_time: flight.arrival_time,

                  // ✅ FIXED HERE (MAIN BUG)
                  price: Number(flight.price) || 0,

                  aircraft: flight.aircraft,
                  stops: flight.stops ?? 0,
                  duration: `${durationHours}h`,
                  passengers: passengers,
                }}
              />
            )
          })}

        </div>

        <div className="col-span-3 space-y-4">

          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            Price Insight
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            AI Savings Box
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            NavBot
          </div>

        </div>
      </div>
    </div>
  )
}