"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Navbar from "@/components/navbar"

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

// ✅ Same mapping as components/FlightCard.tsx — keep these two in sync if
// you add a new airline, so the logo shows consistently on both the
// results list and the checkout summary.
const airlineLogos: Record<string, string> = {
  "IndiGo": "/airlines/indigo.png",
  "Air India": "/airlines/airindia.png",
  "Vistara": "/airlines/vistara.png",
  "Akasa Air": "/airlines/akasa.png",
  "Emirates": "/airlines/emirates.png",
  "Qatar Airways": "/airlines/qatar.png",
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
}

const STORAGE_KEY = "navigo:checkoutSelection"

function formatTime(timeStr?: string) {
  if (!timeStr) return "--:--"
  const d = new Date(timeStr)
  if (isNaN(d.getTime())) return "--:--"
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })
}

function formatDateLabel(timeStr?: string) {
  if (!timeStr) return ""
  const d = new Date(timeStr)
  if (isNaN(d.getTime())) return ""
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })
}

// Stable-ish boarding-pass style record locator derived from the flight id,
// purely cosmetic — gives the ticket motif something authentic to display.
function pnrFrom(id: string | number) {
  const str = String(id).replace(/[^a-zA-Z0-9]/g, "").toUpperCase()
  return (str.slice(0, 6) || "NAV001").padEnd(6, "X")
}

const steps = [
  { id: 1, label: "Search" },
  { id: 2, label: "Select" },
  { id: 3, label: "Passengers" },
  { id: 4, label: "Add-ons" },
  { id: 5, label: "Payment" },
  { id: 6, label: "Confirmed" },
]

