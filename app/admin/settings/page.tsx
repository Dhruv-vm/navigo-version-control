"use client"

import { useState } from "react"

export default function AdminSettingsPage() {
  const [saved, setSaved] = useState(false)
  const [settings, setSettings] = useState({
    qrTokenValidityHours: 48,
    biometricCosineThreshold: 0.88,
    dynamicPricingMaxMultiplier: 2.0,
    dynamicPricingMinMultiplier: 0.8,
    gateAutoClearanceWindowMins: 45,
    autoRefundApprovalLimit: 25000,
    systemAlertLevel: "MEDIUM",
  })

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="space-y-6 font-mono text-xs max-w-4xl">
      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-black text-white tracking-tight">
              Airport & System Operations Settings
            </h1>
            <span className="text-[10px] font-mono font-bold bg-amber-400/15 text-amber-300 px-2 py-0.5 rounded-full border border-amber-400/30">
              GLOBAL CONFIG
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Fine-tune DigiYatra biometric thresholds, cryptographic token expiry duration, and pricing elasticity boundaries.
          </p>
        </div>

        {saved && (
          <span className="px-3 py-1 rounded-full bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 font-bold">
            ✓ Settings Applied Globally
          </span>
        )}
      </div>

      {/* ── SETTINGS FORM ───────────────────────────────────────────── */}
      <form onSubmit={handleSave} className="bg-[#070D18] border border-white/[0.08] rounded-3xl p-6 shadow-xl space-y-6">
        <div>
          <h3 className="font-display text-xs font-bold uppercase text-white pb-2 border-b border-white/[0.08] mb-4">
            DigiYatra & QR Security Thresholds
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">
                Boarding Pass QR Token Validity (Hours)
              </label>
              <input
                type="number"
                value={settings.qrTokenValidityHours}
                onChange={(e) => setSettings({ ...settings, qrTokenValidityHours: Number(e.target.value) })}
                className="w-full bg-[#030712] border border-white/[0.1] rounded-xl px-3 py-2 text-white focus:outline-none"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">Default 48h for domestic flights</span>
            </div>

            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">
                Biometric Vector Cosine Threshold
              </label>
              <input
                type="number"
                step="0.01"
                min="0.70"
                max="0.99"
                value={settings.biometricCosineThreshold}
                onChange={(e) => setSettings({ ...settings, biometricCosineThreshold: Number(e.target.value) })}
                className="w-full bg-[#030712] border border-white/[0.1] rounded-xl px-3 py-2 text-white focus:outline-none"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">0.88 = High Security (Zero False Positives)</span>
            </div>
          </div>
        </div>

        <div>
          <h3 className="font-display text-xs font-bold uppercase text-white pb-2 border-b border-white/[0.08] mb-4">
            Dynamic Pricing Engine Clamping
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">
                Maximum Fare Ceiling Multiplier (Cap)
              </label>
              <input
                type="number"
                step="0.1"
                value={settings.dynamicPricingMaxMultiplier}
                onChange={(e) => setSettings({ ...settings, dynamicPricingMaxMultiplier: Number(e.target.value) })}
                className="w-full bg-[#030712] border border-white/[0.1] rounded-xl px-3 py-2 text-white focus:outline-none"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">Never exceed 2.0x base fare</span>
            </div>

            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">
                Minimum Fare Floor Multiplier (Dip)
              </label>
              <input
                type="number"
                step="0.1"
                value={settings.dynamicPricingMinMultiplier}
                onChange={(e) => setSettings({ ...settings, dynamicPricingMinMultiplier: Number(e.target.value) })}
                className="w-full bg-[#030712] border border-white/[0.1] rounded-xl px-3 py-2 text-white focus:outline-none"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">Minimum 0.8x base fare</span>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-white/[0.08] flex justify-end">
          <button
            type="submit"
            className="px-6 py-2.5 rounded-full bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs shadow-[0_2px_14px_rgba(251,191,36,0.3)] transition-all"
          >
            Save Operations Config ⚙️
          </button>
        </div>
      </form>
    </div>
  )
}
