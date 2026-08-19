"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { motion, useInView, useReducedMotion, AnimatePresence } from "framer-motion"
import Navbar from "@/components/navbar"
import { BoardingPassCard } from "@/app/checkout/payment/BoardingPassCard"
import { deriveFlightNumber, formatINR } from "@/app/checkout/payment/bookingUtils"
import BoardingPassModal, { type ModalBooking } from "@/components/BoardingPassModal"
import TripDetailsModal, { type TripDetailsBooking } from "@/components/TripDetailsModal"
import CheckInModal from "@/components/CheckInModal"
import NavPointsModal from "@/components/NavPointsModal"
import { getNavPointsBalance, pointsToDiscount } from "@/lib/navpoints"
import { airports } from "@/lib/airports"

const airlineLogos: Record<string, string> = {
  "IndiGo": "/airlines/indigo.png",
  "Air India": "/airlines/airindia.png",
  "Vistara": "/airlines/vistara.png",
  "Akasa Air": "/airlines/akasa.png",
  "Emirates": "/airlines/emirates.png",
  "Qatar Airways": "/airlines/qatar.png",
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return "--"
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })
}

function formatDateLong(dateStr: string) {
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

function nextDepartureMs(booking: ModalBooking): number | null {
  const d = booking.travelDate ? new Date(booking.travelDate) : null
  if (!d || isNaN(d.getTime())) return null
  const m = booking.legs[0]?.departureTime?.match(/^(\d{1,2}):(\d{2})/)
  if (m) d.setHours(Number(m[1]), Number(m[2]), 0, 0)
  return d.getTime()
}

// ───────────────────────────────────────────────────────────────────────────
// Hooks
// ───────────────────────────────────────────────────────────────────────────

function useCountdown(target: number | null) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (target == null) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [target])
  if (target == null) return null
  const diff = Math.max(0, target - now)
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    mins: Math.floor((diff % 3600000) / 60000),
    secs: Math.floor((diff % 60000) / 1000),
  }
}

function useCountUp(target: number, duration = 1000) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: "-40px" })
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!inView) return
    let raf = 0
    const start = performance.now()
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration)
      setVal(Math.round(target * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [inView, target, duration])
  return { ref, val }
}

