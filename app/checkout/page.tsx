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
  id: string // booking_passengers.id, returned by /api/bookings on save
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
  savedPassengers?: StoredPassenger[] // written by the passenger details step
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

// passengerId -> seatId, scoped per leg via a composite key "legIndex:passengerId"
type SelectionMap = Record<string, string>

const STORAGE_KEY = "navigo:checkoutSelection"

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

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // ---- hydrate selection from sessionStorage -------------------------------
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      if (!raw) {
        setLoadState("missing")
        return
      }
      const parsed = JSON.parse(raw) as CheckoutSelection
      if (!parsed.bookingId) {
        // Passenger details haven't been saved yet — nothing to attach
        // seats to, so this step can't proceed.
        setLoadState("missing")
        return
      }
      setSelection(parsed)
      setLoadState("found")
    } catch (err) {
      console.error("Failed to read checkout selection:", err)
      setLoadState("missing")
    }
  }, [])

  // ---- fetch seat maps for each leg ----------------------------------------
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

            if (!res.ok) {
              throw new Error(data?.error || `Failed to load seats for ${label.toLowerCase()} flight`)
            }

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

        // Pre-fill any seats already saved for this booking (re-entering the step)
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
    if (selection?.savedPassengers && selection.savedPassengers.length > 0) {
      return selection.savedPassengers
    }
    // Fallback if passenger names weren't stashed in sessionStorage —
    // selection still works, just labeled generically.
    const count = selection?.passengers || 1
    return Array.from({ length: count }, (_, i) => ({
      id: `passenger-${i}`,
      firstName: `Passenger`,
      lastName: `${i + 1}`,
      type: "adult",
    }))
  }, [selection])

  const activeLeg = legs[activeLegIndex]
  const activePassenger = passengers[activePassengerIndex]

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
    // Legs with no generated seat map can't be assigned at all — don't let
    // them block continuing, the summary already offers "Skip" for those.
    return legs
      .map((leg, originalIndex) => ({ leg, originalIndex }))
      .filter(({ leg }) => leg.hasSeatMap)
      .every(({ originalIndex }) =>
        passengers.every((p) => !!picks[`${originalIndex}:${p.id}`])
      )
  }, [legs, passengers, picks])

  function selectSeat(seat: ApiSeat) {
    if (!seat.isAvailable) return

    const key = `${activeLegIndex}:${activePassenger.id}`

    setPicks((prev) => {
      const next = { ...prev }

      // a seat can only belong to one passenger on this leg — if someone
      // else on this leg already holds it, release it from them first
      Object.keys(next).forEach((k) => {
        if (k.startsWith(`${activeLegIndex}:`) && next[k] === seat.id) {
          delete next[k]
        }
      })

      next[key] = seat.id

      // auto-advance to the next passenger without a seat on this leg, then
      // the next leg — computed here against the fresh map, not the stale
      // render-time `picks`, so it never lands on a passenger who was just
      // assigned a seat moments ago.
      const nextPassengerIndex = passengers.findIndex(
        (p, i) => i > activePassengerIndex && !next[`${activeLegIndex}:${p.id}`]
      )
      if (nextPassengerIndex !== -1) {
        setActivePassengerIndex(nextPassengerIndex)
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
                return {
                  passengerId: p.id,
                  seatId: seat.id,
                  seatNumber: seat.seatNumber,
                  price: seat.price,
                }
              })
              .filter((s): s is NonNullable<typeof s> => s !== null),
          })),
      }

      if (payload.legs.every((l) => l.seats.length === 0)) {
        // nothing seat-mapped at all — just move on, same as "Skip"
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
          // a seat got taken between fetch and submit — refresh maps so the
          // traveler sees current availability instead of stale data
          setLegsLoading(true)
          const refreshed = await Promise.all(
            legs.map(async (leg) => {
              const r = await fetch(
                `/api/flights/${leg.flightInstanceId}/seats?bookingId=${selection.bookingId}`
              )
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

  // ---- render states ---------------------------------------------------

  if (loadState === "loading") {
    return (
      <PageShell>
        <CenteredMessage text="Preparing your itinerary…" />
      </PageShell>
    )
  }

  if (loadState === "missing" || !selection) {
    return (
      <PageShell>
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
          <p className="text-slate-300">We couldn't find an active booking with passenger details saved.</p>
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
      <div className="grid grid-cols-12 gap-6">
        {/* LEFT — seat map */}
        <div className="col-span-12 lg:col-span-8 space-y-5">
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

          {/* passenger tabs for the active leg */}
          <div className="flex gap-2 flex-wrap">
            {passengers.map((p, i) => {
              const seatId = picks[`${activeLegIndex}:${p.id}`]
              const seat = activeLeg?.seats.find((s) => s.id === seatId)
              return (
                <button
                  key={p.id}
                  onClick={() => setActivePassengerIndex(i)}
                  className={`px-3.5 py-2 rounded-lg text-xs font-medium border transition-colors flex items-center gap-2 ${
                    activePassengerIndex === i
                      ? "border-cyan-400 bg-cyan-400/10 text-cyan-300"
                      : "border-white/10 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {p.firstName} {p.lastName}
                  {seat && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-400/15 text-emerald-300">
                      {seat.seatNumber}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {activeLeg && !activeLeg.hasSeatMap ? (
            <div className="bg-gradient-to-br from-[#0D1A2C] via-[#0B1729] to-[#0A1424] border border-white/[0.08] rounded-2xl p-10 text-center">
              <p className="text-slate-300">Seat selection isn't available for this flight yet.</p>
              <p className="text-sm text-slate-500 mt-2">You can skip this step — seats will be assigned at check-in.</p>
            </div>
          ) : activeLeg ? (
            <SeatMapCard
              leg={activeLeg}
              picks={picks}
              activeLegIndex={activeLegIndex}
              activePassenger={activePassenger}
              onSelectSeat={selectSeat}
            />
          ) : null}
        </div>

        {/* RIGHT — selection summary */}
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
// PageShell — background, navbar, stepper (same chrome as checkout page)
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
        <div className="flex items-center justify-between mb-10">
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
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold border transition-colors
                    ${
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
                      step.id === 4 ? "text-amber-300 font-medium" : step.id < 4 ? "text-emerald-300/80" : "text-slate-600"
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

// ---------------------------------------------------------------------------
// SeatMapCard — the actual grid
// ---------------------------------------------------------------------------

function SeatMapCard({
  leg,
  picks,
  activeLegIndex,
  activePassenger,
  onSelectSeat,
}: {
  leg: LegSeatMap
  picks: SelectionMap
  activeLegIndex: number
  activePassenger: StoredPassenger
  onSelectSeat: (seat: ApiSeat) => void
}) {
  const rows = useMemo(() => {
    const byRow = new Map<number, ApiSeat[]>()
    leg.seats.forEach((seat) => {
      const arr = byRow.get(seat.row) || []
      arr.push(seat)
      byRow.set(seat.row, arr)
    })
    return Array.from(byRow.entries()).sort((a, b) => a[0] - b[0])
  }, [leg.seats])

  const myPickedSeatIdsThisLeg = new Set(
    Object.entries(picks)
      .filter(([k]) => k.startsWith(`${activeLegIndex}:`))
      .map(([, v]) => v)
  )

  return (
    <div className="bg-gradient-to-br from-[#0D1A2C] via-[#0B1729] to-[#0A1424] border border-white/[0.08] rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] bg-white/[0.02]">
        <p className="text-sm text-slate-300">
          Choosing seat for <span className="text-cyan-300 font-medium">{activePassenger.firstName} {activePassenger.lastName}</span>
        </p>
        <div className="flex items-center gap-4 text-[11px] text-slate-500">
          <Legend swatch="bg-white/10 border-white/20" label="Available" />
          <Legend swatch="bg-amber-400/20 border-amber-400/50" label="Extra legroom" />
          <Legend swatch="bg-cyan-400/30 border-cyan-400" label="Selected" />
          <Legend swatch="bg-slate-700/40 border-slate-600/40" label="Taken" />
        </div>
      </div>

      <div className="px-6 py-8 overflow-x-auto">
        <div className="min-w-[420px] mx-auto flex flex-col items-center gap-2">
          {rows.map(([rowNum, rowSeats]) => (
            <div key={rowNum} className="flex items-center gap-2">
              <span className="w-6 text-right text-[11px] text-slate-500 tabular-nums">{rowNum}</span>
              {rowSeats
                .sort((a, b) => a.col.localeCompare(b.col))
                .map((seat, idx) => {
                  const isSelectedByMe = myPickedSeatIdsThisLeg.has(seat.id)
                  const aisleGapAfter = seat.isAisle && idx < rowSeats.length - 1

                  return (
                    <div key={seat.id} className="flex items-center">
                      <button
                        onClick={() => onSelectSeat(seat)}
                        disabled={!seat.isAvailable}
                        title={`${seat.seatNumber}${seat.price > 0 ? ` · +₹${seat.price}` : ""}`}
                        className={`w-9 h-9 rounded-lg border text-[10px] font-mono flex items-center justify-center transition-all
                          ${
                            isSelectedByMe
                              ? "bg-cyan-400/30 border-cyan-400 text-cyan-200 scale-105"
                              : !seat.isAvailable
                              ? "bg-slate-700/40 border-slate-600/40 text-slate-600 cursor-not-allowed"
                              : seat.seatType === "extra_legroom"
                              ? "bg-amber-400/20 border-amber-400/50 text-amber-200 hover:scale-105"
                              : "bg-white/10 border-white/20 text-slate-300 hover:bg-white/15 hover:scale-105"
                          }`}
                      >
                        {seat.col}
                      </button>
                      {aisleGapAfter && <span className="w-4" />}
                    </div>
                  )
                })}
            </div>
          ))}
        </div>
      </div>
    </div>
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
// SeatSummary — right rail, ticket-stub style to match FareSummary
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
        <div className="px-6 py-5">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Seat Selection</p>
        </div>

        <div className="px-6 space-y-4">
          {legs.map((leg, legIndex) => (
            <div key={leg.flightInstanceId}>
              <p className="text-xs text-slate-500 mb-1.5">{leg.label}</p>
              <div className="space-y-1.5">
                {passengers.map((p) => {
                  const seatId = picks[`${legIndex}:${p.id}`]
                  const seat = leg.seats.find((s) => s.id === seatId)
                  return (
                    <div key={p.id} className="flex justify-between text-sm">
                      <span className="text-slate-400">{p.firstName} {p.lastName}</span>
                      <span className={seat ? "text-slate-200 font-mono text-xs" : "text-slate-600 text-xs"}>
                        {seat ? `${seat.seatNumber}${seat.price > 0 ? ` · ₹${seat.price}` : ""}` : "Not selected"}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="relative my-5 px-6">
          <div className="border-t border-dashed border-white/[0.14]" />
          <span className="absolute -left-[26px] -top-3 w-6 h-6 rounded-full bg-[#060B14]" />
          <span className="absolute -right-[26px] -top-3 w-6 h-6 rounded-full bg-[#060B14]" />
        </div>

        <div className="px-6 flex items-end justify-between mb-5">
          <span className="text-sm text-slate-400">Seat Total</span>
          <span className="text-[28px] leading-none font-semibold tabular-nums text-amber-300">
            ₹{totalSeatPrice.toLocaleString("en-IN")}
          </span>
        </div>

        {submitError && (
          <div className="px-6 mb-4">
            <p className="text-xs text-red-300 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
              {submitError}
            </p>
          </div>
        )}

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