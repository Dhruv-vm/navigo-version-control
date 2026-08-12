"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { motion, useInView, useReducedMotion } from "framer-motion"
import Navbar from "@/components/navbar"
import { BoardingPassCard } from "@/app/checkout/payment/BoardingPassCard"
import { deriveFlightNumber } from "@/app/checkout/payment/bookingUtils"

type Leg = {
  legLabel: "Departure" | "Return" | null
  flightInstanceId: string
  airline: string
  origin: string
  destination: string
  travelDate: string
  departureTime?: string
}

type PassengerRef = { id: string; name: string; isPrimary: boolean }
type SeatRef = { flightInstanceId: string; passengerId: string; seatNumber: string }

type Booking = {
  id: string
  pnr?: string
  status: string
  travelDate: string | null
  legs: Leg[]
  passengers: PassengerRef[]
  seats: SeatRef[]
}

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
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })
}

function formatDateLong(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
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

// Next departure as an absolute timestamp: travelDate + first leg's
// departure time (falls back to midnight if the time is missing).
function nextDepartureMs(booking: Booking): number | null {
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

// Animated count-up that fires when the value scrolls into view.
function useCountUp(target: number, duration = 1100) {
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

// Deterministic PRNG so the starfield renders identically on server + client
// (no hydration mismatch).
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
// Page
// ───────────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter()
  const [bookings, setBookings] = useState<Booking[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [gateMap, setGateMap] = useState<Record<string, string>>({})

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
        if (!cancelled) setBookings(Array.isArray(data) ? data : data?.bookings ?? [])
      })
      .catch((err) => {
        console.error("Failed to load bookings:", err)
        if (!cancelled) setBookings([])
      })
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [])

  const now = Date.now()
  const upcoming = (bookings || [])
    .filter((b) => b.travelDate && new Date(b.travelDate).getTime() >= now && b.status === "confirmed")
    .sort((a, b) => new Date(a.travelDate!).getTime() - new Date(b.travelDate!).getTime())
  const past = (bookings || [])
    .filter((b) => b.travelDate && new Date(b.travelDate).getTime() < now)
    .sort((a, b) => new Date(b.travelDate!).getTime() - new Date(a.travelDate!).getTime())

  const nextTrip = upcoming[0]
  const restUpcoming = upcoming.slice(1)

  // ✅ Gate isn't stored on the booking — fetched live the same way the
  // payment page does, keyed by each leg's flight_instance_id.
  useEffect(() => {
    if (!nextTrip) return
    const ids = nextTrip.legs.map((l) => l.flightInstanceId).filter(Boolean)
    if (ids.length === 0) return
    let cancelled = false
    fetch(`/api/flights/gate?ids=${ids.join(",")}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.gates) setGateMap(data.gates)
      })
      .catch((err) => console.warn("Failed to fetch gate assignments:", err))
    return () => { cancelled = true }
  }, [nextTrip?.id])

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
        { airline: "IndiGo", origin: "DEL", destination: "BOM", pnr: "ABC123", status: "confirmed" },
        { airline: "Emirates", origin: "DXB", destination: "LHR", pnr: "X9Z8Y7", status: "confirmed" },
        { airline: "Vistara", origin: "BLR", destination: "SIN", pnr: "QWE456", status: "confirmed" },
        { airline: "Air India", origin: "BOM", destination: "JFK", pnr: "RTY789", status: "confirmed" },
      ]
    }
    return items
  }, [bookings])

  return (
    <div className="min-h-screen bg-[#04070F] text-white relative overflow-x-hidden">
      <PageStyles />
      <AuroraBackdrop />
      <div className="pointer-events-none fixed inset-0 opacity-[0.05] mix-blend-overlay grain-layer" />

      <Navbar />

      <div className="relative max-w-[1400px] mx-auto px-6 pt-28 pb-16">
        <HeroHeader
          nextTrip={nextTrip}
          gateMap={gateMap}
          loading={loading}
          onBook={() => router.push("/")}
        />

        <Ticker items={tickerItems} />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          <StatCard icon={<SuitcaseIcon />} label="Total Trips" value={String((bookings || []).length)} sub="All time" accent="gold" />
          <StatCard icon={<CalendarIcon />} label="Upcoming Trips" value={String(upcoming.length)} sub={nextTrip?.travelDate ? `Next: ${formatDate(nextTrip.travelDate)}` : "None scheduled"} accent="cyan" />
          <StatCard icon={<StarIcon />} label="Past Trips" value={String(past.length)} sub="Completed" accent="violet" />
          <StatCard icon={<TagIcon />} label="NavPoints" value="—" sub="Coming soon" accent="rose" />
        </div>

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-8 space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.55, ease: "easeOut" }}
            >
              <div className="flex items-center justify-between mb-3">
                <p className="font-display text-lg font-bold text-white flex items-center gap-2.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                  </span>
                  Upcoming Trips
                </p>
                {upcoming.length > 0 && (
                  <button onClick={() => router.push("/my-trips")} className="text-xs text-cyan-300 hover:text-cyan-200 transition-colors">View All</button>
                )}
              </div>

              {loading ? (
                <div className="rounded-2xl bg-white/[0.03] animate-pulse h-64" />
              ) : !nextTrip ? (
                <div className="relative rounded-2xl border border-white/[0.08] bg-white/[0.02] p-10 text-center overflow-hidden">
                  <div className="pointer-events-none absolute inset-0 opacity-40 hero-shimmer-bg" />
                  <motion.p
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="text-sm text-slate-400 mb-4 relative"
                  >
                    The sky is waiting. <span className="text-amber-300">No upcoming trips yet.</span>
                  </motion.p>
                  <button onClick={() => router.push("/")} className="px-5 py-2.5 rounded-full pill-cta text-xs font-bold relative">
                    ✈ Search Flights
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-widest text-slate-500 mb-2 pl-1">
                      Next Up · {nextTrip.travelDate ? formatDateLong(nextTrip.travelDate) : ""}
                    </p>
                    <NextTripPasses booking={nextTrip} gateMap={gateMap} />
                  </div>

                  {restUpcoming.length > 0 && (
                    <div className="space-y-2 pt-1">
                      <p className="text-[11px] uppercase tracking-widest text-slate-500 pl-1">Also Upcoming</p>
                      {restUpcoming.map((b, i) => (
                        <UpcomingRow key={b.id} booking={b} index={i} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.55, delay: 0.1, ease: "easeOut" }}
            >
              <div className="flex items-center justify-between mb-3">
                <p className="font-display text-lg font-bold text-white">Past Trips</p>
                {past.length > 0 && (
                  <button onClick={() => router.push("/my-trips?tab=past")} className="text-xs text-cyan-300 hover:text-cyan-200 transition-colors">View All</button>
                )}
              </div>
              {loading ? (
                <div className="grid grid-cols-2 gap-3">
                  {[0, 1].map((i) => <div key={i} className="rounded-2xl bg-white/[0.03] animate-pulse h-16" />)}
                </div>
              ) : past.length === 0 ? (
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8 text-center">
                  <p className="text-sm text-slate-500">No past trips on record.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {past.slice(0, 4).map((b, i) => (
                    <PastTripCard key={b.id} booking={b} index={i} />
                  ))}
                </div>
              )}
            </motion.div>
          </div>

          <div className="col-span-12 lg:col-span-4 space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.55, delay: 0.15, ease: "easeOut" }}
            >
              <div className="relative bg-white/[0.02] border border-white/[0.08] rounded-2xl p-5 overflow-hidden">
                <div className="pointer-events-none absolute -top-16 -right-16 w-40 h-40 bg-cyan-400/10 blur-3xl rounded-full" />
                <div className="pointer-events-none absolute -bottom-16 -left-16 w-40 h-40 bg-[#D4AF37]/10 blur-3xl rounded-full" />
                <p className="text-sm font-semibold text-white mb-4 relative">Quick Actions</p>
                <div className="grid grid-cols-3 gap-2.5 relative">
                  <QuickAction icon={<PlaneIcon />} label="Book Flight" onClick={() => router.push("/")} />
                  <QuickAction icon={<TicketIcon />} label="My Bookings" onClick={() => router.push("/my-trips")} />
                  <QuickAction icon={<CheckInIcon />} label="Check-in" onClick={() => router.push("/checkin")} />
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.55, delay: 0.2, ease: "easeOut" }}
            >
              <div className="relative bg-gradient-to-br from-cyan-400/[0.06] to-transparent border border-cyan-400/15 rounded-2xl p-5 flex items-start gap-3 overflow-hidden">
                <div className="pointer-events-none absolute -top-10 -right-10 w-32 h-32 bg-cyan-400/10 blur-2xl rounded-full" />
                <div className="relative radar-ring w-10 h-10 rounded-full bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center text-cyan-300 shrink-0" aria-hidden>
                  <BotIcon />
                </div>
                <div className="relative">
                  <p className="text-xs font-semibold text-cyan-300">Need help?</p>
                  <p className="text-sm text-slate-300 mt-1">Our support team is here for you.</p>
                  <button className="text-xs text-cyan-300 hover:text-cyan-200 transition-colors mt-2 border border-cyan-400/25 rounded-full px-3 py-1.5">
                    Chat with NavBot
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// AuroraBackdrop — drifting nebulas, twinkling starfield, shooting stars and
// a perspective grid floor. All deterministic so SSR and client agree.
// ───────────────────────────────────────────────────────────────────────────

function AuroraBackdrop() {
  const stars = useMemo(() => {
    const rand = seededRandom(1337)
    return Array.from({ length: 90 }, (_, i) => ({
      id: i,
      left: rand() * 100,
      top: rand() * 62,
      size: 1 + rand() * 1.6,
      delay: rand() * 6,
      duration: 2.5 + rand() * 4,
      opacity: 0.25 + rand() * 0.6,
    }))
  }, [])

  const shooters = [
    { top: "12%", delay: "0s", duration: "7s" },
    { top: "26%", delay: "3.5s", duration: "9s" },
    { top: "8%", delay: "6s", duration: "8s" },
  ]

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
      {/* nebulas */}
      <div className="absolute top-[-220px] left-[12%] w-[650px] h-[650px] rounded-full aurora-blob" style={{ background: "radial-gradient(circle, rgba(212,175,55,0.09) 0%, rgba(212,175,55,0.03) 45%, transparent 70%)", animationDuration: "26s" }} />
      <div className="absolute bottom-[-260px] right-[8%] w-[580px] h-[580px] rounded-full aurora-blob" style={{ background: "radial-gradient(circle, rgba(34,211,238,0.10) 0%, rgba(34,211,238,0.03) 45%, transparent 70%)", animationDuration: "32s", animationDelay: "-8s" }} />
      <div className="absolute top-[35%] left-[55%] w-[480px] h-[480px] rounded-full aurora-blob" style={{ background: "radial-gradient(circle, rgba(167,139,250,0.08) 0%, rgba(167,139,250,0.02) 45%, transparent 70%)", animationDuration: "38s", animationDelay: "-16s" }} />

      {/* starfield */}
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

      {/* shooting stars */}
      {shooters.map((sh, i) => (
        <span
          key={i}
          className="absolute h-px w-40 shooting-star"
          style={{ top: sh.top, left: "-10%", animationDelay: sh.delay, animationDuration: sh.duration }}
        />
      ))}
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// HeroHeader — radar eyebrow, giant shimmer headline, live clock, countdown
// to next departure and an airport-style departure board.
// ───────────────────────────────────────────────────────────────────────────

function HeroHeader({ nextTrip, gateMap, loading, onBook }: {
  nextTrip?: Booking
  gateMap: Record<string, string>
  loading: boolean
  onBook: () => void
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

  // Status that matches reality: a flight that's days out is "SCHEDULED",
  // check-in opens 24h before, boarding only happens close to departure.
  const statusLabel = (() => {
    if (!countdown) return "SCHEDULED"
    const totalHours = countdown.days * 24 + countdown.hours
    if (totalHours >= 24) return "SCHEDULED"
    if (totalHours >= 2) return "CHECK-IN OPEN"
    return "BOARDING"
  })()
  const statusColor =
    statusLabel === "BOARDING" ? "text-amber-300" :
    statusLabel === "CHECK-IN OPEN" ? "text-cyan-300" :
    "text-emerald-300"

  return (
    <div className="relative mb-10">
      {/* entrance plane streak */}
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
            Navigo Control Tower · Live
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.08, ease: "easeOut" }}
            className="font-cyber text-4xl sm:text-5xl xl:text-6xl font-extrabold leading-[1.04] tracking-tight mb-4"
          >
            <span className="gradient-shimmer-text">READY FOR</span>{" "}
            <span className="text-white">TAKEOFF</span>
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
              ? `Flight ${deriveFlightNumber(nextTrip.legs[0]?.airline || "", nextTrip.legs[0]?.flightInstanceId || "")} is on the board — here's your cockpit.`
              : "The sky is waiting. Plot your next escape from the cockpit."}
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
                  <p className="text-[10px] uppercase tracking-widest text-emerald-300/80">Next departure in</p>
                  <p className="font-board text-base text-emerald-300 tabular-nums font-semibold">
                    {countdown.days > 0 && <span>{pad(countdown.days)}<span className="count-colon">:</span></span>}
                    {pad(countdown.hours)}<span className="count-colon">:</span>
                    {pad(countdown.mins)}<span className="count-colon">:</span>
                    {pad(countdown.secs)}
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        </div>

        {/* airport-style departure board */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92, rotateX: -8 }}
          animate={{ opacity: 1, scale: 1, rotateX: 0 }}
          transition={{ duration: 0.7, delay: 0.3, type: "spring", stiffness: 120, damping: 16 }}
          style={{ perspective: 1000 }}
          className="w-full lg:w-[340px] shrink-0"
        >
          <div className="relative rounded-2xl overflow-hidden border border-white/[0.1] bg-[#0A1424]/90 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.08] bg-white/[0.03]">
              <p className="font-board text-[10px] uppercase tracking-[0.25em] text-amber-300">Departures</p>
              <span className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest text-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live
              </span>
            </div>

            <div className="relative px-4 py-4 scanlines">
              {loading ? (
                <div className="h-24 flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-amber-300/30 border-t-amber-300 rounded-full animate-spin" />
                </div>
              ) : nextTrip ? (
                <div className="space-y-3 board-flicker">
                  <BoardRow label="Flight" value={deriveFlightNumber(nextTrip.legs[0]?.airline || "", nextTrip.legs[0]?.flightInstanceId || "")} accent />
                  <BoardRow label="Route" value={`${nextTrip.legs[0]?.origin || "--"} → ${nextTrip.legs[0]?.destination || "--"}`} />
                  <BoardRow label="Time" value={formatTime(nextTrip.legs[0]?.departureTime)} />
                  <BoardRow label="Gate" value={nextTrip.legs[0] ? (gateMap[nextTrip.legs[0].flightInstanceId] || "TBA") : "TBA"} />
                  <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between">
                    <span className="font-board text-[10px] uppercase tracking-widest text-slate-500">Status</span>
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${statusColor}`}>{statusLabel}</span>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center">
                  <p className="font-board text-[11px] uppercase tracking-[0.2em] text-slate-400 mb-2">No departures scheduled</p>
                  <p className="text-[10px] text-slate-600">Book your escape to light up this board</p>
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
      <span className={`font-board text-sm tabular-nums font-semibold ${accent ? "text-amber-300" : "text-white"}`}>{value}</span>
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// Ticker — scrolling departure marquee.
// ───────────────────────────────────────────────────────────────────────────

function Ticker({ items }: { items: { airline: string; origin: string; destination: string; pnr?: string; status: string }[] }) {
  const doubled = [...items, ...items]
  return (
    <div className="relative mb-10 -mx-6 md:-mx-0 overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.02]">
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 z-10 bg-gradient-to-r from-[#04070F] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 z-10 bg-gradient-to-l from-[#04070F] to-transparent" />
      <div className="flex w-max marquee-track py-2.5">
        {doubled.map((item, i) => (
          <span key={i} className="flex items-center gap-3 px-5 text-xs whitespace-nowrap">
            <span className="text-amber-300" aria-hidden>✈</span>
            <span className="font-semibold text-white uppercase">{item.airline}</span>
            <span className="font-board text-cyan-300 tabular-nums">{item.origin} → {item.destination}</span>
            {item.pnr && <span className="text-slate-500 font-board">{item.pnr}</span>}
            <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
              item.status === "confirmed" ? "bg-emerald-400/15 text-emerald-300" : "bg-slate-400/15 text-slate-400"
            }`}>
              {item.status}
            </span>
            <span className="text-slate-600" aria-hidden>✦</span>
          </span>
        ))}
      </div>
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// NextTripPasses — leg tabs crossed with passenger pager, wrapped in an
// animated conic border + flight path. Logic identical to before.
// ───────────────────────────────────────────────────────────────────────────

