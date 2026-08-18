"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"

export default function CheckInModal({
  isOpen,
  onClose,
  defaultPnr = "",
  onSuccess,
}: {
  isOpen: boolean
  onClose: () => void
  defaultPnr?: string
  onSuccess?: (pnr: string) => void
}) {
  const [pnr, setPnr] = useState(defaultPnr)
  const [lastName, setLastName] = useState("")
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMsg(null)

    if (!pnr.trim()) {
      setError("Please enter your 6-character PNR reference.")
      return
    }

    setChecking(true)
    setTimeout(() => {
      setChecking(false)
      setSuccessMsg(`Check-in is confirmed for PNR ${pnr.toUpperCase()}! Digital boarding pass is ready.`)
      if (onSuccess) {
        onSuccess(pnr.toUpperCase())
      }
    }, 1000)
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-[#020617]/85 backdrop-blur-md"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ type: "spring", damping: 25, stiffness: 280 }}
          className="relative w-full max-w-md bg-[#0A1424] border border-white/[0.12] rounded-3xl p-6 shadow-[0_30px_90px_rgba(0,0,0,0.7)] z-10 overflow-hidden"
        >
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-400 via-amber-400 to-amber-300" />

          <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">🛫</span>
              <h3 className="font-display text-lg font-bold text-white">Online Web Check-In</h3>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/[0.05] border border-white/[0.1] text-slate-400 hover:text-white flex items-center justify-center transition-colors"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            <p className="text-xs text-slate-400">
              Web check-in opens 48 hours before departure. Enter your booking details below.
            </p>

            <div>
              <label className="text-[11px] uppercase tracking-wider text-slate-400 block mb-1.5 font-semibold">
                PNR / Booking Reference
              </label>
              <input
                type="text"
                value={pnr}
                onChange={(e) => setPnr(e.target.value.toUpperCase())}
                placeholder="e.g. 6D9F2A"
                maxLength={8}
                className="w-full bg-white/[0.04] border border-white/[0.1] rounded-xl px-4 py-2.5 text-sm text-white font-mono uppercase tracking-widest placeholder:text-slate-600 focus:outline-none focus:border-amber-400/50"
              />
            </div>

            <div>
              <label className="text-[11px] uppercase tracking-wider text-slate-400 block mb-1.5 font-semibold">
                Traveler Last Name / Email (Optional)
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="e.g. Sharma"
                className="w-full bg-white/[0.04] border border-white/[0.1] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-400/50"
              />
            </div>

            {error && (
              <p className="text-xs text-rose-300 bg-rose-400/10 border border-rose-400/20 rounded-lg p-2.5">
                {error}
              </p>
            )}

            {successMsg && (
              <p className="text-xs text-emerald-300 bg-emerald-400/10 border border-emerald-400/20 rounded-lg p-2.5">
                {successMsg}
              </p>
            )}

            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-full border border-white/[0.1] text-xs font-semibold text-slate-300 hover:bg-white/[0.05]"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={checking}
                className="px-5 py-2 rounded-full pill-cta text-xs font-bold shadow-[0_2px_12px_rgba(251,191,36,0.3)] flex items-center gap-1.5 disabled:opacity-50"
              >
                {checking ? "Verifying…" : "Proceed to Check-In →"}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
