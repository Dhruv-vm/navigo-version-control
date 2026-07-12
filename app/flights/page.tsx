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
    date: d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
    day: d.toLocaleDateString("en-IN", { weekday: "short" }),
  }
}

// ✅ Option C safety net — normalises whatever field names the API returns
// so FlightCard always gets `departure_time` and `arrival_time` as plain
// "HH:MM" or "HH:MM:SS" strings, and `duration` as a human-readable string.
function normalizeFlight(f: any) {
  // --- times ---
  const departure_time =
    f.departure_time ??
    f.dep_time ??
    f.departureTime ??
    f.scheduled_departure ??
    null

  const arrival_time =
    f.arrival_time ??
    f.arr_time ??
    f.arrivalTime ??
    f.scheduled_arrival ??
    null

  // --- duration ---
  // If the API still sends a raw millisecond number (old bug), convert it.
  let duration = f.duration
  if (typeof duration === "number" && duration > 1000) {
    const totalMins = Math.round(duration / 60000)
    const h = Math.floor(totalMins / 60)
    const m = totalMins % 60
    duration = m > 0 ? `${h}h ${m}m` : `${h}h`
  }

  return { ...f, departure_time, arrival_time, duration }
}

type SortMode = "best" | "cheapest" | "fastest" | "value"

