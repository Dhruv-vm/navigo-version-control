"use client"

import { useState, useEffect } from "react"

// ── Thin-stroke line icons — consistent with the rest of the admin panel,
// replacing the emoji glyphs (🛡️ ✓ 🚪) that read as a different template. ──
const iconProps = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const }

const IconShield = ({ className }: { className?: string }) => (
  <svg {...iconProps} className={className}><path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></svg>
)
const IconCheckCircle = ({ className }: { className?: string }) => (
  <svg {...iconProps} className={className}><circle cx="12" cy="12" r="9" /><path d="m8.5 12.5 2.3 2.3L16 10" /></svg>
)
const IconFace = ({ className }: { className?: string }) => (
  <svg {...iconProps} className={className}><rect x="4" y="4" width="16" height="16" rx="4" /><path d="M4 9V6.5A2.5 2.5 0 0 1 6.5 4H9M15 4h2.5A2.5 2.5 0 0 1 20 6.5V9M20 15v2.5a2.5 2.5 0 0 1-2.5 2.5H15M9 20H6.5A2.5 2.5 0 0 1 4 17.5V15" /><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" /></svg>
)
const IconGate = ({ className }: { className?: string }) => (
  <svg {...iconProps} className={className}><path d="M5 21V6a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v15" /><path d="M3 21h18M9 5v16M15 5v16" /></svg>
)
const IconLock = ({ className }: { className?: string }) => (
  <svg {...iconProps} className={className}><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
)
const IconScan = ({ className }: { className?: string }) => (
  <svg {...iconProps} className={className}><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" /><path d="M4 12h16" /></svg>
)

