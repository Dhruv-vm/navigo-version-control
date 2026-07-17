"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import Navbar from "@/components/navbar"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

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

function paxTypeLabel(p: StoredPassenger): string {
  const t = (p.passenger_type || p.type || "adult").toLowerCase()
  if (t.startsWith("child")) return "Child"
  if (t.startsWith("infant")) return "Infant"
  return "Adult"
}

// ---------------------------------------------------------------------------
// Date/time helpers
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
// Cabin class config — a real hierarchy (Economy → First), so each tier
// carries a roman numeral (I–IV). That numbering encodes something true
// (ascending luxury tier) rather than decorating, per design guidance.
// ---------------------------------------------------------------------------

const CABIN_CLASSES = [
  { key: "economy",         label: "Economy Class",   tier: "I",   fromPrice: 2500 },
  { key: "premium_economy", label: "Premium Economy",  tier: "II",  fromPrice: 6000 },
  { key: "business",        label: "Business Class",  tier: "III", fromPrice: 12000 },
  { key: "first",           label: "First Class",     tier: "IV",  fromPrice: 28000 },
] as const

type CabinKey = (typeof CABIN_CLASSES)[number]["key"]

const CABIN_PERKS: Record<CabinKey, { icon: string; label: string; desc: string }[]> = {
  economy: [
    { icon: "◧", label: "Standard seat", desc: "Comfortable recline & legroom" },
    { icon: "⌗", label: "Cabin baggage", desc: "7kg carry-on included" },
    { icon: "◎", label: "In-flight snacks", desc: "Complimentary on longer routes" },
  ],
  premium_economy: [
    { icon: "◧", label: "Extra legroom", desc: "Up to 6 inches more space" },
    { icon: "⌗", label: "Priority baggage", desc: "First off the belt" },
    { icon: "◎", label: "Enhanced meals", desc: "Upgraded in-flight dining" },
  ],
  business: [
    { icon: "⊡", label: "Lie-flat recline", desc: "Deep recline with extra padding" },
    { icon: "▣", label: "Lounge access", desc: "Business lounge at select airports" },
    { icon: "✦", label: "Premium dining", desc: "Curated multi-course meals" },
    { icon: "⊕", label: "Priority boarding", desc: "Skip the queue" },
  ],
  first: [
    { icon: "⊡", label: "Private suite", desc: "Complete privacy with sliding doors" },
    { icon: "⌂", label: "Flat bed", desc: "Up to 80\" bed with luxury bedding" },
    { icon: "✦", label: "Fine dining", desc: "Curated gourmet meals & beverages" },
    { icon: "◎", label: "Personal concierge", desc: "Dedicated assistance throughout" },
    { icon: "▣", label: "Lounge access", desc: "Exclusive first class lounge access" },
    { icon: "⊕", label: "Priority boarding", desc: "Board first, relax sooner" },
  ],
}

