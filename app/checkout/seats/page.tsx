"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Navbar from "@/components/navbar"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type StoredFlight = {
  id: string | number
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
}

type StoredPassenger = {
  id: string
  firstName: string
  lastName: string
  type: string
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
  { ring: "border-cyan-400",   bg: "bg-cyan-400/10",   text: "text-cyan-300",   badge: "bg-cyan-400/20 text-cyan-200",   dot: "bg-cyan-400"   },
  { ring: "border-violet-400", bg: "bg-violet-400/10", text: "text-violet-300", badge: "bg-violet-400/20 text-violet-200", dot: "bg-violet-400" },
  { ring: "border-rose-400",   bg: "bg-rose-400/10",   text: "text-rose-300",   badge: "bg-rose-400/20 text-rose-200",   dot: "bg-rose-400"   },
  { ring: "border-emerald-400",bg: "bg-emerald-400/10",text: "text-emerald-300",badge: "bg-emerald-400/20 text-emerald-200",dot: "bg-emerald-400"},
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
            const instanceId = String(flight.id)
            const res = await fetch(
              `/api/flights/${instanceId}/seats?bookingId=${selection.bookingId}`
            )
            const data = await res.json()
            if (!res.ok) throw new Error(data?.error || `Failed to load seats for ${label.toLowerCase()} flight`)
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
      firstName: "Passenger",
      lastName: `${i + 1}`,
      type: "adult",
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
            <div className="bg-[#0D1A2C]/80 border border-white/[0.08] rounded-2xl p-10 text-center">
              <p className="text-slate-300">Seat selection isn't available for this flight yet.</p>
              <p className="text-sm text-slate-500 mt-2">Seats will be assigned at check-in.</p>
            </div>
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
  const dep = new Date(flight.departure_time)
  const arr = new Date(flight.arrival_time)
  const fmt = (d: Date) =>
    d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false })
  const fmtDate = (d: Date) =>
    d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })

  return (
    <div className="flex flex-wrap items-center gap-4 bg-white/[0.03] border border-white/[0.07] rounded-2xl px-5 py-4">
      {/* Airline */}
      <div className="flex items-center gap-2.5 min-w-[140px]">
        <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-[10px] font-bold text-amber-300">
          {flight.airline.slice(0, 2).toUpperCase()}
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
          <p className="text-lg font-semibold text-white tabular-nums">{fmt(dep)}</p>
          <p className="text-[11px] text-slate-500">{fmtDate(dep)} · {flight.origin}</p>
        </div>
        <div className="flex flex-col items-center gap-0.5 px-2">
          <p className="text-[10px] text-slate-500">{flight.duration ?? "—"}</p>
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
          <p className="text-lg font-semibold text-white tabular-nums">{fmt(arr)}</p>
          <p className="text-[11px] text-slate-500">{fmtDate(arr)} · {flight.destination}</p>
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
              {p.firstName[0]}{p.lastName[0]}
            </span>

            <span>{p.firstName} {p.lastName}</span>

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
              {activePassenger.firstName} {activePassenger.lastName}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-4 text-[11px] text-slate-500">
          <Legend swatch="bg-white/10 border-white/20" label="Available" />
          {visibleSeats.some((s) => s.seatType === "extra_legroom") && (
            <Legend swatch="bg-amber-400/20 border-amber-400/50" label="Extra legroom" />
          )}
          <Legend swatch="bg-cyan-400/30 border-cyan-400" label="Your pick" />
          <Legend swatch="bg-slate-700/40 border-slate-600/40" label="Taken" />
        </div>
      </div>

      {/* Aircraft nose indicator */}
      <div className="flex justify-center pt-5 pb-1">
        <div className="flex flex-col items-center gap-1">
          <div className="text-slate-600 text-[10px] tracking-widest uppercase">Front of aircraft</div>
          <div className="w-px h-4 bg-gradient-to-b from-slate-600 to-transparent" />
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
// EconomySeatGrid
// ---------------------------------------------------------------------------

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
  // Derive column labels from first row
  const firstRowSeats = rows[0]?.[1] ?? []
  const sortedCols = [...firstRowSeats].sort((a, b) => a.col.localeCompare(b.col))

  // Find where the aisle gap should go (after a seat that isAisle)
  const aisleAfterIdx = sortedCols.findIndex((s) => s.isAisle)

  return (
    <div className="min-w-[380px] mx-auto">
      {/* Column headers */}
      <div className="flex items-center gap-2 mb-3 pl-8">
        {sortedCols.map((s, idx) => (
          <div key={s.col}>
            <span className="w-9 inline-flex justify-center text-[11px] text-slate-500">{s.col}</span>
            {idx === aisleAfterIdx && <span className="w-5 inline-block" />}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        {rows.map(([rowNum, rowSeats]) => {
          const sorted = [...rowSeats].sort((a, b) => a.col.localeCompare(b.col))
          return (
            <div key={rowNum} className="flex items-center gap-2">
              <span className="w-6 text-right text-[11px] text-slate-500 tabular-nums shrink-0">{rowNum}</span>
              {sorted.map((seat, idx) => {
                const ownerIdx = seatOwnerMap[seat.id]
                const isMe = picks[`${activeLegIndex}:${activePassenger.id}`] === seat.id
                const isOtherPax = ownerIdx !== undefined && !isMe
                const color = ownerIdx !== undefined ? paxColor(ownerIdx) : null

                return (
                  <div key={seat.id} className="flex items-center">
                    <button
                      onClick={() => onSelectSeat(seat)}
                      disabled={!seat.isAvailable}
                      title={`${seat.seatNumber}${seat.price > 0 ? ` · +₹${seat.price}` : ""}`}
                      className={`w-9 h-9 rounded-lg border text-[10px] font-mono flex items-center justify-center transition-all duration-100
                        ${isMe
                          ? `${color ? color.ring : "border-cyan-400"} ${color ? color.bg : "bg-cyan-400/30"} ${color ? color.text : "text-cyan-200"} scale-105 shadow-[0_0_12px_rgba(34,211,238,0.2)]`
                          : isOtherPax && color
                          ? `${color.ring} ${color.bg} ${color.text} opacity-80`
                          : !seat.isAvailable
                          ? "bg-slate-800/60 border-slate-700/40 text-slate-600 cursor-not-allowed"
                          : seat.seatType === "extra_legroom"
                          ? "bg-amber-400/15 border-amber-400/40 text-amber-300 hover:bg-amber-400/25 hover:scale-105"
                          : "bg-white/[0.06] border-white/15 text-slate-400 hover:bg-white/12 hover:border-white/30 hover:scale-105"
                        }`}
                    >
                      {seat.col}
                    </button>
                    {idx === aisleAfterIdx && <span className="w-5 shrink-0" />}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// LuxurySeatGrid — for Business / First Class
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
  const aisleAfterIdx = sortedCols.findIndex((s) => s.isAisle)
  const seatSize = isFirst ? "w-[76px] h-[64px]" : "w-[60px] h-[52px]"

  return (
    <div className="min-w-[320px] mx-auto">
      {/* Column labels */}
      <div className="flex items-center gap-3 mb-4 pl-8">
        {sortedCols.map((s, idx) => (
          <div key={s.col}>
            <span
              className={`inline-flex justify-center text-[11px] text-slate-500 ${isFirst ? "w-[76px]" : "w-[60px]"}`}
            >
              {s.col}
            </span>
            {idx === aisleAfterIdx && <span className={isFirst ? "w-8 inline-block" : "w-6 inline-block"} />}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {rows.map(([rowNum, rowSeats]) => {
          const sorted = [...rowSeats].sort((a, b) => a.col.localeCompare(b.col))
          return (
            <div key={rowNum} className="flex items-center gap-3">
              <span className="w-6 text-right text-[11px] text-slate-500 tabular-nums shrink-0">{rowNum}</span>
              {sorted.map((seat, idx) => {
                const ownerIdx = seatOwnerMap[seat.id]
                const isMe = picks[`${activeLegIndex}:${activePassenger.id}`] === seat.id
                const isOtherPax = ownerIdx !== undefined && !isMe
                const color = ownerIdx !== undefined ? paxColor(ownerIdx) : null
                const isLocked = !seat.isAvailable && seat.isMine === false

                return (
                  <div key={seat.id} className="flex items-center">
                    <button
                      onClick={() => onSelectSeat(seat)}
                      disabled={!seat.isAvailable}
                      title={`${seat.seatNumber}${seat.price > 0 ? ` · +₹${seat.price}` : ""}`}
                      className={`${seatSize} rounded-xl border flex flex-col items-center justify-center gap-1 transition-all duration-150 group
                        ${isMe
                          ? `${color ? color.ring : "border-cyan-400/80"} ${color ? color.bg : "bg-cyan-400/15"} shadow-[0_0_20px_rgba(34,211,238,0.15)]`
                          : isOtherPax && color
                          ? `${color.ring} ${color.bg}`
                          : !seat.isAvailable
                          ? "border-slate-700/30 bg-slate-800/30 cursor-not-allowed"
                          : "border-white/10 bg-white/[0.04] hover:border-amber-400/40 hover:bg-amber-400/[0.07] hover:shadow-[0_0_16px_rgba(251,191,36,0.08)]"
                        }`}
                    >
                      {/* Seat icon */}
                      <SeatIcon
                        available={seat.isAvailable}
                        isMe={isMe}
                        isOtherPax={isOtherPax}
                        isFirst={isFirst}
                        locked={isLocked}
                        color={color}
                      />
                      <span
                        className={`text-[10px] font-mono ${
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
                    </button>
                    {idx === aisleAfterIdx && (
                      <span className={isFirst ? "w-8 shrink-0" : "w-6 shrink-0"} />
                    )}
                  </div>
                )
              })}
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
// SeatIcon — SVG chair for luxury classes
// ---------------------------------------------------------------------------

function SeatIcon({
  available,
  isMe,
  isOtherPax,
  isFirst,
  locked,
  color,
}: {
  available: boolean
  isMe: boolean
  isOtherPax: boolean
  isFirst: boolean
  locked: boolean
  color: (typeof PAX_COLORS)[number] | null
}) {
  const size = isFirst ? 28 : 22

  if (locked || !available) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="opacity-30">
        <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    )
  }

  const strokeColor = isMe
    ? color ? "currentColor" : "#22d3ee"
    : isOtherPax && color
    ? "currentColor"
    : available
    ? "#94a3b8"
    : "#374151"

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="1.4" strokeLinecap="round">
      <path d="M5 9C5 7 6.5 5 9 5h6c2.5 0 4 2 4 4v5H5V9z" />
      <path d="M5 14v3a2 2 0 002 2h10a2 2 0 002-2v-3" />
      <path d="M8 19v2M16 19v2" />
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
                        <span className="text-sm text-slate-400 truncate">{p.firstName} {p.lastName}</span>
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