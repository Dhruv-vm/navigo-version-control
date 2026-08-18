"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { deriveFlightNumber, formatINR } from "@/app/checkout/payment/bookingUtils"
import { airports } from "@/lib/airports"

export type TripDetailsBooking = {
  id: string
  pnr?: string
  status: string
  totalPrice?: number
  paidAmount?: number
  paymentMethod?: string
  paidAt?: string
  createdAt?: string
  travelDate: string | null
  legs: {
    legLabel: "Departure" | "Return" | null
    flightInstanceId: string
    airline: string
    origin: string
    destination: string
    travelDate: string
    departureTime?: string
    arrivalTime?: string
    aircraft?: string
  }[]
  passengers: {
    id: string
    name: string
    isPrimary?: boolean
    type?: string
  }[]
  seats: {
    flightInstanceId: string
    passengerId: string
    seatNumber: string
  }[]
}

const airlineLogos: Record<string, string> = {
  "IndiGo": "/airlines/indigo.png",
  "Air India": "/airlines/airindia.png",
  "Vistara": "/airlines/vistara.png",
  "Akasa Air": "/airlines/akasa.png",
  "Emirates": "/airlines/emirates.png",
  "Qatar Airways": "/airlines/qatar.png",
}

function formatDateFull(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short", year: "numeric" })
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

function getAirportName(code: string): string {
  const match = airports.find((a) => a.code === code)
  return match ? `${match.city} (${match.name})` : code
}

export default function TripDetailsModal({
  booking,
  isOpen,
  onClose,
  onViewBoardingPass,
}: {
  booking: TripDetailsBooking | null
  isOpen: boolean
  onClose: () => void
  onViewBoardingPass?: () => void
}) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !booking) return null

  const pnr = booking.pnr || "TBA"

  const handleCopy = () => {
    if (!booking.pnr) return
    navigator.clipboard.writeText(booking.pnr)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const isConfirmed = booking.status === "confirmed"

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-[#020617]/85 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ type: "spring", damping: 25, stiffness: 280 }}
          className="relative w-full max-w-2xl bg-[#0A1424] border border-white/[0.12] rounded-3xl p-6 sm:p-8 shadow-[0_30px_90px_rgba(0,0,0,0.7)] z-10 my-8 overflow-hidden"
        >
          {/* Top accent line */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-400 via-amber-400 to-amber-300" />

          {/* Modal Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-amber-300 text-lg">
                ✈️
              </div>
              <div>
                <h3 className="font-display text-lg sm:text-xl font-bold text-white">Trip Itinerary</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-slate-400">PNR:</span>
                  <button
                    onClick={handleCopy}
                    className="font-mono text-xs font-bold text-[#E8C766] hover:underline flex items-center gap-1"
                  >
                    {pnr} {copied ? "✓ Copied" : "📋"}
                  </button>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      isConfirmed
                        ? "bg-emerald-400/15 text-emerald-300 border border-emerald-400/30"
                        : "bg-slate-400/15 text-slate-300 border border-white/10"
                    }`}
                  >
                    {booking.status}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/[0.05] border border-white/[0.1] text-slate-400 hover:text-white flex items-center justify-center transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Flight Legs Section */}
          <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            {booking.legs.map((leg, idx) => {
              const flightNum = deriveFlightNumber(leg.airline, leg.flightInstanceId)
              return (
                <div
                  key={leg.flightInstanceId || idx}
                  className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-4 sm:p-5 relative overflow-hidden"
                >
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center overflow-hidden shrink-0">
                        <img
                          src={airlineLogos[leg.airline] || "/airlines/default.png"}
                          alt={leg.airline}
                          className="w-5 h-5 object-contain"
                        />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white uppercase">{leg.airline}</p>
                        <p className="text-[11px] font-mono text-slate-400">{flightNum}</p>
                      </div>
                    </div>

                    {leg.legLabel && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-400/10 text-amber-300 border border-amber-400/20">
                        {leg.legLabel}
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-400 mb-3">
                    📅 {leg.travelDate ? formatDateFull(leg.travelDate) : "Scheduled Date"}
                  </p>

                  {/* Route Timeline */}
                  <div className="grid grid-cols-11 items-center gap-2 py-3 px-3.5 rounded-xl bg-black/20 border border-white/[0.04]">
                    <div className="col-span-4">
                      <p className="font-display text-xl font-black text-white">{leg.origin}</p>
                      <p className="text-xs text-amber-300 font-medium">{formatTime(leg.departureTime)}</p>
                      <p className="text-[10px] text-slate-500 truncate mt-0.5">{getAirportName(leg.origin)}</p>
                    </div>

                    <div className="col-span-3 flex flex-col items-center justify-center">
                      <span className="text-[10px] text-slate-400">Non-stop</span>
                      <div className="w-full flex items-center gap-1 my-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                        <div className="flex-1 h-[1px] bg-gradient-to-r from-cyan-400 to-amber-400" />
                        <span className="text-[10px] text-amber-300">✈</span>
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      </div>
                      <span className="text-[9px] text-slate-500 font-mono">{leg.aircraft || "A320neo"}</span>
                    </div>

                    <div className="col-span-4 text-right">
                      <p className="font-display text-xl font-black text-white">{leg.destination}</p>
                      <p className="text-xs text-cyan-300 font-medium">{formatTime(leg.arrivalTime)}</p>
                      <p className="text-[10px] text-slate-500 truncate mt-0.5">{getAirportName(leg.destination)}</p>
                    </div>
                  </div>

                  {/* Per-leg passenger seats */}
                  <div className="mt-3 pt-3 border-t border-white/[0.06]">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">Travelers & Seats</p>
                    <div className="flex flex-wrap gap-2">
                      {booking.passengers.map((pax) => {
                        const seat = booking.seats?.find(
                          (s) => s.flightInstanceId === leg.flightInstanceId && s.passengerId === pax.id
                        )?.seatNumber
                        return (
                          <div
                            key={pax.id}
                            className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs"
                          >
                            <span className="text-slate-300 font-medium">{pax.name}</span>
                            <span className="font-mono text-amber-300 font-bold bg-amber-400/10 px-1.5 py-0.5 rounded">
                              {seat ? `Seat ${seat}` : "Seat TBA"}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Baggage & Fare Breakdown */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Baggage Allowance</p>
                <div className="space-y-1 text-xs text-slate-300">
                  <p>🎒 Cabin: 7 kg per traveler</p>
                  <p>🧳 Check-in: 15 kg per traveler</p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Total Paid</p>
                <p className="font-display text-lg font-bold text-[#E8C766]">
                  {booking.totalPrice || booking.paidAmount ? formatINR(booking.totalPrice || booking.paidAmount || 0) : "Paid in Full"}
                </p>
                <p className="text-[10px] text-emerald-400/80">
                  {booking.paymentMethod ? `Via ${booking.paymentMethod.toUpperCase()}` : "Payment Confirmed"}
                </p>
              </div>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/[0.08] mt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-full border border-white/[0.12] text-xs font-semibold text-slate-300 hover:bg-white/[0.05]"
            >
              Close
            </button>
            {onViewBoardingPass && (
              <button
                onClick={() => {
                  onClose()
                  onViewBoardingPass()
                }}
                className="px-5 py-2 rounded-full pill-cta text-xs font-bold shadow-[0_2px_12px_rgba(251,191,36,0.3)] flex items-center gap-1.5"
              >
                🎫 View Boarding Pass
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
