"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Navbar from "@/components/navbar"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type StoredFlight = {
  id: string | number
  flight_instance_id?: string | number
  airline: string
  origin: string
  destination: string
  departure_time: string
  arrival_time: string
  aircraft: string
  stops?: number
  final_price: number
  base_price?: number
  available_seats?: number
  duration?: string
  travel_date?: string
}

// Raw shape as it comes back from booking_passenger via Supabase
// (snake_case — matches the table columns exactly).
type StoredPassenger = {
  id: string
  booking_id?: string
  passenger_index?: number
  passenger_type?: string
  age?: number | null
  title?: string
  first_name: string
  middle_name?: string | null
  last_name: string
  date_of_birth?: string | null
  gender?: string | null
  nationality?: string | null
  frequent_flyer?: string | null
  email?: string | null
  country_code?: string | null
  mobile?: string | null
  is_primary_contact?: boolean
  // tolerate camelCase too, in case an older draft from the passengers page
  // (client-side localId-based shape) ends up in sessionStorage
  firstName?: string
  lastName?: string
  type?: string
}

type CheckoutSelection = {
  departFlight: StoredFlight
  returnFlight: StoredFlight | null
  passengers: number
  mode: string
  totalPrice: number
  origin: string | null
  destination: string | null
  savedAt: number
  bookingId?: string
  savedPassengers?: StoredPassenger[]
}

type ApiSeat = {
  id: string
  seatNumber: string
  row: number
  col: string
  cabinClass: string
  seatType: string
  price: number
  isWindow: boolean
  isAisle: boolean
  isAvailable: boolean
  isMine: boolean
  myPassengerId: string | null
}

type LegSeatMap = {
  flightInstanceId: string
  flight: StoredFlight
  label: string
  seats: ApiSeat[]
  hasSeatMap: boolean
}

type SelectionMap = Record<string, string>

const STORAGE_KEY = "navigo:checkoutSelection"

// Same logo map used on the passenger-details page and FlightCard —
// kept in sync here so the flight info bar shows the real airline logo
// instead of two-letter initials.
const airlineLogos: Record<string, string> = {
  "IndiGo": "/airlines/indigo.png",
  "Air India": "/airlines/airindia.png",
  "Vistara": "/airlines/vistara.png",
  "Akasa Air": "/airlines/akasa.png",
  "Emirates": "/airlines/emirates.png",
  "Qatar Airways": "/airlines/qatar.png",
}

// ---------------------------------------------------------------------------
// Passenger name helpers — normalizes either snake_case (DB / booking_passenger)
// or camelCase (older client-only draft) shapes into display-ready strings.
// ---------------------------------------------------------------------------

function paxFirstName(p: StoredPassenger, fallbackIndex: number): string {
  return p.first_name || p.firstName || `Passenger`
}

function paxLastName(p: StoredPassenger, fallbackIndex: number): string {
  return p.last_name || p.lastName || `${fallbackIndex + 1}`
}

function paxInitials(p: StoredPassenger, fallbackIndex: number): string {
  const f = paxFirstName(p, fallbackIndex)
  const l = paxLastName(p, fallbackIndex)
  return `${f[0] ?? "P"}${l[0] ?? ""}`.toUpperCase()
}

function paxFullName(p: StoredPassenger, fallbackIndex: number): string {
  return `${paxFirstName(p, fallbackIndex)} ${paxLastName(p, fallbackIndex)}`.trim()
}

// ---------------------------------------------------------------------------
// Date/time helpers
// ✅ FIXED — DB stores departure_time / arrival_time as plain "HH:MM:SS"
// (Postgres `time` column), NOT as ISO datetime strings. `new Date("06:00:00")`
// is an Invalid Date, which is why the previous version of this page showed
// "Invalid Date" in the flight info bar. Same fix already applied on the
// passenger details page — ported here.
// ---------------------------------------------------------------------------

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

  const d = new Date(timeStr)
  if (isNaN(d.getTime())) return "--:--"
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

function formatDateLabel(timeStr?: string, travelDate?: string): string {
  const source = travelDate || timeStr
  if (!source) return ""
  if (/^\d{1,2}:\d{2}/.test(source) && !travelDate) return ""
  const d = new Date(source)
  if (isNaN(d.getTime())) return ""
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })
}

function formatDuration(flight: StoredFlight): string {
  if (flight.duration) return flight.duration
  const dep = parseTimeToMinutes(flight.departure_time)
  const arr = parseTimeToMinutes(flight.arrival_time)
  if (dep === null || arr === null) return "--"
  let diff = arr - dep
  if (diff < 0) diff += 24 * 60
  const h = Math.floor(diff / 60)
  const m = diff % 60
  return `${h}h ${m}m`
}

function parseTimeToMinutes(timeStr?: string): number | null {
  if (!timeStr) return null
  const match = timeStr.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
  if (!match) return null
  return Number(match[1]) * 60 + Number(match[2])
}

// ---------------------------------------------------------------------------
// Cabin class config (UI only — doesn't affect API)
// ---------------------------------------------------------------------------

const CABIN_CLASSES = [
  { key: "economy",         label: "Economy",         icon: "✦", fromPrice: "₹2,500" },
  { key: "premium_economy", label: "Premium Economy", icon: "✦✦", fromPrice: "₹6,000" },
  { key: "business",        label: "Business",        icon: "✦✦✦", fromPrice: "₹12,000" },
  { key: "first",           label: "First Class",     icon: "✦✦✦✦", fromPrice: "₹28,000" },
] as const

type CabinKey = (typeof CABIN_CLASSES)[number]["key"]

