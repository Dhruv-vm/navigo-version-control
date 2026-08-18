"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { BoardingPassCard } from "@/app/checkout/payment/BoardingPassCard"
import { exportPassesToPdf } from "@/app/checkout/payment/pdfExport"
import { deriveFlightNumber } from "@/app/checkout/payment/bookingUtils"

export type ModalBookingLeg = {
  legLabel: "Departure" | "Return" | null
  flightInstanceId: string
  airline: string
  origin: string
  destination: string
  travelDate: string
  departureTime?: string
  arrivalTime?: string
  aircraft?: string
}

export type ModalPassenger = {
  id: string
  name: string
  isPrimary?: boolean
  type?: string
}

export type ModalSeat = {
  flightInstanceId: string
  passengerId: string
  seatNumber: string
}

export type ModalBooking = {
  id: string
  pnr?: string
  status: string
  totalPrice?: number
  paidAmount?: number
  paymentMethod?: string
  paidAt?: string
  travelDate: string | null
  legs: ModalBookingLeg[]
  passengers: ModalPassenger[]
  seats: ModalSeat[]
}

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
  return "--:--"
}

export default function BoardingPassModal({
  booking,
  isOpen,
  onClose,
  gateMap = {},
}: {
  booking: ModalBooking | null
  isOpen: boolean
  onClose: () => void
  gateMap?: Record<string, string>
}) {
  const [activeLegIdx, setActiveLegIdx] = useState(0)
  const [activePaxIdx, setActivePaxIdx] = useState(0)
  const [downloading, setDownloading] = useState(false)
  const [copied, setCopied] = useState(false)

  const cardRef = useRef<HTMLDivElement | null>(null)
  const hiddenCardRefs = useRef<Record<string, HTMLDivElement | null>>({})

  // Reset indices on modal open or booking change
  useEffect(() => {
    if (isOpen) {
      setActiveLegIdx(0)
      setActivePaxIdx(0)
      setCopied(false)
    }
  }, [isOpen, booking?.id])

  // ESC key to close
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !booking) return null

  const legs = booking.legs || []
  const passengers = booking.passengers || [{ id: "p0", name: "Traveler", isPrimary: true }]
  const hasMultipleLegs = legs.length > 1
  const hasMultiplePassengers = passengers.length > 1

  const currentLeg = legs[activeLegIdx] || legs[0]
  const currentPax = passengers[activePaxIdx] || passengers[0]

  const isExpired = booking.travelDate
    ? new Date(booking.travelDate).getTime() < Date.now() - 24 * 60 * 60 * 1000
    : false

  const currentSeat = booking.seats?.find(
    (s) => s.flightInstanceId === currentLeg?.flightInstanceId && s.passengerId === currentPax?.id
  )?.seatNumber

  const pnr = booking.pnr || "TBA"

  const handleCopyPnr = () => {
    if (!booking.pnr) return
    navigator.clipboard.writeText(booking.pnr)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // All pass combinations for PDF export
  const allPassEntries = legs.flatMap((leg) =>
    passengers.map((pax) => {
      const seat = booking.seats?.find(
        (s) => s.flightInstanceId === leg.flightInstanceId && s.passengerId === pax.id
      )?.seatNumber
      return {
        passKey: `${leg.flightInstanceId}-${pax.id}`,
        pnr,
        passengerName: pax.name,
        airline: leg.airline,
        logoSrc: airlineLogos[leg.airline] || "/airlines/default.png",
        origin: leg.origin,
        destination: leg.destination,
        dateLabel: leg.travelDate,
        timeLabel: formatTime(leg.departureTime),
        gate: gateMap[leg.flightInstanceId] || "TBA",
        flightNumber: deriveFlightNumber(leg.airline, leg.flightInstanceId),
        seat,
        legLabel: leg.legLabel || undefined,
        expired: isExpired,
      }
    })
  )

  const handleDownloadPdf = async () => {
    setDownloading(true)
    try {
      const elements = allPassEntries
        .map((entry) => hiddenCardRefs.current[entry.passKey])
        .filter((el): el is HTMLDivElement => !!el)

      if (elements.length > 0) {
        await exportPassesToPdf(elements, `navigo-boarding-pass-${pnr}.pdf`)
      } else if (cardRef.current) {
        await exportPassesToPdf([cardRef.current], `navigo-boarding-pass-${pnr}.pdf`)
      }
    } catch (err) {
      console.error("PDF export failed:", err)
    } finally {
      setDownloading(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

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
          initial={{ opacity: 0, scale: 0.94, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 20 }}
          transition={{ type: "spring", damping: 24, stiffness: 260 }}
          className="relative w-full max-w-4xl bg-[#09111E] border border-white/[0.12] rounded-3xl p-6 sm:p-8 shadow-[0_30px_90px_rgba(0,0,0,0.7)] z-10 my-8 overflow-hidden"
        >
          {/* Accent glow line at top */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-400 via-amber-400 to-amber-300" />
          <div className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 bg-amber-400/10 blur-3xl rounded-full" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 w-72 h-72 bg-cyan-400/10 blur-3xl rounded-full" />

          {/* Header */}
          <div className="flex items-center justify-between pb-5 border-b border-white/[0.08] relative">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <h2 className="font-display text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                  Official E-Boarding Pass
                </h2>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Scan at airport security or gate scanner · Reference:{" "}
                <span
                  onClick={handleCopyPnr}
                  className="font-mono text-[#E8C766] font-semibold cursor-pointer hover:underline inline-flex items-center gap-1"
                  title="Click to copy PNR"
                >
                  {pnr} {copied ? "(Copied!)" : "📋"}
                </span>
              </p>
            </div>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white/[0.05] border border-white/[0.1] text-slate-400 hover:text-white hover:bg-white/[0.1] flex items-center justify-center transition-colors"
              aria-label="Close modal"
            >
              ✕
            </button>
          </div>

          {/* Selector Tabs (if multiple legs or passengers) */}
          {(hasMultipleLegs || hasMultiplePassengers) && (
            <div className="flex flex-wrap items-center justify-between gap-3 my-4 py-2 border-b border-white/[0.06]">
              {hasMultipleLegs && (
                <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.08] rounded-full p-1">
                  {legs.map((leg, i) => (
                    <button
                      key={leg.flightInstanceId || i}
                      onClick={() => setActiveLegIdx(i)}
                      className={`px-3.5 py-1 rounded-full text-xs font-semibold transition-all ${
                        activeLegIdx === i
                          ? "text-[#060B14] bg-gradient-to-r from-amber-300 to-amber-500 shadow-[0_2px_10px_rgba(251,191,36,0.35)]"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      {leg.legLabel || `Flight ${i + 1}`} ({leg.origin} → {leg.destination})
                    </button>
                  ))}
                </div>
              )}

              {hasMultiplePassengers && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] uppercase tracking-wider text-slate-500">Traveler:</span>
                  <div className="flex items-center gap-1.5">
                    {passengers.map((pax, i) => (
                      <button
                        key={pax.id || i}
                        onClick={() => setActivePaxIdx(i)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                          activePaxIdx === i
                            ? "bg-[#D4AF37]/25 text-[#E8C766] border border-[#D4AF37]/50 shadow-[0_0_10px_rgba(212,175,55,0.25)]"
                            : "bg-white/[0.04] text-slate-400 border border-white/[0.08] hover:text-white"
                        }`}
                      >
                        {pax.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Pass Card Display */}
          <div className="py-4 relative">
            {currentLeg ? (
              <BoardingPassCard
                ref={cardRef}
                pnr={pnr}
                passengerName={currentPax?.name || "Traveler"}
                airline={currentLeg.airline}
                logoSrc={airlineLogos[currentLeg.airline] || "/airlines/default.png"}
                origin={currentLeg.origin}
                destination={currentLeg.destination}
                dateLabel={currentLeg.travelDate}
                timeLabel={formatTime(currentLeg.departureTime)}
                gate={gateMap[currentLeg.flightInstanceId] || "TBA"}
                flightNumber={deriveFlightNumber(currentLeg.airline, currentLeg.flightInstanceId)}
                seat={currentSeat}
                legLabel={currentLeg.legLabel || undefined}
                expired={isExpired}
                index={0}
              />
            ) : (
              <div className="p-8 text-center text-slate-400">Flight details unavailable</div>
            )}
          </div>

          {/* Bottom Actions Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-5 mt-4 border-t border-white/[0.08] relative">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="text-amber-300">💡</span>
              <span>Keep a digital or printed copy handy for airport terminal entry.</span>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handlePrint}
                className="px-4 py-2 rounded-full border border-white/[0.12] text-xs font-semibold text-slate-300 hover:bg-white/[0.06] hover:text-white transition-colors flex items-center gap-1.5"
              >
                🖨️ Print Pass
              </button>

              <button
                onClick={handleDownloadPdf}
                disabled={downloading}
                className="px-5 py-2 rounded-full pill-cta text-xs font-bold transition-all shadow-[0_2px_14px_rgba(251,191,36,0.25)] flex items-center gap-1.5 disabled:opacity-50"
              >
                {downloading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                    Generating PDF…
                  </>
                ) : (
                  <>
                    📥 Download Official PDF ({allPassEntries.length} {allPassEntries.length === 1 ? "Pass" : "Passes"})
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Hidden multi-pass render container for PDF snapshotting */}
          <div aria-hidden style={{ position: "fixed", top: 0, left: -99999, width: 820 }}>
            {allPassEntries.map(({ passKey, ...passProps }) => (
              <div key={passKey} style={{ width: 820 }}>
                <BoardingPassCard
                  key={passKey}
                  {...passProps}
                  ref={(el) => {
                    hiddenCardRefs.current[passKey] = el
                  }}
                />
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
