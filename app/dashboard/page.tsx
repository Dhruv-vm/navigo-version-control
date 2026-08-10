"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
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

  return (
    <div className="min-h-screen bg-[#060B14] text-white relative overflow-x-hidden">
      <PageStyles />
      <div className="pointer-events-none fixed inset-0 opacity-[0.05] mix-blend-overlay grain-layer" />
      <div className="pointer-events-none fixed top-[-200px] left-[15%] w-[600px] h-[600px] bg-[#D4AF37]/[0.05] blur-[160px] rounded-full" />
      <div className="pointer-events-none fixed bottom-[-200px] right-[10%] w-[500px] h-[500px] bg-cyan-400/[0.05] blur-[160px] rounded-full" />

      <Navbar />

      <div className="relative max-w-[1400px] mx-auto px-6 pt-24 pb-16">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
          <div>
            <h1 className="font-display text-2xl font-extrabold">Welcome back <span aria-hidden>✈️</span></h1>
            <p className="text-sm text-slate-500 mt-1">Here's what's happening with your trips.</p>
          </div>
          <button
            onClick={() => router.push("/")}
            className="px-5 py-2.5 rounded-full pill-cta text-sm font-semibold"
          >
            Book a Flight
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard icon={<SuitcaseIcon />} label="Total Trips" value={String((bookings || []).length)} sub="All time" />
          <StatCard icon={<CalendarIcon />} label="Upcoming Trips" value={String(upcoming.length)} sub={nextTrip?.travelDate ? `Next: ${formatDate(nextTrip.travelDate)}` : "None scheduled"} />
          <StatCard icon={<StarIcon />} label="Past Trips" value={String(past.length)} sub="Completed" />
          <StatCard icon={<TagIcon />} label="NavPoints" value="—" sub="Coming soon" />
        </div>

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-8 space-y-6">
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="font-display text-lg font-bold text-white">Upcoming Trips</p>
                {upcoming.length > 0 && (
                  <button onClick={() => router.push("/my-trips")} className="text-xs text-cyan-300 hover:text-cyan-200 transition-colors">View All</button>
                )}
              </div>

              {loading ? (
                <div className="rounded-2xl bg-white/[0.03] animate-pulse h-64" />
              ) : !nextTrip ? (
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-10 text-center">
                  <p className="text-sm text-slate-500 mb-3">No upcoming trips yet.</p>
                  <button onClick={() => router.push("/")} className="px-4 py-2 rounded-full pill-cta text-xs font-semibold">
                    Search Flights
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
                      {restUpcoming.map((b) => (
                        <UpcomingRow key={b.id} booking={b} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
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
                  {past.slice(0, 4).map((b) => (
                    <PastTripCard key={b.id} booking={b} />
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="col-span-12 lg:col-span-4 space-y-6">
            <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-5">
              <p className="text-sm font-semibold text-white mb-4">Quick Actions</p>
              <div className="grid grid-cols-3 gap-2.5">
                <QuickAction icon={<PlaneIcon />} label="Book Flight" onClick={() => router.push("/")} />
                <QuickAction icon={<TicketIcon />} label="My Bookings" onClick={() => router.push("/my-trips")} />
                <QuickAction icon={<CheckInIcon />} label="Check-in" onClick={() => router.push("/checkin")} />
              </div>
            </div>

            <div className="bg-gradient-to-br from-cyan-400/[0.06] to-transparent border border-cyan-400/15 rounded-2xl p-5 flex items-start gap-3">
              <span className="w-9 h-9 rounded-full bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center text-cyan-300 shrink-0" aria-hidden><BotIcon /></span>
              <div>
                <p className="text-xs font-semibold text-cyan-300">Need help?</p>
                <p className="text-sm text-slate-300 mt-1">Our support team is here for you.</p>
                <button className="text-xs text-cyan-300 hover:text-cyan-200 transition-colors mt-2 border border-cyan-400/25 rounded-full px-3 py-1.5">Chat with NavBot</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// NextTripPasses — leg tabs (Departure / Return) crossed with a passenger
// pager when there's more than one traveler. Each combination renders a
// real BoardingPassCard with its seat resolved from booking_seats, gate
// resolved from the live gate fetch, and flight number derived the same
// way the payment page derives it.
// ---------------------------------------------------------------------------
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
    <div className="space-y-3">
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
                      ? "text-[#060B14] bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500"
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
                      ? "bg-[#D4AF37]/25 text-[#E8C766] border border-[#D4AF37]/50"
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
  )
}

function UpcomingRow({ booking }: { booking: Booking }) {
  const firstLeg = booking.legs[0]
  if (!firstLeg) return null
  const lastLeg = booking.legs[booking.legs.length - 1]
  return (
    <div className="flex items-center gap-3.5 bg-white/[0.02] border border-white/[0.08] rounded-xl p-3.5 hover:border-white/20 transition-colors">
      <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center overflow-hidden shrink-0">
        <img src={airlineLogos[firstLeg.airline] || "/airlines/default.png"} alt={firstLeg.airline} className="w-6 h-6 object-contain" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white truncate">
          {firstLeg.airline} · {firstLeg.origin} → {lastLeg.destination}
          {booking.legs.length > 1 ? " (round trip)" : ""}
        </p>
        <p className="text-xs text-slate-500">
          {formatDateLong(firstLeg.travelDate)}{booking.pnr ? ` · PNR ${booking.pnr}` : ""}
          {booking.passengers.length > 1 ? ` · ${booking.passengers.length} passengers` : ""}
        </p>
      </div>
      <span className="text-[10px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full bg-emerald-400/15 text-emerald-300 border border-emerald-400/25 shrink-0">
        {booking.status}
      </span>
    </div>
  )
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-4">
      <div className="flex items-center gap-2.5 mb-2">
        <span className="w-8 h-8 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/20 flex items-center justify-center text-[#E8C766]">{icon}</span>
        <p className="text-[11px] text-slate-500 uppercase tracking-wide">{label}</p>
      </div>
      <p className="font-display text-2xl font-extrabold text-white">{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{sub}</p>
    </div>
  )
}

function PastTripCard({ booking }: { booking: Booking }) {
  const firstLeg = booking.legs[0]
  if (!firstLeg) return null
  const lastLeg = booking.legs[booking.legs.length - 1]
  return (
    <div className="flex items-center gap-3 bg-white/[0.02] border border-white/[0.08] rounded-xl p-3.5 hover:border-white/20 transition-colors">
      <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center overflow-hidden shrink-0">
        <img src={airlineLogos[firstLeg.airline] || "/airlines/default.png"} alt={firstLeg.airline} className="w-5 h-5 object-contain" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-white truncate">{firstLeg.origin} → {lastLeg.destination}</p>
        <p className="text-[11px] text-slate-500">{formatDate(firstLeg.travelDate)}</p>
      </div>
    </div>
  )
}

function QuickAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/[0.03] border border-white/[0.08] hover:border-[#D4AF37]/30 hover:bg-white/[0.05] transition-colors"
    >
      <span className="text-[#E8C766]">{icon}</span>
      <span className="text-[10px] text-slate-300 text-center leading-tight">{label}</span>
    </button>
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

function PageStyles() {
  return (
    <style jsx global>{`
      @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@700;800&display=swap');
      .font-display { font-family: 'Manrope', ui-sans-serif, system-ui, sans-serif; letter-spacing: -0.01em; }
      .pill-cta {
        background: linear-gradient(90deg, #38BDF8 0%, #60A5FA 30%, #D4AF37 70%, #FBBF24 100%);
        color: #060B14;
      }
      .pill-cta:hover { filter: brightness(1.06); }
      .grain-layer {
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E");
      }
    `}</style>
  )
}