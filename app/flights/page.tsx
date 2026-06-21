"use client"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Navbar from "@/components/navbar"
import FlightCard from "@/components/FlightCard"
import PriceInsight from "@/components/PriceInsight"

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

type SortMode = "best" | "cheapest" | "fastest" | "value"

export default function FlightsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const origin = searchParams.get("origin")
  const destination = searchParams.get("destination")
  const depart = searchParams.get("depart")
  const returnDate = searchParams.get("return")
  const mode = searchParams.get("mode") || "oneway"

  const passengers = Number(searchParams.get("pax")) || 1
  const formattedDepart = formatDate(depart)

  const [departFlights, setDepartFlights] = useState<any[]>([])
  const [returnFlights, setReturnFlights] = useState<any[]>([])

  const [sortBy, setSortBy] = useState<SortMode>("best")
  const [maxPrice, setMaxPrice] = useState(20000)
  const [selectedStops, setSelectedStops] = useState<number | null>(null)

  // ✅ AIRLINES
  const [selectedAirlines, setSelectedAirlines] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<"departure" | "return">("departure")
  const [selectedDepartFlight, setSelectedDepartFlight] = useState<any>(null)

  // ✅ RETURN SELECTION STATE
  const [selectedReturnFlight, setSelectedReturnFlight] = useState<any>(null)

  // ✅ Collapsible filter sections (UI only)
  const [openSections, setOpenSections] = useState({
    stops: true,
    price: true,
    airlines: true,
  })

  const toggleSection = (key: "stops" | "price" | "airlines") => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const [particles, setParticles] = useState<any[]>([])

  useEffect(() => {
    setParticles(
      [...Array(30)].map(() => ({
        top: Math.random() * 100,
        left: Math.random() * 100,
      }))
    )
  }, [])

  useEffect(() => {
    if (!origin || !destination || !depart) return

    fetch(`/api/flights?origin=${origin}&destination=${destination}&depart=${depart}`)
      .then((res) => res.json())
      .then((data) => {
        // eslint-disable-next-line no-console
        console.log("[flights] depart response:", data)
        setDepartFlights(data.flights || [])
      })
      .catch((err) => console.error("[flights] depart fetch failed:", err))

    if (mode === "roundtrip" && returnDate) {
      fetch(`/api/flights?origin=${destination}&destination=${origin}&depart=${returnDate}`)
        .then((res) => res.json())
        .then((data) => {
          // eslint-disable-next-line no-console
          console.log("[flights] return response:", data)
          setReturnFlights(data.flights || [])
        })
        .catch((err) => console.error("[flights] return fetch failed:", err))
    }
  }, [origin, destination, depart, returnDate, mode])

  // ✅ FIXED — resets filters whenever the tab changes so filters picked
  // while browsing Departure (e.g. a specific airline, stop count, or
  // price cap) don't silently wipe out the Return list, which can have a
  // totally different set of airlines/stops/prices.
  const switchTab = (tab: "departure" | "return") => {
    setActiveTab(tab)
    setSelectedStops(null)
    setSelectedAirlines([])
    setMaxPrice(20000)
  }

  // ✅ FILTER LOGIC (unchanged)
  const applyFilters = (flights: any[]) => {
    return flights.filter((f) => {
      if (f.final_price > maxPrice) return false
      if (selectedStops !== null && f.stops !== selectedStops) return false

      if (selectedAirlines.length > 0 && !selectedAirlines.includes(f.airline))
        return false

      return true
    })
  }

  // ✅ FIXED — parses the real "Xh Ym" duration string your API/FlightCard
  // already use, instead of guessing from stops. Falls back only if the
  // field is missing or unparsable.
  const parseDurationMinutes = (duration?: string) => {
    if (!duration) return null
    const match = duration.match(/(\d+)\s*h(?:[^\d]*?(\d+)\s*m)?/i)
    if (!match) return null
    const hours = Number(match[1] || 0)
    const mins = Number(match[2] || 0)
    return hours * 60 + mins
  }

  const getDurationMinutes = (f: any) => {
    const parsed = parseDurationMinutes(f.duration)
    if (parsed !== null) return parsed
    if (typeof f.duration_minutes === "number") return f.duration_minutes
    return 90 + (f.stops || 0) * 75
  }

  const getValueScore = (f: any) => f.final_price + getDurationMinutes(f) * 3
  const getBestScore = (f: any) => f.final_price * 0.6 + getDurationMinutes(f) * 0.4

  const formatDuration = (mins: number) => {
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return `${h}h ${m}m`
  }

  // ✅ supports best / cheapest / fastest / value
  const applySort = (flights: any[]) => {
    const sorted = [...flights]

    if (sortBy === "cheapest")
      return sorted.sort((a, b) => a.final_price - b.final_price)

    if (sortBy === "fastest")
      return sorted.sort((a, b) => getDurationMinutes(a) - getDurationMinutes(b))

    if (sortBy === "value")
      return sorted.sort((a, b) => getValueScore(a) - getValueScore(b))

    // "best" — balanced price + duration score
    return sorted.sort((a, b) => getBestScore(a) - getBestScore(b))
  }

  // ✅ FIXED — was hardcoded to always read from `departFlights`, which
  // meant the airline price chips on the Return tab showed departure
  // prices (or nothing) instead of return prices. Now reads from
  // whichever leg is currently active.
  const getMinPriceByAirline = (airline: string) => {
    const sourceFlights = activeTab === "departure" ? departFlights : returnFlights
    const flights = applyFilters(sourceFlights).filter(
      (f) => f.airline === airline
    )
    if (!flights.length) return null
    return Math.min(...flights.map((f) => f.final_price))
  }

  const stopsOptions = [
    {
      value: 0,
      title: "Non-stop",
      subtitle: "Direct flights only",
      price: 3000,
      icon: "✈️",
    },
    {
      value: 1,
      title: "1 Stop",
      subtitle: "One layover",
      price: 4000,
      icon: "🛫",
    },
    {
      value: 2,
      title: "2+ Stops",
      subtitle: "Multiple layovers",
      price: 5000,
      icon: "🔀",
    },
  ]

  const airlinesList = ["Air India", "IndiGo", "Vistara", "Emirates"]

  // ✅ Currently visible list (filtered, not yet sorted) used to build summary cards
  const activeFlights = activeTab === "departure" ? departFlights : returnFlights
  const currentFiltered = applyFilters(activeFlights)

  const cheapestFlight = currentFiltered.length
    ? [...currentFiltered].sort((a, b) => a.final_price - b.final_price)[0]
    : null

  const fastestFlight = currentFiltered.length
    ? [...currentFiltered].sort(
        (a, b) => getDurationMinutes(a) - getDurationMinutes(b)
      )[0]
    : null

  const bestValueFlight = currentFiltered.length
    ? [...currentFiltered].sort((a, b) => getValueScore(a) - getValueScore(b))[0]
    : null

  const bestFlight = currentFiltered.length
    ? [...currentFiltered].sort((a, b) => getBestScore(a) - getBestScore(b))[0]
    : null

  const summaryCards: {
    key: SortMode
    label: string
    icon: string
    flight: any
  }[] = [
    { key: "best", label: "Best", icon: "⭐", flight: bestFlight },
    { key: "cheapest", label: "Cheapest", icon: "💰", flight: cheapestFlight },
    { key: "fastest", label: "Fastest", icon: "⚡", flight: fastestFlight },
    { key: "value", label: "Best Value", icon: "🎯", flight: bestValueFlight },
  ]

  // ✅ Continue → persist the full selection so /checkout has everything it
  // needs without refetching, and so a page reload on /checkout doesn't
  // lose the booking. sessionStorage survives reloads but clears when the
  // tab/browser closes, which is the right lifetime for an in-progress
  // booking (URL params alone aren't enough — there's too much data, and a
  // copy-pasted/bookmarked URL shouldn't replay someone else's booking).
  const handleContinue = () => {
    if (!selectedDepartFlight) return

    const totalPrice =
      selectedDepartFlight.final_price + (selectedReturnFlight?.final_price || 0)

    const checkoutSelection = {
      departFlight: selectedDepartFlight,
      returnFlight: selectedReturnFlight || null,
      passengers,
      mode,
      totalPrice,
      origin,
      destination,
      savedAt: Date.now(),
    }

    try {
      sessionStorage.setItem("navigo:checkoutSelection", JSON.stringify(checkoutSelection))
    } catch (err) {
      console.error("Failed to persist checkout selection:", err)
    }

    const params = new URLSearchParams({
      departId: String(selectedDepartFlight.id),
      total: String(totalPrice),
      pax: String(passengers),
      mode,
    })

    if (selectedReturnFlight) {
      params.set("returnId", String(selectedReturnFlight.id))
    }

    router.push(`/checkout?${params.toString()}`)
  }

  return (
    <div className="relative min-h-screen text-white overflow-hidden">

      {/* BACKGROUND */}
      <div className="absolute inset-0 bg-[#020617]" />
      <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-cyan-500/10 to-indigo-900/20" />

      {/* GLOW */}
      <div className="absolute top-[-150px] left-[10%] w-[500px] h-[500px] bg-blue-500/20 blur-[140px] rounded-full"></div>
      <div className="absolute bottom-[-200px] right-[10%] w-[500px] h-[500px] bg-cyan-400/10 blur-[140px] rounded-full"></div>

      {/* PARTICLES */}
      <div className="absolute inset-0">
        {particles.map((p, i) => (
          <div key={i}
            className="absolute w-1 h-1 bg-white/30 rounded-full"
            style={{ top: `${p.top}%`, left: `${p.left}%` }}
          />
        ))}
      </div>

      <div className="relative z-10">

        <Navbar />

        {/* TOP BAR (UNCHANGED) */}
        <div className="max-w-7xl mx-auto px-6 pt-24 pb-6">
          <div className="bg-gradient-to-r from-[#0B1220] via-[#0f1c2e] to-[#0B1220]
          border border-white/10 rounded-2xl px-10 py-6">

            <div className="flex items-center justify-between">

              <div className="flex items-center gap-10">

                <div className="text-gray-400 text-sm pr-6 border-r border-white/10">
                  ⇄ {mode}
                </div>

                <div className="flex items-center gap-8 pr-8 border-r border-white/10">
                  <div>
                    <p className="text-xs text-gray-500">From</p>
                    <p className="text-4xl font-bold">{origin}</p>
                  </div>

                  <div className="w-14 h-14 flex items-center justify-center rounded-full 
                  bg-white/5 border border-white/10">
                    ⇄
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">To</p>
                    <p className="text-4xl font-bold text-yellow-400">
                      {destination}
                    </p>
                  </div>
                </div>

                <div className="flex items-center pr-8 border-r border-white/10">
                  <div className="pr-6">
                    <p className="text-xs text-gray-500">Depart</p>
                    <p className="text-lg font-semibold">
                      {formattedDepart.date}
                    </p>
                  </div>

                  {mode === "roundtrip" && returnDate && (
                    <>
                      <div className="h-10 w-px bg-white/10 mx-4" />
                      <div className="pl-6">
                        <p className="text-xs text-gray-500">Return</p>
                        <p className="text-lg font-semibold">
                          {formatDate(returnDate).date}
                        </p>
                      </div>
                    </>
                  )}
                </div>

                <div>
                  <p className="text-xs text-gray-500">Passengers</p>
                  <p className="text-xl font-semibold">{passengers}</p>
                  <p className="text-xs text-gray-400">Economy</p>
                </div>

              </div>

              <button
                onClick={() => router.push("/")}
                className="px-5 py-2 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10"
              >
                ✏️ Edit
              </button>

            </div>
          </div>
        </div>

        {/* MAIN */}
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-12 gap-6 pb-32">

          {/* 🔥 FINAL FILTERS — REDESIGNED UI */}
          <div className="col-span-3 space-y-6">

            <div className="bg-gradient-to-b from-[#0B1220] to-[#0a1628] 
            p-6 rounded-2xl border border-white/10">

              {/* HEADER */}
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-xl font-bold">Filters</h2>
                  <p className="text-xs text-gray-500 mt-1">Refine your flight search</p>
                </div>
                <button
                  onClick={() => {
                    setSelectedStops(null)
                    setMaxPrice(20000)
                    setSelectedAirlines([])
                  }}
                  className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300"
                >
                  <span>↻</span> Reset
                </button>
              </div>

              {/* STOPS */}
              <div className="mb-6">
                <button
                  type="button"
                  onClick={() => toggleSection("stops")}
                  className="w-full flex items-center justify-between mb-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-blue-500/20 flex items-center justify-center text-base">
                      ✈️
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold">Stops</p>
                      <p className="text-xs text-gray-500">Choose the number of stops</p>
                    </div>
                  </div>
                  <span className="text-gray-400 text-xs">
                    {openSections.stops ? "▲" : "▼"}
                  </span>
                </button>

                {openSections.stops && (
                  <div className="space-y-2">
                    {stopsOptions.map((s) => (
                      <label
                        key={s.value}
                        className={`flex items-center justify-between px-3 py-3 rounded-xl cursor-pointer border transition
                        ${selectedStops === s.value
                          ? "bg-blue-500/20 border-blue-400/40"
                          : "bg-white/[0.02] border-white/10 hover:bg-white/5"}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center text-base">
                            {s.icon}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{s.title}</p>
                            <p className="text-xs text-gray-500">{s.subtitle}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-400">₹{s.price.toLocaleString("en-IN")}</span>
                          <input
                            type="radio"
                            className="accent-blue-500 w-4 h-4"
                            checked={selectedStops === s.value}
                            onChange={() => setSelectedStops(s.value)}
                          />
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* PRICE */}
              <div className="mb-6">
                <button
                  type="button"
                  onClick={() => toggleSection("price")}
                  className="w-full flex items-center justify-between mb-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-blue-500/20 flex items-center justify-center text-base">
                      🏷️
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold">Price Range</p>
                      <p className="text-xs text-gray-500">Select your budget range</p>
                    </div>
                  </div>
                  <span className="text-gray-400 text-xs">
                    {openSections.price ? "▲" : "▼"}
                  </span>
                </button>

                {openSections.price && (
                  <div>
                    <input
                      type="range"
                      min={1000}
                      max={20000}
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(Number(e.target.value))}
                      className="w-full accent-blue-500"
                    />

                    <div className="flex items-center justify-between text-xs text-gray-400 mt-2">
                      <span>₹1,000</span>
                      <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white">
                        ₹1,000 - ₹{maxPrice.toLocaleString("en-IN")}
                      </span>
                      <span>₹20,000</span>
                    </div>
                  </div>
                )}
              </div>

              {/* AIRLINES */}
              <div>
                <button
                  type="button"
                  onClick={() => toggleSection("airlines")}
                  className="w-full flex items-center justify-between mb-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-blue-500/20 flex items-center justify-center text-base">
                      ✈️
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold">Airlines</p>
                      <p className="text-xs text-gray-500">Select preferred airlines</p>
                    </div>
                  </div>
                  <span className="text-gray-400 text-xs">
                    {openSections.airlines ? "▲" : "▼"}
                  </span>
                </button>

                {openSections.airlines && (
                  <div className="space-y-2">
                    {airlinesList.map((airline) => {
                      const isSelected = selectedAirlines.includes(airline)
                      const minPrice = getMinPriceByAirline(airline)

                      return (
                        <label
                          key={airline}
                          className={`flex justify-between items-center px-3 py-2.5 rounded-xl cursor-pointer border transition
                          ${isSelected
                            ? "bg-blue-500/20 border-blue-400/40"
                            : "bg-white/[0.02] border-white/10 hover:bg-white/5"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-xs font-bold text-black">
                              {airline.charAt(0)}
                            </div>
                            <span className="text-sm">{airline}</span>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-400">
                              {minPrice ? `₹${minPrice.toLocaleString("en-IN")}` : "--"}
                            </span>
                            <input
                              type="checkbox"
                              className="accent-blue-500 w-4 h-4 rounded"
                              checked={isSelected}
                              onChange={() => {
                                if (isSelected) {
                                  setSelectedAirlines((prev) =>
                                    prev.filter((a) => a !== airline)
                                  )
                                } else {
                                  setSelectedAirlines((prev) => [...prev, airline])
                                }
                              }}
                            />
                          </div>
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* FLIGHTS */}
          <div className="col-span-6 space-y-4">
            {mode === "roundtrip" && (
              <div className="flex gap-4 mb-4">

                <button
                  onClick={() => switchTab("departure")}
                  className={`px-4 py-2 rounded-lg text-sm
                  ${activeTab === "departure"
                    ? "bg-blue-500/20 border border-blue-400 text-white"
                    : "bg-white/5 text-gray-400"}`}
                >
                  Departure
                </button>

                <button
                  disabled={!selectedDepartFlight}
                  onClick={() => switchTab("return")}
                  className={`px-4 py-2 rounded-lg text-sm
                  ${!selectedDepartFlight
                    ? "opacity-40 cursor-not-allowed bg-white/5"
                    : activeTab === "return"
                      ? "bg-blue-500/20 border border-blue-400 text-white"
                      : "bg-white/5 text-gray-400"}`}
                >
                  Return
                </button>

              </div>
            )}

            {/* 🧠 BEST / CHEAPEST / FASTEST / BEST VALUE SUMMARY CARDS */}
            <div className="grid grid-cols-4 gap-3">
              {summaryCards.map((card) => (
                <button
                  key={card.key}
                  type="button"
                  disabled={!card.flight}
                  onClick={() => setSortBy(card.key)}
                  className={`text-left p-4 rounded-2xl border transition
                  ${sortBy === card.key
                    ? "bg-blue-500/20 border-blue-400"
                    : "bg-white/[0.03] border-white/10 hover:bg-white/5"}
                  ${!card.flight ? "opacity-40 cursor-not-allowed" : ""}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span>{card.icon}</span>
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-300">
                      {card.label}
                    </span>
                  </div>

                  {card.flight ? (
                    <>
                      <p className="text-sm font-medium truncate">{card.flight.airline}</p>
                      <p className="text-lg font-bold text-yellow-400">
                        ₹{card.flight.final_price.toLocaleString("en-IN")}
                      </p>
                      {/* ✅ FIXED — uses the real duration string, falls back only if missing */}
                      <p className="text-xs text-gray-500">
                        {card.flight.duration || formatDuration(getDurationMinutes(card.flight))}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-gray-500">No flights</p>
                  )}
                </button>
              ))}
            </div>

            {/* ✅ Uses the real FlightCard's own onSelect / isSelected API */}
            {applySort(currentFiltered).map((flight) => {
              const isThisSelected =
                activeTab === "departure"
                  ? selectedDepartFlight?.id === flight.id
                  : selectedReturnFlight?.id === flight.id

              return (
                <FlightCard
                  key={flight.id}
                  flight={{ ...flight, price: flight.final_price }}
                  isSelected={isThisSelected}
                  onSelect={() => {
                    if (activeTab === "departure") {
                      setSelectedDepartFlight(flight)

                      if (mode === "roundtrip") {
                        switchTab("return")
                      }
                    } else {
                      setSelectedReturnFlight(flight)
                    }
                  }}
                />
              )
            })}

            {currentFiltered.length === 0 && (
              <div className="text-center text-gray-400 text-sm py-10 border border-white/10 rounded-2xl bg-white/[0.02]">
                No flights match your current filters.{" "}
                <button
                  onClick={() => {
                    setSelectedStops(null)
                    setMaxPrice(20000)
                    setSelectedAirlines([])
                  }}
                  className="text-blue-400 hover:underline"
                >
                  Reset filters
                </button>
              </div>
            )}
          </div>

          {/* RIGHT — AI Box / Price Insight, now driven by real dynamic pricing data */}
          <div className="col-span-3">
            <PriceInsight flights={currentFiltered} />
          </div>

        </div>

        {/* ✅ STICKY SELECTION SUMMARY BAR — total only, no price split-up */}
        {selectedDepartFlight && (
          <div className="fixed bottom-0 left-0 w-full bg-[#0B1220] border-t border-white/10 px-6 py-4 z-50">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              {/* FLIGHT SUMMARY */}
              <div className="flex flex-col">
                <span className="text-sm text-gray-400">
                  Selected Flights
                </span>
                <span className="text-sm">
                  {selectedDepartFlight.airline} • {selectedDepartFlight.origin} → {selectedDepartFlight.destination}
                </span>
                {selectedReturnFlight && (
                  <span className="text-sm text-gray-400">
                    Return: {selectedReturnFlight.airline} • {selectedReturnFlight.origin} → {selectedReturnFlight.destination}
                  </span>
                )}
              </div>
              {/* TOTAL PRICE — single combined number, no split-up */}
              <div className="text-right">
                <p className="text-xs text-gray-400">
                  {mode === "roundtrip" && !selectedReturnFlight ? "Total (departure only)" : "Total Price"}
                </p>
                <p className="text-2xl font-bold text-yellow-400">
                  ₹{(
                    selectedDepartFlight.final_price +
                    (selectedReturnFlight?.final_price || 0)
                  ).toLocaleString("en-IN")}
                </p>
              </div>
              {/* CTA */}
              <button
                disabled={mode === "roundtrip" && !selectedReturnFlight}
                onClick={handleContinue}
                className={`px-6 py-3 rounded-xl font-semibold
                ${mode === "roundtrip" && !selectedReturnFlight
                  ? "bg-gray-500 cursor-not-allowed"
                  : "bg-gradient-to-r from-blue-500 via-cyan-400 to-yellow-400 text-black hover:scale-105"}
                transition`}
              >
                Continue →
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}