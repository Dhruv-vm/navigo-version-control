"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { getNavPointsBalance, pointsToDiscount, POINTS_PER_RUPEE } from "@/lib/navpoints"

export default function NavPointsModal({
  isOpen,
  onClose,
  onExploreFlights,
}: {
  isOpen: boolean
  onClose: () => void
  onExploreFlights?: () => void
}) {
  const [points, setPoints] = useState(650)

  useEffect(() => {
    if (isOpen) {
      setPoints(getNavPointsBalance())
    }
  }, [isOpen])

  if (!isOpen) return null

  const discountValue = pointsToDiscount(points)

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-[#04070F]/85 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", stiffness: 300, damping: 26 }}
          className="relative w-full max-w-lg bg-gradient-to-b from-[#0D1A2C] via-[#0A1424] to-[#070D18] border border-[#D4AF37]/25 rounded-3xl p-6 sm:p-7 shadow-[0_25px_60px_rgba(0,0,0,0.6)] ticket-edge overflow-hidden z-10"
        >
          {/* Top Gold/Blue Accent Line */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-400 via-amber-400 to-amber-300" />
          <div className="pointer-events-none absolute -top-24 -right-24 w-48 h-48 bg-amber-400/10 blur-3xl rounded-full" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 w-48 h-48 bg-cyan-400/10 blur-3xl rounded-full" />

          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/[0.06] border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 flex items-center justify-center text-sm transition-colors"
          >
            ✕
          </button>

          {/* Header */}
          <div className="flex items-center gap-3.5 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-2xl shadow-[0_0_20px_rgba(251,191,36,0.2)]">
              🪙
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-white tracking-tight">
                NavPoints Rewards
              </h2>
              <p className="text-xs text-amber-300/90 font-medium">
                Gold Tier Member • 2 NavPoints = ₹1 Discount
              </p>
            </div>
          </div>

          {/* Balance Card */}
          <div className="bg-gradient-to-br from-[#D4AF37]/15 via-white/[0.03] to-cyan-500/[0.05] border border-[#D4AF37]/25 rounded-2xl p-5 mb-6 text-center relative overflow-hidden">
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-1">
              Available Rewards Balance
            </p>
            <div className="flex items-center justify-center gap-2">
              <span className="text-3xl">🪙</span>
              <p className="font-display text-4xl font-extrabold text-[#E8C766] tabular-nums">
                {points.toLocaleString("en-IN")}
              </p>
            </div>
            <p className="text-sm font-semibold text-emerald-400 mt-1">
              Worth ₹{discountValue.toLocaleString("en-IN")} instant discount on flights
            </p>
          </div>

          {/* How It Works Grid */}
          <div className="space-y-3 mb-6">
            <p className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">
              How NavPoints Work
            </p>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3.5">
                <div className="text-lg mb-1">✈️</div>
                <p className="text-xs font-bold text-white">Earn on Every Flight</p>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                  Earn 150+ NavPoints automatically for every booked and completed journey.
                </p>
              </div>

              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3.5">
                <div className="text-lg mb-1">💸</div>
                <p className="text-xs font-bold text-white">Instant Checkout Off</p>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                  Redeem coins during payment: 2 coins = ₹1 off. No coupons needed.
                </p>
              </div>

              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3.5">
                <div className="text-lg mb-1">⚡</div>
                <p className="text-xs font-bold text-white">Stack with Deals</p>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                  NavPoints discounts combine seamlessly with promotional sale fares.
                </p>
              </div>

              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3.5">
                <div className="text-lg mb-1">♾️</div>
                <p className="text-xs font-bold text-white">Never Expire</p>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                  Your NavPoints balance remains active and ready for your next adventure.
                </p>
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-full border border-white/10 text-xs font-semibold text-slate-300 hover:bg-white/[0.05] transition-colors"
            >
              Close
            </button>
            <button
              onClick={() => {
                onClose()
                if (onExploreFlights) onExploreFlights()
              }}
              className="flex-1 py-3 rounded-full pill-cta text-xs font-bold shadow-[0_4px_16px_rgba(251,191,36,0.25)] hover:scale-[1.02] transition-transform"
            >
              Book & Redeem →
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
