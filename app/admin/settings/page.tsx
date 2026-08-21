"use client"

import { useState, type MouseEvent as ReactMouseEvent } from "react"

// ── Ripple hook — same one used on the flights/overview/topbar CTAs. ──────
function useRipple() {
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([])
  const spawn = (e: ReactMouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const id = Date.now() + Math.random()
    setRipples((r) => [...r, { id, x: e.clientX - rect.left, y: e.clientY - rect.top }])
    setTimeout(() => setRipples((r) => r.filter((rp) => rp.id !== id)), 650)
  }
  return { ripples, spawn }
}

const iconProps = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const }

const IconGear = ({ className }: { className?: string }) => (
  <svg {...iconProps} className={className}><circle cx="12" cy="12" r="3" /><path d="M19.4 13a7.9 7.9 0 0 0 0-2l2-1.4-2-3.4-2.3.7a8 8 0 0 0-1.7-1L15 3h-6l-.4 2.3a8 8 0 0 0-1.7 1l-2.3-.7-2 3.4L4.6 11a7.9 7.9 0 0 0 0 2l-2 1.4 2 3.4 2.3-.7a8 8 0 0 0 1.7 1L9 21h6l.4-2.3a8 8 0 0 0 1.7-1l2.3.7 2-3.4-2-1.4Z" /></svg>
)
const IconCheck = ({ className }: { className?: string }) => (
  <svg {...iconProps} className={className}><path d="m5 12.5 4.5 4.5L19 7" /></svg>
)
const IconShieldLock = ({ className }: { className?: string }) => (
  <svg {...iconProps} className={className}><path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3Z" /><rect x="9.5" y="10.5" width="5" height="4" rx="1" /><path d="M10.5 10.5V9a1.5 1.5 0 0 1 3 0v1.5" /></svg>
)
const IconTrendingScale = ({ className }: { className?: string }) => (
  <svg {...iconProps} className={className}><path d="m3 17 6-6 4 4 8-9" /><path d="M15 6h6v6" /></svg>
)

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

  const saveRipple = useRipple()

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="settings-page space-y-6 font-mono text-xs max-w-4xl">
      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <div className="header-enter flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/[0.06]">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="font-display text-2xl font-black text-white tracking-tight">
              Airport & System Operations Settings
            </h1>
            <span className="text-[10px] font-mono font-bold bg-amber-400/15 text-amber-300 px-2 py-0.5 rounded-full border border-amber-400/30 whitespace-nowrap">
              GLOBAL CONFIG
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1.5">
            Fine-tune DigiYatra biometric thresholds, cryptographic token expiry duration, and pricing elasticity boundaries.
          </p>
        </div>

        {saved && (
          <span className="saved-pop inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 font-bold whitespace-nowrap">
            <IconCheck className="w-3.5 h-3.5" /> Settings Applied Globally
          </span>
        )}
      </div>

      {/* ── SETTINGS FORM ───────────────────────────────────────────── */}
      <form onSubmit={handleSave} className="panel-enter ticket-edge relative bg-gradient-to-b from-[#0D1A2C] to-[#0A1424] border border-white/[0.08] rounded-3xl p-6 shadow-xl space-y-7 overflow-hidden">
        <div className="panel-hairline" />

        <div>
          <h3 className="flex items-center gap-2 font-display text-xs font-bold uppercase text-white pb-2.5 border-b border-white/[0.08] mb-4">
            <IconShieldLock className="w-3.5 h-3.5 text-emerald-300" />
            DigiYatra & QR Security Thresholds
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1.5">
                Boarding Pass QR Token Validity (Hours)
              </label>
              <input
                type="number"
                value={settings.qrTokenValidityHours}
                onChange={(e) => setSettings({ ...settings, qrTokenValidityHours: Number(e.target.value) })}
                className="w-full bg-[#030712] border border-white/[0.1] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400/40 focus:ring-1 focus:ring-amber-400/20 transition-colors"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">Default 48h for domestic flights</span>
            </div>

            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1.5">
                Biometric Vector Cosine Threshold
              </label>
              <input
                type="number"
                step="0.01"
                min="0.70"
                max="0.99"
                value={settings.biometricCosineThreshold}
                onChange={(e) => setSettings({ ...settings, biometricCosineThreshold: Number(e.target.value) })}
                className="w-full bg-[#030712] border border-white/[0.1] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400/40 focus:ring-1 focus:ring-amber-400/20 transition-colors"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">0.88 = High Security (Zero False Positives)</span>
            </div>
          </div>
        </div>

        <div>
          <h3 className="flex items-center gap-2 font-display text-xs font-bold uppercase text-white pb-2.5 border-b border-white/[0.08] mb-4">
            <IconTrendingScale className="w-3.5 h-3.5 text-cyan-300" />
            Dynamic Pricing Engine Clamping
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1.5">
                Maximum Fare Ceiling Multiplier (Cap)
              </label>
              <input
                type="number"
                step="0.1"
                value={settings.dynamicPricingMaxMultiplier}
                onChange={(e) => setSettings({ ...settings, dynamicPricingMaxMultiplier: Number(e.target.value) })}
                className="w-full bg-[#030712] border border-white/[0.1] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400/40 focus:ring-1 focus:ring-amber-400/20 transition-colors"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">Never exceed 2.0x base fare</span>
            </div>

            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1.5">
                Minimum Fare Floor Multiplier (Dip)
              </label>
              <input
                type="number"
                step="0.1"
                value={settings.dynamicPricingMinMultiplier}
                onChange={(e) => setSettings({ ...settings, dynamicPricingMinMultiplier: Number(e.target.value) })}
                className="w-full bg-[#030712] border border-white/[0.1] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400/40 focus:ring-1 focus:ring-amber-400/20 transition-colors"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">Minimum 0.8x base fare</span>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-white/[0.08] flex justify-end">
          <button
            type="submit"
            onMouseDown={saveRipple.spawn}
            className="pill-cta relative overflow-hidden px-6 py-2.5 rounded-full font-bold text-xs hover:scale-[1.03] transition-transform flex items-center gap-2"
          >
            {saveRipple.ripples.map((rp) => (
              <span key={rp.id} className="ripple" style={{ left: rp.x, top: rp.y }} />
            ))}
            <IconGear className="w-3.5 h-3.5" /> Save Operations Config
          </button>
        </div>
      </form>

      <style jsx global>{`
        .settings-page .ticket-edge { position: relative; }
        .settings-page .ticket-edge::before {
          content: "";
          position: absolute;
          inset: 3px;
          border: 1px solid rgba(212,175,55,0.10);
          border-radius: inherit;
          pointer-events: none;
        }
        .settings-page .panel-hairline {
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 2px;
          background: linear-gradient(90deg, #38BDF8, #FBBF24, #FBBF24);
          opacity: 0.7;
        }
        .settings-page .pill-cta {
          background: linear-gradient(90deg, #38BDF8 0%, #60A5FA 30%, #D4AF37 70%, #FBBF24 100%);
          color: #060B14;
          box-shadow: 0 8px 24px rgba(56,189,248,0.16), 0 8px 24px rgba(251,191,36,0.16);
        }
        .settings-page .pill-cta:hover { filter: brightness(1.06); }
        .settings-page .ripple {
          position: absolute;
          width: 12px; height: 12px;
          border-radius: 50%;
          background: rgba(255,255,255,0.5);
          transform: translate(-50%, -50%) scale(0);
          pointer-events: none;
          animation: settingsRippleExpand 650ms ease-out forwards;
        }
        @keyframes settingsRippleExpand {
          to { transform: translate(-50%, -50%) scale(16); opacity: 0; }
        }

        @keyframes settingsHeaderIn {
          from { opacity: 0; transform: translateY(-10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .settings-page .header-enter { animation: settingsHeaderIn 0.5s ease-out both; }

        @keyframes settingsPanelIn {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .settings-page .panel-enter { animation: settingsPanelIn 0.5s ease-out 0.08s both; }

        @keyframes settingsSavedPop {
          0% { transform: scale(0.9); opacity: 0; }
          60% { transform: scale(1.03); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .settings-page .saved-pop { animation: settingsSavedPop 280ms cubic-bezier(0.34,1.56,0.64,1); }

        @media (prefers-reduced-motion: reduce) {
          .settings-page .header-enter, .settings-page .panel-enter,
          .settings-page .saved-pop, .settings-page .ripple {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  )
}