// Colours cycling per passenger index
const PAX_COLORS = [
  { ring: "border-cyan-400",   bg: "bg-cyan-400/10",   text: "text-cyan-300",   badge: "bg-cyan-400/20 text-cyan-200",   dot: "bg-cyan-400",   glow: "shadow-[0_0_18px_rgba(34,211,238,0.35)]"   },
  { ring: "border-violet-400", bg: "bg-violet-400/10", text: "text-violet-300", badge: "bg-violet-400/20 text-violet-200", dot: "bg-violet-400", glow: "shadow-[0_0_18px_rgba(167,139,250,0.35)]" },
  { ring: "border-rose-400",   bg: "bg-rose-400/10",   text: "text-rose-300",   badge: "bg-rose-400/20 text-rose-200",   dot: "bg-rose-400",   glow: "shadow-[0_0_18px_rgba(251,113,133,0.35)]"  },
  { ring: "border-emerald-400",bg: "bg-emerald-400/10",text: "text-emerald-300",badge: "bg-emerald-400/20 text-emerald-200",dot: "bg-emerald-400",glow: "shadow-[0_0_18px_rgba(52,211,153,0.35)]"  },
]

function paxColor(index: number) {
  return PAX_COLORS[index % PAX_COLORS.length]
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SeatSelectionPage() {
  const router = useRouter()

  const [selection, setSelection] = useState<CheckoutSelection | null>(null)
  const [loadState, setLoadState] = useState<"loading" | "found" | "missing">("loading")

  const [legs, setLegs] = useState<LegSeatMap[]>([])
  const [legsLoading, setLegsLoading] = useState(true)
  const [legsError, setLegsError] = useState<string | null>(null)

  const [activeLegIndex, setActiveLegIndex] = useState(0)
  const [activePassengerIndex, setActivePassengerIndex] = useState(0)
  const [picks, setPicks] = useState<SelectionMap>({})
  const [activeCabin, setActiveCabin] = useState<CabinKey>("economy")

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // ---- hydrate selection from sessionStorage --------------------------------
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      if (!raw) { setLoadState("missing"); return }
      const parsed = JSON.parse(raw) as CheckoutSelection
      if (!parsed.bookingId) { setLoadState("missing"); return }

      // ✅ DEBUG LOG — if names show as "Passenger 1/2" in the UI, check this
      // log first: if savedPassengers is empty/undefined here, the bookings
      // POST route isn't returning passenger rows after insert (fix there,
      // not in this page). If it HAS data, check the field names match
      // first_name/last_name as printed below.
      console.log("[seats] savedPassengers from storage:", parsed.savedPassengers)

      setSelection(parsed)
      setLoadState("found")
    } catch (err) {
      console.error("Failed to read checkout selection:", err)
      setLoadState("missing")
    }
  }, [])

  // ---- fetch seat maps ------------------------------------------------------
  useEffect(() => {
    if (loadState !== "found" || !selection) return

    const fetchLegs = async () => {
      setLegsLoading(true)
      setLegsError(null)

      const legsToFetch: { flight: StoredFlight; label: string }[] = [
        { flight: selection.departFlight, label: "Departure" },
      ]
      if (selection.returnFlight) {
        legsToFetch.push({ flight: selection.returnFlight, label: "Return" })
      }

      try {
        const results = await Promise.all(
          legsToFetch.map(async ({ flight, label }) => {
            // ✅ FIXED — prefer flight_instance_id when present. StoredFlight
            // from the flight-selection step may carry a separate
            // flight_instance_id distinct from `id`; sending the wrong one
            // here is the most common reason flight_instance_classes comes
            // back empty (hasSeatMap: false) even when rows exist in
            // Supabase for the *correct* instance id. If your flight cards
            // only ever set `id` to the instance id already, this is a
            // no-op fallback.
            const instanceId = String(flight.flight_instance_id ?? flight.id)

            console.log(`[seats] fetching seat map for ${label} leg, instanceId:`, instanceId)

            const res = await fetch(
              `/api/flights/${instanceId}/seats?bookingId=${selection.bookingId}`
            )
            const data = await res.json()
            if (!res.ok) throw new Error(data?.error || `Failed to load seats for ${label.toLowerCase()} flight`)

            console.log(`[seats] ${label} leg hasSeatMap:`, data.hasSeatMap, "seat count:", data.seats?.length ?? 0)

            return {
              flightInstanceId: instanceId,
              flight,
              label,
              seats: data.seats as ApiSeat[],
              hasSeatMap: data.hasSeatMap as boolean,
            }
          })
        )

        setLegs(results)

        // Detect cabin class from seat data and set active tab
        if (results[0]?.seats?.length) {
          const firstCabin = results[0].seats[0].cabinClass as CabinKey
          if (firstCabin) setActiveCabin(firstCabin)
        }

        setPicks((prev) => {
          const next = { ...prev }
          results.forEach((leg, legIndex) => {
            leg.seats.forEach((seat) => {
              if (seat.isMine && seat.myPassengerId) {
                next[`${legIndex}:${seat.myPassengerId}`] = seat.id
              }
            })
          })
          return next
        })
      } catch (err: any) {
        console.error("Failed to fetch seat maps:", err)
        setLegsError(err?.message || "Couldn't load seat maps. Please try again.")
      } finally {
        setLegsLoading(false)
      }
    }

    fetchLegs()
  }, [loadState, selection])

  const passengers: StoredPassenger[] = useMemo(() => {
    if (selection?.savedPassengers?.length) return selection.savedPassengers
    const count = selection?.passengers || 1
    return Array.from({ length: count }, (_, i) => ({
      id: `passenger-${i}`,
      first_name: "Passenger",
      last_name: `${i + 1}`,
      passenger_type: "adult",
    }))
  }, [selection])

  const activeLeg = legs[activeLegIndex]
  const activePassenger = passengers[activePassengerIndex]

  // Filter seats by active cabin tab
  const visibleSeats = useMemo(() => {
    if (!activeLeg) return []
    const cabinSeats = activeLeg.seats.filter((s) => s.cabinClass === activeCabin)
    // If no seats match the active cabin, show all (fallback)
    return cabinSeats.length > 0 ? cabinSeats : activeLeg.seats
  }, [activeLeg, activeCabin])

  // Derive which cabin classes exist in the seat data
  const availableCabins = useMemo(() => {
    if (!activeLeg) return []
    const found = new Set(activeLeg.seats.map((s) => s.cabinClass))
    return CABIN_CLASSES.filter((c) => found.has(c.key))
  }, [activeLeg])

  const totalSeatPrice = useMemo(() => {
    let total = 0
    legs.forEach((leg, legIndex) => {
      passengers.forEach((p) => {
        const seatId = picks[`${legIndex}:${p.id}`]
        const seat = leg.seats.find((s) => s.id === seatId)
        if (seat) total += seat.price
      })
    })
    return total
  }, [legs, passengers, picks])

  const allSeatsAssigned = useMemo(() => {
    return legs
      .map((leg, i) => ({ leg, i }))
      .filter(({ leg }) => leg.hasSeatMap)
      .every(({ i }) => passengers.every((p) => !!picks[`${i}:${p.id}`]))
  }, [legs, passengers, picks])

  function selectSeat(seat: ApiSeat) {
    if (!seat.isAvailable) return
    const key = `${activeLegIndex}:${activePassenger.id}`

    setPicks((prev) => {
      const next = { ...prev }
      // Release the seat from any other passenger on this leg
      Object.keys(next).forEach((k) => {
        if (k.startsWith(`${activeLegIndex}:`) && next[k] === seat.id) delete next[k]
      })
      next[key] = seat.id

      // Auto-advance to next passenger without a seat, then next leg
      const nextPaxIdx = passengers.findIndex(
        (p, i) => i > activePassengerIndex && !next[`${activeLegIndex}:${p.id}`]
      )
      if (nextPaxIdx !== -1) {
        setActivePassengerIndex(nextPaxIdx)
      } else if (activeLegIndex < legs.length - 1) {
        setActiveLegIndex(activeLegIndex + 1)
        setActivePassengerIndex(0)
      }
      return next
    })
  }

  async function handleContinue() {
    if (!selection?.bookingId || !allSeatsAssigned) return
    setSubmitting(true)
    setSubmitError(null)

    try {
      const payload = {
        legs: legs
          .map((leg, originalIndex) => ({ leg, originalIndex }))
          .filter(({ leg }) => leg.hasSeatMap)
          .map(({ leg, originalIndex }) => ({
            flightInstanceId: leg.flightInstanceId,
            seats: passengers
              .map((p) => {
                const seatId = picks[`${originalIndex}:${p.id}`]
                const seat = leg.seats.find((s) => s.id === seatId)
                if (!seat) return null
                return { passengerId: p.id, seatId: seat.id, seatNumber: seat.seatNumber, price: seat.price }
              })
              .filter((s): s is NonNullable<typeof s> => s !== null),
          })),
      }

      if (payload.legs.every((l) => l.seats.length === 0)) {
        router.push("/checkout/addons")
        return
      }

      const res = await fetch(`/api/bookings/${selection.bookingId}/seats`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()

      if (!res.ok) {
        setSubmitError(data?.error || "Couldn't save your seat selection. Please try again.")
        if (data?.conflict) {
          setLegsLoading(true)
          const refreshed = await Promise.all(
            legs.map(async (leg) => {
              const r = await fetch(`/api/flights/${leg.flightInstanceId}/seats?bookingId=${selection.bookingId}`)
              const d = await r.json()
              return { ...leg, seats: d.seats as ApiSeat[], hasSeatMap: d.hasSeatMap }
            })
          )
          setLegs(refreshed)
          setLegsLoading(false)
        }
        setSubmitting(false)
        return
      }

      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(selection))
      router.push("/checkout/addons")
    } catch (err) {
      console.error("Failed to save seat selection:", err)
      setSubmitError("Something went wrong saving your seats. Please try again.")
      setSubmitting(false)
    }
  }

  // ---- render states -------------------------------------------------------

  if (loadState === "loading") {
    return <PageShell><CenteredMessage text="Preparing your itinerary…" /></PageShell>
  }

  if (loadState === "missing" || !selection) {
    return (
      <PageShell>
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
          <p className="text-slate-400">We couldn't find an active booking with passenger details saved.</p>
          <button
            onClick={() => router.push("/checkout/passengers")}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 text-[#060B14] font-semibold"
          >
            Go to Passenger Details
          </button>
        </div>
      </PageShell>
    )
  }

  if (legsLoading) {
    return (
      <PageShell selection={selection} router={router}>
        <CenteredMessage text="Loading seat maps…" />
      </PageShell>
    )
  }

  if (legsError) {
    return (
      <PageShell selection={selection} router={router}>
        <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4">
          <p className="text-slate-300">{legsError}</p>
          <button
            onClick={() => router.refresh()}
            className="px-6 py-3 rounded-xl bg-white/10 text-white font-medium hover:bg-white/15 transition-colors"
          >
            Try again
          </button>
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell selection={selection} router={router}>
      {/* Flight info bar */}
      <FlightInfoBar flight={selection.departFlight} />

      <div className="grid grid-cols-12 gap-6 mt-6">
        {/* LEFT — seat map */}
        <div className="col-span-12 lg:col-span-8 space-y-4">

          {/* Leg tabs (only when round-trip) */}
          {legs.length > 1 && (
            <div className="flex gap-2">
              {legs.map((leg, i) => (
                <button
                  key={leg.flightInstanceId}
                  onClick={() => setActiveLegIndex(i)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    activeLegIndex === i
                      ? "border-amber-400 bg-amber-400/15 text-amber-300"
                      : "border-white/10 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {leg.label} · {leg.flight.origin} → {leg.flight.destination}
                </button>
              ))}
            </div>
          )}

          {/* Cabin class tabs */}
          {availableCabins.length > 1 && (
            <CabinClassTabs
              cabins={availableCabins}
              active={activeCabin}
              onChange={setActiveCabin}
            />
          )}

          {/* Passenger tabs */}
          <PassengerTabs
            passengers={passengers}
            activeIndex={activePassengerIndex}
            activeLegIndex={activeLegIndex}
            picks={picks}
            activeLeg={activeLeg}
            onSelect={setActivePassengerIndex}
          />

          {/* Seat map */}
          {activeLeg && !activeLeg.hasSeatMap ? (
            <NoSeatMapCard />
          ) : activeLeg ? (
            <SeatMapCard
              leg={activeLeg}
              visibleSeats={visibleSeats}
              picks={picks}
              activeLegIndex={activeLegIndex}
              activePassenger={activePassenger}
              activePassengerIndex={activePassengerIndex}
              passengers={passengers}
              activeCabin={activeCabin}
              onSelectSeat={selectSeat}
            />
          ) : null}
        </div>

        {/* RIGHT — summary */}
        <div className="col-span-12 lg:col-span-4">
          <SeatSummary
            legs={legs}
            passengers={passengers}
            picks={picks}
            totalSeatPrice={totalSeatPrice}
            allSeatsAssigned={allSeatsAssigned}
            submitting={submitting}
            submitError={submitError}
            onContinue={handleContinue}
            onSkip={() => router.push("/checkout/addons")}
          />
        </div>
      </div>
    </PageShell>
  )
}

// ---------------------------------------------------------------------------
// FlightInfoBar
// ---------------------------------------------------------------------------

function FlightInfoBar({ flight }: { flight: StoredFlight }) {
  return (
    <div className="flex flex-wrap items-center gap-4 bg-white/[0.03] border border-white/[0.07] rounded-2xl px-5 py-4">
      {/* Airline */}
      <div className="flex items-center gap-2.5 min-w-[140px]">
        <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center overflow-hidden shadow-sm ring-1 ring-black/5 shrink-0">
          <img
            src={airlineLogos[flight.airline] || "/airlines/default.png"}
            alt={flight.airline}
            className="w-6 h-6 object-contain"
          />
        </div>
        <div>
          <p className="text-xs font-medium text-white">{flight.airline}</p>
          <p className="text-[11px] text-slate-500">{flight.aircraft}</p>
        </div>
      </div>

      <div className="w-px h-8 bg-white/10 hidden sm:block" />

      {/* Route */}
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-lg font-semibold text-white tabular-nums">{formatTime(flight.departure_time)}</p>
          <p className="text-[11px] text-slate-500">
            {formatDateLabel(flight.departure_time, flight.travel_date) || "—"} · {flight.origin}
          </p>
        </div>
        <div className="flex flex-col items-center gap-0.5 px-2">
          <p className="text-[10px] text-slate-500">{formatDuration(flight)}</p>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />
            <div className="w-12 h-px bg-gradient-to-r from-slate-600 to-amber-500/60" />
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          </div>
          {(flight.stops ?? 0) > 0 && (
            <p className="text-[10px] text-amber-400/80">{flight.stops} stop</p>
          )}
        </div>
        <div>
          <p className="text-lg font-semibold text-white tabular-nums">{formatTime(flight.arrival_time)}</p>
          <p className="text-[11px] text-slate-500">
            {formatDateLabel(flight.arrival_time, flight.travel_date) || "—"} · {flight.destination}
          </p>
        </div>
      </div>

      <button className="ml-auto text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1">
        Edit flight <span aria-hidden>✎</span>
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// CabinClassTabs
// ---------------------------------------------------------------------------

function CabinClassTabs({
  cabins,
  active,
  onChange,
}: {
  cabins: typeof CABIN_CLASSES[number][]
  active: CabinKey
  onChange: (k: CabinKey) => void
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {cabins.map((c) => {
        const isActive = active === c.key
        return (
          <button
            key={c.key}
            onClick={() => onChange(c.key)}
            className={`relative flex flex-col items-start gap-1 px-4 py-3 rounded-xl border text-left transition-all ${
              isActive
                ? "border-amber-400/70 bg-amber-400/10 shadow-[0_0_20px_rgba(251,191,36,0.08)]"
                : "border-white/[0.08] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
            }`}
          >
            {isActive && (
              <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center">
                <span className="text-[8px] text-[#060B14] font-bold">✓</span>
              </span>
            )}
            <span className={`text-[10px] tracking-widest ${isActive ? "text-amber-300" : "text-slate-600"}`}>
              {c.icon}
            </span>
            <span className={`text-xs font-medium ${isActive ? "text-amber-200" : "text-slate-300"}`}>
              {c.label}
            </span>
            <span className={`text-[11px] ${isActive ? "text-amber-400/70" : "text-slate-600"}`}>
              from {c.fromPrice}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// PassengerTabs
// ---------------------------------------------------------------------------

function PassengerTabs({
  passengers,
  activeIndex,
  activeLegIndex,
  picks,
  activeLeg,
  onSelect,
}: {
  passengers: StoredPassenger[]
  activeIndex: number
  activeLegIndex: number
  picks: SelectionMap
  activeLeg: LegSeatMap | undefined
  onSelect: (i: number) => void
}) {
  return (
    <div className="flex gap-2 flex-wrap">
      {passengers.map((p, i) => {
        const seatId = picks[`${activeLegIndex}:${p.id}`]
        const seat = activeLeg?.seats.find((s) => s.id === seatId)
        const color = paxColor(i)
        const isActive = activeIndex === i

        return (
          <button
            key={p.id}
            onClick={() => onSelect(i)}
            className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl border text-sm font-medium transition-all ${
              isActive
                ? `${color.ring} ${color.bg} ${color.text}`
                : "border-white/[0.08] text-slate-400 hover:text-slate-200 hover:border-white/20"
            }`}
          >
            {/* Avatar with initials */}
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${
                isActive ? color.dot + " text-white" : "bg-white/10 text-slate-400"
              }`}
            >
              {paxInitials(p, i)}
            </span>

            <span>{paxFullName(p, i)}</span>

            {seat ? (
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${color.badge}`}>
                {seat.seatNumber}
              </span>
            ) : (
              <span className="text-[10px] text-slate-600 italic">no seat</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// NoSeatMapCard — shown when hasSeatMap is false for the active leg
// ---------------------------------------------------------------------------

function NoSeatMapCard() {
  return (
    <div className="bg-[#0D1A2C]/80 border border-white/[0.08] rounded-2xl p-10 text-center">
      <div className="w-12 h-12 rounded-full bg-white/[0.04] border border-white/10 flex items-center justify-center mx-auto mb-4 text-xl">
        ✈
      </div>
      <p className="text-slate-300">Seat selection isn't available for this flight yet.</p>
      <p className="text-sm text-slate-500 mt-2">Seats will be assigned at check-in.</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SeatMapCard
// ---------------------------------------------------------------------------

function SeatMapCard({
  leg,
  visibleSeats,
  picks,
  activeLegIndex,
  activePassenger,
  activePassengerIndex,
  passengers,
  activeCabin,
  onSelectSeat,
}: {
  leg: LegSeatMap
  visibleSeats: ApiSeat[]
  picks: SelectionMap
  activeLegIndex: number
  activePassenger: StoredPassenger
  activePassengerIndex: number
  passengers: StoredPassenger[]
  activeCabin: CabinKey
  onSelectSeat: (seat: ApiSeat) => void
}) {
  const isFirstClass = activeCabin === "first"
  const isBusinessClass = activeCabin === "business"
  const isPremiumOrLuxury = isFirstClass || isBusinessClass

  const rows = useMemo(() => {
    const byRow = new Map<number, ApiSeat[]>()
    visibleSeats.forEach((seat) => {
      const arr = byRow.get(seat.row) || []
      arr.push(seat)
      byRow.set(seat.row, arr)
    })
    return Array.from(byRow.entries()).sort((a, b) => a[0] - b[0])
  }, [visibleSeats])

  // Map seatId -> passenger index for colour coding
  const seatOwnerMap = useMemo(() => {
    const map: Record<string, number> = {}
    passengers.forEach((p, i) => {
      const seatId = picks[`${activeLegIndex}:${p.id}`]
      if (seatId) map[seatId] = i
    })
    return map
  }, [passengers, picks, activeLegIndex])

  const activePaxColor = paxColor(activePassengerIndex)

  return (
    <div className="bg-gradient-to-br from-[#0D1A2C] via-[#0B1729] to-[#0A1424] border border-white/[0.08] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between px-6 py-4 border-b border-white/[0.06] bg-white/[0.02] gap-3">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${activePaxColor.dot}`} />
          <p className="text-sm text-slate-300">
            Choosing for{" "}
            <span className={`font-semibold ${activePaxColor.text}`}>
              {paxFullName(activePassenger, activePassengerIndex)}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-4 text-[11px] text-slate-500 flex-wrap">
          <Legend swatch="bg-blue-500/15 border-blue-500/0" label="Available" />
          {visibleSeats.some((s) => s.seatType === "extra_legroom") && (
            <Legend swatch="bg-amber-400/15 border-amber-400/0" label="Extra legroom" />
          )}
          <Legend swatch="bg-cyan-400 border-cyan-400/0" label="Your pick" />
          <Legend swatch="bg-white/[0.04] border-white/0" label="Taken" />
        </div>
      </div>

      {/* Aircraft nose indicator */}
      <div className="flex justify-center pt-5 pb-1">
        <div className="flex flex-col items-center gap-1.5">
          <div className="text-slate-600 text-[10px] tracking-widest uppercase">Front of aircraft</div>
          <svg width="28" height="14" viewBox="0 0 28 14" fill="none">
            <path d="M14 0L27 13H1L14 0Z" fill="currentColor" className="text-slate-700/60" />
          </svg>
        </div>
      </div>

      <div className="px-6 pb-8 overflow-x-auto">
        {isPremiumOrLuxury ? (
          <LuxurySeatGrid
            rows={rows}
            seatOwnerMap={seatOwnerMap}
            activePassenger={activePassenger}
            picks={picks}
            activeLegIndex={activeLegIndex}
            onSelectSeat={onSelectSeat}
            isFirst={isFirstClass}
          />
        ) : (
          <EconomySeatGrid
            rows={rows}
            seatOwnerMap={seatOwnerMap}
            activePassenger={activePassenger}
            picks={picks}
            activeLegIndex={activeLegIndex}
            onSelectSeat={onSelectSeat}
          />
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// EconomySeatGrid — small rounded-square chips with real gaps between seat
// groups, matching the reference economy/premium-economy mockups:
//   default  -> flat blue-tinted square
//   taken    -> dim square + orange lock glyph (no "X", matches premium-eco ref)
//   selected -> bright filled square (passenger colour) with a soft glow
//   paid     -> small "+" marker in the corner, replaced by price on hover
// Each seat group (split by isAisle) gets a real visual gap, and groups are
// wrapped in a faint shared "armrest band" so 3 seats read as one row-block.
// ---------------------------------------------------------------------------

function groupByAisle(sortedCols: ApiSeat[]): ApiSeat[][] {
  const groups: ApiSeat[][] = []
  let current: ApiSeat[] = []
  sortedCols.forEach((seat) => {
    current.push(seat)
    if (seat.isAisle) {
      groups.push(current)
      current = []
    }
  })
  if (current.length) groups.push(current)
  return groups
}

function EconomySeatGrid({
  rows,
  seatOwnerMap,
  activePassenger,
  picks,
  activeLegIndex,
  onSelectSeat,
}: {
  rows: [number, ApiSeat[]][]
  seatOwnerMap: Record<string, number>
  activePassenger: StoredPassenger
  picks: SelectionMap
  activeLegIndex: number
  onSelectSeat: (seat: ApiSeat) => void
}) {
  const firstRowSeats = rows[0]?.[1] ?? []
  const sortedCols = [...firstRowSeats].sort((a, b) => a.col.localeCompare(b.col))
  const colGroups = groupByAisle(sortedCols)

  return (
    <div className="w-fit mx-auto">
      {/* Column headers, grouped to match the seat groups below */}
      <div className="flex items-center gap-5 mb-3 pl-8">
        {colGroups.map((group, gi) => (
          <div key={gi} className="flex items-center gap-1.5">
            {group.map((s) => (
              <span key={s.col} className="w-9 inline-flex justify-center text-[11px] font-semibold text-slate-500">
                {s.col}
              </span>
            ))}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2.5">
        {rows.map(([rowNum, rowSeats]) => {
          const sorted = [...rowSeats].sort((a, b) => a.col.localeCompare(b.col))
          const groups = groupByAisle(sorted)

          return (
            <div key={rowNum} className="flex items-center gap-5">
              <span className="w-6 text-right text-[11px] text-slate-500 tabular-nums shrink-0">{rowNum}</span>
              {groups.map((group, gi) => (
                <div
                  key={gi}
                  className="flex items-center gap-1.5 px-1.5 py-1.5 rounded-xl bg-white/[0.015]"
                >
                  {group.map((seat) => {
                    const ownerIdx = seatOwnerMap[seat.id]
                    const isMe = picks[`${activeLegIndex}:${activePassenger.id}`] === seat.id
                    const isOtherPax = ownerIdx !== undefined && !isMe
                    const color = ownerIdx !== undefined ? paxColor(ownerIdx) : null
                    const isExtraLegroom = seat.seatType === "extra_legroom"

                    return (
                      <button
                        key={seat.id}
                        onClick={() => onSelectSeat(seat)}
                        disabled={!seat.isAvailable}
                        title={`${seat.seatNumber}${seat.price > 0 ? ` · +₹${seat.price}` : ""}`}
                        className={`relative w-9 h-9 rounded-[9px] flex items-center justify-center transition-all duration-150 group
                          ${isMe
                            ? `${color ? color.bg.replace("/10", "") : "bg-cyan-400"} ${color ? color.glow : "shadow-[0_0_16px_rgba(34,211,238,0.45)]"} scale-110`
                            : isOtherPax && color
                            ? `${color.bg.replace("/10", "/70")} opacity-90`
                            : !seat.isAvailable
                            ? "bg-white/[0.04] cursor-not-allowed"
                            : isExtraLegroom
                            ? "bg-amber-400/15 hover:bg-amber-400/25 hover:-translate-y-0.5"
                            : "bg-blue-500/15 hover:bg-blue-500/30 hover:-translate-y-0.5"
                          }`}
                      >
                        {!seat.isAvailable ? (
                          <LockIcon size={13} className="text-amber-500/70" filled />
                        ) : isMe ? (
                          <span className="text-[10px] font-bold text-[#060B14]">{seat.col}</span>
                        ) : isOtherPax && color ? (
                          <span className={`text-[10px] font-bold ${color.text}`}>{seat.col}</span>
                        ) : (
                          <span className={`text-[10px] font-medium ${isExtraLegroom ? "text-amber-300/90" : "text-blue-300/80"}`}>
                            {seat.col}
                          </span>
                        )}

                        {/* "+" marker for paid seats, like the reference's plus-tagged seats */}
                        {seat.isAvailable && !isMe && !isOtherPax && seat.price > 0 && (
                          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-amber-400 text-[#060B14] text-[9px] font-bold flex items-center justify-center leading-none">
                            +
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// LuxurySeatGrid — for Business / First Class.
// Each seat is a flat top-down "pod" glyph: a rounded body with an angled
// headrest wing on the outboard side (window side), echoing the capsule
// shape in the reference photos without trying to fake a 3D render. Taken
// pods get the same orange padlock treatment shown in the mockups.
// ---------------------------------------------------------------------------

function LuxurySeatGrid({
  rows,
  seatOwnerMap,
  activePassenger,
  picks,
  activeLegIndex,
  onSelectSeat,
  isFirst,
}: {
  rows: [number, ApiSeat[]][]
  seatOwnerMap: Record<string, number>
  activePassenger: StoredPassenger
  picks: SelectionMap
  activeLegIndex: number
  onSelectSeat: (seat: ApiSeat) => void
  isFirst: boolean
}) {
  const firstRowSeats = rows[0]?.[1] ?? []
  const sortedCols = [...firstRowSeats].sort((a, b) => a.col.localeCompare(b.col))
  const colGroups = groupByAisle(sortedCols)
  const seatSize = isFirst ? "w-[84px] h-[88px]" : "w-[66px] h-[70px]"

  return (
    <div className="w-fit mx-auto">
      {/* Column labels, grouped */}
      <div className="flex items-center gap-8 mb-4 pl-8">
        {colGroups.map((group, gi) => (
          <div key={gi} className="flex items-center gap-3">
            {group.map((s) => (
              <span
                key={s.col}
                className={`inline-flex justify-center text-[11px] font-semibold text-slate-500 ${isFirst ? "w-[84px]" : "w-[66px]"}`}
              >
                {s.col}
              </span>
            ))}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        {rows.map(([rowNum, rowSeats]) => {
          const sorted = [...rowSeats].sort((a, b) => a.col.localeCompare(b.col))
          const groups = groupByAisle(sorted)

          return (
            <div key={rowNum} className="flex items-center gap-8">
              <span className="w-6 text-right text-[11px] text-slate-500 tabular-nums shrink-0">{rowNum}</span>
              {groups.map((group, gi) => (
                <div key={gi} className="flex items-center gap-3">
                  {group.map((seat, seatIdxInGroup) => {
                    const ownerIdx = seatOwnerMap[seat.id]
                    const isMe = picks[`${activeLegIndex}:${activePassenger.id}`] === seat.id
                    const isOtherPax = ownerIdx !== undefined && !isMe
                    const color = ownerIdx !== undefined ? paxColor(ownerIdx) : null
                    // headrest wing points toward the window: first seat in
                    // group faces left-out, last seat in group faces right-out
                    const wingSide: "left" | "right" =
                      seatIdxInGroup === 0 ? "left" : seatIdxInGroup === group.length - 1 ? "right" : "left"

                    return (
                      <button
                        key={seat.id}
                        onClick={() => onSelectSeat(seat)}
                        disabled={!seat.isAvailable}
                        title={`${seat.seatNumber}${seat.price > 0 ? ` · +₹${seat.price}` : ""}`}
                        className={`${seatSize} relative flex flex-col items-center justify-center gap-1.5 transition-all duration-200 group`}
                      >
                        <PodIcon
                          available={seat.isAvailable}
                          isMe={isMe}
                          isOtherPax={isOtherPax}
                          isFirst={isFirst}
                          color={color}
                          wingSide={wingSide}
                        />

                        <span
                          className={`relative text-[10px] font-mono ${
                            isMe
                              ? color ? color.text : "text-cyan-300"
                              : isOtherPax && color
                              ? color.text
                              : !seat.isAvailable
                              ? "text-slate-600"
                              : "text-slate-400 group-hover:text-amber-300"
                          }`}
                        >
                          {seat.seatNumber}
                        </span>

                        {seat.isAvailable && !isMe && !isOtherPax && seat.price > 0 && (
                          <span className="absolute top-1 right-1 text-[8px] leading-none px-1 py-0.5 rounded bg-[#060B14]/80 border border-amber-400/30 text-amber-300/80">
                            +₹{seat.price}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          )
        })}
      </div>

      {/* First class perks strip */}
      {isFirst && (
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 gap-2">
          {[
            { icon: "⊡", label: "Private suite" },
            { icon: "⌂", label: "Flat bed" },
            { icon: "✦", label: "Fine dining" },
            { icon: "◎", label: "Personal concierge" },
            { icon: "▣", label: "Lounge access" },
            { icon: "⊕", label: "Priority boarding" },
          ].map((b) => (
            <div
              key={b.label}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-400/[0.05] border border-amber-400/10 text-[11px] text-amber-300/60"
            >
              <span className="text-amber-400/60">{b.icon}</span>
              {b.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// PodIcon — flat top-down seat-pod glyph for business/first: a rounded body
// + an angled headrest "wing" toward the window side, echoing the capsule
// shape from the reference photos. Taken pods render dim with an orange
// padlock badge, matching the mockup's lock treatment exactly.
// ---------------------------------------------------------------------------

function PodIcon({
  available,
  isMe,
  isOtherPax,
  isFirst,
  color,
  wingSide,
}: {
  available: boolean
  isMe: boolean
  isOtherPax: boolean
  isFirst: boolean
  color: (typeof PAX_COLORS)[number] | null
  wingSide: "left" | "right"
}) {
  const w = isFirst ? 72 : 58
  const h = isFirst ? 76 : 62
  const flip = wingSide === "right"

  const fillClass = isMe
    ? color ? color.bg.replace("/10", "/30") : "bg-cyan-400/30"
    : isOtherPax && color
    ? color.bg.replace("/10", "/25")
    : !available
    ? "bg-white/[0.03]"
    : "bg-gradient-to-b from-white/[0.07] to-white/[0.02] group-hover:from-amber-400/[0.1] group-hover:to-amber-400/[0.02]"

  const borderClass = isMe
    ? color ? color.ring : "border-cyan-400/80"
    : isOtherPax && color
    ? color.ring
    : !available
    ? "border-white/[0.06]"
    : "border-white/15 group-hover:border-amber-400/40"

  const glowClass = isMe ? (color ? color.glow : "shadow-[0_0_20px_rgba(34,211,238,0.35)]") : ""

  return (
    <div
      className={`relative ${fillClass} ${borderClass} ${glowClass} border-2 rounded-2xl transition-all duration-200 group-hover:-translate-y-0.5`}
      style={{ width: w, height: h, transform: flip ? "scaleX(-1)" : undefined }}
    >
      {/* headrest wing */}
      <div
        className={`absolute -top-1.5 left-1.5 w-[34%] h-[42%] rounded-t-xl border-2 ${borderClass} ${fillClass}`}
      />
      {/* seat back accent lines */}
      {available && (
        <div className="absolute inset-x-0 bottom-2 flex justify-center gap-[3px]" style={{ transform: flip ? "scaleX(-1)" : undefined }}>
          <span className="w-[2px] h-3 rounded-full bg-white/10" />
          <span className="w-[2px] h-4 rounded-full bg-white/10" />
          <span className="w-[2px] h-3 rounded-full bg-white/10" />
        </div>
      )}

      {!available && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ transform: flip ? "scaleX(-1)" : undefined }}
        >
          <LockIcon size={isFirst ? 20 : 17} className="text-amber-500" filled />
        </div>
      )}
    </div>
  )
}

// Padlock glyph matching the reference mockups' orange lock badge —
// filled body, not just an outline, for visibility at small sizes.
function LockIcon({
  size = 14,
  className = "",
  filled = false,
}: {
  size?: number
  className?: string
  filled?: boolean
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect
        x="4" y="11" width="16" height="9" rx="2.5"
        fill={filled ? "currentColor" : "none"}
        fillOpacity={filled ? 0.18 : 1}
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path d="M7.5 11V7.5a4.5 4.5 0 019 0V11" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="12" cy="15.5" r="1.4" fill="currentColor" />
    </svg>
  )
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-3 h-3 rounded border ${swatch}`} />
      {label}
    </div>
  )
}

// ---------------------------------------------------------------------------
// SeatSummary — right rail
// ---------------------------------------------------------------------------

function SeatSummary({
  legs,
  passengers,
  picks,
  totalSeatPrice,
  allSeatsAssigned,
  submitting,
  submitError,
  onContinue,
  onSkip,
}: {
  legs: LegSeatMap[]
  passengers: StoredPassenger[]
  picks: SelectionMap
  totalSeatPrice: number
  allSeatsAssigned: boolean
  submitting: boolean
  submitError: string | null
  onContinue: () => void
  onSkip: () => void
}) {
  const noSeatMapsAtAll = legs.every((l) => !l.hasSeatMap)

  return (
    <div className="sticky top-24">
      <div className="relative bg-gradient-to-b from-[#0D1A2C] to-[#0A1424] border border-white/[0.08] rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/[0.06]">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Seat Selection</p>
        </div>

        {/* Per-leg passenger breakdown */}
        <div className="px-6 pt-4 pb-2 space-y-5">
          {legs.map((leg, legIndex) => (
            <div key={leg.flightInstanceId}>
              {legs.length > 1 && (
                <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500 mb-2">
                  {leg.label} · {leg.flight.origin} → {leg.flight.destination}
                </p>
              )}
              <div className="space-y-2">
                {passengers.map((p, pIdx) => {
                  const seatId = picks[`${legIndex}:${p.id}`]
                  const seat = leg.seats.find((s) => s.id === seatId)
                  const color = paxColor(pIdx)
                  return (
                    <div key={p.id} className="flex items-center justify-between gap-2">
                      {/* Passenger name with colour dot */}
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${color.dot}`} />
                        <span className="text-sm text-slate-400 truncate">{paxFullName(p, pIdx)}</span>
                      </div>
                      {/* Seat or placeholder */}
                      {seat ? (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={`text-[11px] font-mono px-2 py-0.5 rounded ${color.badge}`}>
                            {seat.seatNumber}
                          </span>
                          {seat.price > 0 && (
                            <span className="text-xs text-slate-300 tabular-nums">
                              ₹{seat.price.toLocaleString("en-IN")}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-600 italic shrink-0">Not selected</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Ticket tear line */}
        <div className="relative my-4 px-6">
          <div className="border-t border-dashed border-white/[0.12]" />
          <span className="absolute -left-[26px] -top-3 w-6 h-6 rounded-full bg-[#060B14]" />
          <span className="absolute -right-[26px] -top-3 w-6 h-6 rounded-full bg-[#060B14]" />
        </div>

        {/* Total */}
        <div className="px-6 flex items-end justify-between mb-5">
          <span className="text-sm text-slate-400">Seat Total</span>
          <span className="text-[28px] leading-none font-semibold tabular-nums text-amber-300">
            ₹{totalSeatPrice.toLocaleString("en-IN")}
          </span>
        </div>

        {/* Error */}
        {submitError && (
          <div className="px-6 mb-4">
            <p className="text-xs text-red-300 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
              {submitError}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="px-6 pb-6 space-y-2.5">
          <button
            onClick={onContinue}
            disabled={(!allSeatsAssigned && !noSeatMapsAtAll) || submitting}
            className="w-full px-6 py-3.5 rounded-xl font-semibold bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 text-[#060B14] hover:brightness-105 active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-[0_8px_30px_rgba(251,191,36,0.15)] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:brightness-100"
          >
            {submitting ? "Saving…" : "Continue to Add-ons"}
            {!submitting && <span aria-hidden>→</span>}
          </button>

          {!allSeatsAssigned && !noSeatMapsAtAll && (
            <p className="text-[11px] text-slate-500 text-center">
              Pick a seat for every passenger on every leg to continue
            </p>
          )}

          <button
            onClick={onSkip}
            className="w-full text-xs text-slate-500 hover:text-slate-300 transition-colors py-1"
          >
            Skip seat selection for now
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// PageShell
// ---------------------------------------------------------------------------

const steps = [
  { id: 1, label: "Search" },
  { id: 2, label: "Select" },
  { id: 3, label: "Passengers" },
  { id: 4, label: "Seats" },
  { id: 5, label: "Add-ons" },
  { id: 6, label: "Payment" },
]

function PageShell({
  children,
  selection,
  router,
}: {
  children: React.ReactNode
  selection?: CheckoutSelection
  router?: ReturnType<typeof useRouter>
}) {
  return (
    <div className="min-h-screen bg-[#060B14] text-white relative">
      <div className="pointer-events-none fixed top-[-200px] left-[15%] w-[600px] h-[600px] bg-amber-500/[0.04] blur-[160px] rounded-full" />
      <div className="pointer-events-none fixed bottom-[-200px] right-[10%] w-[500px] h-[500px] bg-cyan-400/[0.04] blur-[160px] rounded-full" />

      <Navbar />

      <div className="relative max-w-7xl mx-auto px-6 pt-24 pb-16">
        {/* Stepper */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => router?.push("/checkout/passengers")}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 transition-colors shrink-0"
          >
            <span aria-hidden>←</span> Back to passenger details
          </button>

          <div className="flex items-center gap-1 overflow-x-auto">
            {steps.map((step, i) => (
              <div key={step.id} className="flex items-center shrink-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold border transition-colors ${
                      step.id === 4
                        ? "border-amber-400 bg-amber-400/15 text-amber-300"
                        : step.id < 4
                        ? "border-emerald-400/60 bg-emerald-400/10 text-emerald-300"
                        : "border-white/10 text-slate-600"
                    }`}
                  >
                    {step.id < 4 ? "✓" : step.id}
                  </span>
                  <span
                    className={`text-xs hidden sm:inline ${
                      step.id === 4
                        ? "text-amber-300 font-medium"
                        : step.id < 4
                        ? "text-emerald-300/80"
                        : "text-slate-600"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <span className={`w-6 sm:w-10 h-px mx-2 ${step.id < 4 ? "bg-emerald-400/30" : "bg-white/10"}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {children}
      </div>
    </div>
  )
}

function CenteredMessage({ text }: { text: string }) {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <p className="text-slate-500 text-sm tracking-wide">{text}</p>
    </div>
  )
}