export default function CheckoutPage() {
  const router = useRouter()

  // ✅ STAYS ON THIS PAGE ON RELOAD — selection is read from sessionStorage
  // on mount. sessionStorage persists across a reload and only clears when
  // the tab/browser closes, so a refresh on /checkout re-hydrates the exact
  // same booking instead of bouncing to /flights or showing a blank page.
  const [selection, setSelection] = useState<CheckoutSelection | null>(null)
  const [loadState, setLoadState] = useState<"loading" | "found" | "missing">("loading")

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      if (!raw) {
        setLoadState("missing")
        return
      }
      const parsed = JSON.parse(raw) as CheckoutSelection
      setSelection(parsed)
      setLoadState("found")
    } catch (err) {
      console.error("Failed to read checkout selection:", err)
      setLoadState("missing")
    }
  }, [])

  if (loadState === "loading") {
    return (
      <div className="min-h-screen bg-[#060B14] text-white flex items-center justify-center">
        <p className="text-slate-500 text-sm tracking-wide">Preparing your itinerary…</p>
      </div>
    )
  }

  if (loadState === "missing" || !selection) {
    return (
      <div className="min-h-screen bg-[#060B14] text-white flex flex-col items-center justify-center gap-4">
        <p className="text-slate-300">We couldn't find an active booking.</p>
        <button
          onClick={() => router.push("/")}
          className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 text-[#060B14] font-semibold"
        >
          Search Flights
        </button>
      </div>
    )
  }

  const { departFlight, returnFlight, passengers, totalPrice } = selection

  // Tax/fee placeholder math until flight_instances.tax_amount /
  // fee_amount are wired through the API response (columns added in the
  // migration — see flight_instances.tax_amount / fee_amount).
  const baseFare = departFlight.final_price + (returnFlight?.final_price || 0)
  const taxesAndFees = Math.round(baseFare * 0.19)
  const seatSelectionPrice = 0 // left at 0 — updates once seat selection ships
  const mealsPrice = 0
  const totalDisplayPrice = baseFare + taxesAndFees + seatSelectionPrice + mealsPrice

  return (
    <div className="min-h-screen bg-[#060B14] text-white relative">

      {/* ambient glow, quiet and far from the content */}
      <div className="pointer-events-none fixed top-[-200px] left-[15%] w-[600px] h-[600px] bg-amber-500/[0.04] blur-[160px] rounded-full" />
      <div className="pointer-events-none fixed bottom-[-200px] right-[10%] w-[500px] h-[500px] bg-cyan-400/[0.04] blur-[160px] rounded-full" />

      <Navbar />

      <div className="relative max-w-7xl mx-auto px-6 pt-24 pb-16">

        {/* STEPPER — boarding-pass progress strip */}
        <div className="flex items-center justify-between mb-10">
          <button
            onClick={() => router.push("/flights")}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 transition-colors shrink-0"
          >
            <span aria-hidden>←</span> Back to results
          </button>

          <div className="flex items-center gap-1 overflow-x-auto">
            {steps.map((step, i) => (
              <div key={step.id} className="flex items-center shrink-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold border transition-colors
                    ${
                      step.id === 3
                        ? "border-amber-400 bg-amber-400/15 text-amber-300"
                        : step.id < 3
                        ? "border-emerald-400/60 bg-emerald-400/10 text-emerald-300"
                        : "border-white/10 text-slate-600"
                    }`}
                  >
                    {step.id < 3 ? "✓" : step.id}
                  </span>
                  <span
                    className={`text-xs hidden sm:inline ${
                      step.id === 3 ? "text-amber-300 font-medium" : step.id < 3 ? "text-emerald-300/80" : "text-slate-600"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <span
                    className={`w-6 sm:w-10 h-px mx-2 ${step.id < 3 ? "bg-emerald-400/30" : "bg-white/10"}`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">

          {/* LEFT — itinerary */}
          <div className="col-span-12 lg:col-span-8 space-y-5">

            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 font-medium">
              Your itinerary
            </p>

            <BoardingPassCard flight={departFlight} passengers={passengers} label="Departure" />

            {returnFlight && (
              <BoardingPassCard flight={returnFlight} passengers={passengers} label="Return" />
            )}

            <WhyChooseThisFlight />
          </div>

          {/* RIGHT — fare summary, ticket-stub motif */}
          <div className="col-span-12 lg:col-span-4">
            <FareSummary
              baseFare={baseFare}
              taxesAndFees={taxesAndFees}
              seatSelectionPrice={seatSelectionPrice}
              mealsPrice={mealsPrice}
              totalDisplayPrice={totalDisplayPrice}
              onContinue={() => router.push("/checkout/passengers")}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// BOARDING PASS — flight itinerary card
// ---------------------------------------------------------------------------

function BoardingPassCard({
  flight,
  passengers,
  label,
}: {
  flight: StoredFlight
  passengers: number
  label: string
}) {
  const pnr = pnrFrom(flight.id)

  return (
    <div className="relative bg-gradient-to-br from-[#0D1A2C] via-[#0B1729] to-[#0A1424] border border-white/[0.08] rounded-2xl overflow-hidden">

      {/* top rail: airline + label + PNR, like a ticket header strip */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] bg-white/[0.02]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center overflow-hidden shadow-sm ring-1 ring-black/5 shrink-0">
            <img
              src={airlineLogos[flight.airline] || "/airlines/default.png"}
              alt={flight.airline}
              className="w-7 h-7 object-contain"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold text-[15px]">{flight.airline}</p>
              <span className="text-[10px] uppercase tracking-wide text-amber-300/90 bg-amber-400/10 border border-amber-400/20 rounded px-1.5 py-0.5">
                {label}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {flight.aircraft} · Economy Class
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">Ref</p>
            <p className="text-xs font-mono tracking-wider text-slate-400">{pnr}</p>
          </div>
          <button className="text-xs text-cyan-300 hover:text-cyan-200 transition-colors flex items-center gap-1 shrink-0">
            <span aria-hidden>✎</span> Edit
          </button>
        </div>
      </div>

      {/* main timeline */}
      <div className="px-6 py-6">
        <div className="grid grid-cols-3 items-center gap-4">
          <div>
            <p className="text-3xl font-semibold tabular-nums tracking-tight">{formatTime(flight.departure_time)}</p>
            <p className="text-xs text-slate-500 mt-0.5">{formatDateLabel(flight.departure_time)}</p>
            <p className="text-base font-medium text-amber-200/90 mt-1.5">{flight.origin}</p>
          </div>

          <div className="flex flex-col items-center px-2">
            <p className="text-[11px] text-slate-400 mb-2 font-medium">{flight.duration || "--"}</p>
            <div className="w-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-300 shrink-0" />
              <div className="flex-1 h-px bg-gradient-to-r from-amber-300/60 via-slate-600/40 to-cyan-300/60" />
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-300 shrink-0" />
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              {flight.stops ? `${flight.stops} stop` : "Non-stop"}
            </p>
          </div>

          <div className="text-right">
            <p className="text-3xl font-semibold tabular-nums tracking-tight">{formatTime(flight.arrival_time)}</p>
            <p className="text-xs text-slate-500 mt-0.5">{formatDateLabel(flight.arrival_time)}</p>
            <p className="text-base font-medium text-cyan-200/90 mt-1.5">{flight.destination}</p>
          </div>
        </div>
      </div>

      {/* perforated divider */}
      <div className="relative px-6">
        <div className="border-t border-dashed border-white/[0.12]" />
        <span className="absolute -left-3 -top-3 w-6 h-6 rounded-full bg-[#060B14]" />
        <span className="absolute -right-3 -top-3 w-6 h-6 rounded-full bg-[#060B14]" />
      </div>

      {/* amenities + pax footer */}
      <div className="flex items-center gap-5 px-6 py-3.5 text-slate-500 text-xs">
        <span className="flex items-center gap-1.5"><span aria-hidden>📶</span> Wifi</span>
        <span className="flex items-center gap-1.5"><span aria-hidden>🧳</span> Baggage</span>
        <span className="flex items-center gap-1.5"><span aria-hidden>💺</span> Seat</span>
        <span className="flex items-center gap-1.5"><span aria-hidden>🍽️</span> Meal</span>
        <span className="ml-auto text-slate-400">
          {passengers} passenger{passengers > 1 ? "s" : ""}
        </span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// FARE SUMMARY — ticket-stub signature element
// ---------------------------------------------------------------------------

function FareSummary({
  baseFare,
  taxesAndFees,
  seatSelectionPrice,
  mealsPrice,
  totalDisplayPrice,
  onContinue,
}: {
  baseFare: number
  taxesAndFees: number
  seatSelectionPrice: number
  mealsPrice: number
  totalDisplayPrice: number
  onContinue: () => void
}) {
  return (
    <div className="sticky top-24">
      <div className="relative bg-gradient-to-b from-[#0D1A2C] to-[#0A1424] border border-white/[0.08] rounded-2xl overflow-hidden">

        {/* header */}
        <div className="flex items-center justify-between px-6 py-5">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Fare Summary</p>
          </div>
          <button className="text-xs text-cyan-300 hover:text-cyan-200 transition-colors">Fare rules</button>
        </div>

        {/* line items */}
        <div className="px-6 space-y-3 text-sm">
          <LineItem label="Base Fare" value={baseFare} />
          <LineItem label="Taxes & Fees" value={taxesAndFees} />
          <LineItem label="Seat Selection" value={seatSelectionPrice} muted />
          <LineItem label="Meals" value={mealsPrice} muted />
        </div>

        {/* perforated stub divider — the signature element */}
        <div className="relative my-5 px-6">
          <div className="border-t border-dashed border-white/[0.14]" />
          <span className="absolute -left-[26px] -top-3 w-6 h-6 rounded-full bg-[#060B14]" />
          <span className="absolute -right-[26px] -top-3 w-6 h-6 rounded-full bg-[#060B14]" />
        </div>

        {/* total */}
        <div className="px-6 flex items-end justify-between mb-5">
          <span className="text-sm text-slate-400">Total Price</span>
          <span className="text-[28px] leading-none font-semibold tabular-nums text-amber-300">
            ₹{totalDisplayPrice.toLocaleString("en-IN")}
          </span>
        </div>

        <div className="px-6 space-y-2.5 mb-5">
          <InfoStrip
            tone="emerald"
            icon="✓"
            title="You're getting a good fare"
            subtitle="Based on current pricing for this route"
          />
          <InfoStrip
            tone="amber"
            icon="💺"
            title="Seat selection"
            subtitle="Choose seats after passenger details"
          />
        </div>

        <div className="px-6 pb-6">
          <button
            onClick={onContinue}
            className="w-full px-6 py-3.5 rounded-xl font-semibold bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 text-[#060B14] hover:brightness-105 active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-[0_8px_30px_rgba(251,191,36,0.15)]"
          >
            Continue to Passenger Details
            <span aria-hidden>→</span>
          </button>

          <p className="text-[11px] text-slate-500 text-center mt-3">
            Next: passengers → seats → add-ons
          </p>
        </div>

        <div className="border-t border-white/[0.06] px-6 py-5 space-y-3">
          <TrustRow icon="🛡️" title="100% Safe Booking" subtitle="Secure encryption protects your data" />
          <TrustRow icon="🎧" title="24/7 Customer Support" subtitle="We're here to help anytime" />
        </div>
      </div>
    </div>
  )
}

function LineItem({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-400">{label}</span>
      <span className={muted ? "text-slate-500" : "text-slate-200"}>
        ₹{value.toLocaleString("en-IN")}
      </span>
    </div>
  )
}

function InfoStrip({
  tone,
  icon,
  title,
  subtitle,
}: {
  tone: "emerald" | "amber"
  icon: string
  title: string
  subtitle: string
}) {
  const toneClasses =
    tone === "emerald"
      ? "bg-emerald-400/[0.08] border-emerald-400/20 text-emerald-300"
      : "bg-amber-400/[0.08] border-amber-400/20 text-amber-300"

  return (
    <div className={`rounded-xl border px-3.5 py-3 flex items-start gap-3 ${toneClasses}`}>
      <span className="text-base leading-none mt-0.5" aria-hidden>{icon}</span>
      <div>
        <p className="text-[13px] font-medium">{title}</p>
        <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>
      </div>
    </div>
  )
}

function TrustRow({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-sm" aria-hidden>{icon}</span>
      <div>
        <p className="text-xs text-slate-300 font-medium">{title}</p>
        <p className="text-[11px] text-slate-500">{subtitle}</p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// WHY CHOOSE THIS FLIGHT
// ---------------------------------------------------------------------------

function WhyChooseThisFlight() {
  const items = [
    { icon: "⭐", title: "Top Rated", subtitle: "Trusted by travelers" },
    { icon: "🕒", title: "On-time Performance", subtitle: "Reliable schedule" },
    { icon: "💺", title: "Comfortable Journey", subtitle: "Wide seats & great service" },
    { icon: "🏅", title: "Best Value", subtitle: "Great price for the journey" },
  ]

  return (
    <div className="bg-gradient-to-br from-[#0D1A2C] via-[#0B1729] to-[#0A1424] border border-white/[0.08] rounded-2xl p-6">
      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500 mb-4">Why choose this flight</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-5 text-sm">
        {items.map((item) => (
          <div key={item.title} className="flex items-start gap-2.5">
            <span className="text-base mt-0.5" aria-hidden>{item.icon}</span>
            <div>
              <p className="font-medium text-slate-200">{item.title}</p>
              <p className="text-xs text-slate-500 mt-0.5">{item.subtitle}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}