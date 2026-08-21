"use client"

import { useState, useEffect, useRef } from "react"

/* ── motion-safe count-up ──────────────────────────────────────────── */
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReduced(mq.matches)
    const handler = () => setReduced(mq.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])
  return reduced
}

function useCountUp(value: number, duration = 1000) {
  const [display, setDisplay] = useState(value)
  const reduced = usePrefersReducedMotion()
  const prevRef = useRef(value)

  useEffect(() => {
    if (reduced) {
      setDisplay(value)
      prevRef.current = value
      return
    }
    const start = prevRef.current
    const delta = value - start
    if (delta === 0) return
    let startTime: number | null = null
    let raf = 0
    const step = (t: number) => {
      if (startTime === null) startTime = t
      const progress = Math.min((t - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(start + delta * eased))
      if (progress < 1) raf = requestAnimationFrame(step)
      else prevRef.current = value
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value, duration, reduced])

  return display
}

/* ── ticket-stub KPI card ──────────────────────────────────────────── */
function LedgerCard({
  eyebrow,
  code,
  value,
  sub,
  accent,
  live = false,
}: {
  eyebrow: string
  code: string
  value: string
  sub: string
  accent: "gold" | "ivory" | "emerald" | "oxblood"
  live?: boolean
}) {
  const accentMap = {
    gold: { text: "text-[#E4C387]", bar: "#D9B579", glow: "rgba(217,181,121,0.35)" },
    ivory: { text: "text-[#F4EEE1]", bar: "#F4EEE1", glow: "rgba(244,238,225,0.22)" },
    emerald: { text: "text-[#7BE7A8]", bar: "#4ADE80", glow: "rgba(74,222,128,0.28)" },
    oxblood: { text: "text-[#E19FAE]", bar: "#B4485E", glow: "rgba(180,72,94,0.3)" },
  }[accent]

  return (
    <div
      className="ledger-card relative rounded-2xl border border-[#D9B579]/[0.14] bg-gradient-to-b from-[#0C1119] to-[#050810] px-5 pt-5 pb-4 shadow-[0_18px_40px_-20px_rgba(0,0,0,0.8)]"
      style={{ ["--glow" as any]: accentMap.glow }}
    >
      {/* perforation notches */}
      <span className="notch notch-left" />
      <span className="notch notch-right" />

      <div className="flex items-start justify-between">
        <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-[#8791A3]">
          {eyebrow}
        </span>
        {live && (
          <span className="flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="pulse-ring absolute inline-flex h-full w-full rounded-full bg-[#4ADE80]" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#4ADE80]" />
            </span>
            <span className="text-[9px] font-mono text-[#4ADE80]">LIVE</span>
          </span>
        )}
      </div>

      <div className={`font-display font-black text-2xl mt-2 ${accentMap.text}`}>
        {value}
      </div>
      <div className="text-[10px] font-mono text-[#8791A3] mt-1">{sub}</div>

      {/* barcode footer */}
      <div className="mt-4 pt-3 border-t border-dashed border-[#D9B579]/[0.16] flex items-center justify-between">
        <div
          className="h-3 w-20 opacity-70"
          style={{
            backgroundImage:
              "repeating-linear-gradient(90deg, #D9B579 0px, #D9B579 1.5px, transparent 1.5px, transparent 4px)",
          }}
        />
        <span className="text-[9px] font-mono tracking-widest text-[#8791A3]">{code}</span>
      </div>
    </div>
  )
}

/* ── dotted flight-path section divider ───────────────────────────── */
function FlightDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 my-1">
      <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#8791A3] whitespace-nowrap">
        {label}
      </span>
      <div className="flight-path flex-1 h-px" />
      <span className="text-[#D9B579] text-xs">✈</span>
    </div>
  )
}

export default function AdminRevenuePage() {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isSimulated, setIsSimulated] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem("navigo_admin_telemetry_mode")
    if (saved === "SIMULATION") setIsSimulated(true)

    const handleModeChange = (e: any) => {
      setIsSimulated(Boolean(e.detail?.isSimulated))
    }
    window.addEventListener("navigo_telemetry_mode_changed", handleModeChange)
    return () => window.removeEventListener("navigo_telemetry_mode_changed", handleModeChange)
  }, [])

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setStats(d)
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [])

  const realTotal = stats?.kpis?.totalRevenue || 3894200
  const realToday = stats?.kpis?.todayRevenue || 342800

  const totalRev = isSimulated ? 186200000 : realTotal
  const todayRev = isSimulated ? 7854200 : realToday

  const ticketRev = Math.round(totalRev * 0.82)
  const addonRev = Math.round(totalRev * 0.15)
  const taxFees = Math.round(totalRev * 0.03)

  const animatedTotal = useCountUp(totalRev)
  const animatedToday = useCountUp(todayRev)
  const animatedAddon = useCountUp(addonRev)

  const cabins = [
    { label: "First Class Suite", pct: 28, color: "#D9B579", text: "text-[#E4C387]" },
    { label: "Business Class", pct: 38, color: "#B08551", text: "text-[#D3A876]" },
    { label: "Premium Economy", pct: 16, color: "#D8CDB8", text: "text-[#E7DFCC]" },
    { label: "Economy Standard", pct: 18, color: "#6B7280", text: "text-[#9AA2AF]" },
  ]

  const channels = [
    {
      icon: "📱",
      name: "UPI (GPay / PhonePe / Paytm)",
      note: "Zero settlement fee",
      share: "64.2%",
      color: "text-[#7BE7A8]",
    },
    {
      icon: "💳",
      name: "Credit & Debit Cards (Visa / Mastercard)",
      note: "3D Secure 2.0",
      share: "28.4%",
      color: "text-[#E4C387]",
    },
    {
      icon: "🏛️",
      name: "Net Banking & Corporate Accounts",
      note: "Corporate portal",
      share: "7.4%",
      color: "text-[#D3A876]",
    },
  ]

  return (
    <div className="space-y-7 relative">
      <style jsx>{`
        .ledger-card {
          overflow: hidden;
        }
        .ledger-card::before {
          content: "";
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 15% 0%, var(--glow), transparent 55%);
          opacity: 0.5;
          pointer-events: none;
        }
        .ledger-card::after {
          content: "";
          position: absolute;
          inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='90' height='90'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E");
          pointer-events: none;
          mix-blend-mode: overlay;
        }
        .ledger-card {
          transition: transform 220ms ease, border-color 220ms ease;
        }
        .ledger-card:hover {
          transform: translateY(-2px);
          border-color: rgba(217, 181, 121, 0.32);
        }
        .notch {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          width: 14px;
          height: 14px;
          border-radius: 9999px;
          background: #05070b;
          border: 1px solid rgba(217, 181, 121, 0.14);
        }
        .notch-left {
          left: -8px;
        }
        .notch-right {
          right: -8px;
        }
        .flight-path {
          background-image: repeating-linear-gradient(
            90deg,
            rgba(217, 181, 121, 0.45) 0px,
            rgba(217, 181, 121, 0.45) 5px,
            transparent 5px,
            transparent 11px
          );
        }
        .pulse-ring {
          animation: pulseRing 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;
        }
        .stamp {
          animation: stampSettle 500ms ease-out;
        }
        @keyframes pulseRing {
          0% {
            transform: scale(1);
            opacity: 0.7;
          }
          75%,
          100% {
            transform: scale(2.4);
            opacity: 0;
          }
        }
        @keyframes stampSettle {
          0% {
            transform: rotate(-14deg) scale(1.4);
            opacity: 0;
          }
          100% {
            transform: rotate(-6deg) scale(1);
            opacity: 1;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .ledger-card,
          .pulse-ring,
          .stamp {
            animation: none !important;
            transition: none !important;
          }
          .ledger-card:hover {
            transform: none;
          }
        }
      `}</style>

      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-black text-white tracking-tight">
              Financial &amp; Revenue Telemetry
            </h1>
            {isSimulated && (
              <span className="text-[9px] font-mono font-bold bg-[#B4485E]/15 text-[#E19FAE] px-2 py-0.5 rounded-full border border-[#B4485E]/30">
                SIMULATION MODE
              </span>
            )}
          </div>
          <p className="text-xs text-[#8791A3] mt-1.5 font-mono">
            Realized ticket sales, ancillary monetization, tax settlements &amp; refund reconciliations.
          </p>
        </div>

        {/* wax-stamp badge */}
        <div className="stamp shrink-0 -rotate-6 border-2 border-[#D9B579]/50 rounded-full px-4 py-2 text-center bg-[#D9B579]/[0.05]">
          <div className="font-display text-[11px] font-bold tracking-[0.14em] text-[#E4C387]">
            CERTIFIED
          </div>
          <div className="text-[8px] font-mono tracking-[0.18em] text-[#8791A3]">
            NAVIGO TREASURY
          </div>
        </div>
      </div>

      {/* ── FINANCIAL KPIS STRIP ────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <LedgerCard
          eyebrow="Gross Revenue (MTD)"
          code="NAV-MTD-01"
          value={`₹${(animatedTotal / 100000).toFixed(2)} Lakhs`}
          sub="+16.3% vs target"
          accent="gold"
        />
        <LedgerCard
          eyebrow="Today's Settlements"
          code="NAV-TDY-02"
          value={`₹${animatedToday.toLocaleString("en-IN")}`}
          sub="42 bookings settled"
          accent="ivory"
          live
        />
        <LedgerCard
          eyebrow="Ancillary Add-On Yield"
          code="NAV-ADN-03"
          value={`₹${(animatedAddon / 100000).toFixed(2)}L`}
          sub="15.2% of total turnover"
          accent="emerald"
        />
        <LedgerCard
          eyebrow="Refunds & Reversals"
          code="NAV-REF-04"
          value="₹48,250"
          sub="1.2% refund rate"
          accent="oxblood"
        />
      </div>

      <FlightDivider label="Manifest" />

      {/* ── REVENUE BY CABIN & ROUTE ─────────────────────────────────── */}
      <div className="grid grid-cols-12 gap-6">
        {/* Cabin Yield (6 cols) */}
        <div className="col-span-12 lg:col-span-6 relative bg-[#070D18] border border-[#D9B579]/[0.12] rounded-2xl p-5 shadow-xl font-mono text-xs space-y-4">
          <h3 className="font-display text-xs font-bold uppercase tracking-[0.1em] text-white">
            Yield by Cabin Class
          </h3>
          <div className="space-y-3.5">
            {cabins.map((c) => (
              <div key={c.label}>
                <div className={`flex justify-between font-bold mb-1 ${c.text}`}>
                  <span>{c.label}</span>
                  <span>
                    ₹{Math.round(totalRev * (c.pct / 100)).toLocaleString("en-IN")} ({c.pct}%)
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${c.pct}%`, backgroundColor: c.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Payment Channels (6 cols) */}
        <div className="col-span-12 lg:col-span-6 bg-[#070D18] border border-[#D9B579]/[0.12] rounded-2xl p-5 shadow-xl font-mono text-xs space-y-4">
          <h3 className="font-display text-xs font-bold uppercase tracking-[0.1em] text-white">
            Settlement Gateway Channels
          </h3>
          <div className="space-y-3">
            {channels.map((ch) => (
              <div
                key={ch.name}
                className="p-3 rounded-xl bg-white/[0.02] border border-[#D9B579]/[0.08] flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{ch.icon}</span>
                  <div>
                    <strong className="text-white block">{ch.name}</strong>
                    <span className="text-[10px] text-[#8791A3]">{ch.note}</span>
                  </div>
                </div>
                <span className={`font-bold ${ch.color}`}>{ch.share} Share</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}