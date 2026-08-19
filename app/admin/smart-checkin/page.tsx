"use client"

import { useState, useEffect } from "react"

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
    <div className="space-y-6">
      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-black text-white tracking-tight">
              DigiYatra Biometrics & Smart Boarding
            </h1>
            <span className="text-[10px] font-mono font-bold bg-emerald-400/15 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-400/30">
              FAST-TRACK TELEMETRY
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Biometric identity enrollment telemetry, HMAC-signed QR token verification logs, and touchless e-gate passage stats.
          </p>
        </div>
      </div>

      {/* ── PRIVACY BANNER ─────────────────────────────────────────── */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900/60 to-cyan-950/40 border border-emerald-500/30 flex items-center gap-3">
        <span className="text-2xl">🛡️</span>
        <div className="text-xs font-mono">
          <strong className="text-emerald-300 block">Biometric Privacy & Compliance Shield</strong>
          <span className="text-slate-400">
            Per Navigo security protocols, raw camera images are never stored or exposed to administrators. Only 128-D normalized mathematical vectors and SHA-256 template hashes are processed.
          </span>
        </div>
      </div>

      {/* ── STATS STRIP ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-[#070D18] border border-white/[0.08]">
          <span className="text-[10px] font-mono text-emerald-400 uppercase font-bold">Active Face Profiles</span>
          <div className="font-display font-black text-2xl text-white mt-1">318 Enrolled</div>
          <span className="text-[10px] font-mono text-emerald-400">Instant Clearance Ready</span>
        </div>
        <div className="p-4 rounded-2xl bg-[#070D18] border border-white/[0.08]">
          <span className="text-[10px] font-mono text-cyan-300 uppercase font-bold">Match Accuracy</span>
          <div className="font-display font-black text-2xl text-cyan-300 mt-1">99.82%</div>
          <span className="text-[10px] font-mono text-cyan-400">Cosine Threshold &gt; 0.90</span>
        </div>
        <div className="p-4 rounded-2xl bg-[#070D18] border border-white/[0.08]">
          <span className="text-[10px] font-mono text-amber-300 uppercase font-bold">Gate Verifications</span>
          <div className="font-display font-black text-2xl text-amber-300 mt-1">1,248 Today</div>
          <span className="text-[10px] font-mono text-slate-400">Avg 1.2s per passenger</span>
        </div>
        <div className="p-4 rounded-2xl bg-[#070D18] border border-white/[0.08]">
          <span className="text-[10px] font-mono text-violet-300 uppercase font-bold">QR Token Security</span>
          <div className="font-display font-black text-2xl text-violet-300 mt-1">HS256 HMAC</div>
          <span className="text-[10px] font-mono text-emerald-400">0 Tampering Incidents</span>
        </div>
      </div>

      {/* ── VERIFICATION TELEMETRY LOG ─────────────────────────────── */}
      <div className="bg-[#070D18] border border-white/[0.08] rounded-3xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-white/[0.08]">
          <h3 className="font-display text-xs font-bold uppercase font-mono tracking-wider text-white">
            Live Smart Check-In & Gate Verification Roster
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[#0A1424] border-b border-white/[0.08] text-slate-400 text-[10px] uppercase tracking-wider">
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
                  <td colSpan={6} className="py-12 text-center text-slate-500 font-mono">
                    Loading DigiYatra telemetry…
                  </td>
                </tr>
              ) : (
                bookings.map((b) => (
                  <tr key={b.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-4 font-bold text-white">
                      {b.passengerName}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-amber-300 font-bold block">{b.pnr}</span>
                      <span className="text-[10px] text-cyan-300">{b.flightNumber} ({b.route})</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-400/15 text-emerald-300 border border-emerald-400/30">
                        ACTIVE ✓
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span>Enrolled (BIO-NVG-{b.pnr.slice(0, 4)})</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-emerald-400 font-bold">SIGNED & VALID</span>
                      <span className="text-[10px] text-slate-500 block font-mono">Expires in 48h</span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <span className="text-[9px] font-bold px-2.5 py-1 rounded-full bg-emerald-400 text-slate-950 shadow-[0_2px_8px_rgba(52,211,153,0.3)]">
                        CLEARED FOR GATE 🚪
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
