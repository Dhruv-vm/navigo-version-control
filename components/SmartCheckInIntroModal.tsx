"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"

export default function SmartCheckInIntroModal({
  isOpen,
  onClose,
  onContinue,
  onDecline,
}: {
  isOpen: boolean
  onClose: () => void
  onContinue: () => void
  onDecline: () => void
}) {
  const [consentChecked, setConsentChecked] = useState(true)

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-[#020617]/90 backdrop-blur-xl"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 280 }}
          className="relative w-full max-w-lg bg-gradient-to-b from-[#0B1528] via-[#070E1A] to-[#040810] border border-white/[0.14] rounded-3xl p-6 sm:p-8 shadow-[0_35px_100px_rgba(0,0,0,0.8)] z-10 overflow-hidden"
        >
          {/* Accent lighting */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-400 via-amber-400 to-emerald-400" />
          <div className="pointer-events-none absolute -top-24 -right-24 w-48 h-48 bg-amber-400/10 blur-3xl rounded-full" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 w-48 h-48 bg-cyan-400/10 blur-3xl rounded-full" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/[0.05] border border-white/[0.1] text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            ✕
          </button>

          {/* Header */}
          <div className="text-center pt-2 pb-5">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-400/20 via-blue-500/20 to-amber-400/20 border border-cyan-300/30 flex items-center justify-center text-2xl mx-auto mb-3.5 shadow-[0_0_30px_rgba(56,189,248,0.25)]">
              👤
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-400/10 border border-cyan-400/25 text-cyan-300 text-[10px] font-mono tracking-widest uppercase mb-2">
              <span>⚡</span> NAVIGO SMART BOARDING
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Smart Boarding
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-2 max-w-md mx-auto leading-relaxed">
              Use your verified identity to speed up airport boarding with Navigo.
            </p>
          </div>

          {/* Benefits List */}
          <div className="space-y-3 my-3">
            <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] transition-colors">
              <div className="w-8 h-8 rounded-xl bg-cyan-400/15 border border-cyan-400/25 text-cyan-300 flex items-center justify-center text-sm font-bold shrink-0">
                ✓
              </div>
              <div>
                <h4 className="text-xs font-bold text-white tracking-wide">
                  Faster Airport Verification
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-normal">
                  Breeze through security checkpoints and e-gates without fumbling for physical documents.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] transition-colors">
              <div className="w-8 h-8 rounded-xl bg-amber-400/15 border border-amber-400/25 text-amber-300 flex items-center justify-center text-sm font-bold shrink-0">
                ✓
              </div>
              <div>
                <h4 className="text-xs font-bold text-white tracking-wide">
                  Secure Identity Verification
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-normal">
                  Tamper-proof cryptographic credentials protect your identity. Biometric vectors are encrypted.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] transition-colors">
              <div className="w-8 h-8 rounded-xl bg-emerald-400/15 border border-emerald-400/25 text-emerald-300 flex items-center justify-center text-sm font-bold shrink-0">
                ✓
              </div>
              <div>
                <h4 className="text-xs font-bold text-white tracking-wide">
                  Reusable Smart Boarding Profile
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-normal">
                  Register once and reuse your verified face profile seamlessly across all future Navigo flights.
                </p>
              </div>
            </div>
          </div>

          {/* Privacy & Consent Guarantee */}
          <div className="my-4 p-3.5 rounded-2xl bg-cyan-500/[0.06] border border-cyan-500/20">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-cyan-400/40 bg-slate-900 text-cyan-400 focus:ring-0 focus:ring-offset-0"
              />
              <span className="text-[11px] text-cyan-200/90 leading-relaxed">
                <strong className="text-cyan-300 font-semibold">User Consent:</strong> Your biometric profile will be securely stored and used only for Navigo identity verification.
              </span>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onDecline}
              className="px-5 py-2.5 rounded-full border border-white/[0.12] text-xs font-semibold text-slate-300 hover:bg-white/[0.05] hover:text-white transition-colors"
            >
              Not Now
            </button>
            <button
              type="button"
              onClick={onContinue}
              disabled={!consentChecked}
              className="px-6 py-2.5 rounded-full pill-cta text-xs font-bold shadow-[0_2px_16px_rgba(56,189,248,0.35)] flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span>👤</span> Continue →
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
