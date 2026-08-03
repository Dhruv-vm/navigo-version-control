"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { formatINR, simulateSandboxOutcome } from "./bookingUtils"

// ---------------------------------------------------------------------------
// ⚠️ SANDBOX SIMULATION — this modal stands in for the real Razorpay
// Checkout. It does NOT call any payment gateway; it's a scripted delay +
// weighted coin-flip (see bookingUtils.simulateSandboxOutcome). Real
// integration needs a server-side order (Razorpay Orders API + your secret
// key) and the actual checkout.js script:
//
//   <script src="https://checkout.razorpay.com/v1/checkout.js" />
//   const rzp = new window.Razorpay({ key: NEXT_PUBLIC_RAZORPAY_KEY_ID, order_id, ... })
//   rzp.open()
//
// Swap the body of `runSimulatedFlow` below for that when you're ready.
// ---------------------------------------------------------------------------

const STEPS = [
  "Initializing secure session...",
  "Authenticating card...",
  "Contacting issuing bank...",
  "Authorizing payment...",
]

export function RazorpaySandboxModal({
  open,
  amount,
  onComplete,
}: {
  open: boolean
  amount: number
  onComplete: (result: { success: boolean; reason?: string }) => void
}) {
  const [stepIndex, setStepIndex] = useState(-1)
  const [outcome, setOutcome] = useState<{ success: boolean; reason?: string } | null>(null)

  useEffect(() => {
    if (!open) {
      setStepIndex(-1)
      setOutcome(null)
      return
    }

    let cancelled = false
    async function runSimulatedFlow() {
      for (let i = 0; i < STEPS.length; i++) {
        if (cancelled) return
        setStepIndex(i)
        await wait(650 + Math.random() * 350)
      }
      if (cancelled) return
      const result = simulateSandboxOutcome()
      setOutcome(result)
      await wait(500)
      if (cancelled) return
      onComplete(result)
    }
    runSimulatedFlow()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
            className="relative w-full max-w-sm bg-gradient-to-b from-[#0D1A2C] to-[#0A1424] border border-[#D4AF37]/20 rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.5)] overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/20 flex items-center justify-center text-[#E8C766] text-xs">🔒</span>
                <p className="font-display text-sm font-semibold text-white">Secure Checkout</p>
              </div>
              <span className="text-[10px] font-semibold tracking-wide px-2 py-1 rounded-full bg-amber-400/10 text-amber-300 border border-amber-400/25">
                Razorpay Test Mode
              </span>
            </div>

            <div className="px-5 py-7">
              <p className="text-xs text-slate-500 mb-5 text-center">Charging <span className="text-white font-medium">{formatINR(amount)}</span></p>

              {outcome === null ? (
                <div className="flex flex-col items-center">
                  <SpinningCoin />
                  <div className="h-5 mt-5 relative w-full max-w-[240px]">
                    <AnimatePresence mode="wait">
                      <motion.p
                        key={stepIndex}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.25 }}
                        className="absolute inset-x-0 text-center text-xs text-slate-300"
                      >
                        {STEPS[Math.max(0, stepIndex)]}
                      </motion.p>
                    </AnimatePresence>
                  </div>
                  <div className="flex items-center gap-1.5 mt-4">
                    {STEPS.map((_, i) => (
                      <span
                        key={i}
                        className={`h-1 rounded-full transition-all duration-300 ${
                          i <= stepIndex ? "w-5 bg-[#D4AF37]" : "w-1.5 bg-white/15"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              ) : outcome.success ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center text-center py-3"
                >
                  <span className="w-14 h-14 rounded-full bg-emerald-400/15 border border-emerald-400/30 flex items-center justify-center text-emerald-300 text-2xl mb-3">✓</span>
                  <p className="text-sm font-semibold text-emerald-300">Payment successful.</p>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, x: 0 }}
                  animate={{ opacity: 1, x: [0, -6, 6, -4, 4, 0] }}
                  transition={{ duration: 0.4 }}
                  className="flex flex-col items-center text-center py-3"
                >
                  <span className="w-14 h-14 rounded-full bg-rose-400/15 border border-rose-400/30 flex items-center justify-center text-rose-300 text-2xl mb-3">✕</span>
                  <p className="text-sm font-semibold text-rose-300">Payment failed</p>
                  <p className="text-xs text-slate-500 mt-1">{outcome.reason}</p>
                </motion.div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ---------------------------------------------------------------------------
// SpinningCoin — continuous 3D flip between a ₹ face and the Navigo mark,
// same gold gradient/material as the payment card's chip and the boarding
// pass's gold accents, so this reads as the same product rather than a
// generic loading spinner.
// ---------------------------------------------------------------------------

function SpinningCoin() {
  const faceStyle: React.CSSProperties = {
    backfaceVisibility: "hidden",
    WebkitBackfaceVisibility: "hidden",
  }

  return (
    <div style={{ perspective: 500 }} className="w-16 h-16">
      <motion.div
        animate={{ rotateY: 360 }}
        transition={{ duration: 1.3, repeat: Infinity, ease: "linear" }}
        style={{ transformStyle: "preserve-3d", WebkitTransformStyle: "preserve-3d" }}
        className="relative w-16 h-16"
      >
        <div style={faceStyle} className="absolute inset-0 rounded-full overflow-hidden shadow-[0_8px_24px_rgba(212,175,55,0.35)]">
          <div className="absolute inset-0 bg-gradient-to-br from-[#F1D98A] via-[#D4AF37] to-[#B8860B]" />
          <div className="absolute inset-[3px] rounded-full border-2 border-[#8a6a1f]/40" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-display text-2xl font-extrabold text-[#060B14]">₹</span>
          </div>
        </div>
        <div style={{ ...faceStyle, transform: "rotateY(180deg)" }} className="absolute inset-0 rounded-full overflow-hidden shadow-[0_8px_24px_rgba(212,175,55,0.35)]">
          <div className="absolute inset-0 bg-gradient-to-br from-[#F1D98A] via-[#D4AF37] to-[#B8860B]" />
          <div className="absolute inset-[3px] rounded-full border-2 border-[#8a6a1f]/40" />
          <div className="absolute inset-0 flex items-center justify-center">
            <img src="/logo.png" alt="" className="w-8 h-8 object-contain" />
          </div>
        </div>
      </motion.div>
    </div>
  )
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}