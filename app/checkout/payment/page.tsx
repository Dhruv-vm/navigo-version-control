"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import Navbar from "@/components/navbar"
import { PaymentCard } from "./PaymentCard"
import { RazorpaySandboxModal } from "./RazorpaySandboxModal"
import { UpiPanel } from "./UpiPanel"
import { BoardingPassDeck, type BoardingPassData } from "./BoardingPassDeck"
import {
  detectCardBrand,
  sanitizeCardNumberInput,
  sanitizeExpiryInput,
  sanitizeCvvInput,
  validateCardForm,
  type CardFieldErrors,
} from "./cardUtils"
import { formatINR, deriveFlightNumber } from "./bookingUtils"

type StoredFlight = {
  id: string
  flight_instance_id: string
  airline: string
  origin: string
  destination: string
  departure_time: string
  arrival_time: string
  aircraft: string
  stops?: number
  final_price: number
  duration?: string
  travel_date?: string
}

type StoredAddon = { id: string; title: string; variant: string; price: number }

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
  holdExpiresAt?: string
  seatSelectionPrice?: number
  addons?: StoredAddon[]
  addonsTotal?: number
  savedPassengers?: { id?: string; first_name?: string; firstName?: string; last_name?: string; lastName?: string }[]
}

const STORAGE_KEY = "navigo:checkoutSelection"
const HOLD_MINUTES = 15

// ✅ FIX: these are the same namespaced keys app/checkout/passengers/page.tsx
// writes a completed booking's id and passenger draft into. They were never
// cleared anywhere, so after a successful payment, the NEXT booking attempt
// by the same user would silently pick the old (now-confirmed) bookingId
// back up on the Passengers page and try to update it — which the bookings
// API correctly rejects (status is no longer "draft"), surfacing as
// "Booking not found" (POST /api/bookings 404) and making it look like the
// user can't book again.
const PAX_DRAFT_BASE_KEY = "navigo:passengerDraft"
const BOOKING_ID_BASE_KEY = "navigo:bookingId"

function decodeUserIdFromToken(token: string): string | null {
  try {
    const payload = token.split(".")[1]
    const decoded = JSON.parse(atob(payload))
    return decoded?.userId ?? null
  } catch {
    return null
  }
}

function clearStaleBookingSession() {
  try {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
    const namespace = token ? decodeUserIdFromToken(token) || "guest" : "guest"
    sessionStorage.removeItem(`${BOOKING_ID_BASE_KEY}:${namespace}`)
    sessionStorage.removeItem(`${PAX_DRAFT_BASE_KEY}:${namespace}`)
  } catch (err) {
    console.error("Failed to clear stale booking session keys:", err)
  }
}

const steps = [
  { id: 1, label: "Search" },
  { id: 2, label: "Select" },
  { id: 3, label: "Passengers" },
  { id: 4, label: "Seats" },
  { id: 5, label: "Add-ons" },
  { id: 6, label: "Payment" },
]

