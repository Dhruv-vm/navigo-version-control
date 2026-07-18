"use client"

import { motion } from "framer-motion"
import { PseudoQr } from "./sandboxQr"
import { formatINR } from "./bookingUtils"

export function BoardingPass({
  pnr,
  passengerName,
  origin,
  destination,
  departureLabel,
  airline,
  amountPaid,
  onDone,
}: {
  pnr: string
  passengerName: string
  origin: string
  destination: string
  departureLabel: string
  airline: string
  amountPaid: number
  onDone: () => void
}) {
  return (
    <div className="max-w-lg mx-auto text-center py-10">
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 18 }}
        className="w-16 h-16 rounded-full bg-emerald-400/15 border border-emerald-400/30 flex items-center justify-center text-emerald-300 text-3xl mx-auto mb-4"
      >
        ✓
      </motion.div>
      <h1 className="font-display text-2xl font-extrabold text-white">Booking Confirmed</h1>
      <p className="text-sm text-slate-500 mt-1">{formatINR(amountPaid)} paid successfully</p>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="relative mt-8 bg-gradient-to-br from-[#0D1A2C] via-[#0B1729] to-[#0A1424] border border-[#D4AF37]/20 rounded-2xl overflow-hidden ticket-edge text-left"
      >
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-400 via-amber-400 to-amber-300" />
        <div className="flex items-center justify-between px-6 py-4 border-b border-dashed border-white/[0.12]">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Boarding Pass</p>
            <p className="font-display text-lg font-bold text-white mt-0.5">{origin} → {destination}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">PNR</p>
            <p className="font-display text-lg font-bold text-[#E8C766] tracking-widest">{pnr}</p>
          </div>
        </div>

        <div className="flex items-center gap-6 px-6 py-5">
          <div className="flex-1 space-y-2 text-sm">
            <Row label="Passenger" value={passengerName} />
            <Row label="Airline" value={airline} />
            <Row label="Departs" value={departureLabel} />
          </div>
          <div className="shrink-0 flex flex-col items-center">
            <PseudoQr seed={pnr} pixelSize={5} className="rounded-lg" />
            <p className="text-[9px] text-slate-600 mt-1.5 text-center max-w-[110px]">Sandbox QR — visual only</p>
          </div>
        </div>
      </motion.div>

      <div className="flex items-center justify-center gap-3 mt-6">
        <button
          onClick={() => window.print()}
          className="px-5 py-2.5 rounded-full text-sm font-semibold border border-white/[0.12] text-slate-200 hover:bg-white/[0.04] transition-colors"
        >
          Download Boarding Pass
        </button>
        <button onClick={onDone} className="px-5 py-2.5 rounded-full pill-cta text-sm font-semibold">
          View My Trips
        </button>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-slate-500">{label}</span>
      <span className="text-white font-medium text-right">{value}</span>
    </div>
  )
}