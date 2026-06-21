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

const steps = [
  { id: 1, label: "Search Flight" },
  { id: 2, label: "Select Flight" },
  { id: 3, label: "Passenger Details" },
  { id: 4, label: "Add-ons" },
  { id: 5, label: "Payment" },
  { id: 6, label: "Confirmation" },
]

export default function CheckoutPage() {
  const router = useRouter()

  // ✅ STAYS ON THIS PAGE ON RELOAD — selection is read from sessionStorage
  // on mount, not from component state alone. Since sessionStorage persists
  // across a reload (and only clears when the tab/browser closes), a
  // refresh on /checkout re-hydrates the exact same booking instead of
  // bouncing back to /flights or showing a blank page.
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
      <div className="min-h-screen bg-[#020617] text-white flex items-center justify-center">
        <p className="text-gray-400">Loading your booking…</p>
      </div>
    )
  }

  if (loadState === "missing" || !selection) {
    return (
      <div className="min-h-screen bg-[#020617] text-white flex flex-col items-center justify-center gap-4">
        <p className="text-gray-300">We couldn't find an active booking.</p>
        <button
          onClick={() => router.push("/")}
          className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 via-cyan-400 to-yellow-400 text-black font-semibold"
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
  const taxesAndFees = Math.round(baseFare * 0.19) // placeholder ~19% combined, matches mockup ratio
  const seatSelectionPrice = 0 // ✅ left at 0 for now, per your instruction — update later
  const mealsPrice = 0
  const totalDisplayPrice = baseFare + taxesAndFees + seatSelectionPrice + mealsPrice

  return (
    <div className="min-h-screen bg-[#020617] text-white">
      <Navbar />

      <div className="max-w-7xl mx-auto px-6 pt-24 pb-16">

        {/* STEPPER */}
        <div className="flex items-center gap-3 mb-8 overflow-x-auto">
          <button
            onClick={() => router.push("/flights")}
            className="flex items-center gap-1 text-sm text-gray-400 hover:text-white mr-2 shrink-0"
          >
            ← Back to results
          </button>

          {steps.map((step, i) => (
            <div key={step.id} className="flex items-center gap-3 shrink-0">
              <div
                className={`flex items-center gap-2 text-sm ${
                  step.id === 3
                    ? "text-blue-400 font-semibold"
                    : step.id < 3
                    ? "text-emerald-400"
                    : "text-gray-500"
                }`}
              >
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs border
                  ${
                    step.id === 3
                      ? "border-blue-400 bg-blue-500/20"
                      : step.id < 3
                      ? "border-emerald-400 bg-emerald-500/20"
                      : "border-gray-600"
                  }`}
                >
                  {step.id < 3 ? "✓" : step.id}
                </span>
                {step.label}
              </div>
              {i < steps.length - 1 && <span className="w-8 h-px bg-white/10" />}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-12 gap-6">

          {/* LEFT — flight details */}
          <div className="col-span-12 lg:col-span-8 space-y-6">

            <FlightSummaryCard flight={departFlight} passengers={passengers} />

            {returnFlight && (
              <FlightSummaryCard flight={returnFlight} passengers={passengers} label="Return" />
            )}

            <WhyChooseThisFlight flight={departFlight} />
          </div>

          {/* RIGHT — price summary */}
          <div className="col-span-12 lg:col-span-4 space-y-4">
            <div className="bg-[#0B1220] border border-white/10 rounded-2xl p-6 sticky top-24">

              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">Price Summary</h3>
                <button className="text-xs text-blue-400 hover:underline">Fare Rules</button>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Base Fare</span>
                  <span>₹{baseFare.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Taxes & Fees</span>
                  <span>₹{taxesAndFees.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Seat Selection</span>
                  <span>₹{seatSelectionPrice.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Meals</span>
                  <span>₹{mealsPrice.toLocaleString("en-IN")}</span>
                </div>
              </div>

              <div className="border-t border-white/10 my-4" />

              <div className="flex justify-between items-end mb-6">
                <span className="text-sm text-gray-400">Total Price</span>
                <span className="text-2xl font-bold text-yellow-400">
                  ₹{totalDisplayPrice.toLocaleString("en-IN")}
                </span>
              </div>

              <div className="bg-emerald-500/10 border border-emerald-400/20 rounded-xl p-3 mb-3 flex items-center gap-3">
                <span className="text-emerald-400 text-lg">🏆</span>
                <div>
                  <p className="text-emerald-400 text-sm font-semibold">You're getting a good fare</p>
                  <p className="text-xs text-gray-400">Based on current pricing for this route</p>
                </div>
              </div>

              <div className="bg-amber-500/10 border border-amber-400/20 rounded-xl p-3 mb-4 flex items-center gap-3">
                <span className="text-amber-400 text-lg">💺</span>
                <div>
                  <p className="text-amber-400 text-sm font-semibold">Seat Selection</p>
                  <p className="text-xs text-gray-400">Seats will be chosen after passenger details</p>
                </div>
              </div>

              <button
                onClick={() => router.push("/checkout/passengers")}
                className="w-full px-6 py-3 rounded-xl font-semibold bg-gradient-to-r from-blue-500 via-cyan-400 to-yellow-400 text-black hover:scale-[1.02] transition flex items-center justify-center gap-2"
              >
                Continue to Passenger Details →
              </button>

              <p className="text-xs text-gray-500 text-center mt-3">
                Next: Add passengers → choose seats → add add-ons
              </p>

              <div className="border-t border-white/10 my-5" />

              <div className="space-y-3 text-xs text-gray-400">
                <div className="flex items-center gap-2">
                  <span>🛡️</span>
                  <div>
                    <p className="text-gray-200 font-medium">100% Safe Booking</p>
                    <p>We use secure encryption to protect your data</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span>🎧</span>
                  <div>
                    <p className="text-gray-200 font-medium">24/7 Customer Support</p>
                    <p>We are here to help anytime</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function FlightSummaryCard({
  flight,
  passengers,
  label,
}: {
  flight: StoredFlight
  passengers: number
  label?: string
}) {
  return (
    <div className="bg-[#0B1220] border border-white/10 rounded-2xl p-6">
      {label && (
        <p className="text-xs uppercase tracking-wide text-gray-500 mb-3">{label}</p>
      )}

      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center overflow-hidden shadow-sm ring-1 ring-black/5">
            <img
              src={airlineLogos[flight.airline] || "/airlines/default.png"}
              alt={flight.airline}
              className="w-7 h-7 object-contain"
            />
          </div>
          <div>
            <p className="font-semibold">{flight.airline}</p>
            <p className="text-xs text-gray-500">
              {flight.aircraft} • Economy Class
            </p>
          </div>
        </div>
        <button className="text-xs text-blue-400 hover:underline flex items-center gap-1">
          ✎ Edit Flight
        </button>
      </div>

      <div className="grid grid-cols-3 items-center gap-4">
        <div>
          <p className="text-2xl font-bold tabular-nums">{formatTime(flight.departure_time)}</p>
          <p className="text-xs text-gray-400">{formatDateLabel(flight.departure_time)}</p>
          <p className="text-sm font-medium mt-1">{flight.origin}</p>
        </div>

        <div className="flex flex-col items-center">
          <p className="text-xs text-gray-400 mb-1">{flight.duration || "--"}</p>
          <div className="w-full h-px bg-white/10 relative">
            <span className="absolute left-0 -top-1 w-2 h-2 bg-white rounded-full" />
            <span className="absolute right-0 -top-1 w-2 h-2 bg-white rounded-full" />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {flight.stops ? `${flight.stops} Stop` : "Non-stop"}
          </p>
        </div>

        <div className="text-right">
          <p className="text-2xl font-bold tabular-nums">{formatTime(flight.arrival_time)}</p>
          <p className="text-xs text-gray-400">{formatDateLabel(flight.arrival_time)}</p>
          <p className="text-sm font-medium mt-1">{flight.destination}</p>
        </div>
      </div>

      <div className="flex items-center gap-4 mt-4 pt-3 border-t border-white/5 text-gray-400 text-xs">
        <span>📶 Wifi</span>
        <span>🧳 Baggage</span>
        <span>💺 Seat</span>
        <span>🍽️ Meal</span>
        <span className="ml-auto text-gray-500">{passengers} passenger{passengers > 1 ? "s" : ""}</span>
      </div>
    </div>
  )
}

function WhyChooseThisFlight({ flight }: { flight: StoredFlight }) {
  return (
    <div className="bg-[#0B1220] border border-white/10 rounded-2xl p-6">
      <h3 className="font-bold mb-4">Why choose this flight?</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
        <div className="flex items-center gap-2">
          <span>⭐</span>
          <div>
            <p className="font-medium">Top Rated</p>
            <p className="text-xs text-gray-500">Trusted by travelers</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span>🕒</span>
          <div>
            <p className="font-medium">On-time Performance</p>
            <p className="text-xs text-gray-500">Reliable schedule</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span>💺</span>
          <div>
            <p className="font-medium">Comfortable Journey</p>
            <p className="text-xs text-gray-500">Wide seats & great service</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span>🏅</span>
          <div>
            <p className="font-medium">Best Value</p>
            <p className="text-xs text-gray-500">Great price for the journey</p>
          </div>
        </div>
      </div>
    </div>
  )
}