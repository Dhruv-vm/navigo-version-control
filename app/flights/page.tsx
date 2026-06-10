"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"

type Flight = {
  id: string
  flight_number: string
  airline: string
  origin: string
  destination: string
  departure_time: string
  arrival_time: string
  final_price: number
  tags: string[]
}

export default function FlightsPage() {
  const searchParams = useSearchParams()

  const origin = searchParams.get("origin")
  const destination = searchParams.get("destination")

  const [flights, setFlights] = useState<Flight[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchFlights = async () => {
      const res = await fetch(
        `/api/flights?origin=${origin}&destination=${destination}`
      )
      const data = await res.json()
      setFlights(data)
      setLoading(false)
    }

    fetchFlights()
  }, [origin, destination])

  return (
    <div className="min-h-screen bg-[#020617] text-white px-6 py-12">

      <div className="max-w-6xl mx-auto">

        {/* HEADER */}
        <h1 className="text-4xl md:text-5xl font-bold mb-12 tracking-tight">
          Flights from{" "}
          <span className="text-blue-400">{origin}</span> →{" "}
          <span className="text-yellow-400">{destination}</span>
        </h1>

        {/* LOADING */}
        {loading && (
          <p className="text-gray-400 animate-pulse">
            Loading flights...
          </p>
        )}

        {/* EMPTY STATE */}
        {!loading && flights.length === 0 && (
          <p className="text-gray-400">
            No flights found 😢
          </p>
        )}

        {/* FLIGHT CARDS */}
        <div className="space-y-6">
          {flights.map((flight) => {
            const dep = new Date(flight.departure_time).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })

            const arr = new Date(flight.arrival_time).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })

            return (
              <div
                key={flight.id}
                className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl px-8 py-7 flex justify-between items-center hover:bg-white/10 hover:border-blue-400/30 transition duration-300 shadow-[0_0_40px_rgba(0,0,0,0.3)]"
              >
                {/* LEFT */}
                <div className="space-y-3">
                  <h2 className="text-2xl font-semibold tracking-tight">
                    {flight.airline} ({flight.flight_number})
                  </h2>

                  <p className="text-gray-400 text-sm">
                    {flight.origin} → {flight.destination}
                  </p>

                  <p className="text-gray-300 text-lg">
                    {dep} → {arr}
                  </p>

                  {/* TAGS */}
                  <div className="flex gap-3 mt-2 flex-wrap">
                    {flight.tags?.map((tag, i) => {
                      let style =
                        "px-4 py-1 text-sm rounded-full bg-blue-500/20 text-blue-300"

                      if (tag === "Best")
                        style =
                          "px-4 py-1 text-sm rounded-full bg-green-500/20 text-green-300"
                      if (tag === "Fastest")
                        style =
                          "px-4 py-1 text-sm rounded-full bg-purple-500/20 text-purple-300"
                      if (tag === "Recommended")
                        style =
                          "px-4 py-1 text-sm rounded-full bg-cyan-500/20 text-cyan-300"
                      if (tag === "Cheapest")
                        style =
                          "px-4 py-1 text-sm rounded-full bg-yellow-500/20 text-yellow-300"

                      return (
                        <span key={i} className={style}>
                          {tag}
                        </span>
                      )
                    })}
                  </div>
                </div>

                {/* RIGHT */}
                <div className="text-right flex flex-col items-end gap-4">
                  <p className="text-4xl font-bold text-yellow-400 tracking-tight">
                    ₹{flight.final_price}
                  </p>

                  <button className="px-6 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-yellow-400 text-black font-semibold hover:opacity-90 transition">
                    Select
                  </button>
                </div>
              </div>
            )
          })}
        </div>

      </div>
    </div>
  )
}