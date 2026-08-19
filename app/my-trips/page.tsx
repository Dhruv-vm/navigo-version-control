"use client"

import { useEffect, useMemo, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import Navbar from "@/components/navbar"
import BoardingPassModal, { type ModalBooking } from "@/components/BoardingPassModal"
import TripDetailsModal, { type TripDetailsBooking } from "@/components/TripDetailsModal"
import CheckInModal from "@/components/CheckInModal"
import NavPointsModal from "@/components/NavPointsModal"
import { getNavPointsBalance, pointsToDiscount } from "@/lib/navpoints"
import { deriveFlightNumber, formatINR } from "@/app/checkout/payment/bookingUtils"
import { airports } from "@/lib/airports"

const airlineLogos: Record<string, string> = {
  "IndiGo": "/airlines/indigo.png",
  "Air India": "/airlines/airindia.png",
  "Vistara": "/airlines/vistara.png",
  "Akasa Air": "/airlines/akasa.png",
  "Emirates": "/airlines/emirates.png",
  "Qatar Airways": "/airlines/qatar.png",
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return "--"
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return "--"
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })
}

function formatTime(timeStr?: string): string {
  if (!timeStr) return "--:--"
  const match = timeStr.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
  if (match) {
    const hours = Number(match[1])
    const minutes = match[2]
    const period = hours >= 12 ? "PM" : "AM"
    const displayHour = hours % 12 === 0 ? 12 : hours % 12
    return `${displayHour}:${minutes} ${period}`
  }
  return "--:--"
}

function getAirportCity(code: string): string {
  const match = airports.find((a) => a.code === code)
  return match ? match.city : code
}

function MyTripsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialTab = searchParams.get("tab") || "all"

  const [bookings, setBookings] = useState<ModalBooking[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"all" | "upcoming" | "past" | "cancelled">(
    initialTab === "past" || initialTab === "completed"
      ? "past"
      : initialTab === "upcoming"
      ? "upcoming"
      : initialTab === "cancelled"
      ? "cancelled"
      : "all"
  )
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState<"date-asc" | "date-desc" | "price-high" | "price-low">("date-asc")
  const [gateMap, setGateMap] = useState<Record<string, string>>({})

  // Modals state
  const [selectedPassBooking, setSelectedPassBooking] = useState<ModalBooking | null>(null)
  const [selectedDetailsBooking, setSelectedDetailsBooking] = useState<TripDetailsBooking | null>(null)
  const [checkInModalOpen, setCheckInModalOpen] = useState(false)
  const [checkInPnr, setCheckInPnr] = useState("")
  const [copiedPnr, setCopiedPnr] = useState<string | null>(null)
  const [pointsModalOpen, setPointsModalOpen] = useState(false)
  const [userNavPoints, setUserNavPoints] = useState(650)

  useEffect(() => {
    setUserNavPoints(getNavPointsBalance())
    const handleUpdate = () => setUserNavPoints(getNavPointsBalance())
    window.addEventListener("navpoints_updated", handleUpdate)
    return () => window.removeEventListener("navpoints_updated", handleUpdate)
  }, [])

  useEffect(() => {
    let cancelled = false
    const token = localStorage.getItem("token")
    if (!token) {
      setBookings([])
      setLoading(false)
      return
    }

    fetch("/api/bookings", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (!cancelled) {
          const list = Array.isArray(data) ? data : data?.bookings ?? []
          setBookings(list)
        }
      })
      .catch((err) => {
        console.error("Failed to fetch bookings:", err)
        if (!cancelled) setBookings([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  // Fetch gate assignments for active bookings
  useEffect(() => {
    if (!bookings || bookings.length === 0) return
    const ids = bookings
      .flatMap((b) => b.legs.map((l) => l.flightInstanceId))
      .filter(Boolean)
    if (ids.length === 0) return

    let cancelled = false
    fetch(`/api/flights/gate?ids=${ids.slice(0, 20).join(",")}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.gates) setGateMap(data.gates)
      })
      .catch((err) => console.warn("Failed to fetch gate assignments:", err))

    return () => {
      cancelled = true
    }
  }, [bookings])

  const todayStr = new Date().toISOString().split("T")[0]

  const upcomingBookings = useMemo(() => {
    return (bookings || []).filter(
      (b) => (!b.travelDate || b.travelDate >= todayStr) && (b.status === "confirmed" || b.status === "paid")
    )
  }, [bookings, todayStr])

  const pastBookings = useMemo(() => {
    return (bookings || []).filter(
      (b) => (b.travelDate && b.travelDate < todayStr) || b.status === "completed"
    )
  }, [bookings, todayStr])

  const cancelledBookings = useMemo(() => {
    return (bookings || []).filter((b) => b.status === "cancelled")
  }, [bookings])

  // Filtered by active tab
  const tabFilteredBookings = useMemo(() => {
    if (!bookings) return []
    if (activeTab === "upcoming") return upcomingBookings
    if (activeTab === "past") return pastBookings
    if (activeTab === "cancelled") return cancelledBookings
    return bookings
  }, [bookings, activeTab, upcomingBookings, pastBookings, cancelledBookings])

  // Filtered by search query & sorted
  const displayedBookings = useMemo(() => {
    let result = [...tabFilteredBookings]

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter((b) => {
        const matchesPnr = b.pnr?.toLowerCase().includes(q)
        const matchesAirline = b.legs.some((l) => l.airline.toLowerCase().includes(q))
        const matchesCity = b.legs.some(
          (l) =>
            l.origin.toLowerCase().includes(q) ||
            l.destination.toLowerCase().includes(q) ||
            getAirportCity(l.origin).toLowerCase().includes(q) ||
            getAirportCity(l.destination).toLowerCase().includes(q)
        )
        const matchesPassenger = b.passengers.some((p) => p.name.toLowerCase().includes(q))
        return matchesPnr || matchesAirline || matchesCity || matchesPassenger
      })
    }

    result.sort((a, b) => {
      const dateA = a.travelDate ? new Date(a.travelDate).getTime() : 0
      const dateB = b.travelDate ? new Date(b.travelDate).getTime() : 0
      const priceA = a.totalPrice || a.paidAmount || 0
      const priceB = b.totalPrice || b.paidAmount || 0

      if (sortBy === "date-asc") return dateA - dateB
      if (sortBy === "date-desc") return dateB - dateA
      if (sortBy === "price-high") return priceB - priceA
      if (sortBy === "price-low") return priceA - priceB
      return 0
    })

    return result
  }, [tabFilteredBookings, searchQuery, sortBy])

  const handleCopyPnr = (pnr: string) => {
    navigator.clipboard.writeText(pnr)
    setCopiedPnr(pnr)
    setTimeout(() => setCopiedPnr(null), 2000)
  }

  return (
    <div className="min-h-screen bg-[#04070F] text-white relative overflow-x-hidden">
      {/* Background glow & subtle stars */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute top-[-200px] left-[15%] w-[600px] h-[600px] rounded-full bg-amber-400/[0.05] blur-[120px]" />
        <div className="absolute top-[40%] right-[10%] w-[550px] h-[550px] rounded-full bg-cyan-400/[0.05] blur-[130px]" />
      </div>

      <Navbar />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-20">
        {/* Header Banner */}
        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-white/[0.08]">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-amber-400/25 bg-amber-400/[0.07] text-[10px] font-bold uppercase tracking-widest text-amber-300 mb-3">
              <span>✈️</span> Flight Central · Itineraries
            </div>
            <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight">
              My Bookings & Trips
            </h1>
            <p className="text-sm text-slate-400 mt-2 max-w-xl">
              Access digital boarding passes, check flight status, manage seats, and download official travel documents.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/")}
              className="px-5 py-2.5 rounded-full pill-cta text-xs font-bold shadow-[0_2px_14px_rgba(251,191,36,0.3)] hover:brightness-105 transition-all flex items-center gap-1.5"
            >
              <span>+</span> Book New Flight
            </button>
            <button
              onClick={() => {
                setCheckInPnr("")
                setCheckInModalOpen(true)
              }}
              className="px-4 py-2.5 rounded-full border border-white/[0.12] bg-white/[0.03] text-xs font-semibold text-slate-200 hover:bg-white/[0.07] hover:text-white transition-colors flex items-center gap-1.5"
            >
              <span>🛫</span> Web Check-In
            </button>
          </div>
        </div>

        {/* Quick Stats Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-8">
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.08]">
            <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Total Journeys</p>
            <p className="font-display text-2xl font-extrabold text-white mt-1">
              {loading ? "…" : (bookings || []).length}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">All time records</p>
          </div>

          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.08]">
            <p className="text-[11px] uppercase tracking-wider text-cyan-300/80 font-semibold">Upcoming Flights</p>
            <p className="font-display text-2xl font-extrabold text-cyan-300 mt-1">
              {loading ? "…" : upcomingBookings.length}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">Scheduled to fly</p>
          </div>

          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.08]">
            <p className="text-[11px] uppercase tracking-wider text-[#E8C766]/80 font-semibold">Completed Trips</p>
            <p className="font-display text-2xl font-extrabold text-[#E8C766] mt-1">
              {loading ? "…" : pastBookings.length}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">Landed safely</p>
          </div>

          <button
            onClick={() => setPointsModalOpen(true)}
            className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.08] hover:border-amber-400/30 hover:bg-amber-400/[0.03] text-left transition-colors cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-wider text-amber-300 font-semibold">NavPoints Rewards</p>
              <span className="text-xs group-hover:translate-x-0.5 transition-transform">🪙</span>
            </div>
            <p className="font-display text-2xl font-extrabold text-[#E8C766] mt-1">
              {loading ? "…" : `${userNavPoints.toLocaleString("en-IN")} pts`}
            </p>
            <p className="text-[11px] text-emerald-400 mt-0.5 font-medium">
              Worth ₹{pointsToDiscount(userNavPoints)} off on flights
            </p>
          </button>
        </div>

        {/* Filter Tabs & Search Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto p-1 bg-white/[0.03] border border-white/[0.08] rounded-2xl w-fit shrink-0">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "all"
                  ? "bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 text-[#060B14] shadow-[0_2px_10px_rgba(251,191,36,0.35)]"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              All Trips ({(bookings || []).length})
            </button>
            <button
              onClick={() => setActiveTab("upcoming")}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "upcoming"
                  ? "bg-gradient-to-r from-cyan-400 to-blue-500 text-[#060B14] shadow-[0_2px_10px_rgba(34,211,238,0.35)]"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Upcoming ({upcomingBookings.length})
            </button>
            <button
              onClick={() => setActiveTab("past")}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "past"
                  ? "bg-gradient-to-r from-violet-400 to-purple-500 text-[#060B14] shadow-[0_2px_10px_rgba(167,139,250,0.35)]"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Completed ({pastBookings.length})
            </button>
            {cancelledBookings.length > 0 && (
              <button
                onClick={() => setActiveTab("cancelled")}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === "cancelled"
                    ? "bg-slate-700 text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Other ({cancelledBookings.length})
              </button>
            )}
          </div>

          {/* Search & Sort */}
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-72">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search PNR, city, airport, airline…"
                className="w-full bg-white/[0.04] border border-white/[0.1] rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400/50"
              />
              <span className="absolute left-3 top-2.5 text-slate-500 text-xs">🔍</span>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-2 text-slate-400 hover:text-white text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-white/[0.04] border border-white/[0.1] rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-amber-400/50 shrink-0"
            >
              <option value="date-asc" className="bg-[#0A1424]">Date (Upcoming first)</option>
              <option value="date-desc" className="bg-[#0A1424]">Date (Latest first)</option>
              <option value="price-high" className="bg-[#0A1424]">Price (High to Low)</option>
              <option value="price-low" className="bg-[#0A1424]">Price (Low to High)</option>
            </select>
          </div>
        </div>

        {/* Bookings List */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-44 rounded-3xl bg-white/[0.03] border border-white/[0.06] animate-pulse" />
            ))}
          </div>
        ) : displayedBookings.length === 0 ? (
          <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-12 text-center my-6">
            <div className="w-16 h-16 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-3xl mx-auto mb-4">
              🧳
            </div>
            <h3 className="font-display text-xl font-bold text-white mb-2">
              {searchQuery
                ? `No bookings match "${searchQuery}"`
                : activeTab === "upcoming"
                ? "No Upcoming Flights Scheduled"
                : activeTab === "past"
                ? "No Completed Journeys On Record"
                : "No Bookings Found"}
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto mb-6">
              {searchQuery
                ? "Try searching by PNR reference (e.g. ABC123), city name (Delhi, Mumbai), or airline."
                : "Ready to explore the skies? Book your next destination now with best price guarantee."}
            </p>
            <button
              onClick={() => router.push("/")}
              className="px-6 py-3 rounded-full pill-cta text-xs font-bold shadow-[0_2px_14px_rgba(251,191,36,0.3)]"
            >
              ✈️ Search & Book Flights
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {displayedBookings.map((booking, index) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                index={index}
                gateMap={gateMap}
                copiedPnr={copiedPnr}
                onCopyPnr={handleCopyPnr}
                onOpenBoardingPass={() => setSelectedPassBooking(booking)}
                onOpenDetails={() => setSelectedDetailsBooking(booking)}
                onCheckIn={() => {
                  setCheckInPnr(booking.pnr || "")
                  setCheckInModalOpen(true)
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <BoardingPassModal
        booking={selectedPassBooking}
        isOpen={!!selectedPassBooking}
        onClose={() => setSelectedPassBooking(null)}
        gateMap={gateMap}
      />

      <TripDetailsModal
        booking={selectedDetailsBooking}
        isOpen={!!selectedDetailsBooking}
        onClose={() => setSelectedDetailsBooking(null)}
        onViewBoardingPass={() => {
          if (selectedDetailsBooking) {
            setSelectedPassBooking(selectedDetailsBooking as any)
          }
        }}
      />

      <CheckInModal
        isOpen={checkInModalOpen}
        onClose={() => setCheckInModalOpen(false)}
        defaultPnr={checkInPnr}
        onSuccess={(pnr) => {
          const match = bookings?.find((b) => b.pnr === pnr)
          if (match) {
            setSelectedPassBooking(match)
            setCheckInModalOpen(false)
          }
        }}
      />

      <NavPointsModal
        isOpen={pointsModalOpen}
        onClose={() => setPointsModalOpen(false)}
        onExploreFlights={() => router.push("/")}
      />
    </div>
  )
}

function BookingCard({
  booking,
  index,
  gateMap,
  copiedPnr,
  onCopyPnr,
  onOpenBoardingPass,
  onOpenDetails,
  onCheckIn,
}: {
  booking: ModalBooking
  index: number
  gateMap: Record<string, string>
  copiedPnr: string | null
  onCopyPnr: (pnr: string) => void
  onOpenBoardingPass: () => void
  onOpenDetails: () => void
  onCheckIn: () => void
}) {
  const router = useRouter()
  const isPast = booking.travelDate
    ? new Date(booking.travelDate).getTime() < Date.now()
    : false
  const isConfirmed = booking.status === "confirmed"
  const isRoundTrip = booking.legs.length > 1
  const primaryLeg = booking.legs[0]
  const pnr = booking.pnr || "TBA"

  if (!primaryLeg) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05 }}
      className={`group relative rounded-3xl border transition-all duration-300 overflow-hidden ${
        isPast
          ? "bg-white/[0.015] border-white/[0.07] hover:border-white/[0.15]"
          : "bg-white/[0.03] border-white/[0.1] hover:border-amber-400/30 hover:shadow-[0_12px_40px_rgba(0,0,0,0.5)]"
      }`}
    >
      {/* Top status accent ribbon */}
      <div
        className={`h-[2px] w-full ${
          isPast
            ? "bg-slate-700"
            : isConfirmed
            ? "bg-gradient-to-r from-blue-400 via-amber-400 to-amber-300"
            : "bg-amber-500/50"
        }`}
      />

      <div className="p-5 sm:p-6">
        {/* Card Header Strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/[0.06]">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">PNR:</span>
              <button
                onClick={() => onCopyPnr(pnr)}
                className="font-mono text-sm font-bold text-[#E8C766] hover:underline inline-flex items-center gap-1.5 bg-[#D4AF37]/10 px-2.5 py-0.5 rounded-lg border border-[#D4AF37]/20"
                title="Click to copy PNR"
              >
                {pnr}
                <span className="text-[11px] text-slate-400 font-sans">
                  {copiedPnr === pnr ? "✓ Copied" : "📋"}
                </span>
              </button>
            </div>

            <span
              className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                isPast
                  ? "bg-slate-500/15 text-slate-400 border border-slate-500/25"
                  : isConfirmed
                  ? "bg-emerald-400/15 text-emerald-300 border border-emerald-400/30"
                  : "bg-amber-400/15 text-amber-300 border border-amber-400/25"
              }`}
            >
              {isPast ? "Completed" : booking.status}
            </span>

            {isRoundTrip && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-400/10 text-cyan-300 border border-cyan-400/20">
                Round Trip
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="text-slate-400">
              Total:{" "}
              <span className="font-display font-extrabold text-white text-sm">
                {booking.totalPrice || booking.paidAmount
                  ? formatINR(booking.totalPrice || booking.paidAmount || 0)
                  : "Paid"}
              </span>
            </span>
          </div>
        </div>

        {/* Legs Itinerary */}
        <div className="py-4 space-y-4">
          {booking.legs.map((leg, legIdx) => {
            const flightNum = deriveFlightNumber(leg.airline, leg.flightInstanceId)
            const gate = gateMap[leg.flightInstanceId]
            return (
              <div
                key={leg.flightInstanceId || legIdx}
                className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.04]"
              >
                {/* Airline & Date Info */}
                <div className="flex items-center gap-3 min-w-[200px]">
                  <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                    <img
                      src={airlineLogos[leg.airline] || "/airlines/default.png"}
                      alt={leg.airline}
                      className="w-6 h-6 object-contain"
                    />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white uppercase">{leg.airline}</p>
                    <p className="text-[11px] font-mono text-slate-400">{flightNum}</p>
                    <p className="text-[11px] text-amber-300/90 mt-0.5">{formatDate(leg.travelDate)}</p>
                  </div>
                </div>

                {/* Route Visualizer */}
                <div className="flex-1 grid grid-cols-9 items-center gap-2 max-w-lg">
                  <div className="col-span-3">
                    <p className="font-display text-lg sm:text-xl font-bold text-white">{leg.origin}</p>
                    <p className="text-xs text-amber-300 font-medium">{formatTime(leg.departureTime)}</p>
                    <p className="text-[10px] text-slate-500 truncate">{getAirportCity(leg.origin)}</p>
                  </div>

                  <div className="col-span-3 flex flex-col items-center justify-center">
                    <span className="text-[10px] text-slate-400">Non-stop</span>
                    <div className="w-full flex items-center gap-1 my-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                      <div className="flex-1 h-[1px] bg-gradient-to-r from-cyan-400 to-amber-400" />
                      <span className="text-[10px] text-amber-300">✈</span>
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    </div>
                    <span className="text-[9px] text-slate-500 font-mono">
                      Gate: {gate || "TBA"}
                    </span>
                  </div>

                  <div className="col-span-3 text-right">
                    <p className="font-display text-lg sm:text-xl font-bold text-white">{leg.destination}</p>
                    <p className="text-xs text-cyan-300 font-medium">{formatTime(leg.arrivalTime)}</p>
                    <p className="text-[10px] text-slate-500 truncate">{getAirportCity(leg.destination)}</p>
                  </div>
                </div>

                {/* Travelers & Seats summary */}
                <div className="lg:text-right min-w-[150px] border-t lg:border-t-0 pt-2 lg:pt-0 border-white/[0.04]">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">
                    {booking.passengers.length} {booking.passengers.length === 1 ? "Traveler" : "Travelers"}
                  </p>
                  <p className="text-xs text-slate-300 font-medium truncate">
                    {booking.passengers[0]?.name}
                    {booking.passengers.length > 1 ? ` +${booking.passengers.length - 1} more` : ""}
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Card Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-white/[0.06]">
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenDetails}
              className="px-3.5 py-1.5 rounded-full border border-white/[0.1] text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/[0.05] transition-colors flex items-center gap-1.5"
            >
              📋 View Details
            </button>
            {!isPast && (
              <button
                onClick={onCheckIn}
                className="px-3.5 py-1.5 rounded-full border border-white/[0.1] text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/[0.05] transition-colors flex items-center gap-1.5"
              >
                🛫 Web Check-in
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {isPast ? (
              <button
                onClick={() => router.push(`/?from=${primaryLeg.origin}&to=${primaryLeg.destination}`)}
                className="px-4 py-2 rounded-full border border-white/[0.12] bg-white/[0.03] text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/[0.06] transition-colors"
              >
                🔄 Rebook Route
              </button>
            ) : null}

            <button
              onClick={onOpenBoardingPass}
              className="px-5 py-2 rounded-full pill-cta text-xs font-bold shadow-[0_2px_14px_rgba(251,191,36,0.3)] hover:brightness-105 transition-all flex items-center gap-1.5"
            >
              🎫 {isPast ? "View Archived Pass" : "Boarding Pass & QR"}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export default function MyTripsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#04070F] text-white flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
        </div>
      }
    >
      <MyTripsContent />
    </Suspense>
  )
}
