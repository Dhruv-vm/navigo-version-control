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
  const returnDate = searchParams.get("return")
  const mode = searchParams.get("mode") || "oneway"

  const passengers = Number(searchParams.get("pax")) || 1

  const formattedDepart = formatDate(depart)

  const [departFlights, setDepartFlights] = useState<any[]>([])
  const [returnFlights, setReturnFlights] = useState<any[]>([])

  const [selectedDepart, setSelectedDepart] = useState<any>(null)
  const [selectedReturn, setSelectedReturn] = useState<any>(null)

  const [activeTab, setActiveTab] = useState("departure")

  useEffect(() => {
    if (!origin || !destination || !depart) return

    fetch(
      `/api/flights?origin=${origin}&destination=${destination}&depart=${depart}`
    )
      .then((res) => res.json())
      .then((data) => setDepartFlights(data.flights || []))

    if (mode === "roundtrip" && returnDate) {
      fetch(
        `/api/flights?origin=${destination}&destination=${origin}&depart=${returnDate}`
      )
        .then((res) => res.json())
        .then((data) => setReturnFlights(data.flights || []))
    }

  }, [origin, destination, depart, returnDate, mode])

  return (
    <div className="min-h-screen bg-[#020617] text-white">

      <Navbar />

      {/* TOP BAR */}
      <div className="max-w-7xl mx-auto px-6 pt-24 pb-6">
        <div className="bg-gradient-to-r from-[#0B1220] via-[#0f1c2e] to-[#0B1220] border border-white/10 rounded-2xl px-8 py-6 flex items-center justify-between">

          <div className="flex items-center gap-10">

            <div className="text-gray-400 text-sm">
              {mode === "roundtrip" ? "⇄ Round Trip" : "→ One Way"}
            </div>

            <div>
              <p className="text-xs text-gray-400">From</p>
              <p className="text-lg font-semibold">{origin}</p>
            </div>

            <div>
              <p className="text-xs text-gray-400">To</p>
              <p className="text-lg font-semibold text-yellow-400">
                {destination}
              </p>
            </div>

            <div>
              <p className="text-xs text-gray-400">Depart</p>
              <p className="text-sm">{formattedDepart.date}</p>
              <p className="text-xs text-gray-500">{formattedDepart.day}</p>
            </div>

            <div>
              <p className="text-xs text-gray-400">Passengers</p>
              <p className="text-sm">
                {passengers} Passenger{passengers > 1 ? "s" : ""}
              </p>
            </div>

          </div>
        </div>
      </div>

      {/* ✅ SELECTED SUMMARY */}
      {mode === "roundtrip" && selectedDepart && (
        <div className="max-w-7xl mx-auto px-6 mb-4">
          <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 flex justify-between items-center">
            <div className="text-sm text-gray-300">
              ✈️ Departure: {selectedDepart.origin} → {selectedDepart.destination}
            </div>

            <button
              onClick={() => {
                setSelectedDepart(null)
                setSelectedReturn(null)
                setActiveTab("departure")
              }}
              className="text-xs text-red-400 hover:underline"
            >
              Change
            </button>
          </div>
        </div>
      )}

      {/* MAIN */}
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-12 gap-6">

        <div className="col-span-3">
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            Filters Sidebar
          </div>
        </div>

        <div className="col-span-6 space-y-4">

          {/* TABS */}
          {mode === "roundtrip" && (
            <div className="flex gap-3 mb-2">
              <button
                onClick={() => setActiveTab("departure")}
                className={`px-4 py-2 rounded-lg border text-sm ${
                  activeTab === "departure"
                    ? "bg-blue-500/20 border-blue-400 text-blue-300"
                    : "bg-white/5 border-white/10 text-gray-400"
                }`}
              >
                Departure
              </button>

              <button
                onClick={() => {
                  if (selectedDepart) setActiveTab("return")
                }}
                className={`px-4 py-2 rounded-lg border text-sm ${
                  activeTab === "return"
                    ? "bg-blue-500/20 border-blue-400 text-blue-300"
                    : "bg-white/5 border-white/10 text-gray-400"
                } ${!selectedDepart ? "opacity-40 cursor-not-allowed" : ""}`}
              >
                Return
              </button>
            </div>
          )}

          {/* HELPER TEXT */}
          {mode === "roundtrip" && activeTab === "return" && !selectedReturn && (
            <p className="text-xs text-blue-400 mb-2">
              Select your return flight
            </p>
          )}

          {/* ONE WAY */}
          {mode === "oneway" &&
            departFlights.map((flight) => {
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
                    price: flight.final_price,
                    aircraft: flight.aircraft,
                    stops: flight.stops,
                    duration: `${durationHours}h`,
                    passengers,
                  }}
                />
              )
            })}

          {/* ROUND TRIP */}
          {mode === "roundtrip" && (
            <>
              {activeTab === "departure" &&
                departFlights.map((flight) => {
                  const durationHours = Math.round(
                    (new Date(flight.arrival_time).getTime() -
                      new Date(flight.departure_time).getTime()) /
                      (1000 * 60 * 60)
                  )

                  return (
                    <FlightCard
                      key={flight.id}
                      onSelect={() => {
                        setSelectedDepart(flight)
                        setActiveTab("return")
                      }}
                      isSelected={selectedDepart?.id === flight.id}
                      flight={{
                        airline: flight.airline,
                        origin: flight.origin,
                        destination: flight.destination,
                        departure_time: flight.departure_time,
                        arrival_time: flight.arrival_time,
                        price: flight.final_price,
                        aircraft: flight.aircraft,
                        stops: flight.stops,
                        duration: `${durationHours}h`,
                        passengers,
                      }}
                    />
                  )
                })}

              {activeTab === "return" &&
                returnFlights.map((flight) => {
                  const durationHours = Math.round(
                    (new Date(flight.arrival_time).getTime() -
                      new Date(flight.departure_time).getTime()) /
                      (1000 * 60 * 60)
                  )

                  return (
                    <FlightCard
                      key={flight.id}
                      onSelect={() => setSelectedReturn(flight)}
                      isSelected={selectedReturn?.id === flight.id}
                      flight={{
                        airline: flight.airline,
                        origin: flight.origin,
                        destination: flight.destination,
                        departure_time: flight.departure_time,
                        arrival_time: flight.arrival_time,
                        price: flight.final_price,
                        aircraft: flight.aircraft,
                        stops: flight.stops,
                        duration: `${durationHours}h`,
                        passengers,
                      }}
                    />
                  )
                })}
            </>
          )}

        </div>

        <div className="col-span-3 space-y-4">
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            AI Box
          </div>
        </div>
      </div>

      {/* TOTAL BAR */}
      {mode === "roundtrip" && selectedDepart && selectedReturn && (
        <div className="fixed bottom-0 left-0 w-full bg-[#0B1220] border-t border-white/10 px-6 py-4 flex justify-between items-center">

          <div>
            <p className="text-xs text-gray-400">Total Price</p>
            <p className="text-2xl font-bold text-yellow-400">
              ₹{(
                selectedDepart.final_price +
                selectedReturn.final_price
              ).toLocaleString()}
            </p>
          </div>

          <button className="px-6 py-3 rounded-lg font-semibold bg-gradient-to-r from-blue-500 via-cyan-400 to-yellow-400 text-black">
            Continue →
          </button>
        </div>
      )}
    </div>
  )
}