"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import Navbar from "@/components/navbar"
import FlightCard from "@/components/FlightCard"

export default function FlightsPage() {
  const searchParams = useSearchParams()

  const origin = searchParams.get("origin")
  const destination = searchParams.get("destination")
  const depart = searchParams.get("depart")

  const [flights, setFlights] = useState<any[]>([])

  useEffect(() => {
    if (!origin || !destination || !depart) return

    fetch(
      `/api/flights?origin=${origin}&destination=${destination}&depart=${depart}`
    )
      .then((res) => res.json())
      .then((data) => {
        // ✅ FIX: support both API formats
        if (Array.isArray(data)) {
          setFlights(data)
        } else {
          setFlights(data.flights || [])
        }
      })
      .catch(() => setFlights([]))
  }, [origin, destination, depart])

  return (
    <div className="min-h-screen bg-[#020617] text-white">

      {/* NAVBAR */}
      <Navbar />

      {/* TOP SEARCH */}
      <div className="max-w-7xl mx-auto px-6 pt-24 pb-6">
        <div className="bg-white/5 border border-white/10 rounded-2xl px-6 py-5 backdrop-blur-xl flex justify-between items-center">

          <div className="flex items-center gap-8">

            <div>
              <p className="text-xs text-gray-400">From</p>
              <p className="text-xl font-semibold">{origin}</p>
            </div>

            <div className="text-gray-500 text-xl">→</div>

            <div>
              <p className="text-xs text-gray-400">To</p>
              <p className="text-xl font-semibold text-yellow-400">
                {destination}
              </p>
            </div>

            <div>
              <p className="text-xs text-gray-400">Depart</p>
              <p className="font-medium">{depart}</p>
            </div>

            <div>
              <p className="text-xs text-gray-400">Passengers</p>
              <p className="font-medium">1 • Economy</p>
            </div>
          </div>

          <button className="px-4 py-2 border border-white/20 rounded-lg hover:bg-white/10 transition">
            ✏️ Edit Search
          </button>
        </div>
      </div>

      {/* MAIN */}
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-12 gap-6">

        {/* LEFT */}
        <div className="col-span-3 space-y-4">
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 backdrop-blur-xl">
            <p className="font-semibold mb-4">Filters</p>

            <div className="text-sm text-gray-400 space-y-2">
              <p>Stops</p>
              <p>Price Range</p>
              <p>Airlines</p>
              <p>Departure Time</p>
            </div>
          </div>
        </div>

        {/* CENTER */}
        <div className="col-span-6 space-y-4">

          {/* HEADER */}
          <div className="flex justify-between items-center">
            <div>
              <p className="text-lg font-semibold">
                {flights.length} flights found
              </p>
              <p className="text-xs text-gray-400">
                Prices include taxes & fees
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button className="text-sm border border-white/20 px-3 py-1 rounded hover:bg-white/10">
                🔔 Price Alerts
              </button>

              <button className="text-sm border border-white/20 px-3 py-1 rounded hover:bg-white/10">
                Sort: Best
              </button>
            </div>
          </div>

          {/* 🔥 UPGRADED MINI CARDS */}
          <div className="grid grid-cols-4 gap-4">

            <div className="p-4 rounded-xl bg-gradient-to-br from-blue-900/40 to-blue-600/20 border border-blue-500/20">
              <p className="text-sm text-gray-300">Best</p>
              <p className="text-xl font-bold">₹478</p>
              <p className="text-xs text-gray-400">15h avg</p>
            </div>

            <div className="p-4 rounded-xl bg-[#0b1220] border border-white/10">
              <p className="text-sm text-gray-300">Cheapest</p>
              <p className="text-green-400 font-bold">₹362</p>
              <p className="text-xs text-gray-400">18h avg</p>
            </div>

            <div className="p-4 rounded-xl bg-[#0b1220] border border-white/10">
              <p className="text-sm text-gray-300">Fastest</p>
              <p className="text-white font-bold">₹612</p>
              <p className="text-xs text-gray-400">13h</p>
            </div>

            <div className="p-4 rounded-xl bg-[#0b1220] border border-white/10">
              <p className="text-sm text-gray-300">Best Value</p>
              <p className="text-yellow-400 font-bold">₹478</p>
              <p className="text-xs text-gray-400">15h</p>
            </div>

          </div>

          {/* FLIGHTS */}
          {flights.length === 0 ? (
            <div className="text-center text-gray-400 mt-10">
              No flights found ✈️
            </div>
          ) : (
            Array.isArray(flights) &&
            flights.map((flight) => {
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
                    price: flight.base_price,
                    aircraft: flight.aircraft,
                    stops: flight.stops,
                    duration: `${durationHours}h`,
                  }}
                />
              )
            })
          )}

        </div>

        {/* RIGHT */}
        <div className="col-span-3 space-y-4">

          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <p className="font-semibold mb-2">Price Insight</p>
            <p className="text-sm text-green-400">Low</p>
            <p className="text-xs text-gray-400">
              Prices are currently low. Book now.
            </p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <p className="font-semibold">AI Savings</p>
            <p className="text-sm text-green-400">Save up to ₹2000</p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <p className="font-semibold">NavBot</p>
            <p className="text-xs text-gray-400">
              Ask for recommendations
            </p>
          </div>

        </div>

      </div>
    </div>
  )
}