function seededRandom(seed: number) {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Main Dashboard Page
// ───────────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter()
  const [bookings, setBookings] = useState<ModalBooking[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [gateMap, setGateMap] = useState<Record<string, string>>({})
  const [isGuest, setIsGuest] = useState(false)

  // Modals state
  const [activePassBooking, setActivePassBooking] = useState<ModalBooking | null>(null)
  const [activeDetailsBooking, setActiveDetailsBooking] = useState<TripDetailsBooking | null>(null)
  const [checkInOpen, setCheckInOpen] = useState(false)
  const [checkInPnr, setCheckInPnr] = useState("")
  const [copiedPnr, setCopiedPnr] = useState<string | null>(null)
  const [pointsModalOpen, setPointsModalOpen] = useState(false)
  const [userNavPoints, setUserNavPoints] = useState(650)

  // Smart Check-In & DigiYatra Biometrics State
  const [biometricProfile, setBiometricProfile] = useState<any>(null)
  const [smartBoardingActive, setSmartBoardingActive] = useState(true)
  const [deleteBioModalOpen, setDeleteBioModalOpen] = useState(false)
  const [deletingBio, setDeletingBio] = useState(false)
  const [checkedInPnrs, setCheckedInPnrs] = useState<Record<string, { isSmart: boolean; qrToken?: string }>>({})

  // Load Biometric Profile
  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) return

    fetch("/api/biometrics/profile", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.hasProfile && d.profile) {
          setBiometricProfile(d.profile)
          setSmartBoardingActive(d.profile.isActive)
        }
      })
      .catch(() => {})
  }, [])

  const handleDeleteBiometricProfile = async () => {
    setDeletingBio(true)
    try {
      const token = localStorage.getItem("token")
      const res = await fetch("/api/biometrics/profile", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        setBiometricProfile(null)
        setDeleteBioModalOpen(false)
      }
    } catch {
      // Fallback
    } finally {
      setDeletingBio(false)
    }
  }

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
      setIsGuest(true)
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
        console.error("Failed to load bookings:", err)
        if (!cancelled) setBookings([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const todayStr = new Date().toISOString().split("T")[0]
  const confirmedBookings = (bookings || []).filter(
    (b) => b.status === "confirmed" || b.status === "paid"
  )

  const upcoming = confirmedBookings
    .filter((b) => !b.travelDate || b.travelDate >= todayStr)
    .sort((a, b) => (a.travelDate || "").localeCompare(b.travelDate || ""))

  const past = (bookings || [])
    .filter((b) => (b.travelDate && b.travelDate < todayStr) || b.status === "completed")
    .sort((a, b) => (b.travelDate || "").localeCompare(a.travelDate || ""))

  const nextTrip = upcoming[0] || confirmedBookings[0]
  const restUpcoming = upcoming.length > 0 ? upcoming.slice(1) : confirmedBookings.slice(1)

  // Live gate fetch
  useEffect(() => {
    if (!bookings || bookings.length === 0) return
    const ids = bookings.flatMap((b) => b.legs.map((l) => l.flightInstanceId)).filter(Boolean)
    if (ids.length === 0) return

    let cancelled = false
    fetch(`/api/flights/gate?ids=${ids.slice(0, 15).join(",")}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.gates) setGateMap(data.gates)
      })
      .catch((err) => console.warn("Failed to fetch gate assignments:", err))

    return () => {
      cancelled = true
    }
  }, [bookings])

  const tickerItems = useMemo(() => {
    const items = (bookings || []).flatMap((b) =>
      b.legs.map((l) => ({
        airline: l.airline,
        origin: l.origin,
        destination: l.destination,
        pnr: b.pnr,
        status: b.status,
      }))
    )
    if (items.length === 0) {
      return [
        { airline: "IndiGo", origin: "DEL", destination: "BLR", pnr: "6E4192", status: "confirmed" },
        { airline: "Emirates", origin: "DXB", destination: "LHR", pnr: "EK8829", status: "confirmed" },
        { airline: "Air India", origin: "BOM", destination: "JFK", pnr: "AI1014", status: "confirmed" },
        { airline: "Vistara", origin: "BLR", destination: "SIN", pnr: "UK9531", status: "confirmed" },
        { airline: "Akasa Air", origin: "HYD", destination: "BOM", pnr: "QP1380", status: "confirmed" },
      ]
    }
    return items
  }, [bookings])

  const handleCopyPnr = (pnr: string) => {
    navigator.clipboard.writeText(pnr)
    setCopiedPnr(pnr)
    setTimeout(() => setCopiedPnr(null), 2000)
  }

  // Destination weather info for next trip or default
  const destinationCode = nextTrip?.legs[0]?.destination || "BLR"
  const destinationCity = getAirportCity(destinationCode)

  return (
    <div className="min-h-screen bg-[#04070F] text-white relative overflow-x-hidden">
      <PageStyles />
      <AuroraBackdrop />
      <div className="pointer-events-none fixed inset-0 opacity-[0.05] mix-blend-overlay grain-layer" />

      <Navbar />

      <div className="relative max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        {/* Hero Control Tower */}
        <HeroHeader
          nextTrip={nextTrip}
          gateMap={gateMap}
          loading={loading}
          onBook={() => router.push("/")}
          onViewPass={() => nextTrip && setActivePassBooking(nextTrip)}
          onViewDetails={() => nextTrip && setActiveDetailsBooking(nextTrip as any)}
        />

        {/* Live Marquee Ticker */}
        <Ticker items={tickerItems} />

        {/* Key Metrics Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          <StatCard
            icon={<SuitcaseIcon />}
            label="Total Journeys"
            value={String((bookings || []).length)}
            sub="All time record"
            accent="gold"
            onClick={() => router.push("/my-trips?tab=all")}
          />
          <StatCard
            icon={<CalendarIcon />}
            label="Upcoming Flights"
            value={String(upcoming.length)}
            sub={nextTrip?.travelDate ? `Next: ${formatDate(nextTrip.travelDate)}` : "None scheduled"}
            accent="cyan"
            onClick={() => router.push("/my-trips?tab=upcoming")}
          />
          <StatCard
            icon={<StarIcon />}
            label="Completed Trips"
            value={String(past.length)}
            sub="Landed safely"
            accent="violet"
            onClick={() => router.push("/my-trips?tab=past")}
          />
          <StatCard
            icon={<TagIcon />}
            label="NavPoints Rewards"
            value={String(userNavPoints)}
            sub={`Save up to ₹${pointsToDiscount(userNavPoints)}`}
            accent="rose"
            onClick={() => setPointsModalOpen(true)}
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-12 gap-6">
          {/* Left Column (8 cols): Upcoming & Past Trips */}
          <div className="col-span-12 lg:col-span-8 space-y-8">
            {/* Upcoming Trips Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.5 }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
                  </span>
                  <h2 className="font-display text-xl font-bold text-white tracking-tight">
                    Upcoming Flights ({upcoming.length})
                  </h2>
                </div>

                <button
                  onClick={() => router.push("/my-trips?tab=upcoming")}
                  className="text-xs font-semibold text-cyan-300 hover:text-cyan-200 transition-colors flex items-center gap-1 group"
                >
                  View All Bookings <span className="group-hover:translate-x-1 transition-transform">→</span>
                </button>
              </div>

              {loading ? (
                <div className="rounded-3xl bg-white/[0.03] border border-white/[0.08] animate-pulse h-72" />
              ) : !nextTrip ? (
                <div className="relative rounded-3xl border border-white/[0.08] bg-gradient-to-b from-white/[0.03] to-white/[0.01] p-10 text-center overflow-hidden">
                  <div className="pointer-events-none absolute inset-0 opacity-30 hero-shimmer-bg" />
                  <div className="w-14 h-14 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-2xl mx-auto mb-3">
                    ✈️
                  </div>
                  <h3 className="font-display text-lg font-bold text-white mb-1">The Sky Is Waiting</h3>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto mb-5">
                    You have no active flights scheduled right now. Book your next journey or browse trending routes.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <button
                      onClick={() => router.push("/")}
                      className="px-6 py-2.5 rounded-full pill-cta text-xs font-bold shadow-[0_2px_14px_rgba(251,191,36,0.3)]"
                    >
                      ✈ Search Flights
                    </button>
                    <button
                      onClick={() => router.push("/my-trips")}
                      className="px-5 py-2.5 rounded-full border border-white/[0.12] text-xs font-semibold text-slate-300 hover:bg-white/[0.05]"
                    >
                      View All Past Bookings
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Next Up Hero Card with Boarding Pass */}
                  <div className="bg-white/[0.02] border border-white/[0.08] rounded-3xl p-5 sm:p-6 relative overflow-hidden">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                      <div>
                        <span className="text-[10px] uppercase tracking-widest text-amber-300 font-bold bg-amber-400/10 border border-amber-400/20 px-2.5 py-0.5 rounded-full">
                          Next Flight Up
                        </span>
                        <p className="text-xs text-slate-400 mt-1">
                          Departs on {nextTrip.travelDate ? formatDateLong(nextTrip.travelDate) : ""}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setActiveDetailsBooking(nextTrip as any)}
                          className="px-3.5 py-1.5 rounded-full border border-white/[0.1] text-xs font-semibold text-slate-300 hover:bg-white/[0.05] transition-colors"
                        >
                          📋 Flight Details
                        </button>
                        <button
                          onClick={() => setActivePassBooking(nextTrip)}
                          className="px-4 py-1.5 rounded-full pill-cta text-xs font-bold shadow-[0_2px_10px_rgba(251,191,36,0.25)] flex items-center gap-1.5"
                        >
                          🎫 Boarding Pass & QR
                        </button>
                      </div>
                    </div>

                    {/* Smart Boarding Status Banner */}
                    {biometricProfile?.isActive || (nextTrip.pnr && checkedInPnrs[nextTrip.pnr]?.isSmart) ? (
                      <div className="mb-4 p-5 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900/60 to-cyan-950/40 border border-emerald-500/30 shadow-[0_4px_20px_rgba(16,185,129,0.15)] relative overflow-hidden">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                          <div className="flex items-start gap-3.5">
                            <div className="w-11 h-11 rounded-xl bg-emerald-400/20 border border-emerald-400/40 flex items-center justify-center text-2xl text-emerald-300 shrink-0 shadow-[0_0_16px_rgba(52,211,153,0.3)]">
                              ✓
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-bold text-white font-display uppercase tracking-wide">
                                  SMART BOARDING
                                </h4>
                                <span className="text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 border border-emerald-400/40">
                                  ✓ READY
                                </span>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-xs font-mono mt-2 text-slate-300">
                                <div>
                                  <span className="text-slate-500 block text-[10px] uppercase">Passenger</span>
                                  <strong className="text-white truncate block">{nextTrip.passengers?.[0]?.name || "Traveler"}</strong>
                                </div>
                                <div>
                                  <span className="text-slate-500 block text-[10px] uppercase">Flight</span>
                                  <strong className="text-cyan-300">{nextTrip.legs?.[0]?.airline || "Navigo"} {deriveFlightNumber(nextTrip.legs?.[0]?.airline || "Navigo", nextTrip.legs?.[0]?.flightInstanceId)}</strong>
                                </div>
                                <div>
                                  <span className="text-slate-500 block text-[10px] uppercase">Route</span>
                                  <strong className="text-white">{nextTrip.legs?.[0]?.origin || "DEL"} → {nextTrip.legs?.[0]?.destination || "BLR"}</strong>
                                </div>
                                <div>
                                  <span className="text-slate-500 block text-[10px] uppercase">Status</span>
                                  <strong className="text-emerald-400">Smart Boarding Enabled</strong>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setActivePassBooking(nextTrip)}
                              className="px-4 py-2 rounded-full bg-emerald-400 text-slate-950 text-xs font-bold shadow-[0_2px_14px_rgba(52,211,153,0.35)] hover:bg-emerald-300 transition-colors flex items-center gap-1.5"
                            >
                              <span>📱</span> Show Boarding QR
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="mb-4 p-4 rounded-2xl bg-gradient-to-r from-amber-950/30 via-slate-900/60 to-slate-900/40 border border-amber-500/25 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-amber-400/15 border border-amber-400/25 flex items-center justify-center text-xl text-amber-300">
                            👤
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold text-white font-display">SMART BOARDING</h4>
                              <span className="text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-amber-400/15 text-amber-300">
                                FAST-TRACK
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">
                              Speed up your airport journey with verified biometric boarding.
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            setCheckInPnr(nextTrip.pnr || "")
                            setCheckInOpen(true)
                          }}
                          className="px-4 py-2 rounded-full pill-cta text-xs font-bold shadow-[0_2px_12px_rgba(251,191,36,0.3)] flex items-center gap-1.5"
                        >
                          <span>⚡</span> Enable Smart Boarding →
                        </button>
                      </div>
                    )}

                    <NextTripPasses booking={nextTrip} gateMap={gateMap} />
                  </div>

                  {/* Also Upcoming List */}
                  {restUpcoming.length > 0 && (
                    <div className="space-y-2.5 pt-2">
                      <p className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold pl-1">
                        Other Upcoming Journeys ({restUpcoming.length})
                      </p>
                      {restUpcoming.map((b, i) => (
                        <UpcomingRow
                          key={b.id}
                          booking={b}
                          index={i}
                          gateMap={gateMap}
                          copiedPnr={copiedPnr}
                          onCopyPnr={handleCopyPnr}
                          onOpenPass={() => setActivePassBooking(b)}
                          onOpenDetails={() => setActiveDetailsBooking(b as any)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </motion.div>

            {/* Past Trips Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-base">🧳</span>
                  <h2 className="font-display text-xl font-bold text-white tracking-tight">
                    Past Journeys ({past.length})
                  </h2>
                </div>

                {past.length > 0 && (
                  <button
                    onClick={() => router.push("/my-trips?tab=past")}
                    className="text-xs font-semibold text-cyan-300 hover:text-cyan-200 transition-colors flex items-center gap-1 group"
                  >
                    View All Completed <span className="group-hover:translate-x-1 transition-transform">→</span>
                  </button>
                )}
              </div>

              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {[0, 1].map((i) => (
                    <div key={i} className="rounded-2xl bg-white/[0.03] border border-white/[0.06] animate-pulse h-24" />
                  ))}
                </div>
              ) : past.length === 0 ? (
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8 text-center">
                  <p className="text-xs text-slate-500">No completed flights on record yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {past.slice(0, 4).map((b, i) => (
                    <PastTripCard
                      key={b.id}
                      booking={b}
                      index={i}
                      onOpenPass={() => setActivePassBooking(b)}
                      onOpenDetails={() => setActiveDetailsBooking(b as any)}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          </div>

          {/* Right Column (4 cols): Quick Actions, Weather Widget, NavBot Support */}
          <div className="col-span-12 lg:col-span-4 space-y-6">
            {/* Quick Actions Panel */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.5, delay: 0.15 }}
            >
              <div className="relative bg-gradient-to-b from-[#0B1526] to-[#070D18] border border-white/[0.08] rounded-3xl p-5 sm:p-6 overflow-hidden shadow-xl">
                <div className="pointer-events-none absolute -top-16 -right-16 w-40 h-40 bg-cyan-400/10 blur-3xl rounded-full" />
                <div className="pointer-events-none absolute -bottom-16 -left-16 w-40 h-40 bg-[#D4AF37]/10 blur-3xl rounded-full" />

                <h3 className="text-sm font-bold text-white mb-4 relative flex items-center justify-between">
                  <span>Cockpit Quick Actions</span>
                  <span className="text-[10px] text-amber-300 font-mono">FAST ACCESS</span>
                </h3>

                <div className="grid grid-cols-2 gap-3 relative">
                  <QuickAction
                    icon="✈️"
                    label="Book Flight"
                    sub="Explore routes"
                    onClick={() => router.push("/")}
                  />
                  <QuickAction
                    icon="🧳"
                    label="My Bookings"
                    sub="View all trips"
                    onClick={() => router.push("/my-trips")}
                  />
                  <QuickAction
                    icon="🛫"
                    label="Web Check-In"
                    sub="Instant pass"
                    onClick={() => {
                      setCheckInPnr(nextTrip?.pnr || "")
                      setCheckInOpen(true)
                    }}
                  />
                  <QuickAction
                    icon="📊"
                    label="Flight Status"
                    sub="Live radar"
                    onClick={() => router.push("/my-trips")}
                  />
                </div>
              </div>
            </motion.div>

            {/* DigiYatra Smart Boarding & Face ID Settings Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.5, delay: 0.18 }}
            >
              <div className="relative bg-gradient-to-b from-[#0A1628] to-[#060D18] border border-cyan-500/25 rounded-3xl p-5 sm:p-6 overflow-hidden shadow-xl">
                <div className="pointer-events-none absolute -top-16 -right-16 w-40 h-40 bg-emerald-400/10 blur-3xl rounded-full" />

                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">👤</span>
                    <div>
                      <h4 className="text-sm font-bold text-white">Smart Boarding Profile</h4>
                      <p className="text-[10px] text-slate-400 font-mono">DIGIYATRA BIOMETRIC ID</p>
                    </div>
                  </div>
                  <span
                    className={`text-[9px] font-mono font-bold uppercase px-2.5 py-1 rounded-full ${
                      biometricProfile
                        ? "bg-emerald-400/15 text-emerald-300 border border-emerald-400/30"
                        : "bg-slate-400/15 text-slate-400 border border-slate-400/30"
                    }`}
                  >
                    {biometricProfile ? "ACTIVE ✓" : "NOT CONFIGURED"}
                  </span>
                </div>

                <div className="space-y-2.5 text-xs text-slate-300 pt-3 border-t border-white/[0.08]">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Smart Check-In:</span>
                    <button
                      onClick={() => setSmartBoardingActive(!smartBoardingActive)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        smartBoardingActive ? "bg-emerald-400" : "bg-slate-700"
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-slate-950 transition-transform ${
                          smartBoardingActive ? "translate-x-4" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Profile Reference:</span>
                    <span className="font-mono text-amber-300 font-bold">
                      {biometricProfile?.biometricProfileId || "Unregistered"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Last Verified:</span>
                    <span className="text-slate-300 font-mono">
                      {biometricProfile?.lastVerifiedAt
                        ? new Date(biometricProfile.lastVerifiedAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "Pending enrollment"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/[0.06]">
                  {biometricProfile ? (
                    <button
                      onClick={() => setDeleteBioModalOpen(true)}
                      className="w-full py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 hover:bg-rose-500/20 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                    >
                      <span>🗑️</span> Remove Face Profile
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setCheckInPnr(nextTrip?.pnr || "")
                        setCheckInOpen(true)
                      }}
                      className="px-3 py-2 rounded-xl pill-cta text-slate-950 text-[11px] font-bold shadow-[0_2px_8px_rgba(251,191,36,0.3)] transition-all"
                    >
                      Setup Face ID
                    </button>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Destination Weather & Insights Widget */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <div className="relative bg-white/[0.02] border border-white/[0.08] rounded-3xl p-5 overflow-hidden">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🌤️</span>
                    <div>
                      <p className="text-xs font-bold text-white">Destination Advisory</p>
                      <p className="text-[10px] text-slate-400">{destinationCity} ({destinationCode})</p>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold text-amber-300 bg-amber-400/10 px-2 py-0.5 rounded-lg border border-amber-400/20">
                    26°C · Clear
                  </span>
                </div>

                <div className="space-y-2 text-xs text-slate-300 pt-2 border-t border-white/[0.06]">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Terminal:</span>
                    <span className="font-semibold text-white">Terminal 2 (Domestic & Intl)</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Free Airport Wi-Fi:</span>
                    <span className="font-semibold text-emerald-300">Available (High Speed)</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Navigo Lounge:</span>
                    <span className="font-semibold text-cyan-300">Gates 14–22 Concourse</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* NavBot AI Assistant Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.5, delay: 0.25 }}
            >
              <div className="relative bg-gradient-to-br from-cyan-400/[0.07] to-transparent border border-cyan-400/20 rounded-3xl p-5 flex items-start gap-3.5 overflow-hidden">
                <div className="pointer-events-none absolute -top-10 -right-10 w-32 h-32 bg-cyan-400/10 blur-2xl rounded-full" />
                <div className="relative radar-ring w-10 h-10 rounded-full bg-cyan-400/10 border border-cyan-400/30 flex items-center justify-center text-cyan-300 shrink-0">
                  <BotIcon />
                </div>
                <div className="relative">
                  <p className="text-xs font-bold text-cyan-300">NavBot Travel Copilot</p>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    Need to modify baggage, swap seats, or get gate assistance?
                  </p>
                  <button
                    onClick={() => router.push("/my-trips")}
                    className="text-xs text-cyan-300 hover:text-cyan-200 transition-colors mt-2.5 border border-cyan-400/30 rounded-full px-3.5 py-1 bg-cyan-400/[0.05] hover:bg-cyan-400/10"
                  >
                    Chat with NavBot →
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Global Modals */}
      <BoardingPassModal
        booking={activePassBooking}
        isOpen={!!activePassBooking}
        onClose={() => setActivePassBooking(null)}
        gateMap={gateMap}
      />

      <TripDetailsModal
        booking={activeDetailsBooking}
        isOpen={!!activeDetailsBooking}
        onClose={() => setActiveDetailsBooking(null)}
        onViewBoardingPass={() => {
          if (activeDetailsBooking) {
            setActivePassBooking(activeDetailsBooking as any)
          }
        }}
      />

      <CheckInModal
        isOpen={checkInOpen}
        onClose={() => setCheckInOpen(false)}
        defaultPnr={checkInPnr}
        onSuccess={(pnr) => {
          const match = bookings?.find((b) => b.pnr === pnr)
          if (match) {
            setActivePassBooking(match)
            setCheckInOpen(false)
          }
        }}
      />

      <NavPointsModal
        isOpen={pointsModalOpen}
        onClose={() => setPointsModalOpen(false)}
        onExploreFlights={() => router.push("/")}
      />

      {/* Delete Biometric Profile Confirmation Modal */}
      <AnimatePresence>
        {deleteBioModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteBioModalOpen(false)}
              className="fixed inset-0 bg-[#020617]/85 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              className="relative w-full max-w-md bg-[#0A1424] border border-rose-500/30 rounded-3xl p-6 shadow-2xl z-10 overflow-hidden"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-2xl flex items-center justify-center mb-4">
                ⚠️
              </div>
              <h3 className="font-display text-lg font-bold text-white">
                Remove Smart Boarding Face ID?
              </h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                This will permanently delete your stored facial feature vector template and disable DigiYatra express fast-track e-gate clearance. You will need to re-register your face for future flights.
              </p>
              <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setDeleteBioModalOpen(false)}
                  className="px-4 py-2 rounded-full border border-white/[0.1] text-xs font-semibold text-slate-300 hover:bg-white/[0.05]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteBiometricProfile}
                  disabled={deletingBio}
                  className="px-5 py-2 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-[0_2px_12px_rgba(244,63,94,0.35)] transition-colors disabled:opacity-50"
                >
                  {deletingBio ? "Removing…" : "Confirm Deletion"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// Hero Header with Live Clock & Departure Board
// ───────────────────────────────────────────────────────────────────────────

function HeroHeader({
  nextTrip,
  gateMap,
  loading,
  onBook,
  onViewPass,
  onViewDetails,
}: {
  nextTrip?: ModalBooking
  gateMap: Record<string, string>
  loading: boolean
  onBook: () => void
  onViewPass: () => void
  onViewDetails: () => void
}) {
  const reducedMotion = useReducedMotion()
  const target = nextTrip ? nextDepartureMs(nextTrip) : null
  const countdown = useCountdown(target)
  const [clock, setClock] = useState("")
  const [dateLabel, setDateLabel] = useState("")

  useEffect(() => {
    const tick = () => {
      const d = new Date()
      setClock(d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }))
      setDateLabel(d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" }))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  const pad = (n: number) => String(n).padStart(2, "0")

  const statusLabel = (() => {
    if (!countdown) return "SCHEDULED"
    const totalHours = countdown.days * 24 + countdown.hours
    if (totalHours >= 24) return "SCHEDULED"
    if (totalHours >= 2) return "CHECK-IN OPEN"
    return "BOARDING NOW"
  })()

  const statusColor =
    statusLabel === "BOARDING NOW"
      ? "text-amber-300"
      : statusLabel === "CHECK-IN OPEN"
      ? "text-cyan-300"
      : "text-emerald-300"

  const flightNumber = nextTrip
    ? deriveFlightNumber(nextTrip.legs[0]?.airline || "", nextTrip.legs[0]?.flightInstanceId || "")
    : "—"

  return (
    <div className="relative mb-10">
      {!reducedMotion && (
        <motion.div
          initial={{ x: "-30vw", opacity: 0, y: 20 }}
          animate={{ x: "110vw", opacity: [0, 1, 1, 0], y: [20, -10, -10, -30] }}
          transition={{ duration: 2.6, delay: 0.4, ease: "easeInOut" }}
          className="absolute top-6 left-0 text-amber-300 pointer-events-none z-10"
          aria-hidden
        >
          <PlaneGlyph className="w-9 h-9 drop-shadow-[0_0_14px_rgba(251,191,36,0.8)]" />
        </motion.div>
      )}

      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-amber-400/25 bg-amber-400/[0.07] text-[10px] font-bold uppercase tracking-[0.22em] text-amber-300 mb-5"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-300 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-300" />
            </span>
            Navigo Flight Control · Live Cockpit
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.08, ease: "easeOut" }}
            className="font-cyber text-4xl sm:text-5xl xl:text-6xl font-extrabold leading-[1.04] tracking-tight mb-4"
          >
            <span className="gradient-shimmer-text">READY FOR</span> <span className="text-white">TAKEOFF</span>
            <span className="inline-block align-middle ml-2 origin-center float-bob" aria-hidden>
              <PlaneGlyph className="w-8 h-8 sm:w-10 sm:h-10 text-cyan-300 drop-shadow-[0_0_16px_rgba(34,211,238,0.7)]" />
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.16, ease: "easeOut" }}
            className="text-sm sm:text-base text-slate-400 max-w-xl"
          >
            {nextTrip
              ? `Flight ${flightNumber} to ${nextTrip.legs[0]?.destination} is on the board. View live gate, boarding pass, and status.`
              : "Explore the skies. Plot your next flight booking with instant confirmation."}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.24, ease: "easeOut" }}
            className="flex flex-wrap items-center gap-4 mt-6"
          >
            <button onClick={onBook} className="px-6 py-3 rounded-full pill-cta text-sm font-bold glow-cta">
              Book a Flight
            </button>

            {nextTrip && (
              <button
                onClick={onViewPass}
                className="px-5 py-3 rounded-full border border-white/[0.15] bg-white/[0.04] text-sm font-semibold text-slate-200 hover:bg-white/[0.08] hover:text-white transition-colors flex items-center gap-2"
              >
                <span>🎫</span> Digital Pass
              </button>
            )}

            <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-white/[0.03] border border-white/[0.08]">
              <ClockIcon />
              <div className="leading-tight">
                <p className="font-board text-sm text-white tabular-nums">{clock || "--:--:--"}</p>
                <p className="text-[10px] uppercase tracking-widest text-slate-500">{dateLabel || ""}</p>
              </div>
            </div>

            {countdown && (
              <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.05]">
                <RadarIcon />
                <div className="leading-tight">
                  <p className="text-[10px] uppercase tracking-widest text-emerald-300/80">Takeoff in</p>
                  <p className="font-board text-base text-emerald-300 tabular-nums font-semibold">
                    {countdown.days > 0 && (
                      <span>
                        {pad(countdown.days)}
                        <span className="count-colon">:</span>
                      </span>
                    )}
                    {pad(countdown.hours)}
                    <span className="count-colon">:</span>
                    {pad(countdown.mins)}
                    <span className="count-colon">:</span>
                    {pad(countdown.secs)}
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        </div>

        {/* Airport-Style Departure Board */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92, rotateX: -8 }}
          animate={{ opacity: 1, scale: 1, rotateX: 0 }}
          transition={{ duration: 0.7, delay: 0.3, type: "spring", stiffness: 120, damping: 16 }}
          style={{ perspective: 1000 }}
          className="w-full lg:w-[350px] shrink-0"
        >
          <div className="relative rounded-3xl overflow-hidden border border-white/[0.1] bg-[#0A1424]/90 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.08] bg-white/[0.03]">
              <p className="font-board text-[10px] uppercase tracking-[0.25em] text-amber-300">Live Departure Board</p>
              <span className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest text-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live
              </span>
            </div>

            <div className="relative px-5 py-4 scanlines">
              {loading ? (
                <div className="h-28 flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-amber-300/30 border-t-amber-300 rounded-full animate-spin" />
                </div>
              ) : nextTrip ? (
                <div className="space-y-3 board-flicker">
                  <BoardRow label="Flight" value={flightNumber} accent />
                  <BoardRow
                    label="Route"
                    value={`${nextTrip.legs[0]?.origin || "--"} → ${nextTrip.legs[0]?.destination || "--"}`}
                  />
                  <BoardRow label="Time" value={formatTime(nextTrip.legs[0]?.departureTime)} />
                  <BoardRow
                    label="Gate"
                    value={nextTrip.legs[0] ? gateMap[nextTrip.legs[0].flightInstanceId] || "TBA" : "TBA"}
                  />
                  <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between">
                    <span className="font-board text-[10px] uppercase tracking-widest text-slate-500">Status</span>
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${statusColor}`}>
                      {statusLabel}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center">
                  <p className="font-board text-[11px] uppercase tracking-[0.2em] text-slate-400 mb-2">
                    No Departures Scheduled
                  </p>
                  <p className="text-[10px] text-slate-500">Book your escape to light up this board</p>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

function BoardRow({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="font-board text-[10px] uppercase tracking-widest text-slate-500">{label}</span>
      <span className={`font-board text-sm tabular-nums font-semibold ${accent ? "text-amber-300" : "text-white"}`}>
        {value}
      </span>
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// Ticker
// ───────────────────────────────────────────────────────────────────────────

function Ticker({
  items,
}: {
  items: { airline: string; origin: string; destination: string; pnr?: string; status: string }[]
}) {
  const doubled = [...items, ...items]
  // Constant, relaxed linear velocity regardless of item count (at least 45s, +9s per item)
  const speedSeconds = Math.max(45, items.length * 9)

  return (
    <div className="relative mb-10 -mx-4 sm:-mx-0 overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02]">
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 z-10 bg-gradient-to-r from-[#04070F] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 z-10 bg-gradient-to-l from-[#04070F] to-transparent" />
      <div
        className="flex w-max marquee-track py-2.5"
        style={{ animationDuration: `${speedSeconds}s` }}
      >
        {doubled.map((item, i) => (
          <span key={i} className="flex items-center gap-3 px-5 text-xs whitespace-nowrap">
            <span className="text-amber-300" aria-hidden>
              ✈
            </span>
            <span className="font-semibold text-white uppercase">{item.airline}</span>
            <span className="font-board text-cyan-300 tabular-nums">
              {item.origin} → {item.destination}
            </span>
            {item.pnr && <span className="text-slate-500 font-board font-semibold">PNR {item.pnr}</span>}
            <span
              className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                item.status === "confirmed" ? "bg-emerald-400/15 text-emerald-300" : "bg-slate-400/15 text-slate-400"
              }`}
            >
              {item.status}
            </span>
            <span className="text-slate-600" aria-hidden>
              ✦
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// NextTripPasses
// ───────────────────────────────────────────────────────────────────────────

function NextTripPasses({ booking, gateMap }: { booking: ModalBooking; gateMap: Record<string, string> }) {
  const hasMultipleLegs = booking.legs.length > 1
  const hasMultiplePassengers = booking.passengers.length > 1

  const [activeLegIdx, setActiveLegIdx] = useState(0)
  const [activePaxIdx, setActivePaxIdx] = useState(0)

  const leg = booking.legs[activeLegIdx]
  const passenger = booking.passengers[activePaxIdx]

  const seat = useMemo(() => {
    if (!leg || !passenger) return undefined
    return booking.seats.find((s) => s.flightInstanceId === leg.flightInstanceId && s.passengerId === passenger.id)
      ?.seatNumber
  }, [booking.seats, leg, passenger])

  if (!leg) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 160, damping: 20, delay: 0.1 }}
      className="relative"
    >
      <div className="relative space-y-3 rounded-2xl">
        {(hasMultipleLegs || hasMultiplePassengers) && (
          <div className="flex items-center justify-between flex-wrap gap-2 pb-2">
            {hasMultipleLegs && (
              <div className="inline-flex items-center gap-1 bg-white/[0.03] border border-white/[0.06] rounded-full p-1">
                {booking.legs.map((l, i) => (
                  <button
                    key={l.flightInstanceId}
                    onClick={() => setActiveLegIdx(i)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      activeLegIdx === i
                        ? "text-[#060B14] bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 shadow-[0_2px_14px_rgba(251,191,36,0.45)]"
                        : "text-slate-400 hover:text-white hover:bg-white/[0.05]"
                    }`}
                  >
                    {l.legLabel || `Flight ${i + 1}`} ({l.origin} → {l.destination})
                  </button>
                ))}
              </div>
            )}

            {hasMultiplePassengers && (
              <div className="inline-flex items-center gap-1.5">
                <span className="text-[10px] uppercase tracking-widest text-slate-500 mr-1">Traveler</span>
                {booking.passengers.map((p, i) => (
                  <button
                    key={p.id}
                    onClick={() => setActivePaxIdx(i)}
                    className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all shrink-0 ${
                      activePaxIdx === i
                        ? "bg-[#D4AF37]/25 text-[#E8C766] border border-[#D4AF37]/50 shadow-[0_0_12px_rgba(212,175,55,0.35)]"
                        : "bg-white/[0.04] text-slate-400 border border-white/[0.08] hover:text-white"
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="rounded-2xl overflow-hidden shadow-2xl">
          <BoardingPassCard
            pnr={booking.pnr || "—"}
            passengerName={passenger?.name || "Traveler"}
            airline={leg.airline}
            logoSrc={airlineLogos[leg.airline] || "/airlines/default.png"}
            origin={leg.origin}
            destination={leg.destination}
            dateLabel={leg.travelDate}
            timeLabel={formatTime(leg.departureTime)}
            gate={gateMap[leg.flightInstanceId]}
            flightNumber={deriveFlightNumber(leg.airline, leg.flightInstanceId)}
            seat={seat}
            legLabel={leg.legLabel || undefined}
            index={0}
          />
        </div>
      </div>
    </motion.div>
  )
}

function UpcomingRow({
  booking,
  index = 0,
  gateMap,
  copiedPnr,
  onCopyPnr,
  onOpenPass,
  onOpenDetails,
}: {
  booking: ModalBooking
  index?: number
  gateMap: Record<string, string>
  copiedPnr: string | null
  onCopyPnr: (pnr: string) => void
  onOpenPass: () => void
  onOpenDetails: () => void
}) {
  const firstLeg = booking.legs[0]
  if (!firstLeg) return null
  const lastLeg = booking.legs[booking.legs.length - 1]
  const flightNum = deriveFlightNumber(firstLeg.airline, firstLeg.flightInstanceId)

  return (
    <motion.div
      initial={{ opacity: 0, x: -14 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, delay: 0.05 * index }}
      className="group relative flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 bg-white/[0.02] border border-white/[0.08] rounded-2xl p-4 hover:border-cyan-400/30 transition-all overflow-hidden"
    >
      <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-cyan-400/[0.04] to-transparent" />

      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center overflow-hidden shrink-0 group-hover:scale-105 transition-transform duration-300 shadow-sm">
          <img
            src={airlineLogos[firstLeg.airline] || "/airlines/default.png"}
            alt={firstLeg.airline}
            className="w-6 h-6 object-contain"
          />
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-white truncate">
              {firstLeg.origin} → {lastLeg.destination}
            </p>
            <span className="text-[10px] font-mono text-slate-400">({flightNum})</span>
            {booking.legs.length > 1 && (
              <span className="text-[9px] uppercase tracking-wider font-semibold text-cyan-300 bg-cyan-400/10 px-1.5 py-0.5 rounded">
                Round Trip
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {formatDateLong(firstLeg.travelDate)} · {formatTime(firstLeg.departureTime)}
            {booking.pnr && (
              <span
                onClick={() => onCopyPnr(booking.pnr!)}
                className="ml-2 font-mono text-[#E8C766] cursor-pointer hover:underline"
              >
                PNR {booking.pnr} {copiedPnr === booking.pnr ? "✓" : ""}
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
        <button
          onClick={onOpenDetails}
          className="px-3 py-1.5 rounded-full border border-white/[0.1] text-xs font-medium text-slate-300 hover:text-white hover:bg-white/[0.05] transition-colors"
        >
          Details
        </button>
        <button
          onClick={onOpenPass}
          className="px-4 py-1.5 rounded-full pill-cta text-xs font-bold shadow-[0_2px_10px_rgba(251,191,36,0.25)] flex items-center gap-1"
        >
          <span>🎫</span> Pass
        </button>
      </div>
    </motion.div>
  )
}

function StatCard({
  icon,
  label,
  value,
  sub,
  accent,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
  accent: "gold" | "cyan" | "violet" | "rose"
  onClick?: () => void
}) {
  const numeric = /^\d+$/.test(value)
  const { ref, val } = useCountUp(numeric ? Number(value) : 0)

  const accentStyles: Record<string, { icon: string; glow: string; ring: string }> = {
    gold: {
      icon: "bg-[#D4AF37]/10 border-[#D4AF37]/20 text-[#E8C766]",
      glow: "group-hover:shadow-[0_0_32px_rgba(212,175,55,0.22)]",
      ring: "group-hover:border-[#D4AF37]/40",
    },
    cyan: {
      icon: "bg-cyan-400/10 border-cyan-400/20 text-cyan-300",
      glow: "group-hover:shadow-[0_0_32px_rgba(34,211,238,0.22)]",
      ring: "group-hover:border-cyan-400/40",
    },
    violet: {
      icon: "bg-violet-400/10 border-violet-400/20 text-violet-300",
      glow: "group-hover:shadow-[0_0_32px_rgba(167,139,250,0.22)]",
      ring: "group-hover:border-violet-400/40",
    },
    rose: {
      icon: "bg-rose-400/10 border-rose-400/20 text-rose-300",
      glow: "group-hover:shadow-[0_0_32px_rgba(251,113,133,0.22)]",
      ring: "group-hover:border-rose-400/40",
    },
  }
  const s = accentStyles[accent]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.45 }}
      whileHover={{ y: -3, scale: 1.01 }}
      onClick={onClick}
      className={`group relative bg-white/[0.02] border border-white/[0.08] rounded-3xl p-5 transition-all duration-300 cursor-pointer ${s.glow} ${s.ring}`}
    >
      <div className="flex items-center gap-2.5 mb-2.5">
        <span
          className={`w-8 h-8 rounded-xl border flex items-center justify-center transition-transform duration-300 group-hover:scale-110 ${s.icon}`}
        >
          {icon}
        </span>
        <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">{label}</p>
      </div>
      <p className="font-display text-2xl font-extrabold text-white tabular-nums">
        {numeric ? <span ref={ref}>{val}</span> : value}
      </p>
      <p className="text-xs text-slate-500 mt-0.5">{sub}</p>
    </motion.div>
  )
}

function PastTripCard({
  booking,
  index = 0,
  onOpenPass,
  onOpenDetails,
}: {
  booking: ModalBooking
  index?: number
  onOpenPass: () => void
  onOpenDetails: () => void
}) {
  const router = useRouter()
  const firstLeg = booking.legs[0]
  if (!firstLeg) return null
  const lastLeg = booking.legs[booking.legs.length - 1]

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.05 * index }}
      className="group relative flex items-center justify-between gap-3 bg-white/[0.02] border border-white/[0.08] rounded-2xl p-4 hover:border-violet-400/30 hover:shadow-[0_0_24px_rgba(167,139,250,0.12)] transition-all overflow-hidden"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center overflow-hidden shrink-0 group-hover:scale-105 transition-transform duration-300">
          <img
            src={airlineLogos[firstLeg.airline] || "/airlines/default.png"}
            alt={firstLeg.airline}
            className="w-5 h-5 object-contain"
          />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold text-white truncate">
            {firstLeg.origin} → {lastLeg.destination}
          </p>
          <p className="text-[11px] text-slate-400">{formatDate(firstLeg.travelDate)} · Completed</p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={onOpenPass}
          className="px-3 py-1 rounded-full border border-white/[0.1] text-[11px] font-semibold text-slate-300 hover:text-white hover:bg-white/[0.05]"
        >
          Pass
        </button>
        <button
          onClick={() => router.push(`/?from=${firstLeg.origin}&to=${lastLeg.destination}`)}
          className="px-3 py-1 rounded-full bg-white/[0.04] text-[11px] font-semibold text-amber-300 border border-amber-400/20 hover:bg-amber-400/10"
        >
          Rebook
        </button>
      </div>
    </motion.div>
  )
}

function QuickAction({
  icon,
  label,
  sub,
  onClick,
}: {
  icon: string
  label: string
  sub: string
  onClick: () => void
}) {
  return (
    <motion.button
      whileHover={{ y: -3, scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="group relative flex flex-col items-start gap-1 p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.08] hover:border-amber-400/40 hover:shadow-[0_0_24px_rgba(251,191,36,0.18)] transition-all overflow-hidden text-left"
    >
      <span className="text-xl mb-0.5">{icon}</span>
      <span className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors">{label}</span>
      <span className="text-[10px] text-slate-500">{sub}</span>
    </motion.button>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// Icons & Aurora Backdrop
// ───────────────────────────────────────────────────────────────────────────

function AuroraBackdrop() {
  const stars = useMemo(() => {
    const rand = seededRandom(1337)
    return Array.from({ length: 70 }, (_, i) => ({
      id: i,
      left: rand() * 100,
      top: rand() * 62,
      size: 1 + rand() * 1.6,
      delay: rand() * 6,
      duration: 2.5 + rand() * 4,
      opacity: 0.25 + rand() * 0.6,
    }))
  }, [])

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
      <div
        className="absolute top-[-220px] left-[12%] w-[650px] h-[650px] rounded-full aurora-blob"
        style={{
          background:
            "radial-gradient(circle, rgba(212,175,55,0.08) 0%, rgba(212,175,55,0.02) 45%, transparent 70%)",
          animationDuration: "26s",
        }}
      />
      <div
        className="absolute bottom-[-260px] right-[8%] w-[580px] h-[580px] rounded-full aurora-blob"
        style={{
          background:
            "radial-gradient(circle, rgba(34,211,238,0.08) 0%, rgba(34,211,238,0.02) 45%, transparent 70%)",
          animationDuration: "32s",
          animationDelay: "-8s",
        }}
      />

      {stars.map((s) => (
        <span
          key={s.id}
          className="absolute rounded-full bg-white star-twinkle"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            opacity: s.opacity,
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.duration}s`,
          }}
        />
      ))}
    </div>
  )
}

function PlaneGlyph({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
    </svg>
  )
}

function SuitcaseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" />
      <path d="M3 12h18" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  )
}

function StarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" />
    </svg>
  )
}

function TagIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.6 12.6l-8-8H4v8.6l8 8a2 2 0 002.8 0l5.8-5.8a2 2 0 000-2.8z" />
      <circle cx="8.5" cy="8.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-amber-300">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}

function RadarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-300">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 12l5-5" />
      <path d="M12 3a9 9 0 019 9" />
    </svg>
  )
}

function BotIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="8" width="16" height="11" rx="2" />
      <path d="M12 4v4" />
      <circle cx="12" cy="3" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

function PageStyles() {
  return (
    <style jsx global>{`
      @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@700;800&family=Unbounded:wght@600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap');
      .font-display {
        font-family: 'Manrope', ui-sans-serif, system-ui, sans-serif;
        letter-spacing: -0.01em;
      }
      .font-cyber {
        font-family: 'Unbounded', 'Manrope', ui-sans-serif, system-ui, sans-serif;
        letter-spacing: -0.02em;
      }
      .font-board {
        font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, monospace;
      }

      .pill-cta {
        background: linear-gradient(90deg, #38bdf8 0%, #60a5fa 30%, #d4af37 70%, #fbbf24 100%);
        color: #060b14;
      }
      .pill-cta:hover {
        filter: brightness(1.06);
      }

      .grain-layer {
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E");
      }

      @keyframes auroraDrift {
        0%,
        100% {
          transform: translate(0, 0) scale(1);
        }
        33% {
          transform: translate(40px, -30px) scale(1.08);
        }
        66% {
          transform: translate(-30px, 24px) scale(0.95);
        }
      }
      .aurora-blob {
        animation: auroraDrift 26s ease-in-out infinite;
        will-change: transform;
      }

      @keyframes starTwinkle {
        0%,
        100% {
          opacity: 0.15;
          transform: scale(0.8);
        }
        50% {
          opacity: 1;
          transform: scale(1.15);
        }
      }
      .star-twinkle {
        animation: starTwinkle 4s ease-in-out infinite;
      }

      @keyframes shimmerShift {
        to {
          background-position: 200% center;
        }
      }
      .gradient-shimmer-text {
        background: linear-gradient(90deg, #fbbf24, #fde68a, #38bdf8, #a78bfa, #fbbf24);
        background-size: 200% auto;
        -webkit-background-clip: text;
        background-clip: text;
        -webkit-text-fill-color: transparent;
        color: transparent;
        animation: shimmerShift 6s linear infinite;
      }

      @keyframes floatBob {
        0%,
        100% {
          transform: translateY(0) rotate(-3deg);
        }
        50% {
          transform: translateY(-8px) rotate(4deg);
        }
      }
      .float-bob {
        animation: floatBob 3.4s ease-in-out infinite;
      }

      @keyframes marqueeScroll {
        from {
          transform: translateX(0);
        }
        to {
          transform: translateX(-50%);
        }
      }
      .marquee-track {
        animation: marqueeScroll 50s linear infinite;
        will-change: transform;
      }
      .marquee-track:hover {
        animation-play-state: paused;
      }

      @keyframes boardFlicker {
        0%,
        100% {
          opacity: 1;
        }
        92% {
          opacity: 1;
        }
        93% {
          opacity: 0.82;
        }
        94% {
          opacity: 1;
        }
        97% {
          opacity: 0.9;
        }
      }
      .board-flicker {
        animation: boardFlicker 5s linear infinite;
      }
      .scanlines {
        background-image: repeating-linear-gradient(
          to bottom,
          rgba(255, 255, 255, 0.022) 0px,
          rgba(255, 255, 255, 0.022) 1px,
          transparent 1px,
          transparent 4px
        );
      }

      @keyframes radarSweep {
        from {
          transform: rotate(0deg);
        }
        to {
          transform: rotate(360deg);
        }
      }
      .radar-ring::after {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: 9999px;
        background: conic-gradient(from 0deg, transparent 0deg, rgba(34, 211, 238, 0.5) 40deg, transparent 80deg);
        animation: radarSweep 3s linear infinite;
        mask-image: radial-gradient(circle, transparent 62%, black 64%);
        -webkit-mask-image: radial-gradient(circle, transparent 62%, black 64%);
      }

      @keyframes glowPulse {
        0%,
        100% {
          box-shadow: 0 0 18px rgba(251, 191, 36, 0.35), 0 0 42px rgba(56, 189, 248, 0.15);
        }
        50% {
          box-shadow: 0 0 30px rgba(251, 191, 36, 0.55), 0 0 64px rgba(56, 189, 248, 0.28);
        }
      }
      .glow-cta {
        animation: glowPulse 2.6s ease-in-out infinite;
      }

      @keyframes colonBlink {
        0%,
        100% {
          opacity: 1;
        }
        50% {
          opacity: 0.35;
        }
      }
      .count-colon {
        animation: colonBlink 1s steps(1) infinite;
      }

      @keyframes heroShimmer {
        from {
          background-position: -200% 0;
        }
        to {
          background-position: 200% 0;
        }
      }
      .hero-shimmer-bg {
        background: linear-gradient(100deg, transparent 30%, rgba(255, 255, 255, 0.05) 50%, transparent 70%);
        background-size: 200% 100%;
        animation: heroShimmer 3.5s linear infinite;
      }

      @media (prefers-reduced-motion: reduce) {
        .aurora-blob,
        .star-twinkle,
        .gradient-shimmer-text,
        .float-bob,
        .marquee-track,
        .board-flicker,
        .radar-ring::after,
        .glow-cta,
        .count-colon,
        .hero-shimmer-bg {
          animation: none !important;
        }
      }
    `}</style>
  )
}
