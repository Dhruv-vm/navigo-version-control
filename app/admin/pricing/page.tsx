"use client"

import { useState } from "react"
import { computeDynamicPrice } from "@/lib/pricing"

export default function AdminPricingPage() {
  const [basePrice, setBasePrice] = useState(5200)
  const [availableSeats, setAvailableSeats] = useState(32)
  const [totalSeats] = useState(180)
  const [travelDate, setTravelDate] = useState("2026-08-25")
  const [engineEnabled, setEngineEnabled] = useState(true)

  // Compute live breakdown using real pricing engine
  const breakdown = computeDynamicPrice({
    basePrice,
    availableSeats,
    totalSeats,
    travelDate,
  })

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-black text-white tracking-tight">
              Dynamic Pricing Engine Controls
            </h1>
            <span className="text-[10px] font-mono font-bold bg-amber-400/15 text-amber-300 px-2 py-0.5 rounded-full border border-amber-400/30">
              REVENUE OPTIMIZER
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time multi-variable dynamic fare engine factoring demand curve, lead-time velocity, and day-of-week demand.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-slate-400">Algorithmic Engine:</span>
          <button
            onClick={() => setEngineEnabled(!engineEnabled)}
            className={`px-3 py-1 rounded-full font-bold text-[10px] border ${
              engineEnabled
                ? "bg-emerald-400/15 text-emerald-300 border-emerald-400/30"
                : "bg-slate-500/15 text-slate-400 border-slate-500/30"
            }`}
          >
            {engineEnabled ? "ACTIVE (LIVE PRICING)" : "BYPASS (STATIC BASE)"}
          </button>
        </div>
      </div>

      {/* ── FORMULA ARCHITECTURE CARD ────────────────────────────────── */}
      <div className="p-5 rounded-3xl bg-gradient-to-r from-[#0B1528] to-[#060D18] border border-white/[0.08] shadow-xl">
        <h3 className="font-display text-xs font-bold uppercase text-white mb-2">
          Pricing Mathematical Architecture
        </h3>
        <p className="text-slate-400 text-xs mb-3">
          <code className="text-amber-300 bg-black/40 px-2 py-1 rounded">
            Final Fare = Base Price × Demand Multiplier × Lead-Time Multiplier × Day-Of-Week Multiplier × Clamped Range (0.8x - 2.0x)
          </code>
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px] text-slate-300 pt-2 border-t border-white/[0.06]">
          <div>
            <span className="text-slate-500 block">Demand Curve</span>
            <strong className="text-cyan-300">0.90x → 1.45x</strong>
          </div>
          <div>
            <span className="text-slate-500 block">Lead-Time Curve</span>
            <strong className="text-amber-300">0.85x → 1.60x</strong>
          </div>
          <div>
            <span className="text-slate-500 block">Day of Week</span>
            <strong className="text-emerald-300">Fri/Sun Peak (1.15x)</strong>
          </div>
          <div>
            <span className="text-slate-500 block">Combined Clamping</span>
            <strong className="text-violet-300">Bounded [0.8x, 2.0x]</strong>
          </div>
        </div>
      </div>

      {/* ── INTERACTIVE LIVE SIMULATOR ──────────────────────────────── */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left Inputs (6 cols) */}
        <div className="col-span-12 lg:col-span-6 bg-[#070D18] border border-white/[0.08] rounded-3xl p-5 shadow-xl space-y-4">
          <h3 className="font-display text-xs font-bold uppercase text-white pb-2 border-b border-white/[0.08]">
            Interactive Price Simulator
          </h3>

          <div>
            <div className="flex justify-between text-slate-300 mb-1">
              <span>Base Fare Matrix:</span>
              <strong className="text-emerald-400">₹{basePrice.toLocaleString("en-IN")}</strong>
            </div>
            <input
              type="range"
              min={2000}
              max={25000}
              step={100}
              value={basePrice}
              onChange={(e) => setBasePrice(Number(e.target.value))}
              className="w-full accent-amber-400"
            />
          </div>

          <div>
            <div className="flex justify-between text-slate-300 mb-1">
              <span>Remaining Seat Inventory:</span>
              <strong className="text-cyan-300">
                {availableSeats} / {totalSeats} Seats ({breakdown.occupancyPct}% Full)
              </strong>
            </div>
            <input
              type="range"
              min={0}
              max={totalSeats}
              value={availableSeats}
              onChange={(e) => setAvailableSeats(Number(e.target.value))}
              className="w-full accent-cyan-400"
            />
          </div>

          <div>
            <div className="flex justify-between text-slate-300 mb-1">
              <span>Scheduled Travel Date:</span>
              <strong className="text-amber-300">{travelDate}</strong>
            </div>
            <input
              type="date"
              value={travelDate}
              onChange={(e) => setTravelDate(e.target.value)}
              className="w-full bg-[#030712] border border-white/[0.1] rounded-xl px-3 py-2 text-white focus:outline-none"
            />
          </div>
        </div>

        {/* Right Output Breakdown (6 cols) */}
        <div className="col-span-12 lg:col-span-6 bg-gradient-to-b from-[#091322] to-[#050A14] border border-white/[0.08] rounded-3xl p-5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <h3 className="font-display text-xs font-bold uppercase text-white">
                Calculated Dynamic Fare Output
              </h3>
              <span className="text-[10px] text-emerald-400 font-bold">REAL-TIME DB ENGINE</span>
            </div>

            <div className="my-4 p-4 rounded-2xl bg-black/40 border border-white/[0.06] text-center">
              <span className="text-[10px] text-slate-400 uppercase tracking-widest block">
                Calculated Passenger Fare
              </span>
              <div className="font-display font-black text-3xl text-amber-300 mt-1">
                ₹{breakdown.finalPrice.toLocaleString("en-IN")}
              </div>
              <span className="text-[10px] text-slate-400 block mt-1">
                Effective Multiplier: <strong className="text-white">{breakdown.combinedMultiplier.toFixed(2)}x</strong>
              </span>
            </div>

            <div className="space-y-1.5 text-[11px] text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-400">Demand Multiplier (at {breakdown.occupancyPct}% full):</span>
                <strong className="text-cyan-300">{breakdown.demandFactor.toFixed(2)}x</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Lead-Time Multiplier ({breakdown.daysUntilDeparture} days out):</span>
                <strong className="text-amber-300">{breakdown.daysFactor.toFixed(2)}x</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Day-of-Week Multiplier:</span>
                <strong className="text-emerald-300">{breakdown.dowFactor.toFixed(2)}x</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Seed Jitter Wobble:</span>
                <strong className="text-slate-300">{breakdown.jitterFactor.toFixed(2)}x</strong>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-white/[0.06] text-[10px] text-slate-500 flex justify-between">
            <span>ENGINE: lib/pricing.ts (computeDynamicPrice)</span>
            <span className="text-emerald-400 font-bold">OPTIMAL YIELD</span>
          </div>
        </div>
      </div>
    </div>
  )
}