const CABIN_PRAISE: Record<CabinKey, { title: string; body: string }> = {
  economy: { title: "Good pick", body: "Solid comfort for the price." },
  premium_economy: { title: "Smart upgrade", body: "More room, small step up in cost." },
  business: { title: "Great choice!", body: "You're travelling in serious comfort." },
  first: { title: "Excellent choice!", body: "You're enjoying the finest experience in the sky." },
}

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

  const [fetchedPassengers, setFetchedPassengers] = useState<StoredPassenger[] | null>(null)

  const [activeLegIndex, setActiveLegIndex] = useState(0)
  const [activePassengerIndex, setActivePassengerIndex] = useState(0)
  const [picks, setPicks] = useState<SelectionMap>({})
  const [activeCabin, setActiveCabin] = useState<CabinKey>("economy")
  const [zoom, setZoom] = useState(100)

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const [skipModalOpen, setSkipModalOpen] = useState(false)
  const [skipStep, setSkipStep] = useState<"cabin" | "mode" | "error">("cabin")
  const [skipCabin, setSkipCabin] = useState<CabinKey>("economy")
  const [skipErrorMessage, setSkipErrorMessage] = useState<string | null>(null)
  const [skipPartialNote, setSkipPartialNote] = useState<string | null>(null)

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      if (!raw) { setLoadState("missing"); return }
      const parsed = JSON.parse(raw) as CheckoutSelection
      if (!parsed.bookingId) { setLoadState("missing"); return }

      console.log("[seats] savedPassengers from storage:", parsed.savedPassengers)

      setSelection(parsed)
      setLoadState("found")
    } catch (err) {
      console.error("Failed to read checkout selection:", err)
      setLoadState("missing")
    }
  }, [])

  useEffect(() => {
    if (loadState !== "found" || !selection?.bookingId) return

    let cancelled = false
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null

    fetch(`/api/bookings/${selection.bookingId}/passengers`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        const rows: StoredPassenger[] | undefined = data.passengers ?? data
        if (Array.isArray(rows) && rows.length) {
          console.log("[seats] passengers fetched from API:", rows)
          setFetchedPassengers(rows)
        }
      })
      .catch((err) => console.warn("[seats] passenger fetch failed, keeping sessionStorage/placeholder names:", err))

    return () => {
      cancelled = true
    }
  }, [loadState, selection])

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
    if (fetchedPassengers?.length) return fetchedPassengers
    if (selection?.savedPassengers?.length) return selection.savedPassengers
    const count = selection?.passengers || 1
    return Array.from({ length: count }, (_, i) => ({
      id: `passenger-${i}`,
      first_name: "Passenger",
      last_name: `${i + 1}`,
      passenger_type: "adult",
    }))
  }, [selection, fetchedPassengers])

  const activeLeg = legs[activeLegIndex]
  const activePassenger = passengers[activePassengerIndex]

  const visibleSeats = useMemo(() => {
    if (!activeLeg) return []
    return activeLeg.seats.filter((s) => s.cabinClass === activeCabin)
  }, [activeLeg, activeCabin])

  const availableCabins = useMemo(() => {
    if (!activeLeg) return [...CABIN_CLASSES]
    const found = new Set(activeLeg.seats.map((s) => s.cabinClass))
    const filtered = CABIN_CLASSES.filter((c) => found.has(c.key))
    return filtered.length ? filtered : [...CABIN_CLASSES]
  }, [activeLeg])

  const cheapestInCabin = useMemo(() => {
    const priced = visibleSeats.filter((s) => s.price > 0)
    if (!priced.length) return null
    return Math.min(...priced.map((s) => s.price))
  }, [visibleSeats])

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

  const seatsSelectedCount = useMemo(() => {
    if (!activeLeg) return 0
    return passengers.filter((p) => !!picks[`${activeLegIndex}:${p.id}`]).length
  }, [activeLeg, activeLegIndex, passengers, picks])

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
      Object.keys(next).forEach((k) => {
        if (k.startsWith(`${activeLegIndex}:`) && next[k] === seat.id) delete next[k]
      })
      next[key] = seat.id

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

  function clearSeat(passengerId: string) {
    setPicks((prev) => {
      const next = { ...prev }
      delete next[`${activeLegIndex}:${passengerId}`]
      return next
    })
  }

  function pickedSeatIdsForLeg(source: SelectionMap, legIndex: number): Set<string> {
    const ids = new Set<string>()
    Object.entries(source).forEach(([key, seatId]) => {
      if (key.startsWith(`${legIndex}:`)) ids.add(seatId)
    })
    return ids
  }

  function passengersMissingSeat(source: SelectionMap, legIndex: number): StoredPassenger[] {
    return passengers.filter((p) => !source[`${legIndex}:${p.id}`])
  }

  function checkCabinAvailability(cabin: CabinKey): string | null {
    for (const [legIndex, leg] of legs.entries()) {
      if (!leg.hasSeatMap) continue
      const missing = passengersMissingSeat(picks, legIndex)
      if (!missing.length) continue
      const claimed = pickedSeatIdsForLeg(picks, legIndex)
      const free = leg.seats.filter((s) => s.cabinClass === cabin && s.isAvailable && !claimed.has(s.id))
      if (free.length < missing.length) {
        const cabinLabel = CABIN_CLASSES.find((c) => c.key === cabin)?.label ?? cabin
        return `Only ${free.length} ${cabinLabel} seat${free.length === 1 ? "" : "s"} left on the ${leg.label.toLowerCase()} flight, but ${missing.length} passenger${missing.length === 1 ? "" : "s"} still need${missing.length === 1 ? "s" : ""} one.`
      }
    }
    return null
  }

  function shuffleArray<T>(arr: T[]): T[] {
    const copy = [...arr]
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[copy[i], copy[j]] = [copy[j], copy[i]]
    }
    return copy
  }

  function findTogetherBlock(cabinSeats: ApiSeat[], claimed: Set<string>, count: number): ApiSeat[] | null {
    const byRow = new Map<number, ApiSeat[]>()
    cabinSeats.forEach((s) => {
      const arr = byRow.get(s.row) || []
      arr.push(s)
      byRow.set(s.row, arr)
    })
    const rowEntries = shuffleArray(Array.from(byRow.entries()))
    for (const [, rowSeats] of rowEntries) {
      const sorted = [...rowSeats].sort((a, b) => a.col.localeCompare(b.col))
      const groups = shuffleArray(groupByAisle(sorted))
      for (const group of groups) {
        for (let start = 0; start <= group.length - count; start++) {
          const slice = group.slice(start, start + count)
          if (slice.every((s) => s.isAvailable && !claimed.has(s.id))) return slice
        }
      }
    }
    return null
  }

  function runAutoAssign(cabin: CabinKey, mode: "random" | "together") {
    let anyPartial = false

    setPicks((prev) => {
      const next = { ...prev }

      legs.forEach((leg, legIndex) => {
        if (!leg.hasSeatMap) return
        const missing = passengersMissingSeat(next, legIndex)
        if (!missing.length) return

        const claimed = pickedSeatIdsForLeg(next, legIndex)
        const cabinSeats = leg.seats.filter((s) => s.cabinClass === cabin)

        let assigned: ApiSeat[] = []

        if (mode === "together") {
          const block = findTogetherBlock(cabinSeats, claimed, missing.length)
          if (block) assigned = block
          else anyPartial = true
        }

        if (assigned.length < missing.length) {
          const usedIds = new Set(assigned.map((s) => s.id))
          const pool = shuffleArray(
            cabinSeats.filter((s) => s.isAvailable && !claimed.has(s.id) && !usedIds.has(s.id))
          )
          assigned = [...assigned, ...pool.slice(0, missing.length - assigned.length)]
        }

        missing.forEach((p, i) => {
          const seat = assigned[i]
          if (seat) next[`${legIndex}:${p.id}`] = seat.id
        })
      })

      return next
    })

    setActiveCabin(cabin)
    setSkipPartialNote(
      anyPartial ? "Couldn't fit everyone in one row on every leg — closest available seats were used instead." : null
    )
    setSkipModalOpen(false)
  }

  function openSkipModal() {
    setSkipCabin(activeCabin)
    setSkipErrorMessage(null)
    setSkipStep("cabin")
    setSkipModalOpen(true)
  }

  function handleSkipCheck() {
    const reason = checkCabinAvailability(skipCabin)
    if (reason) {
      setSkipErrorMessage(reason)
      setSkipStep("error")
    } else {
      setSkipStep("mode")
    }
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

      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...selection, holdExpiresAt: data.holdExpiresAt, seatSelectionPrice: data.seatSelectionPrice ?? totalSeatPrice })
      )
      router.push("/checkout/addons")
    } catch (err) {
      console.error("Failed to save seat selection:", err)
      setSubmitError("Something went wrong saving your seats. Please try again.")
      setSubmitting(false)
    }
  }

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
            className="px-6 py-3 rounded-xl gold-cta font-semibold"
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

  const cabinMeta = CABIN_CLASSES.find((c) => c.key === activeCabin)
  const activeLegFlight = legs[activeLegIndex]?.flight ?? selection.departFlight
  const activeLegLabel = legs[activeLegIndex]?.label ?? (legs.length > 1 ? "Departure" : undefined)

  return (
    <PageShell selection={selection} router={router}>
      {legs.length > 1 && (
        <Tabs
          value={String(activeLegIndex)}
          onValueChange={(v) => setActiveLegIndex(Number(v))}
          className="mb-5"
        >
          <TabsList className="h-auto bg-white/[0.03] border border-white/[0.06] rounded-full p-1.5 gap-1">
            {legs.map((leg, i) => (
              <TabsTrigger
                key={leg.flightInstanceId}
                value={String(i)}
                className="rounded-full px-4 py-1.5 text-sm font-medium text-slate-400 data-[state=active]:text-[#060B14] data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-300 data-[state=active]:via-amber-400 data-[state=active]:to-amber-500 data-[state=active]:shadow-[0_2px_12px_rgba(251,191,36,0.35)]"
              >
                {leg.label} · {leg.flight.origin} → {leg.flight.destination}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      <FlightInfoBar flight={activeLegFlight} legLabel={activeLegLabel} />

      <div className="grid grid-cols-12 gap-6 mt-6">
        <div className="col-span-12 lg:col-span-3 space-y-4">
          <CabinClassRail
            cabins={availableCabins}
            active={activeCabin}
            onChange={setActiveCabin}
          />
          <AircraftCard flight={selection.departFlight} activeCabin={activeCabin} />
        </div>

        <div className="col-span-12 lg:col-span-6 space-y-4">
          {activeLeg && !activeLeg.hasSeatMap ? (
            <NoSeatMapCard />
          ) : activeLeg && visibleSeats.length === 0 ? (
            <EmptyCabinCard cabinLabel={cabinMeta?.label ?? activeCabin} />
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
              cabinLabel={cabinMeta?.label ?? "Cabin"}
              cheapestInCabin={cheapestInCabin}
              seatsSelectedCount={seatsSelectedCount}
              totalPassengers={passengers.length}
              zoom={zoom}
              onZoomChange={setZoom}
              onSelectSeat={selectSeat}
            />
          ) : null}
        </div>

        <div className="col-span-12 lg:col-span-3">
          <SeatSummary
            legs={legs}
            passengers={passengers}
            picks={picks}
            activeLegIndex={activeLegIndex}
            activePassengerIndex={activePassengerIndex}
            activeCabin={activeCabin}
            totalSeatPrice={totalSeatPrice}
            allSeatsAssigned={allSeatsAssigned}
            submitting={submitting}
            submitError={submitError}
            onSelectPassenger={setActivePassengerIndex}
            onClearSeat={clearSeat}
            onContinue={handleContinue}
            onSkip={openSkipModal}
          />
        </div>
      </div>

      {skipPartialNote && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] flex items-center gap-2.5 px-4 py-3 rounded-xl bg-[#0D1A2C] border border-[#D4AF37]/30 shadow-[0_12px_40px_rgba(0,0,0,0.4)]">
          <span className="text-[#E8C766] text-sm shrink-0">⚠</span>
          <p className="text-xs text-slate-300">{skipPartialNote}</p>
          <button
            onClick={() => setSkipPartialNote(null)}
            className="ml-2 text-slate-500 hover:text-slate-300 text-xs"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      {skipModalOpen && (
        <SkipSeatModal
          step={skipStep}
          cabin={skipCabin}
          errorMessage={skipErrorMessage}
          onCabinChange={setSkipCabin}
          onCheck={handleSkipCheck}
          onBackToCabin={() => setSkipStep("cabin")}
          onChooseMode={(mode) => runAutoAssign(skipCabin, mode)}
          onClose={() => setSkipModalOpen(false)}
        />
      )}
    </PageShell>
  )
}

// ---------------------------------------------------------------------------
// SkipSeatModal
// ---------------------------------------------------------------------------

function SkipSeatModal({
  step,
  cabin,
  errorMessage,
  onCabinChange,
  onCheck,
  onBackToCabin,
  onChooseMode,
  onClose,
}: {
  step: "cabin" | "mode" | "error"
  cabin: CabinKey
  errorMessage: string | null
  onCabinChange: (c: CabinKey) => void
  onCheck: () => void
  onBackToCabin: () => void
  onChooseMode: (mode: "random" | "together") => void
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md bg-gradient-to-b from-[#0D1A2C] to-[#0A1424] border border-[#D4AF37]/20 rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.5)] overflow-hidden"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 rounded-full flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/[0.06] transition-colors"
          aria-label="Close"
        >
          ✕
        </button>

        {step === "cabin" && (
          <div className="p-6">
            <p className="font-display text-lg font-semibold text-white mb-1">Skip seat selection</p>
            <p className="text-sm text-slate-500 mb-5">
              Pick a cabin and we'll assign seats for anyone who doesn't have one yet.
            </p>

            <div className="grid grid-cols-2 gap-2.5 mb-5">
              {CABIN_CLASSES.map((c) => {
                const isActive = cabin === c.key
                return (
                  <button
                    key={c.key}
                    onClick={() => onCabinChange(c.key)}
                    className={`flex flex-col items-start gap-1 px-3.5 py-3 rounded-xl border text-left transition-all ${
                      isActive
                        ? "border-[#D4AF37]/60 bg-[#D4AF37]/[0.08]"
                        : "border-white/[0.08] bg-white/[0.02] hover:border-white/20"
                    }`}
                  >
                    <span className={`text-xs font-medium ${isActive ? "text-[#E8C766]" : "text-slate-300"}`}>
                      {c.label}
                    </span>
                    <span className={`text-[11px] ${isActive ? "text-[#C9A227]/80" : "text-slate-600"}`}>
                      from ₹{c.fromPrice.toLocaleString("en-IN")}
                    </span>
                  </button>
                )
              })}
            </div>

            <button onClick={onCheck} className="w-full px-6 py-3 rounded-xl gold-cta font-semibold">
              Check availability
            </button>
          </div>
        )}

        {step === "error" && (
          <div className="p-6">
            <div className="w-11 h-11 rounded-full bg-red-400/10 border border-red-400/20 flex items-center justify-center mb-4">
              <span className="text-red-300 text-lg">!</span>
            </div>
            <p className="font-display text-base font-semibold text-white mb-1.5">Not enough seats there</p>
            <p className="text-sm text-slate-400 mb-6">{errorMessage}</p>
            <div className="flex gap-2.5">
              <button
                onClick={onBackToCabin}
                className="flex-1 px-4 py-2.5 rounded-xl font-medium bg-white/[0.06] text-white hover:bg-white/[0.1] transition-colors"
              >
                Try another cabin
              </button>
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-xl font-medium border border-white/[0.1] text-slate-300 hover:bg-white/[0.04] transition-colors"
              >
                I'll pick manually
              </button>
            </div>
          </div>
        )}

        {step === "mode" && (
          <div className="p-6">
            <p className="font-display text-lg font-semibold text-white mb-1">How should we seat everyone?</p>
            <p className="text-sm text-slate-500 mb-5">
              {CABIN_CLASSES.find((c) => c.key === cabin)?.label} has enough open seats — pick how to assign them.
            </p>

            <div className="space-y-2.5">
              <button
                onClick={() => onChooseMode("together")}
                className="w-full flex items-start gap-3 px-4 py-3.5 rounded-xl border border-white/[0.08] bg-white/[0.02] hover:border-[#D4AF37]/50 hover:bg-[#D4AF37]/[0.05] transition-all text-left group"
              >
                <span className="w-9 h-9 rounded-lg bg-[#D4AF37]/10 flex items-center justify-center text-[#E8C766] shrink-0 group-hover:bg-[#D4AF37]/20 transition-colors">
                  👥
                </span>
                <span>
                  <span className="block text-sm font-medium text-white">Seated together</span>
                  <span className="block text-[12px] text-slate-500 mt-0.5">
                    Keep the group in the same row where possible
                  </span>
                </span>
              </button>

              <button
                onClick={() => onChooseMode("random")}
                className="w-full flex items-start gap-3 px-4 py-3.5 rounded-xl border border-white/[0.08] bg-white/[0.02] hover:border-cyan-400/50 hover:bg-cyan-400/[0.05] transition-all text-left group"
              >
                <span className="w-9 h-9 rounded-lg bg-cyan-400/10 flex items-center justify-center text-cyan-300 shrink-0 group-hover:bg-cyan-400/20 transition-colors">
                  🎲
                </span>
                <span>
                  <span className="block text-sm font-medium text-white">Random seats</span>
                  <span className="block text-[12px] text-slate-500 mt-0.5">
                    Any available seat per passenger, fastest option
                  </span>
                </span>
              </button>
            </div>

            <button
              onClick={onBackToCabin}
              className="w-full mt-4 text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              ← Choose a different cabin
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// FlightInfoBar
// ---------------------------------------------------------------------------

function FlightInfoBar({ flight, legLabel }: { flight: StoredFlight; legLabel?: string }) {
  return (
    <div>
      {legLabel && (
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#C9A227]/90 font-medium mb-2 ml-1">
          {legLabel}
        </p>
      )}
      <div className="relative flex flex-wrap items-center gap-4 bg-gradient-to-r from-white/[0.04] to-white/[0.02] border border-[#D4AF37]/15 rounded-2xl px-5 py-4 shadow-[0_8px_24px_rgba(0,0,0,0.15)] ticket-edge">
      <div className="flex items-center gap-2.5 min-w-[140px]">
        <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center overflow-hidden shadow-sm ring-1 ring-black/5 shrink-0">
          <img
            src={airlineLogos[flight.airline] || "/airlines/default.png"}
            alt={flight.airline}
            className="w-6 h-6 object-contain"
          />
        </div>
        <div>
          <p className="text-xs font-medium text-white">{flight.airline} <span className="text-slate-500 font-normal">{flight.aircraft}</span></p>
          <p className="text-[11px] text-slate-500">{flight.aircraft}</p>
        </div>
      </div>

      <div className="w-px h-8 bg-[#D4AF37]/15 hidden sm:block" />

      <div className="flex items-center gap-3">
        <div>
          <p className="font-display text-lg font-semibold text-white tabular-nums">
            {flight.origin} <span className="text-slate-300">{formatTime(flight.departure_time)}</span>
          </p>
          <p className="text-[11px] text-slate-500">{formatDateLabel(flight.departure_time, flight.travel_date) || "—"}</p>
        </div>
        <div className="flex flex-col items-center gap-0.5 px-2">
          <p className="text-[10px] text-slate-500">{formatDuration(flight)}</p>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />
            <div className="w-16 h-px bg-gradient-to-r from-slate-600 to-[#D4AF37]/60" />
            <span aria-hidden className="text-[#D4AF37] text-xs -mx-1">✈</span>
            <div className="w-16 h-px bg-gradient-to-r from-[#D4AF37]/60 to-slate-600" />
            <div className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" />
          </div>
          <p className="text-[10px] text-[#C9A227]/80">{(flight.stops ?? 0) > 0 ? `${flight.stops} stop` : "Nonstop"}</p>
        </div>
        <div>
          <p className="font-display text-lg font-semibold text-white tabular-nums">
            {flight.destination} <span className="text-slate-300">{formatTime(flight.arrival_time)}</span>
          </p>
          <p className="text-[11px] text-slate-500">{formatDateLabel(flight.arrival_time, flight.travel_date) || "—"}</p>
        </div>
      </div>

      <button className="ml-auto text-xs text-slate-400 hover:text-[#E8C766] transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.08] hover:border-[#D4AF37]/30 hover:bg-[#D4AF37]/[0.04]">
        Edit flight <span aria-hidden>✎</span>
      </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// CabinClassRail — roman-numeral tier badges (I–IV) replace the generic
// icon-in-a-box: cabin classes are a real ascending hierarchy, so the
// numbering encodes that order instead of decorating.
// ---------------------------------------------------------------------------

function CabinClassRail({
  cabins,
  active,
  onChange,
}: {
  cabins: readonly (typeof CABIN_CLASSES)[number][]
  active: CabinKey
  onChange: (k: CabinKey) => void
}) {
  return (
    <div className="bg-[#0D1A2C]/60 border border-[#D4AF37]/10 rounded-2xl p-4">
      <p className="font-display text-sm font-semibold text-white mb-0.5">Choose Your Tier</p>
      <p className="text-[11px] text-slate-500 mb-4 uppercase tracking-wider">Economy → First</p>

      <div className="space-y-2.5">
        {cabins.map((c) => {
          const isActive = active === c.key
          return (
            <button
              key={c.key}
              onClick={() => onChange(c.key)}
              className={`cabin-row relative w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border text-left transition-all duration-200 ${
                isActive
                  ? "bg-[#D4AF37]/[0.06] border-[#D4AF37]/60 shadow-[0_0_24px_rgba(212,175,55,0.12)]"
                  : "border-white/[0.08] bg-white/[0.015] hover:border-white/20 hover:bg-white/[0.03]"
              }`}
            >
              <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 font-display text-sm font-semibold ${
                isActive ? "bg-[#D4AF37]/15 text-[#E8C766]" : "bg-white/[0.04] text-slate-500"
              }`}>
                {c.tier}
              </span>
              <span className="min-w-0">
                <span className={`block text-sm font-medium truncate ${isActive ? "text-white" : "text-slate-300"}`}>
                  {c.label}
                </span>
                <span className={`block text-[11px] ${isActive ? "text-[#C9A227]/80" : "text-slate-500"}`}>
                  from ₹{c.fromPrice.toLocaleString("en-IN")}
                </span>
              </span>
              {isActive && (
                <span className="ml-auto w-5 h-5 rounded-md bg-[#D4AF37] text-[#060B14] flex items-center justify-center text-[11px] font-bold shrink-0">
                  ✓
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function AircraftCard({ flight, activeCabin }: { flight: StoredFlight; activeCabin: CabinKey }) {
  return (
    <div className="bg-[#0D1A2C]/60 border border-[#D4AF37]/10 rounded-2xl p-4">
      <div className="flex items-center gap-2.5 mb-3">
        <span className="w-8 h-8 rounded-lg bg-white/[0.05] flex items-center justify-center text-[#C9A227]/80 text-sm">✈</span>
        <div>
          <p className="text-sm font-medium text-white">{flight.aircraft}</p>
          <button className="text-[11px] text-[#C9A227]/80 hover:text-[#E8C766] transition-colors">View aircraft details →</button>
        </div>
      </div>
      <div className="space-y-2 pt-2 border-t border-[#D4AF37]/10">
        {CABIN_PERKS[activeCabin].map((perk) => (
          <div key={perk.label} className="flex items-center gap-2.5 text-[12px] text-slate-400">
            <span className="text-[#C9A227]/60 w-4 text-center shrink-0">{perk.icon}</span>
            {perk.label}
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// NoSeatMapCard / EmptyCabinCard
// ---------------------------------------------------------------------------

function NoSeatMapCard() {
  return (
    <div className="bg-[#0D1A2C]/80 border border-[#D4AF37]/10 rounded-2xl p-10 text-center">
      <div className="w-12 h-12 rounded-full bg-white/[0.04] border border-white/10 flex items-center justify-center mx-auto mb-4 text-xl">
        ✈
      </div>
      <p className="text-slate-300">Seat selection isn't available for this flight yet.</p>
      <p className="text-sm text-slate-500 mt-2">Seats will be assigned at check-in.</p>
    </div>
  )
}

function EmptyCabinCard({ cabinLabel }: { cabinLabel: string }) {
  return (
    <div className="bg-[#0D1A2C]/80 border border-[#D4AF37]/10 rounded-2xl p-10 text-center">
      <div className="w-12 h-12 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/20 flex items-center justify-center mx-auto mb-4 text-xl">
        ⊘
      </div>
      <p className="text-slate-300">No {cabinLabel} seats are available on this flight.</p>
      <p className="text-sm text-slate-500 mt-2">Try a different cabin class on the left.</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SeatMapCard
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

function SeatMapCard({
  leg,
  visibleSeats,
  picks,
  activeLegIndex,
  activePassenger,
  activePassengerIndex,
  passengers,
  activeCabin,
  cabinLabel,
  cheapestInCabin,
  seatsSelectedCount,
  totalPassengers,
  zoom,
  onZoomChange,
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
  cabinLabel: string
  cheapestInCabin: number | null
  seatsSelectedCount: number
  totalPassengers: number
  zoom: number
  onZoomChange: (z: number) => void
  onSelectSeat: (seat: ApiSeat) => void
}) {
  const rows = useMemo(() => {
    const byRow = new Map<number, ApiSeat[]>()
    visibleSeats.forEach((seat) => {
      const arr = byRow.get(seat.row) || []
      arr.push(seat)
      byRow.set(seat.row, arr)
    })
    return Array.from(byRow.entries()).sort((a, b) => a[0] - b[0])
  }, [visibleSeats])

  const seatOwnerMap = useMemo(() => {
    const map: Record<string, number> = {}
    passengers.forEach((p, i) => {
      const seatId = picks[`${activeLegIndex}:${p.id}`]
      if (seatId) map[seatId] = i
    })
    return map
  }, [passengers, picks, activeLegIndex])

  const firstRowSeats = rows[0]?.[1] ?? []
  const sortedCols = [...firstRowSeats].sort((a, b) => a.col.localeCompare(b.col))
  const colGroups = groupByAisle(sortedCols)

  const podSize = activeCabin === "first" ? 92 : activeCabin === "business" ? 72 : 46
  const scaledPod = Math.round(podSize * (zoom / 100))

  return (
    <div className="relative bg-gradient-to-br from-[#0D1A2C] via-[#0B1729] to-[#0A1424] border border-[#D4AF37]/15 rounded-2xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.3)] ticket-edge">
      {/* signature accent bar — the same blue → gold pairing used for the
          "BEST" highlight and "Continue" button on the flights results page,
          so this card reads as part of the same product instead of a bare panel */}
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-blue-400 via-[#D4AF37] to-[#E8C766]" />

      <div
        className="pointer-events-none absolute -top-24 -left-16 w-72 h-72 bg-blue-500/[0.07] blur-[100px] rounded-full"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-24 -right-16 w-72 h-72 bg-[#D4AF37]/[0.06] blur-[100px] rounded-full"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      <div className="relative px-5 py-4 border-b border-[#D4AF37]/10 bg-white/[0.02]">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3.5">
          <div className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/20 flex items-center justify-center text-[#E8C766] text-xs shrink-0">
              ⛶
            </span>
            <p className="font-display text-base font-semibold text-white">{cabinLabel}</p>
          </div>
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-blue-300 bg-blue-500/[0.1] border border-blue-400/25 rounded-full px-3 py-1">
            <span aria-hidden>ⓘ</span> Tap a seat to view details
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <LegendChip variant="available" label="Available" />
          <LegendChip variant="selected" label="Selected" />
          <LegendChip variant="booked" label="Booked" />
          <LegendChip variant="locked" label="Locked" price={cheapestInCabin ?? undefined} />
        </div>
      </div>

      <div className="relative flex justify-center pt-6 pb-2">
        <div className="flex flex-col items-center gap-2">
          <svg width="32" height="16" viewBox="0 0 36 18" fill="none">
            <path d="M18 0L35 17H1L18 0Z" fill="currentColor" className="text-[#D4AF37]/20" />
            <path d="M18 5L27 14H9L18 5Z" fill="currentColor" className="text-[#D4AF37]/55" />
          </svg>
          <span className="w-2 h-2 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,0.8)]" />
        </div>
      </div>

      <div className="relative flex justify-center pb-3 overflow-x-auto">
        <div className="flex items-center gap-8" style={{ paddingLeft: 28 }}>
          {colGroups.map((group, gi) => (
            <div key={gi} className="flex items-center gap-2" style={{ gap: Math.max(6, scaledPod * 0.12) }}>
              {group.map((s) => (
                <span
                  key={s.col}
                  className="inline-flex items-center justify-center rounded-md bg-white/[0.04] border border-white/[0.06] text-[10px] font-semibold text-[#C9A227]/80 tracking-wide"
                  style={{ width: scaledPod, height: 18 }}
                >
                  {s.col}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="relative px-5 pb-6 overflow-x-auto">
        <div className="pointer-events-none absolute top-0 bottom-6 left-1 w-3 rounded-full bg-gradient-to-b from-white/[0.05] via-white/[0.02] to-white/[0.05] border border-white/[0.06] hidden sm:block" />
        <div className="pointer-events-none absolute top-0 bottom-6 right-1 w-3 rounded-full bg-gradient-to-b from-white/[0.05] via-white/[0.02] to-white/[0.05] border border-white/[0.06] hidden sm:block" />

        <div className="flex flex-col items-center gap-2.5" style={{ gap: Math.max(9, scaledPod * 0.16) }}>
          {rows.map(([rowNum, rowSeats], rowIdx) => {
            const sorted = [...rowSeats].sort((a, b) => a.col.localeCompare(b.col))
            const groups = groupByAisle(sorted)
            return (
              <div
                key={rowNum}
                className={`flex items-center gap-8 rounded-xl ${rowIdx % 2 === 0 ? "bg-white/[0.012]" : ""}`}
                style={{ paddingBlock: Math.max(2, scaledPod * 0.04) }}
              >
                <span className="w-5 text-right text-[11px] text-[#C9A227]/60 font-display tabular-nums shrink-0">{rowNum}</span>
                {groups.map((group, gi) => (
                  <div key={gi} className="flex items-center" style={{ gap: Math.max(6, scaledPod * 0.12) }}>
                    {group.map((seat) => {
                      const ownerIdx = seatOwnerMap[seat.id]
                      const isMe = picks[`${activeLegIndex}:${activePassenger.id}`] === seat.id
                      const isOtherPax = ownerIdx !== undefined && !isMe
                      const color = ownerIdx !== undefined ? paxColor(ownerIdx) : null

                      return (
                        <GoldSeatPod
                          key={seat.id}
                          seat={seat}
                          size={scaledPod}
                          cabin={activeCabin}
                          isMe={isMe}
                          isOtherPax={isOtherPax}
                          color={color}
                          onClick={() => onSelectSeat(seat)}
                        />
                      )
                    })}
                  </div>
                ))}
              </div>
            )
          })}
        </div>

        <div className="flex items-center justify-between mt-8 px-2">
          <span className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/[0.08] text-violet-300/70 text-xs">
            🚻
          </span>
          <span className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/[0.08] text-slate-400 text-xs">
            🍽
          </span>
          <span className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/[0.08] text-violet-300/70 text-xs">
            🚻
          </span>
        </div>
      </div>

      <div className="relative flex items-center justify-between px-5 py-3 border-t border-[#D4AF37]/10 bg-white/[0.015]">
        <p className="text-[11px] text-slate-500">
          <span className={seatsSelectedCount === totalPassengers ? "text-emerald-300" : "text-[#E8C766]"}>
            {seatsSelectedCount} of {totalPassengers}
          </span>{" "}
          seats selected
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onZoomChange(Math.max(70, zoom - 10))}
            className="w-7 h-7 rounded-md border border-white/10 text-slate-300 hover:bg-white/5 flex items-center justify-center text-sm"
          >
            −
          </button>
          <span className="text-xs text-slate-400 w-10 text-center tabular-nums">{zoom}%</span>
          <button
            onClick={() => onZoomChange(Math.min(150, zoom + 10))}
            className="w-7 h-7 rounded-md border border-white/10 text-slate-300 hover:bg-white/5 flex items-center justify-center text-sm"
          >
            +
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SeatIcon — a real seat-back silhouette used inside pods and legend chips,
// so the "available" state reads as a seat rather than a generic "+".
// ---------------------------------------------------------------------------

function SeatIcon({ size, className, filled = false }: { size: number; className?: string; filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M7.5 4.75C7.5 3.78 8.28 3 9.25 3h5.5c.97 0 1.75.78 1.75 1.75V12h1.75A1.75 1.75 0 0120 13.75v2.5a1 1 0 01-1 1h-1v1.75a.5.5 0 01-1 0V17.25H7v1.75a.5.5 0 01-1 0V17.25H5a1 1 0 01-1-1v-2.5A1.75 1.75 0 015.75 12H7.5V4.75z"
        fill={filled ? "currentColor" : "none"}
        fillOpacity={filled ? 1 : 0}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// GoldSeatPod — economy / premium-economy pod reshaped into a real seat-back
// silhouette (rounded headrest, narrower base) instead of a flat square, with
// the same gold gradient as the primary CTA on selection and a fine diagonal
// hatch on booked seats so "taken" reads as texture, not just a dim square.
// ---------------------------------------------------------------------------

function GoldSeatPod({
  seat,
  size,
  cabin,
  isMe,
  isOtherPax,
  color,
  onClick,
}: {
  seat: ApiSeat
  size: number
  cabin: CabinKey
  isMe: boolean
  isOtherPax: boolean
  color: (typeof PAX_COLORS)[number] | null
  onClick: () => void
}) {
  const taken = !seat.isAvailable

  if (cabin === "first") {
    return (
      <IllustratedSeatPod
        seat={seat}
        size={size}
        taken={taken}
        isMe={isMe}
        isOtherPax={isOtherPax}
        color={color}
        onClick={onClick}
      />
    )
  }

  if (cabin === "business") {
    return (
      <BusinessSeatPod
        seat={seat}
        size={size}
        taken={taken}
        isMe={isMe}
        isOtherPax={isOtherPax}
        color={color}
        onClick={onClick}
      />
    )
  }

  const iconSize = Math.max(11, Math.round(size * 0.4))
  const isExtraLegroom = seat.seatType === "extra_legroom"

  let style: React.CSSProperties = {
    width: size,
    height: size * 1.06,
  }
  let borderClass = "border-white/[0.14]"
  let innerClass = "text-slate-500"

  if (isMe) {
    style.background = "linear-gradient(160deg, #F1D98A 0%, #D4AF37 50%, #B8860B 100%)"
    style.boxShadow = "0 4px 16px rgba(212,175,55,0.45), inset 0 1px 0 rgba(255,255,255,0.4)"
    borderClass = "border-[#F1D98A]"
    innerClass = "text-[#060B14]"
  } else if (isOtherPax && color) {
    style.background = `linear-gradient(160deg, transparent, transparent)`
    borderClass = color.ring
    innerClass = color.text
  } else if (taken) {
    style.backgroundImage =
      "repeating-linear-gradient(135deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1.5px, transparent 1.5px, transparent 6px)"
    style.backgroundColor = "rgba(255,255,255,0.02)"
    borderClass = "border-white/[0.07]"
    innerClass = "text-[#B8860B]/80"
  } else if (isExtraLegroom) {
    style.background = "linear-gradient(160deg, rgba(212,175,55,0.14), rgba(212,175,55,0.04))"
    borderClass = "border-[#D4AF37]/45"
    innerClass = "text-[#E8C766]/85"
  } else {
    style.background = "linear-gradient(160deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01))"
  }

  const otherPaxBgClass = isOtherPax && color ? color.bg.replace("/10", "/50") : ""

  return (
    <button
      onClick={onClick}
      disabled={taken}
      title={`${seat.seatNumber}${isExtraLegroom ? " · Extra legroom" : ""}${seat.price > 0 ? ` · +₹${seat.price.toLocaleString("en-IN")}` : ""}`}
      style={style}
      className={`seat-btn relative flex items-center justify-center transition-all duration-150 group shrink-0 border-2 rounded-t-[42%] rounded-b-[16%] ${borderClass} ${otherPaxBgClass} ${
        taken ? "cursor-not-allowed" : "cursor-pointer hover:-translate-y-0.5 hover:border-[#E8C766]/70"
      } ${isMe ? "seat-pop" : ""}`}
    >
      {seat.isWindow && !taken && !isMe && !isOtherPax && (
        <span className="absolute top-1.5 left-1.5 w-1.5 h-1.5 rounded-full bg-sky-300/60" aria-hidden />
      )}
      {isExtraLegroom && !taken && !isMe && !isOtherPax && (
        <span className="absolute bottom-1 text-[#E8C766]/70" style={{ fontSize: size * 0.16 }} aria-hidden>
          ⌄⌄
        </span>
      )}

      {taken ? (
        <LockIcon size={Math.max(10, iconSize * 0.8)} className={innerClass} filled />
      ) : isMe ? (
        <span className={`font-bold ${innerClass}`} style={{ fontSize: Math.max(10, size * 0.26) }}>
          ✓
        </span>
      ) : isOtherPax && color ? (
        <span className={`font-bold ${innerClass}`} style={{ fontSize: Math.max(10, size * 0.24) }}>
          {seat.col}
        </span>
      ) : (
        <SeatIcon size={iconSize} className={innerClass} />
      )}
    </button>
  )
}

function BusinessSeatPod({
  seat,
  size,
  taken,
  isMe,
  isOtherPax,
  color,
  onClick,
}: {
  seat: ApiSeat
  size: number
  taken: boolean
  isMe: boolean
  isOtherPax: boolean
  color: (typeof PAX_COLORS)[number] | null
  onClick: () => void
}) {
  const ART_RATIO = 1110 / 1104
  const height = size * ART_RATIO
  const badge = { left: "13%", top: "43%", width: "27%", height: "27%" }
  const ringColor = isMe ? (color ? color.dot : "bg-violet-400") : isOtherPax && color ? color.dot : null

  return (
    <button
      onClick={onClick}
      disabled={taken}
      title={`${seat.seatNumber}${seat.price > 0 ? ` · +₹${seat.price.toLocaleString("en-IN")}` : ""}`}
      style={{ width: size, height }}
      className={`seat-btn group relative shrink-0 transition-all duration-200 ${
        taken ? "cursor-not-allowed" : "cursor-pointer hover:-translate-y-0.5"
      } ${isMe ? "seat-pop" : ""}`}
    >
      {ringColor && (
        <span className={`absolute inset-[6%] rounded-[24%] ${ringColor} opacity-25 blur-lg`} aria-hidden />
      )}

      <img
        src="/seats/business-class-seat-pod.png"
        alt=""
        draggable={false}
        className={`relative w-full h-full object-contain select-none transition-all duration-200 ${
          !taken ? "group-hover:brightness-110" : ""
        }`}
        style={{ filter: taken ? "grayscale(65%) brightness(0.55)" : undefined }}
      />

      <div className="absolute flex items-center justify-center" style={badge}>
        {taken ? (
          <span className="w-[62%] h-[62%] rounded-full bg-[#3a2410]/90 border border-[#D4AF37]/70 flex items-center justify-center">
            <LockIcon size={Math.max(11, size * 0.14)} className="text-[#E8C766]" filled />
          </span>
        ) : isMe ? (
          <span
            className={`w-[62%] h-[62%] rounded-full ${color ? color.dot : "bg-violet-400"} flex items-center justify-center font-bold text-[#060B14]`}
            style={{ fontSize: Math.max(11, size * 0.14) }}
          >
            ✓
          </span>
        ) : isOtherPax && color ? (
          <span
            className={`w-[62%] h-[62%] rounded-full ${color.bg.replace("/10", "/70")} border ${color.ring} flex items-center justify-center font-bold ${color.text}`}
            style={{ fontSize: Math.max(11, size * 0.14) }}
          >
            {seat.col}
          </span>
        ) : (
          <span className="text-slate-300 font-light group-hover:text-violet-300 transition-colors" style={{ fontSize: Math.max(14, size * 0.2) }}>
            +
          </span>
        )}
      </div>

      {!taken && !isMe && !isOtherPax && seat.price > 0 && (
        <span
          className="absolute text-[9px] leading-none px-1.5 py-0.5 rounded bg-[#060B14]/90 border border-violet-400/30 text-violet-300/80 whitespace-nowrap"
          style={{ top: size * 0.02, right: -4 }}
        >
          +₹{seat.price.toLocaleString("en-IN")}
        </span>
      )}
    </button>
  )
}

function IllustratedSeatPod({
  seat,
  size,
  taken,
  isMe,
  isOtherPax,
  color,
  onClick,
}: {
  seat: ApiSeat
  size: number
  taken: boolean
  isMe: boolean
  isOtherPax: boolean
  color: (typeof PAX_COLORS)[number] | null
  onClick: () => void
}) {
  const ART_RATIO = 795 / 829
  const height = size * ART_RATIO
  const badge = { left: "21%", top: "12%", width: "36%", height: "36%" }
  const ringColor = isMe ? (color ? color.dot : "bg-[#D4AF37]") : isOtherPax && color ? color.dot : null

  return (
    <button
      onClick={onClick}
      disabled={taken}
      title={`${seat.seatNumber}${seat.price > 0 ? ` · +₹${seat.price.toLocaleString("en-IN")}` : ""}`}
      style={{ width: size, height }}
      className={`seat-btn group relative shrink-0 transition-all duration-200 ${
        taken ? "cursor-not-allowed" : "cursor-pointer hover:-translate-y-0.5"
      } ${isMe ? "seat-pop" : ""}`}
    >
      {ringColor && (
        <span
          className={`absolute inset-[6%] rounded-[24%] ${ringColor} opacity-25 blur-lg`}
          aria-hidden
        />
      )}

      <img
        src="/seats/first-class-seat-pod.png"
        alt=""
        draggable={false}
        className={`relative w-full h-full object-contain select-none transition-all duration-200 ${
          !taken ? "group-hover:brightness-110" : ""
        }`}
        style={{
          filter: taken ? "grayscale(65%) brightness(0.55)" : undefined,
        }}
      />

      <div
        className="absolute flex items-center justify-center"
        style={badge}
      >
        {taken ? (
          <span className="w-[62%] h-[62%] rounded-full bg-[#3a2410]/90 border border-[#D4AF37]/70 flex items-center justify-center">
            <LockIcon size={Math.max(12, size * 0.15)} className="text-[#E8C766]" filled />
          </span>
        ) : isMe ? (
          <span
            className={`w-[62%] h-[62%] rounded-full ${color ? color.dot : "bg-[#D4AF37]"} flex items-center justify-center font-bold text-[#060B14]`}
            style={{ fontSize: Math.max(11, size * 0.15) }}
          >
            ✓
          </span>
        ) : isOtherPax && color ? (
          <span
            className={`w-[62%] h-[62%] rounded-full ${color.bg.replace("/10", "/70")} border ${color.ring} flex items-center justify-center font-bold ${color.text}`}
            style={{ fontSize: Math.max(11, size * 0.15) }}
          >
            {seat.col}
          </span>
        ) : (
          <span
            className="text-slate-300 font-light group-hover:text-[#E8C766] transition-colors"
            style={{ fontSize: Math.max(15, size * 0.22) }}
          >
            +
          </span>
        )}
      </div>

      {!taken && !isMe && !isOtherPax && seat.price > 0 && (
        <span
          className="absolute text-[9px] leading-none px-1.5 py-0.5 rounded bg-[#060B14]/90 border border-[#D4AF37]/30 text-[#C9A227]/80 whitespace-nowrap"
          style={{ top: size * 0.02, right: -4 }}
        >
          +₹{seat.price.toLocaleString("en-IN")}
        </span>
      )}
    </button>
  )
}

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

// ---------------------------------------------------------------------------
// LegendChip — swatches now mirror the actual seat-pod shape and gradient
// per state (available / selected / booked / locked) instead of plain
// rounded squares, so the legend reads as a key to the map, not decoration.
// ---------------------------------------------------------------------------

function LegendChip({
  variant,
  label,
  price,
}: {
  variant: "available" | "selected" | "booked" | "locked"
  label: string
  price?: number
}) {
  const swatchStyle: React.CSSProperties =
    variant === "selected"
      ? { background: "linear-gradient(160deg, #F1D98A 0%, #D4AF37 50%, #B8860B 100%)" }
      : variant === "booked"
      ? {
          backgroundImage:
            "repeating-linear-gradient(135deg, rgba(255,255,255,0.08) 0px, rgba(255,255,255,0.08) 1.5px, transparent 1.5px, transparent 5px)",
          backgroundColor: "rgba(255,255,255,0.03)",
        }
      : variant === "locked"
      ? { background: "rgba(212,175,55,0.12)" }
      : { background: "rgba(255,255,255,0.04)" }

  const borderClass =
    variant === "selected"
      ? "border-[#F1D98A]"
      : variant === "booked"
      ? "border-white/[0.1]"
      : variant === "locked"
      ? "border-[#D4AF37]/40"
      : "border-white/[0.16]"

  return (
    <div className="flex items-center gap-1.5">
      <span
        style={swatchStyle}
        className={`relative w-4 h-[17px] rounded-t-[42%] rounded-b-[16%] border flex items-center justify-center ${borderClass}`}
      >
        {variant === "selected" && <span className="text-[#060B14] text-[8px] font-bold">✓</span>}
        {variant === "booked" && <LockIcon size={7} className="text-[#B8860B]/90" filled />}
        {variant === "locked" && <LockIcon size={7} className="text-[#E8C766]" filled />}
      </span>
      <span className="text-[11px] text-slate-400">
        {label}
        {typeof price === "number" && <span className="text-slate-600"> · ₹{price.toLocaleString("en-IN")}</span>}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SeatSummary
// ---------------------------------------------------------------------------

function SeatSummary({
  legs,
  passengers,
  picks,
  activeLegIndex,
  activePassengerIndex,
  activeCabin,
  totalSeatPrice,
  allSeatsAssigned,
  submitting,
  submitError,
  onSelectPassenger,
  onClearSeat,
  onContinue,
  onSkip,
}: {
  legs: LegSeatMap[]
  passengers: StoredPassenger[]
  picks: SelectionMap
  activeLegIndex: number
  activePassengerIndex: number
  activeCabin: CabinKey
  totalSeatPrice: number
  allSeatsAssigned: boolean
  submitting: boolean
  submitError: string | null
  onSelectPassenger: (i: number) => void
  onClearSeat: (passengerId: string) => void
  onContinue: () => void
  onSkip: () => void
}) {
  const noSeatMapsAtAll = legs.every((l) => !l.hasSeatMap)
  const activeLeg = legs[activeLegIndex]
  const assignedCount = passengers.filter((p) => !!picks[`${activeLegIndex}:${p.id}`]).length
  const praise = CABIN_PRAISE[activeCabin]

  return (
    <div className="sticky top-24 space-y-4">
      <div className="relative bg-gradient-to-b from-[#0D1A2C] to-[#0A1424] border border-[#D4AF37]/15 rounded-2xl overflow-hidden ticket-edge">
        <div className="px-5 py-4 border-b border-[#D4AF37]/10 flex items-center justify-between">
          <p className="font-display text-sm font-semibold text-white tracking-wide">Your Selection</p>
          <span className={`text-[11px] font-medium ${assignedCount === passengers.length ? "text-emerald-300" : "text-slate-500"}`}>
            {assignedCount} of {passengers.length} seats selected
          </span>
        </div>

        <div className="px-5 py-4 space-y-2.5">
          {passengers.map((p, pIdx) => {
            const seatId = picks[`${activeLegIndex}:${p.id}`]
            const seat = activeLeg?.seats.find((s) => s.id === seatId)
            const color = paxColor(pIdx)
            const isActive = activePassengerIndex === pIdx

            return (
              <div
                key={p.id}
                onClick={() => onSelectPassenger(pIdx)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-colors ${
                  isActive ? `${color.ring} ${color.bg}` : "border-white/[0.06] hover:border-white/15 hover:bg-white/[0.02]"
                }`}
              >
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${color.dot} text-[#060B14]`}>
                  {paxInitials(p, pIdx)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white truncate">{paxFullName(p, pIdx)}</p>
                  <p className="text-[10px] text-slate-500">{paxTypeLabel(p)}</p>
                </div>
                {seat ? (
                  <>
                    <div className="text-right shrink-0">
                      <span
                        className={`inline-flex items-center rounded-full font-mono text-[11px] font-semibold px-2.5 py-0.5 ${color.badge}`}
                      >
                        {seat.seatNumber}
                      </span>
                      {seat.price > 0 && (
                        <p className="text-[11px] text-slate-300 tabular-nums mt-0.5">₹{seat.price.toLocaleString("en-IN")}</p>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onClearSeat(p.id)
                      }}
                      className="text-slate-600 hover:text-red-400 transition-colors shrink-0"
                      aria-label={`Remove seat for ${paxFullName(p, pIdx)}`}
                    >
                      🗑
                    </button>
                  </>
                ) : (
                  <span className="text-[11px] text-slate-600 italic shrink-0">No seat</span>
                )}
              </div>
            )
          })}
        </div>

        <div className="relative my-1 px-5">
          <div className="border-t border-dashed border-[#D4AF37]/20" />
          <span className="absolute -left-[26px] -top-3 w-6 h-6 rounded-full bg-[#060B14]" />
          <span className="absolute -right-[26px] -top-3 w-6 h-6 rounded-full bg-[#060B14]" />
        </div>

        <div className="px-5 pt-4 pb-4">
          <div className="border border-blue-400/25 bg-blue-500/[0.07] rounded-xl px-4 py-3.5 flex items-end justify-between">
            <span className="text-sm text-slate-300">Total Seat Price</span>
            <span className={`font-display text-[28px] leading-none font-extrabold tabular-nums text-[#E8C766] ${totalSeatPrice > 0 ? "seat-pop" : ""}`}>
              ₹{totalSeatPrice.toLocaleString("en-IN")}
            </span>
          </div>
        </div>

        {assignedCount > 0 && (
          <div className="mx-5 mb-4 flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-emerald-400/[0.08] border border-emerald-400/20">
            <span className="text-emerald-300 shrink-0">✓</span>
            <div>
              <p className="text-[12px] font-medium text-emerald-300">{praise.title}</p>
              <p className="text-[11px] text-emerald-300/70 mt-0.5">{praise.body}</p>
            </div>
          </div>
        )}

        {submitError && (
          <div className="px-5 mb-4">
            <p className="text-xs text-red-300 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
              {submitError}
            </p>
          </div>
        )}

        <div className="px-5 pb-5 space-y-2.5">
          <button
            onClick={onContinue}
            disabled={(!allSeatsAssigned && !noSeatMapsAtAll) || submitting}
            className={`continue-cta relative overflow-hidden w-full px-6 py-3.5 rounded-full font-semibold pill-cta transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none ${
              (allSeatsAssigned || noSeatMapsAtAll) && !submitting ? "rail-glow" : ""
            }`}
          >
            {(allSeatsAssigned || noSeatMapsAtAll) && !submitting && (
              <span className="shimmer-sweep absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent skew-x-[-20deg]" />
            )}
            <span className="relative">{submitting ? "Saving…" : "Continue to Add-ons"}</span>
            {!submitting && <span aria-hidden className="relative">→</span>}
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

      <div className="bg-gradient-to-b from-[#0D1A2C] to-[#0A1424] border border-[#D4AF37]/15 rounded-2xl p-5">
        <p className="font-display text-sm font-semibold text-white mb-3">
          {CABIN_CLASSES.find((c) => c.key === activeCabin)?.label} Benefits
        </p>
        <div className="space-y-2.5">
          {CABIN_PERKS[activeCabin].map((perk) => (
            <div key={perk.label} className="flex items-start gap-2.5">
              <span className="text-[#C9A227]/70 text-sm w-4 shrink-0">{perk.icon}</span>
              <div>
                <p className="text-[12px] text-slate-200">{perk.label}</p>
                <p className="text-[11px] text-slate-500">{perk.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 bg-gradient-to-r from-white/[0.04] to-white/[0.02] border border-white/[0.08] rounded-2xl px-4 py-3.5">
        <span className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-lg shrink-0">🤖</span>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] text-white font-medium">Need help choosing a seat?</p>
          <button className="text-[11px] text-cyan-300 hover:text-cyan-200 transition-colors">Chat with NavBot</button>
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
  children: ReactNode
  selection?: CheckoutSelection
  router?: ReturnType<typeof useRouter>
}) {
  return (
    <div className="min-h-screen bg-[#060B14] text-white relative overflow-x-hidden">
      <PageStyles />

      {/* film-grain texture — foil-stamped cardstock feel over the dark cabin */}
      <div className="pointer-events-none fixed inset-0 opacity-[0.05] mix-blend-overlay grain-layer" />

      <div className="pointer-events-none fixed top-[-200px] left-[15%] w-[600px] h-[600px] bg-[#D4AF37]/[0.05] blur-[160px] rounded-full ambient-drift-1" />
      <div className="pointer-events-none fixed bottom-[-200px] right-[10%] w-[500px] h-[500px] bg-cyan-400/[0.05] blur-[160px] rounded-full ambient-drift-2" />
      <div className="pointer-events-none fixed top-[30%] right-[25%] w-[350px] h-[350px] bg-violet-400/[0.03] blur-[140px] rounded-full ambient-drift-3" />

      <Navbar />

      <div className="relative max-w-[1600px] mx-auto px-6 pt-24 pb-16">
        <div className="flex items-center justify-between gap-6 mb-10">
          <button
            onClick={() => router?.push("/checkout/passengers")}
            className="group flex items-center gap-2 pl-2 pr-3.5 py-1.5 rounded-full text-sm text-slate-400 hover:text-white border border-transparent hover:border-white/10 hover:bg-white/[0.04] transition-colors shrink-0"
          >
            <span className="w-6 h-6 rounded-full bg-white/[0.05] flex items-center justify-center group-hover:bg-white/10 transition-colors" aria-hidden>
              ←
            </span>
            Back to passenger details
          </button>

          <Stepper currentStepId={4} />
        </div>

        {children}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Stepper — a single continuous track (not dashed segments) so progress
// reads as one journey; the fill genuinely encodes how far through the six
// real, ordered checkout steps the traveller is, per the roman-numeral
// numbering logic used elsewhere on this page.
// ---------------------------------------------------------------------------

function Stepper({ currentStepId }: { currentStepId: number }) {
  const progressPct = ((currentStepId - 1) / (steps.length - 1)) * 100

  return (
    <div className="relative hidden md:flex items-center flex-1 max-w-2xl">
      <div className="absolute left-4 right-4 h-[2px] bg-white/[0.08] rounded-full" />
      <div
        className="absolute left-4 h-[2px] bg-gradient-to-r from-emerald-400 to-[#D4AF37] rounded-full transition-all duration-500"
        style={{ width: `calc(${progressPct}% - ${progressPct > 0 ? 32 : 0}px)` }}
      />

      <div className="relative flex items-center justify-between w-full">
        {steps.map((step) => {
          const isDone = step.id < currentStepId
          const isCurrent = step.id === currentStepId
          return (
            <div key={step.id} className="flex flex-col items-center gap-1.5 bg-[#060B14] px-1">
              <span
                className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold border-2 transition-all ${
                  isCurrent
                    ? "border-[#D4AF37] bg-[#D4AF37]/15 text-[#E8C766] shadow-[0_0_0_4px_rgba(212,175,55,0.12)] glow-pulse"
                    : isDone
                    ? "border-emerald-400/70 bg-emerald-400/15 text-emerald-300"
                    : "border-white/15 bg-white/[0.03] text-slate-600"
                }`}
              >
                {isDone ? "✓" : step.id}
              </span>
              <span
                className={`text-[11px] whitespace-nowrap ${
                  isCurrent ? "text-[#E8C766] font-semibold" : isDone ? "text-emerald-300/70" : "text-slate-600"
                }`}
              >
                {step.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PageStyles() {
  return (
    <style jsx global>{`
      @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@600;700;800&display=swap');

      /* Bold geometric sans — matches the big price/time numerals on the
         flights results page (₹9,597 · 9:00 AM), replacing the mismatched
         serif that made this page feel like a different product. */
      .font-display { font-family: 'Manrope', ui-sans-serif, system-ui, sans-serif; letter-spacing: -0.01em; }

      /* Gold CTA — richer brass gradient than a flat Tailwind amber */
      .gold-cta {
        background: linear-gradient(135deg, #E8C766 0%, #D4AF37 45%, #B8860B 100%);
        color: #060B14;
        box-shadow: 0 8px 30px rgba(212,175,55,0.22);
      }
      .gold-cta:hover { filter: brightness(1.05); }

      /* Blue → gold pill CTA — same pairing as the "Continue" button on the
         flights results page, so the primary action reads identically
         across the booking flow instead of switching to a flat gold box. */
      .pill-cta {
        background: linear-gradient(90deg, #38BDF8 0%, #60A5FA 30%, #D4AF37 70%, #E8C766 100%);
        color: #060B14;
        box-shadow: 0 8px 30px rgba(56,189,248,0.18), 0 8px 30px rgba(212,175,55,0.18);
      }
      .pill-cta:hover { filter: brightness(1.06); }

      /* Hairline gold ticket border, echoing a real boarding-pass edge */
      .ticket-edge { position: relative; }
      .ticket-edge::before {
        content: "";
        position: absolute;
        inset: 3px;
        border: 1px solid rgba(212,175,55,0.12);
        border-radius: inherit;
        pointer-events: none;
      }

      /* Faint animated grain, like foil-stamped cardstock under the ambient glow */
      .grain-layer {
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E");
      }

      @keyframes ambientDrift1 { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(40px, 30px); } }
      @keyframes ambientDrift2 { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(-30px, -40px); } }
      @keyframes ambientDrift3 { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(20px, -20px) scale(1.1); } }
      .ambient-drift-1 { animation: ambientDrift1 14s ease-in-out infinite; }
      .ambient-drift-2 { animation: ambientDrift2 16s ease-in-out infinite; }
      .ambient-drift-3 { animation: ambientDrift3 12s ease-in-out infinite; }

      @keyframes glowPulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
      .glow-pulse { animation: glowPulse 1.8s ease-in-out infinite; }

      @keyframes seatPop { 0% { transform: scale(0.85); } 60% { transform: scale(1.12); } 100% { transform: scale(1.05); } }
      .seat-pop { animation: seatPop 380ms cubic-bezier(0.34,1.56,0.64,1); }

      @keyframes shimmerSweep { 0% { transform: translateX(-120%); } 100% { transform: translateX(120%); } }
      .shimmer-sweep { animation: shimmerSweep 2.8s ease-in-out infinite; }

      @keyframes railGlow { 0%, 100% { box-shadow: 0 0 12px 1px rgba(212,175,55,0.18); } 50% { box-shadow: 0 0 22px 4px rgba(212,175,55,0.38); } }
      .rail-glow { animation: railGlow 2.2s ease-in-out infinite; }

      .cabin-row:hover { transform: translateY(-1px); }
      .seat-btn:hover:not(:disabled) { transform: translateY(-3px) scale(1.04); }
      .seat-btn:active:not(:disabled) { transform: translateY(0) scale(0.97); }

      .continue-cta:hover { transform: scale(1.02); }
      .continue-cta:active { transform: scale(0.98); }

      @media (prefers-reduced-motion: reduce) {
        .ambient-drift-1, .ambient-drift-2, .ambient-drift-3,
        .glow-pulse, .seat-pop, .shimmer-sweep, .rail-glow {
          animation: none !important;
        }
      }
    `}</style>
  )
}

function CenteredMessage({ text }: { text: string }) {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <p className="text-slate-500 text-sm tracking-wide font-display">{text}</p>
    </div>
  )
}