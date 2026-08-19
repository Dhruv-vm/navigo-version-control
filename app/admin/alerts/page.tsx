"use client"

import { useState } from "react"

export default function AdminAlertsPage() {
  const [filter, setFilter] = useState("ALL")
  const [alerts, setAlerts] = useState([
    {
      id: "alt-1",
      severity: "CRITICAL",
      title: "High Delay Risk: Flight AI 106 (DEL → SFO)",
      message: "Severe thunderstorm activity over Western sector. Projected departure delay 90 minutes. 284 passengers affected.",
      timestamp: "10:23 AM",
      flight: "AI 106",
      status: "OPEN",
    },
    {
      id: "alt-2",
      severity: "WARNING",
      title: "Seat Inventory Depleted: EK 512 (DEL → DXB)",
      message: "Economy cabin reached 98% occupancy. Dynamic pricing engine bumped multiplier to 1.85x.",
      timestamp: "10:19 AM",
      flight: "EK 512",
      status: "OPEN",
    },
    {
      id: "alt-3",
      severity: "WARNING",
      title: "Runway Congestion at Delhi T3 Concourse",
      message: "Runway 29L departure queue exceeding 8 aircraft. Estimated 12-minute taxiway hold.",
      timestamp: "10:14 AM",
      flight: "ALL_DEL",
      status: "OPEN",
    },
    {
      id: "alt-4",
      severity: "INFO",
      title: "DigiYatra E-Gate Passage Spike at Gate G4",
      message: "48 biometric verifications executed within 10 minutes. Gate scanner latency 1.1s (Optimal).",
      timestamp: "10:08 AM",
      flight: "6E 204",
      status: "RESOLVED",
    },
    {
      id: "alt-5",
      severity: "INFO",
      title: "Daily Payment Settlement Batch Completed",
      message: "Razorpay / UPI settlement of ₹3.42 Lakhs credited to Navigo Escrow account.",
      timestamp: "09:45 AM",
      flight: "FINANCE",
      status: "RESOLVED",
    },
  ])

  const handleDismiss = (id: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: "RESOLVED" } : a))
    )
  }

  const filtered = alerts.filter(
    (a) => filter === "ALL" || a.severity === filter
  )

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-black text-white tracking-tight">
              Airport Operations Alerts & Risk Watch
            </h1>
            <span className="text-[10px] font-mono font-bold bg-rose-500/15 text-rose-300 px-2 py-0.5 rounded-full border border-rose-500/30">
              REAL-TIME DISPATCH
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Weather disruptions, gate delays, seat depletion alerts, payment gateway anomalies, and security events.
          </p>
        </div>

        {/* Severity Filters */}
        <div className="flex items-center gap-2">
          {["ALL", "CRITICAL", "WARNING", "INFO"].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-xl font-bold transition-colors ${
                filter === s
                  ? "bg-amber-400 text-slate-950 font-bold"
                  : "bg-white/[0.04] text-slate-400 hover:text-white"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* ── ALERTS FEED ────────────────────────────────────────────── */}
      <div className="space-y-3">
        {filtered.map((a) => (
          <div
            key={a.id}
            className={`p-5 rounded-3xl border shadow-xl flex flex-wrap items-start justify-between gap-4 transition-all ${
              a.severity === "CRITICAL"
                ? "bg-rose-950/20 border-rose-500/30"
                : a.severity === "WARNING"
                ? "bg-amber-950/20 border-amber-500/30"
                : "bg-[#070D18] border-white/[0.08]"
            }`}
          >
            <div className="flex items-start gap-3.5 max-w-3xl">
              <span className="text-xl mt-0.5">
                {a.severity === "CRITICAL" ? "🚨" : a.severity === "WARNING" ? "⚠️" : "ℹ️"}
              </span>
              <div>
                <div className="flex items-center gap-2.5">
                  <strong className="text-sm font-bold text-white font-display">{a.title}</strong>
                  <span
                    className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                      a.severity === "CRITICAL"
                        ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                        : a.severity === "WARNING"
                        ? "bg-amber-400/20 text-amber-300 border border-amber-400/30"
                        : "bg-cyan-400/20 text-cyan-300 border border-cyan-400/30"
                    }`}
                  >
                    {a.severity}
                  </span>
                  <span className="text-[10px] text-slate-500">{a.timestamp}</span>
                </div>
                <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">{a.message}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-center">
              {a.status === "OPEN" ? (
                <button
                  onClick={() => handleDismiss(a.id)}
                  className="px-4 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white text-xs border border-white/[0.08] transition-colors"
                >
                  Acknowledge ✓
                </button>
              ) : (
                <span className="text-[10px] text-emerald-400 font-bold px-3 py-1 rounded-full bg-emerald-400/10 border border-emerald-400/20">
                  RESOLVED
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