function NextTripPasses({ booking, gateMap }: { booking: Booking; gateMap: Record<string, string> }) {
  const hasMultipleLegs = booking.legs.length > 1
  const hasMultiplePassengers = booking.passengers.length > 1

  const [activeLegIdx, setActiveLegIdx] = useState(0)
  const [activePaxIdx, setActivePaxIdx] = useState(0)

  const leg = booking.legs[activeLegIdx]
  const passenger = booking.passengers[activePaxIdx]

  const seat = useMemo(() => {
    if (!leg || !passenger) return undefined
    return booking.seats.find(
      (s) => s.flightInstanceId === leg.flightInstanceId && s.passengerId === passenger.id
    )?.seatNumber
  }, [booking.seats, leg, passenger])

  if (!leg) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 26, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 160, damping: 20, delay: 0.15 }}
      className="relative"
    >
      {/* soft glow behind the pass */}
      <div className="pointer-events-none absolute -inset-6 rounded-[32px] bg-gradient-to-r from-amber-400/[0.07] via-cyan-400/[0.07] to-violet-400/[0.07] blur-2xl" aria-hidden />

      {/* route divider — static line, no flying plane (the flight is days away) */}
      <div className="relative flex items-center gap-4 px-2 mb-3" aria-hidden>
        <span className="font-board text-[11px] uppercase tracking-[0.2em] text-slate-500">{leg.origin}</span>
        <div className="relative flex-1 h-8">
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 300 30" fill="none" preserveAspectRatio="none">
            <path
              d="M2 15 L 298 15"
              stroke="rgba(34,211,238,0.35)"
              strokeWidth="1.5"
              strokeDasharray="4 6"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <span className="font-board text-[11px] uppercase tracking-[0.2em] text-cyan-300">{leg.destination}</span>
      </div>

      <div className="relative space-y-3 rounded-[20px]">
        {(hasMultipleLegs || hasMultiplePassengers) && (
          <div className="flex items-center justify-between flex-wrap gap-2">
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
                    {l.legLabel || "Flight"}
                  </button>
                ))}
              </div>
            )}

            {hasMultiplePassengers && (
              <div className="inline-flex items-center gap-1.5">
                <span className="text-[10px] uppercase tracking-widest text-slate-500 mr-1">Passenger</span>
                {booking.passengers.map((p, i) => (
                  <button
                    key={p.id}
                    onClick={() => setActivePaxIdx(i)}
                    className={`w-7 h-7 rounded-full text-[11px] font-bold flex items-center justify-center transition-all shrink-0 ${
                      activePaxIdx === i
                        ? "bg-[#D4AF37]/25 text-[#E8C766] border border-[#D4AF37]/50 shadow-[0_0_12px_rgba(212,175,55,0.35)]"
                        : "bg-white/[0.04] text-slate-400 border border-white/[0.08] hover:text-white"
                    }`}
                    title={p.name}
                  >
                    {p.name.slice(0, 1).toUpperCase()}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="rounded-[18px] overflow-hidden">
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

function UpcomingRow({ booking, index = 0 }: { booking: Booking; index?: number }) {
  const firstLeg = booking.legs[0]
  if (!firstLeg) return null
  const lastLeg = booking.legs[booking.legs.length - 1]
  return (
    <motion.div
      initial={{ opacity: 0, x: -14 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: 0.08 * index }}
      whileHover={{ x: 6 }}
      className="group relative flex items-center gap-3.5 bg-white/[0.02] border border-white/[0.08] rounded-xl p-3.5 hover:border-cyan-400/30 transition-colors overflow-hidden"
    >
      <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-cyan-400/[0.06] to-transparent" />
      <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center overflow-hidden shrink-0 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
        <img src={airlineLogos[firstLeg.airline] || "/airlines/default.png"} alt={firstLeg.airline} className="w-6 h-6 object-contain" />
      </div>
      <div className="min-w-0 flex-1 relative">
        <p className="text-sm font-semibold text-white truncate">
          {firstLeg.airline} · {firstLeg.origin} → {lastLeg.destination}
          {booking.legs.length > 1 ? " (round trip)" : ""}
        </p>
        <p className="text-xs text-slate-500">
          {formatDateLong(firstLeg.travelDate)}{booking.pnr ? ` · PNR ${booking.pnr}` : ""}
          {booking.passengers.length > 1 ? ` · ${booking.passengers.length} passengers` : ""}
        </p>
      </div>
      <span className="relative text-[10px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full bg-emerald-400/15 text-emerald-300 border border-emerald-400/25 shrink-0 group-hover:shadow-[0_0_14px_rgba(52,211,153,0.3)] transition-shadow">
        {booking.status}
      </span>
    </motion.div>
  )
}

function StatCard({ icon, label, value, sub, accent }: {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
  accent: "gold" | "cyan" | "violet" | "rose"
}) {
  const numeric = /^\d+$/.test(value)
  const { ref, val } = useCountUp(numeric ? Number(value) : 0)

  const accentStyles: Record<string, { icon: string; glow: string; ring: string }> = {
    gold: { icon: "bg-[#D4AF37]/10 border-[#D4AF37]/20 text-[#E8C766]", glow: "group-hover:shadow-[0_0_32px_rgba(212,175,55,0.22)]", ring: "group-hover:border-[#D4AF37]/40" },
    cyan: { icon: "bg-cyan-400/10 border-cyan-400/20 text-cyan-300", glow: "group-hover:shadow-[0_0_32px_rgba(34,211,238,0.22)]", ring: "group-hover:border-cyan-400/40" },
    violet: { icon: "bg-violet-400/10 border-violet-400/20 text-violet-300", glow: "group-hover:shadow-[0_0_32px_rgba(167,139,250,0.22)]", ring: "group-hover:border-violet-400/40" },
    rose: { icon: "bg-rose-400/10 border-rose-400/20 text-rose-300", glow: "group-hover:shadow-[0_0_32px_rgba(251,113,133,0.22)]", ring: "group-hover:border-rose-400/40" },
  }
  const s = accentStyles[accent]

  return (
    <motion.div
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      whileHover={{ y: -4, scale: 1.02 }}
      className={`group relative bg-white/[0.02] border border-white/[0.08] rounded-2xl p-4 transition-all duration-300 ${s.glow} ${s.ring}`}
    >
      <div className="pointer-events-none absolute -top-10 -right-10 w-28 h-28 rounded-full opacity-0 group-hover:opacity-100 blur-2xl transition-opacity duration-500 stat-glow-bg" style={{ background: "radial-gradient(circle, rgba(255,255,255,0.10), transparent 70%)" }} />
      <div className="flex items-center gap-2.5 mb-2">
        <span className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6 ${s.icon}`}>{icon}</span>
        <p className="text-[11px] text-slate-500 uppercase tracking-wide">{label}</p>
      </div>
      <p className="font-display text-2xl font-extrabold text-white tabular-nums">
        {numeric ? <span ref={ref}>{val}</span> : value}
      </p>
      <p className="text-xs text-slate-500 mt-0.5">{sub}</p>
    </motion.div>
  )
}

function PastTripCard({ booking, index = 0 }: { booking: Booking; index?: number }) {
  const firstLeg = booking.legs[0]
  if (!firstLeg) return null
  const lastLeg = booking.legs[booking.legs.length - 1]
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.07 * index }}
      whileHover={{ y: -3, scale: 1.02 }}
      className="group relative flex items-center gap-3 bg-white/[0.02] border border-white/[0.08] rounded-xl p-3.5 hover:border-violet-400/30 hover:shadow-[0_0_24px_rgba(167,139,250,0.15)] transition-all overflow-hidden"
    >
      <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center overflow-hidden shrink-0 group-hover:scale-110 transition-transform duration-300">
        <img src={airlineLogos[firstLeg.airline] || "/airlines/default.png"} alt={firstLeg.airline} className="w-5 h-5 object-contain" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-white truncate">{firstLeg.origin} → {lastLeg.destination}</p>
        <p className="text-[11px] text-slate-500">{formatDate(firstLeg.travelDate)}</p>
      </div>
    </motion.div>
  )
}

function QuickAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <motion.button
      whileHover={{ y: -4, scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="group relative flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/[0.03] border border-white/[0.08] hover:border-amber-400/40 hover:shadow-[0_0_28px_rgba(251,191,36,0.2)] transition-all overflow-hidden"
    >
      <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br from-amber-400/[0.08] to-cyan-400/[0.08]" />
      <span className="relative text-[#E8C766] group-hover:scale-125 group-hover:-rotate-6 transition-transform duration-300">{icon}</span>
      <span className="relative text-[10px] text-slate-300 text-center leading-tight group-hover:text-white transition-colors">{label}</span>
    </motion.button>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// Icons
// ───────────────────────────────────────────────────────────────────────────

function PlaneGlyph({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
    </svg>
  )
}

function SuitcaseIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" /><path d="M3 12h18" /></svg>
}
function CalendarIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
}
function StarIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" /></svg>
}
function TagIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20.6 12.6l-8-8H4v8.6l8 8a2 2 0 002.8 0l5.8-5.8a2 2 0 000-2.8z" /><circle cx="8.5" cy="8.5" r="1" fill="currentColor" stroke="none" /></svg>
}
function PlaneIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 19l19-7-19-7 3 7-3 7z" /></svg>
}
function TicketIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8a2 2 0 012-2h14a2 2 0 012 2v2a2 2 0 000 4v2a2 2 0 01-2 2H5a2 2 0 01-2-2v-2a2 2 0 000-4V8z" /></svg>
}
function CheckInIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" /></svg>
}
function BotIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="8" width="16" height="11" rx="2" /><path d="M12 4v4" /><circle cx="12" cy="3" r="1" fill="currentColor" stroke="none" /></svg>
}
function ClockIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-amber-300"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
}
function RadarIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-300"><circle cx="12" cy="12" r="9" /><path d="M12 12l5-5" /><path d="M12 3a9 9 0 019 9" /></svg>
}

// ───────────────────────────────────────────────────────────────────────────
// PageStyles — fonts + every keyframe this page uses. Reduced-motion aware.
// ───────────────────────────────────────────────────────────────────────────

function PageStyles() {
  return (
    <style jsx global>{`
      @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@700;800&family=Unbounded:wght@600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap');
      .font-display { font-family: 'Manrope', ui-sans-serif, system-ui, sans-serif; letter-spacing: -0.01em; }
      .font-cyber { font-family: 'Unbounded', 'Manrope', ui-sans-serif, system-ui, sans-serif; letter-spacing: -0.02em; }
      .font-board { font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, monospace; }

      .pill-cta {
        background: linear-gradient(90deg, #38BDF8 0%, #60A5FA 30%, #D4AF37 70%, #FBBF24 100%);
        color: #060B14;
      }
      .pill-cta:hover { filter: brightness(1.06); }

      .grain-layer {
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E");
      }

      /* ── aurora blobs ── */
      @keyframes auroraDrift {
        0%, 100% { transform: translate(0, 0) scale(1); }
        33% { transform: translate(40px, -30px) scale(1.08); }
        66% { transform: translate(-30px, 24px) scale(0.95); }
      }
      .aurora-blob { animation: auroraDrift 26s ease-in-out infinite; will-change: transform; }

      /* ── starfield ── */
      @keyframes starTwinkle {
        0%, 100% { opacity: 0.15; transform: scale(0.8); }
        50% { opacity: 1; transform: scale(1.15); }
      }
      .star-twinkle { animation: starTwinkle 4s ease-in-out infinite; }

      /* ── shooting stars ── */
      @keyframes shootingStar {
        0% { transform: translateX(0) translateY(0) rotate(-25deg); opacity: 0; }
        8% { opacity: 1; }
        30% { transform: translateX(70vw) translateY(30vh) rotate(-25deg); opacity: 0; }
        100% { transform: translateX(70vw) translateY(30vh) rotate(-25deg); opacity: 0; }
      }
      .shooting-star {
        background: linear-gradient(90deg, rgba(255,255,255,0.9), transparent);
        border-radius: 9999px;
        animation: shootingStar 8s linear infinite;
      }

      /* ── shimmer headline ── */
      @keyframes shimmerShift { to { background-position: 200% center; } }
      .gradient-shimmer-text {
        background: linear-gradient(90deg, #FBBF24, #FDE68A, #38BDF8, #A78BFA, #FBBF24);
        background-size: 200% auto;
        -webkit-background-clip: text;
        background-clip: text;
        -webkit-text-fill-color: transparent;
        color: transparent;
        animation: shimmerShift 6s linear infinite;
      }

      /* ── floating plane / bob ── */
      @keyframes floatBob {
        0%, 100% { transform: translateY(0) rotate(-3deg); }
        50% { transform: translateY(-8px) rotate(4deg); }
      }
      .float-bob { animation: floatBob 3.4s ease-in-out infinite; }

      /* ── marquee ── */
      @keyframes marqueeScroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
      .marquee-track { animation: marqueeScroll 28s linear infinite; }
      .marquee-track:hover { animation-play-state: paused; }

      /* ── departure board flicker + scanlines ── */
      @keyframes boardFlicker {
        0%, 100% { opacity: 1; }
        92% { opacity: 1; }
        93% { opacity: 0.82; }
        94% { opacity: 1; }
        97% { opacity: 0.9; }
      }
      .board-flicker { animation: boardFlicker 5s linear infinite; }
      .scanlines {
        background-image: repeating-linear-gradient(
          to bottom,
          rgba(255,255,255,0.022) 0px,
          rgba(255,255,255,0.022) 1px,
          transparent 1px,
          transparent 4px
        );
      }

      /* ── radar ring ── */
      @keyframes radarSweep {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      .radar-ring::after {
        content: "";
        position: absolute;
        inset: 0;
        border-radius: 9999px;
        background: conic-gradient(from 0deg, transparent 0deg, rgba(34,211,238,0.5) 40deg, transparent 80deg);
        animation: radarSweep 3s linear infinite;
        mask-image: radial-gradient(circle, transparent 62%, black 64%);
        -webkit-mask-image: radial-gradient(circle, transparent 62%, black 64%);
      }

      /* ── glowing CTA ── */
      @keyframes glowPulse {
        0%, 100% { box-shadow: 0 0 18px rgba(251,191,36,0.35), 0 0 42px rgba(56,189,248,0.15); }
        50% { box-shadow: 0 0 30px rgba(251,191,36,0.55), 0 0 64px rgba(56,189,248,0.28); }
      }
      .glow-cta { animation: glowPulse 2.6s ease-in-out infinite; }

      /* ── countdown colon pulse ── */
      @keyframes colonBlink { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
      .count-colon { animation: colonBlink 1s steps(1) infinite; }

      /* ── empty-state shimmer sweep ── */
      @keyframes heroShimmer {
        from { background-position: -200% 0; }
        to { background-position: 200% 0; }
      }
      .hero-shimmer-bg {
        background: linear-gradient(100deg, transparent 30%, rgba(255,255,255,0.05) 50%, transparent 70%);
        background-size: 200% 100%;
        animation: heroShimmer 3.5s linear infinite;
      }

      @media (prefers-reduced-motion: reduce) {
        .aurora-blob, .star-twinkle, .shooting-star, .gradient-shimmer-text,
        .float-bob, .marquee-track, .board-flicker, .radar-ring::after,
        .glow-cta, .count-colon, .hero-shimmer-bg {
          animation: none !important;
        }
      }
    `}</style>
  )
}