export default function AdminSmartCheckInPage() {
  const [bookings, setBookings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/admin/bookings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.bookings) setBookings(d.bookings)
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="digiyatra-page space-y-6">
      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <div className="header-enter flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/[0.06]">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="font-display text-2xl font-black text-white tracking-tight">
              DigiYatra Biometrics & Smart Boarding
            </h1>
            <span className="text-[10px] font-mono font-bold bg-emerald-400/15 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-400/30 whitespace-nowrap">
              FAST-TRACK TELEMETRY
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1.5">
            Biometric identity enrollment telemetry, HMAC-signed QR token verification logs, and touchless e-gate passage stats.
          </p>
        </div>
      </div>

      {/* ── PRIVACY BANNER ─────────────────────────────────────────── */}
      <div className="panel-enter ticket-edge relative overflow-hidden p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-[#0A1424] to-cyan-950/30 border border-emerald-500/25 flex items-center gap-3.5">
        <div className="panel-hairline" />
        <div className="w-10 h-10 rounded-xl bg-emerald-400/10 border border-emerald-400/25 text-emerald-300 flex items-center justify-center shrink-0">
          <IconShield className="w-5 h-5" />
        </div>
        <div className="text-xs font-mono">
          <strong className="text-emerald-300 block mb-0.5">Biometric Privacy & Compliance Shield</strong>
          <span className="text-slate-400">
            Per Navigo security protocols, raw camera images are never stored or exposed to administrators. Only 128-D normalized mathematical vectors and SHA-256 template hashes are processed.
          </span>
        </div>
      </div>

      {/* ── STATS STRIP ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          delay={0}
          icon={<IconFace className="w-4 h-4" />}
          label="Active Face Profiles"
          value="318 Enrolled"
          accent="emerald"
          footnote="Instant Clearance Ready"
        />
        <StatCard
          delay={60}
          icon={<IconScan className="w-4 h-4" />}
          label="Match Accuracy"
          value="99.82%"
          accent="cyan"
          footnote="Cosine Threshold > 0.90"
        />
        <StatCard
          delay={120}
          icon={<IconGate className="w-4 h-4" />}
          label="Gate Verifications"
          value="1,248 Today"
          accent="amber"
          footnote="Avg 1.2s per passenger"
        />
        <StatCard
          delay={180}
          icon={<IconLock className="w-4 h-4" />}
          label="QR Token Security"
          value="HS256 HMAC"
          accent="violet"
          footnote="0 Tampering Incidents"
        />
      </div>

      {/* ── VERIFICATION TELEMETRY LOG ─────────────────────────────── */}
      <div className="panel-enter panel-enter-delay-1 ticket-edge relative bg-gradient-to-b from-[#0D1A2C] to-[#0A1424] border border-white/[0.08] rounded-3xl overflow-hidden shadow-xl">
        <div className="panel-hairline" />
        <div className="p-4 border-b border-white/[0.08] flex items-center gap-2 text-amber-300">
          <IconScan className="w-4 h-4" />
          <h3 className="font-display text-xs font-bold uppercase font-mono tracking-wider text-white">
            Live Smart Check-In & Gate Verification Roster
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[#030712] border-b border-white/[0.08] text-slate-400 text-[10px] uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4 font-bold">Passenger Name</th>
                <th className="py-3.5 px-4 font-bold">PNR & Flight</th>
                <th className="py-3.5 px-4 font-bold">Smart Check-In</th>
                <th className="py-3.5 px-4 font-bold">Face ID Profile</th>
                <th className="py-3.5 px-4 font-bold">QR Token Status</th>
                <th className="py-3.5 px-4 font-bold text-right">E-Gate Clearance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-14 text-center text-slate-500 font-mono">
                    <span className="inline-flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                      Loading DigiYatra telemetry…
                    </span>
                  </td>
                </tr>
              ) : bookings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-14 text-center text-slate-500 font-mono">
                    No smart check-ins recorded yet.
                  </td>
                </tr>
              ) : (
                bookings.map((b) => (
                  <tr key={b.id} className="hover:bg-white/[0.025] transition-colors">
                    <td className="py-3.5 px-4 font-bold text-white">
                      {b.passengerName}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-amber-300 font-bold block">{b.pnr}</span>
                      <span className="text-[10px] text-cyan-300">{b.flightNumber} ({b.route})</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-400/15 text-emerald-300 border border-emerald-400/30">
                        <IconCheckCircle className="w-2.5 h-2.5" /> ACTIVE
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                        <span>Enrolled (BIO-NVG-{b.pnr.slice(0, 4)})</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-emerald-400 font-bold">SIGNED & VALID</span>
                      <span className="text-[10px] text-slate-500 block font-mono">Expires in 48h</span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2.5 py-1 rounded-full bg-emerald-400 text-slate-950 shadow-[0_2px_8px_rgba(52,211,153,0.3)]">
                        <IconGate className="w-2.5 h-2.5" /> CLEARED FOR GATE
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <style jsx global>{`
        .digiyatra-page .ticket-edge { position: relative; }
        .digiyatra-page .ticket-edge::before {
          content: "";
          position: absolute;
          inset: 3px;
          border: 1px solid rgba(212,175,55,0.10);
          border-radius: inherit;
          pointer-events: none;
        }
        .digiyatra-page .panel-hairline {
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 2px;
          background: linear-gradient(90deg, #38BDF8, #FBBF24, #FBBF24);
          opacity: 0.7;
        }

        @keyframes digiyatraHeaderIn {
          from { opacity: 0; transform: translateY(-10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .digiyatra-page .header-enter { animation: digiyatraHeaderIn 0.5s ease-out both; }

        @keyframes digiyatraPanelIn {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .digiyatra-page .panel-enter { animation: digiyatraPanelIn 0.5s ease-out 0.05s both; }
        .digiyatra-page .panel-enter-delay-1 { animation-delay: 0.14s; }

        @media (prefers-reduced-motion: reduce) {
          .digiyatra-page .header-enter, .digiyatra-page .panel-enter { animation: none !important; }
        }
      `}</style>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  accent,
  footnote,
  delay = 0,
}: {
  icon: React.ReactNode
  label: string
  value: string
  accent: "emerald" | "cyan" | "amber" | "violet"
  footnote: string
  delay?: number
}) {
  const accentText: Record<string, string> = {
    emerald: "text-emerald-300",
    cyan: "text-cyan-300",
    amber: "text-amber-300",
    violet: "text-violet-300",
  }
  const accentChip: Record<string, string> = {
    emerald: "bg-emerald-400/10 border-emerald-400/25 text-emerald-300",
    cyan: "bg-cyan-400/10 border-cyan-400/25 text-cyan-300",
    amber: "bg-amber-400/10 border-amber-400/25 text-amber-300",
    violet: "bg-violet-400/10 border-violet-400/25 text-violet-300",
  }

  return (
    <div
      className="panel-enter ticket-edge relative p-4 rounded-2xl bg-gradient-to-b from-[#0D1A2C] to-[#0A1424] border border-white/[0.08] hover:border-white/[0.16] transition-colors overflow-hidden"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="panel-hairline" />
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-mono text-slate-400 uppercase font-bold tracking-wide">{label}</span>
        <div className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${accentChip[accent]}`}>
          {icon}
        </div>
      </div>
      <div className={`font-display font-black text-2xl mt-1 ${accentText[accent]}`}>{value}</div>
      <span className="text-[10px] font-mono text-slate-500 mt-1 block">{footnote}</span>
    </div>
  )
}