const airlineLogos: Record<string, string> = {
  "IndiGo": "/airlines/indigo.png",
  "Air India": "/airlines/airindia.png",
  "Vistara": "/airlines/vistara.png",
  "Akasa Air": "/airlines/akasa.png",
  "Emirates": "/airlines/emirates.png",
  "Qatar Airways": "/airlines/qatar.png",
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
  const d = new Date(timeStr)
  if (isNaN(d.getTime())) return "--:--"
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

function passengerDisplayName(p: NonNullable<CheckoutSelection["savedPassengers"]>[number]): string {
  const first = p.first_name || p.firstName || "Passenger"
  const last = p.last_name || p.lastName || ""
  return `${first} ${last}`.trim()
}

export default function PaymentPage() {
  const router = useRouter()

  const [selection, setSelection] = useState<CheckoutSelection | null>(null)
  const [loadState, setLoadState] = useState<"loading" | "found" | "missing">("loading")
  const [mounted, setMounted] = useState(false)

  const [method, setMethod] = useState<"card" | "upi">("card")

  const [name, setName] = useState("")
  const [numberDigits, setNumberDigits] = useState("")
  const [expiry, setExpiry] = useState("")
  const [cvv, setCvv] = useState("")
  const [focusedField, setFocusedField] = useState<"name" | "number" | "expiry" | "cvv" | null>(null)
  const [errors, setErrors] = useState<CardFieldErrors>({})
  const [touchedSubmit, setTouchedSubmit] = useState(false)

  const brand = useMemo(() => detectCardBrand(numberDigits), [numberDigits])

  const [gatewayOpen, setGatewayOpen] = useState(false)
  const [lastFailure, setLastFailure] = useState<string | null>(null)
  const [paid, setPaid] = useState(false)
  const [pnr, setPnr] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [pendingConfirm, setPendingConfirm] = useState<{ amountPaid: number; method: "card" | "upi" } | null>(null)

  const [msLeft, setMsLeft] = useState<number | null>(null)

  const [seatMap, setSeatMap] = useState<Record<string, string>>({})
  const [gateMap, setGateMap] = useState<Record<string, string>>({})

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(t)
  }, [])

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

  useEffect(() => {
    if (!selection?.bookingId) return
    let cancelled = false
    fetch(`/api/bookings/${selection.bookingId}/seats`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.seats) return
        const map: Record<string, string> = {}
        for (const s of data.seats as { flightInstanceId: string; passengerId: string | null; seatNumber: string }[]) {
          if (s.passengerId) map[`${s.flightInstanceId}:${s.passengerId}`] = s.seatNumber
        }
        setSeatMap(map)
      })
      .catch((err) => console.warn("Failed to fetch seat assignments:", err))
    return () => {
      cancelled = true
    }
  }, [selection?.bookingId])

  useEffect(() => {
    if (!selection?.departFlight?.flight_instance_id) return
    const ids = [selection.departFlight.flight_instance_id, selection.returnFlight?.flight_instance_id]
      .filter((id): id is string => !!id)
    let cancelled = false
    fetch(`/api/flights/gate?ids=${ids.join(",")}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.gates) return
        setGateMap(data.gates)
      })
      .catch((err) => console.warn("Failed to fetch gate assignments:", err))
    return () => {
      cancelled = true
    }
  }, [selection?.departFlight?.flight_instance_id, selection?.returnFlight?.flight_instance_id])

  useEffect(() => {
    if (!selection?.holdExpiresAt || paid) return
    const expiresAt = new Date(selection.holdExpiresAt).getTime()
    const tick = () => {
      const remaining = expiresAt - Date.now()
      setMsLeft(remaining)
      if (remaining <= 0) router.push("/checkout/seats")
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [selection?.holdExpiresAt, paid, router])

  if (loadState === "loading") {
    return <PageShell><CenteredMessage text="Preparing payment…" /></PageShell>
  }

  if (loadState === "missing" || !selection) {
    return (
      <PageShell>
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
          <p className="text-slate-400">We couldn't find an active booking to pay for.</p>
          <button onClick={() => router.push("/checkout/seats")} className="px-6 py-3 rounded-full pill-cta font-semibold">
            Go to Seat Selection
          </button>
        </div>
      </PageShell>
    )
  }

  const { departFlight, returnFlight } = selection
  const isRoundTrip = !!returnFlight
  const baseFare = (departFlight.final_price + (returnFlight?.final_price || 0)) * selection.passengers
  const taxesAndFees = Math.round(baseFare * 0.19)
  const seatSelectionPrice = selection.seatSelectionPrice || 0
  const addonsTotal = selection.addonsTotal ?? (selection.addons || []).reduce((sum, a) => sum + a.price, 0)
  const tripTotal = baseFare + taxesAndFees + seatSelectionPrice + addonsTotal

  const primaryPassengerName = selection.savedPassengers?.[0]
    ? passengerDisplayName(selection.savedPassengers[0])
    : name.trim() || "Traveler"

  function buildBoardingPasses(finalPnr: string): BoardingPassData[] {
    if (!selection) return []
    const legs = [
      { flight: departFlight, label: isRoundTrip ? "Departure" : undefined },
      ...(returnFlight ? [{ flight: returnFlight, label: "Return" as const }] : []),
    ]
    const passengers = selection.savedPassengers && selection.savedPassengers.length > 0
      ? selection.savedPassengers
      : [null]

    const passes: BoardingPassData[] = []
    legs.forEach((leg) => {
      passengers.forEach((p) => {
        const seat = p?.id ? seatMap[`${leg.flight.flight_instance_id}:${p.id}`] : undefined
        passes.push({
          pnr: finalPnr,
          passengerName: p ? passengerDisplayName(p) : primaryPassengerName,
          airline: leg.flight.airline,
          logoSrc: airlineLogos[leg.flight.airline] || "/airlines/default.png",
          seat,
          gate: gateMap[leg.flight.flight_instance_id],
          flightNumber: deriveFlightNumber(leg.flight.airline, leg.flight.flight_instance_id),
          addons: selection.addons?.map((a) => ({ id: a.id, title: a.title })),
          origin: leg.flight.origin,
          destination: leg.flight.destination,
          dateLabel: leg.flight.travel_date,
          timeLabel: formatTime(leg.flight.departure_time),
          legLabel: leg.label,
        })
      })
    })
    return passes
  }

  function openGatewayForCard() {
    const fieldErrors = validateCardForm({ name, numberDigits, brand, expiry, cvv })
    setErrors(fieldErrors)
    setTouchedSubmit(true)
    if (Object.keys(fieldErrors).length > 0) return
    setLastFailure(null)
    setGatewayOpen(true)
  }

  function openGatewayForUpi() {
    setLastFailure(null)
    setGatewayOpen(true)
  }

  async function confirmBookingInDb(amountPaid: number, paymentMethod: "card" | "upi") {
    if (!selection?.bookingId) {
      setConfirmError("Missing booking reference — please contact support.")
      return
    }
    setConfirming(true)
    setConfirmError(null)
    try {
      const res = await fetch(`/api/bookings/${selection.bookingId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountPaid, paymentMethod }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Couldn't confirm the booking")

      setPnr(data.pnr)
      setPaid(true)
      setPendingConfirm(null)
      try {
        sessionStorage.setItem(
          "navigo:lastBooking",
          JSON.stringify({ pnr: data.pnr, bookingId: selection.bookingId, amountPaid, paidAt: Date.now() })
        )
        sessionStorage.removeItem(STORAGE_KEY)
        // ✅ FIX: also clear the namespaced bookingId + passenger draft so
        // the next booking this user starts can't accidentally reattach
        // to this now-confirmed booking.
        clearStaleBookingSession()
      } catch (err) {
        console.error("Failed to persist completed booking:", err)
      }
    } catch (err: any) {
      console.error("CONFIRM BOOKING FAILED:", err)
      setPendingConfirm({ amountPaid, method: paymentMethod })
      setConfirmError(err?.message || "Payment succeeded, but we couldn't finalize your booking. Please retry.")
    } finally {
      setConfirming(false)
    }
  }

  function handleGatewayComplete(result: { success: boolean; reason?: string }) {
    setGatewayOpen(false)
    if (result.success) {
      void confirmBookingInDb(tripTotal, method)
    } else {
      setLastFailure(result.reason || "Payment failed. Please try again.")
      setCvv("")
    }
  }

  if (confirming || pendingConfirm) {
    return (
      <PageShell hideStepper>
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center max-w-sm mx-auto">
          {confirming ? (
            <>
              <span className="w-12 h-12 rounded-full border-2 border-[#E8C766] border-t-transparent animate-spin" />
              <p className="text-sm text-slate-300">Finalizing your booking…</p>
            </>
          ) : (
            <>
              <span className="w-12 h-12 rounded-full bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-amber-300 text-xl">!</span>
              <p className="text-sm font-semibold text-white">Payment received, booking not yet confirmed</p>
              <p className="text-xs text-slate-500">{confirmError}</p>
              <button
                onClick={() => pendingConfirm && confirmBookingInDb(pendingConfirm.amountPaid, pendingConfirm.method)}
                className="mt-2 px-6 py-3 rounded-full pill-cta font-semibold text-sm"
              >
                Retry Confirmation
              </button>
            </>
          )}
        </div>
      </PageShell>
    )
  }

  if (paid && pnr) {
    return (
      <PageShell hideStepper>
        <BoardingPassDeck
          passes={buildBoardingPasses(pnr)}
          formattedAmount={formatINR(tripTotal)}
          onDone={() => router.push("/my-trips")}
        />
      </PageShell>
    )
  }

  return (
    <PageShell>
      <div className={`flex items-center justify-between gap-4 mb-3 transition-all duration-500 ease-out ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
        <p className="text-[11px] uppercase tracking-widest text-slate-500">Review & Pay</p>
        {msLeft !== null && <HoldTimer msLeft={msLeft} holdMinutes={HOLD_MINUTES} />}
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-5 space-y-4">
          <FlightSummaryCard flight={departFlight} tag={isRoundTrip ? "Departure" : undefined} />
          {isRoundTrip && <FlightSummaryCard flight={returnFlight} tag="Return" />}

          {selection.savedPassengers && selection.savedPassengers.length > 0 && (
            <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-5">
              <p className="text-[11px] uppercase tracking-widest text-slate-500 mb-2.5">Passengers</p>
              <div className="space-y-1.5">
                {selection.savedPassengers.map((p, i) => (
                  <p key={i} className="text-sm text-slate-200">{passengerDisplayName(p)}</p>
                ))}
              </div>
            </div>
          )}

          {selection.addons && selection.addons.length > 0 && (
            <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-5">
              <p className="text-[11px] uppercase tracking-widest text-slate-500 mb-2.5">Add-ons</p>
              <div className="space-y-2">
                {selection.addons.map((a) => (
                  <div key={a.id} className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">{a.title} <span className="text-slate-600">· {a.variant}</span></span>
                    <span className="text-slate-200 tabular-nums">{formatINR(a.price)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="relative bg-gradient-to-b from-[#0D1A2C] to-[#0A1424] border border-[#D4AF37]/15 rounded-2xl overflow-hidden ticket-edge">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-400 via-amber-400 to-amber-300" />
            <div className="px-5 py-4 space-y-2 text-sm">
              <p className="text-[11px] uppercase tracking-widest text-slate-500 mb-1">Fare Breakdown</p>
              <div className="flex justify-between"><span className="text-slate-400">Base Fare</span><span className="text-slate-200 tabular-nums">{formatINR(baseFare)}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Taxes & Fees</span><span className="text-slate-200 tabular-nums">{formatINR(taxesAndFees)}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Seat Selection</span><span className="text-slate-200 tabular-nums">{formatINR(seatSelectionPrice)}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Add-ons Total</span><span className="text-emerald-300 tabular-nums">{formatINR(addonsTotal)}</span></div>
            </div>
            <div className="px-5 py-4 border-t border-white/[0.06] flex items-end justify-between">
              <span className="text-sm text-slate-400">Amount to Pay</span>
              <span className="font-display text-2xl font-extrabold text-amber-300 tabular-nums">{formatINR(tripTotal)}</span>
            </div>
          </div>

          <SecurityBadges />
        </div>

        <div className="col-span-12 lg:col-span-7">
          <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-5 sm:p-6">
            <div className="flex items-center gap-0.5 rounded-lg bg-white/[0.04] border border-white/[0.08] p-0.5 w-fit mb-6">
              <button
                onClick={() => setMethod("card")}
                className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  method === "card" ? "bg-[#D4AF37]/20 text-[#E8C766]" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                💳 Card
              </button>
              <button
                onClick={() => setMethod("upi")}
                className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  method === "upi" ? "bg-[#D4AF37]/20 text-[#E8C766]" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                📱 UPI
              </button>
            </div>

            <AnimatePresence mode="wait">
              {method === "card" ? (
                <motion.div
                  key="card"
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.2 }}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-6"
                >
                  <div className="sm:col-span-5">
                    <PaymentCard
                      name={name}
                      numberDigits={numberDigits}
                      expiry={expiry}
                      cvv={cvv}
                      brand={brand}
                      isFlipped={focusedField === "cvv"}
                    />
                  </div>

                  <div className="sm:col-span-7 space-y-4">
                    <Field label="Cardholder Name" error={touchedSubmit ? errors.name : undefined} focused={focusedField === "name"}>
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onFocus={() => setFocusedField("name")}
                        onBlur={() => setFocusedField(null)}
                        placeholder="DHRUV VM"
                        className="w-full bg-transparent outline-none text-sm text-white placeholder:text-slate-600 uppercase"
                      />
                    </Field>

                    <Field label="Card Number" error={touchedSubmit ? errors.number : undefined} focused={focusedField === "number"}>
                      <input
                        value={numberDigits}
                        onChange={(e) => setNumberDigits(sanitizeCardNumberInput(e.target.value))}
                        onFocus={() => setFocusedField("number")}
                        onBlur={() => setFocusedField(null)}
                        inputMode="numeric"
                        placeholder="4111 1111 1111 1111"
                        className="w-full bg-transparent outline-none text-sm text-white placeholder:text-slate-600 font-mono tracking-wider"
                      />
                    </Field>

                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Expiry" error={touchedSubmit ? errors.expiry : undefined} focused={focusedField === "expiry"}>
                        <input
                          value={expiry}
                          onChange={(e) => setExpiry(sanitizeExpiryInput(e.target.value))}
                          onFocus={() => setFocusedField("expiry")}
                          onBlur={() => setFocusedField(null)}
                          inputMode="numeric"
                          placeholder="12/29"
                          className="w-full bg-transparent outline-none text-sm text-white placeholder:text-slate-600 font-mono"
                        />
                      </Field>
                      <Field label="CVV" error={touchedSubmit ? errors.cvv : undefined} focused={focusedField === "cvv"}>
                        <input
                          value={cvv}
                          onChange={(e) => setCvv(sanitizeCvvInput(e.target.value, brand))}
                          onFocus={() => setFocusedField("cvv")}
                          onBlur={() => setFocusedField(null)}
                          inputMode="numeric"
                          type="password"
                          placeholder={brand === "amex" ? "1234" : "123"}
                          className="w-full bg-transparent outline-none text-sm text-white placeholder:text-slate-600 font-mono tracking-widest"
                        />
                      </Field>
                    </div>

                    {lastFailure && (
                      <p className="text-xs text-rose-300 bg-rose-400/10 border border-rose-400/20 rounded-lg px-3 py-2">{lastFailure}</p>
                    )}

                    <button
                      onClick={openGatewayForCard}
                      className="w-full px-6 py-3.5 rounded-full font-semibold pill-cta transition-all flex items-center justify-center gap-2"
                    >
                      Pay {formatINR(tripTotal)} <span aria-hidden>→</span>
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="upi"
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.2 }}
                >
                  {lastFailure && (
                    <p className="text-xs text-rose-300 bg-rose-400/10 border border-rose-400/20 rounded-lg px-3 py-2 mb-4">{lastFailure}</p>
                  )}
                  <UpiPanel
                    amount={tripTotal}
                    bookingId={selection.bookingId || "sandbox"}
                    disabled={gatewayOpen}
                    onPay={openGatewayForUpi}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <RazorpaySandboxModal open={gatewayOpen} amount={tripTotal} onComplete={handleGatewayComplete} />
    </PageShell>
  )
}

function Field({
  label,
  error,
  focused,
  children,
}: {
  label: string
  error?: string
  focused: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="text-[11px] text-slate-500 mb-1.5 block">{label}</label>
      <motion.div
        animate={{
          boxShadow: focused
            ? "0 0 0 1px rgba(212,175,55,0.5), 0 0 20px rgba(212,175,55,0.15)"
            : error
            ? "0 0 0 1px rgba(251,113,133,0.4)"
            : "0 0 0 1px rgba(255,255,255,0.08)",
        }}
        transition={{ duration: 0.2 }}
        className="rounded-lg bg-white/[0.04] px-3.5 py-2.5"
      >
        {children}
      </motion.div>
      {error && <p className="text-[11px] text-rose-300 mt-1.5">{error}</p>}
    </div>
  )
}

function HoldTimer({ msLeft, holdMinutes }: { msLeft: number; holdMinutes: number }) {
  const totalSeconds = Math.max(0, Math.floor(msLeft / 1000))
  const mm = Math.floor(totalSeconds / 60)
  const ss = totalSeconds % 60
  const urgent = totalSeconds <= 120
  const radius = 14
  const circumference = 2 * Math.PI * radius
  const pct = Math.min(1, Math.max(0, totalSeconds / (holdMinutes * 60)))
  const dashOffset = circumference * (1 - pct)

  return (
    <div className={`inline-flex items-center gap-2.5 rounded-full border pl-2 pr-4 py-1.5 transition-colors ${
      urgent ? "border-rose-400/40 bg-rose-400/[0.08] hold-timer-urgent" : "border-amber-400/25 bg-amber-400/[0.06]"
    }`} role="timer" aria-live="polite">
      <svg width="32" height="32" viewBox="0 0 32 32" className="shrink-0 -rotate-90" aria-hidden>
        <circle cx="16" cy="16" r={radius} fill="none" stroke="currentColor" strokeWidth="3" className="text-white/10" />
        <circle
          cx="16" cy="16" r={radius} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className={`transition-[stroke-dashoffset] duration-1000 ease-linear ${urgent ? "text-rose-300" : "text-amber-300"}`}
        />
      </svg>
      <div className="leading-tight">
        <p className={`font-display text-sm font-bold tabular-nums ${urgent ? "text-rose-200" : "text-amber-100"}`}>{mm}:{ss.toString().padStart(2, "0")}</p>
        <p className="text-[10px] text-slate-500 -mt-0.5">seats held</p>
      </div>
    </div>
  )
}

function FlightSummaryCard({ flight, tag }: { flight: StoredFlight; tag?: "Departure" | "Return" }) {
  return (
    <div className="relative bg-gradient-to-br from-[#0D1A2C] via-[#0B1729] to-[#0A1424] border border-white/[0.08] rounded-2xl overflow-hidden ticket-edge">
      <div className={`absolute top-0 left-0 right-0 h-[2px] ${tag === "Return" ? "bg-gradient-to-r from-cyan-400 to-blue-400" : "bg-gradient-to-r from-amber-300 to-amber-500"}`} />
      <div className="flex items-center gap-3 px-5 py-4">
        <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center overflow-hidden shadow-sm ring-1 ring-black/5 shrink-0">
          <img src={airlineLogos[flight.airline] || "/airlines/default.png"} alt={flight.airline} className="w-6 h-6 object-contain" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {tag && (
              <span className={`text-[9px] uppercase tracking-wide font-semibold rounded px-1.5 py-0.5 border ${tag === "Departure" ? "text-amber-300 bg-amber-400/10 border-amber-400/20" : "text-cyan-300 bg-cyan-400/10 border-cyan-400/20"}`}>{tag}</span>
            )}
            <p className="font-semibold text-sm truncate">{flight.airline}</p>
          </div>
          <p className="text-xs text-slate-500 truncate">
            {flight.origin} {formatTime(flight.departure_time)} → {flight.destination} {formatTime(flight.arrival_time)}
          </p>
        </div>
      </div>
    </div>
  )
}

function SecurityBadges() {
  const badges = [
    { icon: "🔒", label: "256-bit SSL encrypted" },
    { icon: "🛡️", label: "PCI DSS compliant" },
    { icon: "✓", label: "Secure payment gateway" },
    { icon: "🧪", label: "Razorpay Test Mode" },
  ]
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {badges.map((b) => (
        <div key={b.label} className="flex items-center gap-2 text-[11px] text-slate-500 bg-white/[0.02] border border-white/[0.06] rounded-lg px-3 py-2.5">
          <span aria-hidden>{b.icon}</span>
          {b.label}
        </div>
      ))}
    </div>
  )
}

function PageShell({ children, hideStepper }: { children: React.ReactNode; hideStepper?: boolean }) {
  const router = useRouter()
  return (
    <div className="min-h-screen bg-[#060B14] text-white relative overflow-x-hidden">
      <PageStyles />
      <div className="pointer-events-none fixed inset-0 opacity-[0.05] mix-blend-overlay grain-layer" />
      <div className="pointer-events-none fixed top-[-200px] left-[15%] w-[600px] h-[600px] bg-[#D4AF37]/[0.05] blur-[160px] rounded-full" />
      <div className="pointer-events-none fixed bottom-[-200px] right-[10%] w-[500px] h-[500px] bg-cyan-400/[0.05] blur-[160px] rounded-full" />

      <Navbar />

      <div className="relative max-w-[1400px] mx-auto px-6 pt-24 pb-16">
        {!hideStepper && (
          <div className="flex items-center justify-between gap-6 mb-10">
            <button
              onClick={() => router.push("/checkout/addons")}
              className="group flex items-center gap-2 pl-2 pr-3.5 py-1.5 rounded-full text-sm text-slate-400 hover:text-white border border-transparent hover:border-white/10 hover:bg-white/[0.04] transition-colors shrink-0"
            >
              <span className="w-6 h-6 rounded-full bg-white/[0.05] flex items-center justify-center group-hover:bg-white/10 transition-colors" aria-hidden>←</span>
              Back to add-ons
            </button>
            <Stepper currentStepId={6} />
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

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
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold border-2 transition-all ${
                isCurrent ? "border-[#D4AF37] bg-[#D4AF37]/15 text-[#E8C766] shadow-[0_0_0_4px_rgba(212,175,55,0.12)] glow-pulse"
                : isDone ? "border-emerald-400/70 bg-emerald-400/15 text-emerald-300"
                : "border-white/15 bg-white/[0.03] text-slate-600"
              }`}>
                {isDone ? "✓" : step.id}
              </span>
              <span className={`text-[11px] whitespace-nowrap ${isCurrent ? "text-[#E8C766] font-semibold" : isDone ? "text-emerald-300/70" : "text-slate-600"}`}>{step.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CenteredMessage({ text }: { text: string }) {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <p className="text-slate-500 text-sm tracking-wide font-display">{text}</p>
    </div>
  )
}

function PageStyles() {
  return (
    <style jsx global>{`
      @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@700;800&display=swap');
      .font-display { font-family: 'Manrope', ui-sans-serif, system-ui, sans-serif; letter-spacing: -0.01em; }

      .ticket-edge { position: relative; }
      .ticket-edge::before {
        content: "";
        position: absolute;
        inset: 3px;
        border: 1px solid rgba(212,175,55,0.10);
        border-radius: inherit;
        pointer-events: none;
      }

      .pill-cta {
        background: linear-gradient(90deg, #38BDF8 0%, #60A5FA 30%, #D4AF37 70%, #FBBF24 100%);
        color: #060B14;
      }
      .pill-cta:hover { filter: brightness(1.06); }

      .grain-layer {
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E");
      }

      @keyframes glowPulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
      .glow-pulse { animation: glowPulse 1.8s ease-in-out infinite; }

      @keyframes holdTimerPulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(251,113,133,0.25); } 50% { box-shadow: 0 0 0 6px rgba(251,113,133,0); } }
      .hold-timer-urgent { animation: holdTimerPulse 1.6s ease-in-out infinite; }

      @media (prefers-reduced-motion: reduce) {
        .glow-pulse, .hold-timer-urgent { animation: none !important; }
      }
    `}</style>
  )
}