const airlineLogos: Record<string, string> = {
  "IndiGo": "/airlines/indigo.png",
  "Air India": "/airlines/airindia.png",
  "Vistara": "/airlines/vistara.png",
  "Akasa Air": "/airlines/akasa.png",
  "Emirates": "/airlines/emirates.png",
  "Qatar Airways": "/airlines/qatar.png",
}

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
  const [selectedAirlines, setSelectedAirlines] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<"departure" | "return">("departure")
  const [selectedDepartFlight, setSelectedDepartFlight] = useState<any>(null)
  const [selectedReturnFlight, setSelectedReturnFlight] = useState<any>(null)
  const [openSections, setOpenSections] = useState({ stops: true, price: true, airlines: true })
  const [particles, setParticles] = useState<any[]>([])

  const toggleSection = (key: "stops" | "price" | "airlines") => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  useEffect(() => {
    setParticles([...Array(30)].map(() => ({ top: Math.random() * 100, left: Math.random() * 100 })))
  }, [])

  useEffect(() => {
    if (!origin || !destination || !depart) return

    fetch(`/api/flights?origin=${origin}&destination=${destination}&depart=${depart}`)
      .then((res) => res.json())
      .then((data) => {
        // ✅ Normalize every flight before storing in state
        setDepartFlights(Array.isArray(data) ? data.map(normalizeFlight) : [])
      })
      .catch((err) => console.error("[flights] depart fetch failed:", err))

    if (mode === "roundtrip" && returnDate) {
      fetch(`/api/flights?origin=${destination}&destination=${origin}&depart=${returnDate}`)
        .then((res) => res.json())
        .then((data) => {
          setReturnFlights(Array.isArray(data) ? data.map(normalizeFlight) : [])
        })
        .catch((err) => console.error("[flights] return fetch failed:", err))
    }
  }, [origin, destination, depart, returnDate, mode])

  const switchTab = (tab: "departure" | "return") => {
    setActiveTab(tab)
    setSelectedStops(null)
    setSelectedAirlines([])
    setMaxPrice(20000)
  }

  const applyFilters = (flights: any[]) => {
    return flights.filter((f) => {
      if (f.final_price > maxPrice) return false
      if (selectedStops !== null && f.stops !== selectedStops) return false
      if (selectedAirlines.length > 0 && !selectedAirlines.includes(f.airline)) return false
      return true
    })
  }

  const parseDurationMinutes = (duration?: string) => {
    if (!duration) return null
    const match = duration.match(/(\d+)\s*h(?:[^\d]*?(\d+)\s*m)?/i)
    if (!match) return null
    return Number(match[1] || 0) * 60 + Number(match[2] || 0)
  }

  const getDurationMinutes = (f: any) => {
    // Prefer pre-computed numeric field from API
    if (typeof f.duration_minutes === "number") return f.duration_minutes
    const parsed = parseDurationMinutes(f.duration)
    if (parsed !== null) return parsed
    return 90 + (f.stops || 0) * 75
  }

  const getValueScore = (f: any) => f.final_price + getDurationMinutes(f) * 3
  const getBestScore = (f: any) => f.final_price * 0.6 + getDurationMinutes(f) * 0.4

  const formatDuration = (mins: number) => {
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return `${h}h ${m}m`
  }

  const applySort = (flights: any[]) => {
    const sorted = [...flights]
    if (sortBy === "cheapest") return sorted.sort((a, b) => a.final_price - b.final_price)
    if (sortBy === "fastest") return sorted.sort((a, b) => getDurationMinutes(a) - getDurationMinutes(b))
    if (sortBy === "value") return sorted.sort((a, b) => getValueScore(a) - getValueScore(b))
    return sorted.sort((a, b) => getBestScore(a) - getBestScore(b))
  }

  const getMinPriceByAirline = (airline: string) => {
    const sourceFlights = activeTab === "departure" ? departFlights : returnFlights
    const flights = applyFilters(sourceFlights).filter((f) => f.airline === airline)
    if (!flights.length) return null
    return Math.min(...flights.map((f) => f.final_price))
  }

  const stopsOptions = [
    { value: 0, title: "Non-stop", subtitle: "Direct flights only", price: 3000, icon: "✈️" },
    { value: 1, title: "1 Stop", subtitle: "One layover", price: 4000, icon: "🛫" },
    { value: 2, title: "2+ Stops", subtitle: "Multiple layovers", price: 5000, icon: "🔀" },
  ]

  const airlinesList = ["Air India", "IndiGo", "Vistara", "Emirates"]

  const activeFlights = activeTab === "departure" ? departFlights : returnFlights
  const currentFiltered = applyFilters(activeFlights)

  const cheapestFlight = currentFiltered.length
    ? [...currentFiltered].sort((a, b) => a.final_price - b.final_price)[0]
    : null

  const fastestFlight = currentFiltered.length
    ? [...currentFiltered].sort((a, b) => getDurationMinutes(a) - getDurationMinutes(b))[0]
    : null

  const bestValueFlight = currentFiltered.length
    ? [...currentFiltered].sort((a, b) => getValueScore(a) - getValueScore(b))[0]
    : null

  const bestFlight = currentFiltered.length
    ? [...currentFiltered].sort((a, b) => getBestScore(a) - getBestScore(b))[0]
    : null

  const summaryCards: { key: SortMode; label: string; icon: string; flight: any }[] = [
    { key: "best", label: "Best", icon: "⭐", flight: bestFlight },
    { key: "cheapest", label: "Cheapest", icon: "💰", flight: cheapestFlight },
    { key: "fastest", label: "Fastest", icon: "⚡", flight: fastestFlight },
    { key: "value", label: "Best Value", icon: "🎯", flight: bestValueFlight },
  ]

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

    if (selectedReturnFlight) params.set("returnId", String(selectedReturnFlight.id))
    router.push(`/checkout?${params.toString()}`)
  }

  return (
    <div className="relative min-h-screen text-white overflow-hidden">

      {/* BACKGROUND — swapped the cool blue wash for the same warm dark
          navy + amber/cyan ambient glow used on every other page, so this
          no longer reads as a different, unbranded template. */}
      <div className="absolute inset-0 bg-[#060B14]" />
      <div className="absolute inset-0 bg-gradient-to-br from-amber-500/[0.04] via-transparent to-cyan-500/[0.05]" />

      {/* GLOW */}
      <div className="absolute top-[-150px] left-[10%] w-[500px] h-[500px] bg-amber-500/[0.06] blur-[140px] rounded-full" />
      <div className="absolute bottom-[-200px] right-[10%] w-[500px] h-[500px] bg-cyan-400/[0.06] blur-[140px] rounded-full" />
      <div className="absolute top-[20%] right-[25%] w-[350px] h-[350px] bg-blue-500/[0.04] blur-[130px] rounded-full" />

      {/* PARTICLES */}
      <div className="absolute inset-0">
        {particles.map((p, i) => (
          <div key={i} className="absolute w-1 h-1 bg-white/30 rounded-full"
            style={{ top: `${p.top}%`, left: `${p.left}%` }} />
        ))}
      </div>

      <div className="relative z-10">
        <Navbar />

        {/* TOP BAR */}
        <div className="max-w-7xl mx-auto px-6 pt-24 pb-6">
          <div className="relative bg-gradient-to-r from-[#0D1A2C] via-[#0B1729] to-[#0D1A2C] border border-white/[0.08] rounded-2xl px-10 py-6 ticket-edge overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-400 via-amber-400 to-amber-300" />
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-10 flex-wrap">

                <div className="text-slate-400 text-sm pr-6 border-r border-white/10 flex items-center gap-1.5">
                  <span className="text-amber-300">⇄</span> {mode}
                </div>

                <div className="flex items-center gap-8 pr-8 border-r border-white/10">
                  <div>
                    <p className="text-xs text-slate-500">From</p>
                    <p className="font-display text-4xl font-extrabold">{origin}</p>
                  </div>
                  <div className="w-14 h-14 flex items-center justify-center rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-300">⇄</div>
                  <div>
                    <p className="text-xs text-slate-500">To</p>
                    <p className="font-display text-4xl font-extrabold text-amber-300">{destination}</p>
                  </div>
                </div>

                <div className="flex items-center pr-8 border-r border-white/10">
                  <div className="pr-6">
                    <p className="text-xs text-slate-500">Depart</p>
                    <p className="font-display text-lg font-bold">{formattedDepart.date}</p>
                  </div>
                  {mode === "roundtrip" && returnDate && (
                    <>
                      <div className="h-10 w-px bg-white/10 mx-4" />
                      <div className="pl-6">
                        <p className="text-xs text-slate-500">Return</p>
                        <p className="font-display text-lg font-bold">{formatDate(returnDate).date}</p>
                      </div>
                    </>
                  )}
                </div>

                <div>
                  <p className="text-xs text-slate-500">Passengers</p>
                  <p className="font-display text-xl font-bold">{passengers}</p>
                  <p className="text-xs text-cyan-300/80">Economy</p>
                </div>

              </div>
              <button onClick={() => router.push("/")}
                className="px-5 py-2 rounded-full border border-amber-400/25 bg-amber-400/[0.06] text-amber-200 hover:bg-amber-400/[0.12] hover:border-amber-400/40 transition-colors">
                ✏️ Edit
              </button>
            </div>
          </div>
        </div>

        {/* MAIN */}
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-12 gap-6 pb-32">

          {/* FILTERS */}
          <div className="col-span-3 space-y-6">
            <div className="fade-up relative bg-gradient-to-b from-[#0D1A2C] to-[#0A1424] p-6 rounded-2xl border border-white/[0.08] ticket-edge overflow-hidden">

              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="font-display text-xl font-bold">Filters</h2>
                  <p className="text-xs text-slate-500 mt-1">Refine your flight search</p>
                </div>
                <button
                  onClick={() => { setSelectedStops(null); setMaxPrice(20000); setSelectedAirlines([]) }}
                  className="flex items-center gap-1 text-sm text-cyan-300 hover:text-cyan-200 transition-colors"
                >
                  <span>↻</span> Reset
                </button>
              </div>

              {/* STOPS */}
              <div className="mb-6">
                <button type="button" onClick={() => toggleSection("stops")}
                  className="w-full flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-base">✈️</div>
                    <div className="text-left">
                      <p className="text-sm font-semibold">Stops</p>
                      <p className="text-xs text-slate-500">Choose the number of stops</p>
                    </div>
                  </div>
                  <span className="text-slate-500 text-xs">{openSections.stops ? "▲" : "▼"}</span>
                </button>

                <div className="grid transition-all duration-300 ease-out" style={{ gridTemplateRows: openSections.stops ? "1fr" : "0fr" }}>
                  <div className="overflow-hidden">
                    <div className="space-y-2 pt-0.5">
                      {stopsOptions.map((s) => {
                        const isSelected = selectedStops === s.value
                        return (
                          <div key={s.value}
                            role="radio"
                            aria-checked={isSelected}
                            tabIndex={0}
                            onClick={() => setSelectedStops(s.value)}
                            onKeyDown={(e) => e.key === "Enter" && setSelectedStops(s.value)}
                            className={`filter-row flex items-center justify-between px-3 py-3 rounded-xl cursor-pointer border transition-all duration-200
                            ${isSelected
                              ? "bg-amber-400/[0.1] border-amber-400/40 shadow-[0_0_0_1px_rgba(251,191,36,0.15)]"
                              : "bg-white/[0.02] border-white/10 hover:bg-white/5 hover:border-white/20"}`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-base transition-colors ${isSelected ? "bg-amber-400/[0.16]" : "bg-amber-400/[0.08]"}`}>{s.icon}</div>
                              <div>
                                <p className="text-sm font-medium">{s.title}</p>
                                <p className="text-xs text-slate-500">{s.subtitle}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-slate-400">₹{s.price.toLocaleString("en-IN")}</span>
                              <span className={`custom-radio ${isSelected ? "is-checked" : ""}`}>
                                <span className="custom-radio-dot" />
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* PRICE */}
              <div className="mb-6">
                <button type="button" onClick={() => toggleSection("price")}
                  className="w-full flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-base">🏷️</div>
                    <div className="text-left">
                      <p className="text-sm font-semibold">Price Range</p>
                      <p className="text-xs text-slate-500">Select your budget range</p>
                    </div>
                  </div>
                  <span className="text-slate-500 text-xs">{openSections.price ? "▲" : "▼"}</span>
                </button>

                <div className="grid transition-all duration-300 ease-out" style={{ gridTemplateRows: openSections.price ? "1fr" : "0fr" }}>
                  <div className="overflow-hidden">
                    <div className="pt-0.5">
                      <input type="range" min={1000} max={20000} value={maxPrice}
                        onChange={(e) => setMaxPrice(Number(e.target.value))}
                        className="w-full accent-amber-400" />
                      <div className="flex items-center justify-between text-xs text-slate-400 mt-2">
                        <span>₹1,000</span>
                        <span className="px-3 py-1 rounded-full bg-amber-400/[0.08] border border-amber-400/20 text-amber-200">
                          ₹1,000 - ₹{maxPrice.toLocaleString("en-IN")}
                        </span>
                        <span>₹20,000</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* AIRLINES */}
              <div>
                <button type="button" onClick={() => toggleSection("airlines")}
                  className="w-full flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-base">✈️</div>
                    <div className="text-left">
                      <p className="text-sm font-semibold">Airlines</p>
                      <p className="text-xs text-slate-500">Select preferred airlines</p>
                    </div>
                  </div>
                  <span className="text-slate-500 text-xs">{openSections.airlines ? "▲" : "▼"}</span>
                </button>

                <div className="grid transition-all duration-300 ease-out" style={{ gridTemplateRows: openSections.airlines ? "1fr" : "0fr" }}>
                  <div className="overflow-hidden">
                    <div className="space-y-2 pt-0.5">
                      {airlinesList.map((airline) => {
                        const isSelected = selectedAirlines.includes(airline)
                        const minPrice = getMinPriceByAirline(airline)
                        return (
                          <div key={airline}
                            role="checkbox"
                            aria-checked={isSelected}
                            tabIndex={0}
                            onClick={() => {
                              if (isSelected) {
                                setSelectedAirlines((prev) => prev.filter((a) => a !== airline))
                              } else {
                                setSelectedAirlines((prev) => [...prev, airline])
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key !== "Enter") return
                              setSelectedAirlines((prev) => isSelected ? prev.filter((a) => a !== airline) : [...prev, airline])
                            }}
                            className={`filter-row flex justify-between items-center px-3 py-2.5 rounded-xl cursor-pointer border transition-all duration-200
                            ${isSelected
                              ? "bg-amber-400/[0.1] border-amber-400/40 shadow-[0_0_0_1px_rgba(251,191,36,0.15)]"
                              : "bg-white/[0.02] border-white/10 hover:bg-white/5 hover:border-white/20"}`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center overflow-hidden ring-1 ring-black/5 shrink-0">
                                <img src={airlineLogos[airline] || "/airlines/default.png"} alt={airline} className="w-6 h-6 object-contain" />
                              </div>
                              <span className="text-sm">{airline}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-slate-400">
                                {minPrice ? `₹${minPrice.toLocaleString("en-IN")}` : "--"}
                              </span>
                              <span className={`custom-checkbox ${isSelected ? "is-checked" : ""}`}>
                                {isSelected && <span className="custom-checkbox-tick">✓</span>}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* FLIGHTS */}
          <div className="col-span-6 space-y-4">
            {mode === "roundtrip" && (
              <div className="inline-flex items-center gap-1 bg-white/[0.03] border border-white/[0.06] rounded-full p-1.5 mb-2">
                <button onClick={() => switchTab("departure")}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200
                  ${activeTab === "departure"
                    ? "text-[#060B14] bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 shadow-[0_2px_12px_rgba(251,191,36,0.35)]"
                    : "text-slate-400 hover:text-white hover:bg-white/[0.05]"}`}>
                  Departure
                </button>
                <button
                  disabled={!selectedDepartFlight}
                  onClick={() => switchTab("return")}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200
                  ${!selectedDepartFlight
                    ? "opacity-40 cursor-not-allowed text-slate-600"
                    : activeTab === "return"
                      ? "text-[#060B14] bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 shadow-[0_2px_12px_rgba(251,191,36,0.35)]"
                      : "text-slate-400 hover:text-white hover:bg-white/[0.05]"}`}>
                  Return
                </button>
              </div>
            )}

            {/* SUMMARY CARDS */}
            <div className="grid grid-cols-4 gap-3">
              {summaryCards.map((card, i) => (
                <button key={card.key} type="button"
                  disabled={!card.flight}
                  onClick={() => setSortBy(card.key)}
                  style={{ animationDelay: `${i * 60}ms` }}
                  className={`fade-up relative text-left p-4 rounded-2xl border transition overflow-hidden
                  ${sortBy === card.key
                    ? "bg-amber-400/[0.1] border-amber-400/50"
                    : "bg-white/[0.03] border-white/10 hover:bg-white/5"}
                  ${!card.flight ? "opacity-40 cursor-not-allowed" : ""}`}
                >
                  {sortBy === card.key && (
                    <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-amber-300 to-amber-500" />
                  )}
                  <div className="flex items-center gap-2 mb-2">
                    <span>{card.icon}</span>
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-300">{card.label}</span>
                  </div>
                  {card.flight ? (
                    <>
                      <p className="text-sm font-medium truncate">{card.flight.airline}</p>
                      <p className="font-display text-lg font-extrabold text-amber-300">₹{card.flight.final_price.toLocaleString("en-IN")}</p>
                      <p className="text-xs text-slate-500">
                        {card.flight.duration || formatDuration(getDurationMinutes(card.flight))}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-slate-500">No flights</p>
                  )}
                </button>
              ))}
            </div>

            {/* FLIGHT CARDS */}
            {applySort(currentFiltered).map((flight, i) => {
              const isThisSelected =
                activeTab === "departure"
                  ? selectedDepartFlight?.id === flight.id
                  : selectedReturnFlight?.id === flight.id

              return (
                <div key={flight.id} className="fade-up" style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}>
                  <FlightCard
                    flight={{ ...flight, price: flight.final_price }}
                    isSelected={isThisSelected}
                    onSelect={() => {
                      if (activeTab === "departure") {
                        setSelectedDepartFlight(flight)
                        if (mode === "roundtrip") switchTab("return")
                      } else {
                        setSelectedReturnFlight(flight)
                      }
                    }}
                  />
                </div>
              )
            })}

            {currentFiltered.length === 0 && (
              <div className="text-center text-slate-400 text-sm py-10 border border-white/10 rounded-2xl bg-white/[0.02]">
                No flights match your current filters.{" "}
                <button
                  onClick={() => { setSelectedStops(null); setMaxPrice(20000); setSelectedAirlines([]) }}
                  className="text-cyan-300 hover:underline"
                >
                  Reset filters
                </button>
              </div>
            )}
          </div>

          {/* RIGHT — Price Insight */}
          <div className="col-span-3">
            <PriceInsight flights={currentFiltered} />
          </div>

        </div>

        {/* STICKY BOTTOM BAR */}
        {selectedDepartFlight && (
          <div className="fixed bottom-0 left-0 w-full bg-[#060B14]/90 backdrop-blur-xl border-t border-white/10 px-6 py-4 z-50">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-400 via-amber-400 to-amber-300" />
            <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-4">
              <div className="flex flex-col">
                <span className="text-sm text-slate-400">Selected Flights</span>
                <span className="text-sm">
                  {selectedDepartFlight.airline} • {selectedDepartFlight.origin} → {selectedDepartFlight.destination}
                </span>
                {selectedReturnFlight && (
                  <span className="text-sm text-slate-400">
                    Return: {selectedReturnFlight.airline} • {selectedReturnFlight.origin} → {selectedReturnFlight.destination}
                  </span>
                )}
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400">
                  {mode === "roundtrip" && !selectedReturnFlight ? "Total (departure only)" : "Total Price"}
                </p>
                <p className="font-display text-2xl font-extrabold text-amber-300">
                  ₹{(selectedDepartFlight.final_price + (selectedReturnFlight?.final_price || 0)).toLocaleString("en-IN")}
                </p>
              </div>
              <button
                disabled={mode === "roundtrip" && !selectedReturnFlight}
                onClick={handleContinue}
                className={`px-6 py-3 rounded-full font-semibold
                ${mode === "roundtrip" && !selectedReturnFlight
                  ? "bg-white/[0.06] text-slate-500 cursor-not-allowed"
                  : "pill-cta hover:scale-[1.03]"}
                transition`}
              >
                Continue →
              </button>
            </div>
          </div>
        )}

      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@700;800&display=swap');

        /* Bold sans for prices/city codes/times — same font used across
           the checkout flow, so this results page matches instead of
           defaulting to plain system text. */
        .font-display { font-family: 'Manrope', ui-sans-serif, system-ui, sans-serif; letter-spacing: -0.01em; }

        /* Hairline ticket border, echoing the boarding-pass edge used on
           every other card in the app. */
        .ticket-edge { position: relative; }
        .ticket-edge::before {
          content: "";
          position: absolute;
          inset: 3px;
          border: 1px solid rgba(212,175,55,0.10);
          border-radius: inherit;
          pointer-events: none;
        }

        /* Blue → gold pill CTA — identical to the seats/passengers pages
           so the primary action looks the same at every step. */
        .pill-cta {
          background: linear-gradient(90deg, #38BDF8 0%, #60A5FA 30%, #D4AF37 70%, #FBBF24 100%);
          color: #060B14;
          box-shadow: 0 8px 30px rgba(56,189,248,0.18), 0 8px 30px rgba(251,191,36,0.18);
        }
        .pill-cta:hover { filter: brightness(1.06); }

        /* Custom radio/checkbox — replaces the native browser controls
           (plain white circle/box) that read as a leftover default-HTML
           element rather than part of this design. */
        .custom-radio {
          width: 18px; height: 18px;
          border-radius: 50%;
          border: 2px solid rgba(255,255,255,0.22);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          transition: border-color 0.2s;
        }
        .custom-radio.is-checked { border-color: #FBBF24; }
        .custom-radio-dot {
          width: 8px; height: 8px;
          border-radius: 50%;
          background: #FBBF24;
          transform: scale(0);
          transition: transform 0.18s cubic-bezier(0.34,1.56,0.64,1);
        }
        .custom-radio.is-checked .custom-radio-dot { transform: scale(1); }

        .custom-checkbox {
          width: 18px; height: 18px;
          border-radius: 6px;
          border: 2px solid rgba(255,255,255,0.22);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          transition: border-color 0.2s, background 0.2s;
        }
        .custom-checkbox.is-checked { border-color: #FBBF24; background: #FBBF24; }
        .custom-checkbox-tick {
          font-size: 12px;
          font-weight: 800;
          color: #060B14;
          line-height: 1;
          animation: checkboxPop 220ms cubic-bezier(0.34,1.56,0.64,1);
        }
        @keyframes checkboxPop { from { transform: scale(0); } to { transform: scale(1); } }

        .filter-row:active { transform: scale(0.99); }

        /* Staggered fade-up entrance — used on the filters panel, summary
           cards, and flight card list so the page feels alive on load
           instead of everything snapping in at once. */
        @keyframes fadeUpIn {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fade-up {
          animation: fadeUpIn 0.5s ease-out both;
        }

        @media (prefers-reduced-motion: reduce) {
          .fade-up, .custom-radio-dot, .custom-checkbox-tick { animation: none !important; transition: none !important; }
        }
      `}</style>
    </div>
  )
}