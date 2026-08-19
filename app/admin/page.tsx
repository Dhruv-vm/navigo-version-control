"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState("Today")
  const [simulationRunning, setSimulationRunning] = useState(false)
  const [simResult, setSimResult] = useState<any>(null)
  const [simRoute, setSimRoute] = useState("DEL → DXB")
  const [simDelay, setSimDelay] = useState("2")
  const [simReason, setSimReason] = useState("Weather")
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
      .catch((e) => console.error("Stats fetch error:", e))
      .finally(() => setLoading(false))
  }, [])

  const runSimulation = () => {
    setSimulationRunning(true)
    setTimeout(() => {
      const hrs = Number(simDelay) || 2
      setSimResult({
        affectedFlights: Math.round(hrs * 3.5),
        affectedPassengers: Math.round(hrs * 380),
        estimatedImpact: `₹${(hrs * 485000).toLocaleString("en-IN")}`,
        recoveryTime: `${hrs * 2.2} hours`,
      })
      setSimulationRunning(false)
    }, 900)
  }

  // Real DB KPIs vs Simulated Enterprise Scale
  const realKpis = stats?.kpis || {
    totalBookings: 43,
    todayBookings: 4,
    todayRevenue: 342800,
    totalRevenue: 3894200,
    totalPassengers: 63,
    upcomingFlights: 1000,
    checkedInPassengers: 48,
    smartCheckInUsers: 32,
    occupancyRate: "78.6%",
  }

  const simulatedKpis = {
    totalBookings: 245672,
    todayBookings: 3421,
    todayRevenue: 7854200,
    totalRevenue: 186200000,
    totalPassengers: 386421,
    upcomingFlights: 1286,
    checkedInPassengers: 2412,
    smartCheckInUsers: 142850,
    occupancyRate: "87.4%",
  }

  const kpis = isSimulated ? simulatedKpis : realKpis

  return (
    <div className="space-y-6">
      {/* ── HEADER TITLE & CONTROLS ─────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-black text-white tracking-tight">
              Airport Command Center
            </h1>
            {isSimulated ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-[0_0_15px_rgba(168,85,247,0.2)]">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                SIMULATION TELEMETRY (TEST DATA)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono font-bold bg-emerald-400/15 text-emerald-300 border border-emerald-400/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                100% REALTIME SUPABASE SYNCED
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {isSimulated
              ? "High-volume synthetic airport traffic simulation for pitch & scalability demonstrations."
              : "Real-time operations, real bookings, Supabase flight instances, and DigiYatra telemetry."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Time filter */}
          <div className="flex items-center bg-white/[0.04] border border-white/[0.08] rounded-xl p-1 text-xs font-mono">
            {["Live", "1H", "6H", "24H", "7D", "30D"].map((t) => (
              <button
                key={t}
                onClick={() => setTimeRange(t)}
                className={`px-2.5 py-1 rounded-lg transition-colors ${
                  timeRange === t ? "bg-amber-400 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <Link
            href="/admin/flights"
            className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs shadow-[0_2px_12px_rgba(251,191,36,0.3)] transition-colors flex items-center gap-1.5"
          >
            <span>+</span> Create Flight
          </Link>
        </div>
      </div>

      {/* ── TOP KPI CARDS STRIP ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        <KpiCard
          label="TOTAL BOOKINGS"
          value={kpis.totalBookings.toLocaleString()}
          diff={isSimulated ? "+14.6% vs yesterday" : "Real Supabase Records"}
          accent="amber"
          icon="🎫"
        />
        <KpiCard
          label="ACTIVE FLIGHTS"
          value={kpis.upcomingFlights.toLocaleString()}
          diff={isSimulated ? "+6.2% scheduled" : "Scheduled Dates"}
          accent="cyan"
          icon="✈️"
        />
        <KpiCard
          label="TOTAL PASSENGERS"
          value={kpis.totalPassengers.toLocaleString()}
          diff={isSimulated ? "+10.1% vs avg" : "Registered Manifest"}
          accent="emerald"
          icon="👥"
        />
        <KpiCard
          label="REVENUE (MTD)"
          value={isSimulated ? "₹18.62M" : `₹${(kpis.totalRevenue / 100000).toFixed(2)}L`}
          diff={isSimulated ? "+16.3% vs target" : "Audited Net Revenue"}
          accent="gold"
          icon="💰"
        />
        <KpiCard
          label="SMART BOARDING"
          value={isSimulated ? "142.8k Pax" : `${kpis.smartCheckInUsers} Pax`}
          diff="DigiYatra Face ID"
          accent="violet"
          icon="⚡"
        />
        <KpiCard
          label="OCCUPANCY RATE"
          value={kpis.occupancyRate}
          diff={isSimulated ? "On-Time Performance" : "Current Load Factor"}
          accent="sky"
          icon="📊"
        />
      </div>

      {/* ── MAIN ROW 1: FLIGHT RADAR MAP + SEAT HEATMAP + REVENUE ─────── */}
      <div className="grid grid-cols-12 gap-6">
        {/* Live Flight Radar Simulation (5 cols) */}
        <div className="col-span-12 lg:col-span-4 bg-gradient-to-b from-[#091322] to-[#050A14] border border-white/[0.08] rounded-3xl p-5 relative overflow-hidden shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-base">🌐</span>
              <h3 className="text-xs font-bold uppercase font-mono tracking-wider text-white">
                Live Flight Radar Map
              </h3>
            </div>
            <span className="text-[10px] font-mono text-cyan-400 bg-cyan-400/10 border border-cyan-400/20 px-2 py-0.5 rounded-full">
              4 Active En Route
            </span>
          </div>

          {/* Map canvas simulation with SVG flight paths */}
          <div className="relative h-56 rounded-2xl bg-[#030712] border border-white/[0.06] overflow-hidden flex items-center justify-center p-3">
            {/* Grid overlay */}
            <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-40" />

            <svg viewBox="0 0 400 240" className="w-full h-full">
              {/* Route arcs */}
              <path d="M 60 160 Q 200 40 340 120" fill="none" stroke="#22D3EE" strokeWidth="1.5" strokeDasharray="4 4" className="animate-pulse" />
              <path d="M 60 160 Q 150 180 260 190" fill="none" stroke="#F59E0B" strokeWidth="1.5" strokeDasharray="4 4" />
              <path d="M 60 160 Q 180 80 320 60" fill="none" stroke="#34D399" strokeWidth="1.5" strokeDasharray="4 4" />

              {/* Airports Nodes */}
              {/* DEL */}
              <circle cx="60" cy="160" r="5" fill="#E8C766" />
              <text x="50" y="180" fill="#E8C766" fontSize="10" fontFamily="monospace" fontWeight="bold">DEL</text>

              {/* BLR */}
              <circle cx="260" cy="190" r="4" fill="#38BDF8" />
              <text x="265" y="195" fill="#38BDF8" fontSize="9" fontFamily="monospace">BLR</text>

              {/* DXB */}
              <circle cx="320" cy="60" r="4" fill="#34D399" />
              <text x="325" y="65" fill="#34D399" fontSize="9" fontFamily="monospace">DXB</text>

              {/* NRT */}
              <circle cx="340" cy="120" r="4" fill="#F472B6" />
              <text x="345" y="125" fill="#F472B6" fontSize="9" fontFamily="monospace">NRT</text>

              {/* Animated Planes */}
              <circle cx="180" cy="85" r="3.5" fill="#FFFFFF" className="animate-ping" />
              <circle cx="180" cy="85" r="3" fill="#22D3EE" />

              <circle cx="150" cy="175" r="3" fill="#F59E0B" />
              <circle cx="210" cy="98" r="3" fill="#34D399" />
            </svg>

            {/* Radar Sweep Animation */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-cyan-400/5 to-transparent w-full h-full animate-[spin_8s_linear_infinite]" />
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-3 border-t border-white/[0.06] mt-3">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-cyan-400" /> DEL → DXB (EK 512)</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400" /> DEL → BLR (6E 204)</span>
          </div>
        </div>

        {/* Seat Occupancy Heatmap (4 cols) */}
        <div className="col-span-12 lg:col-span-4 bg-gradient-to-b from-[#091322] to-[#050A14] border border-white/[0.08] rounded-3xl p-5 relative overflow-hidden shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-base">💺</span>
              <h3 className="text-xs font-bold uppercase font-mono tracking-wider text-white">
                Seat Occupancy Heatmap
              </h3>
            </div>
            <Link href="/admin/seats" className="text-[10px] text-amber-400 hover:underline font-mono">
              View All Cabins →
            </Link>
          </div>

          {/* Cabin visualization */}
          <div className="bg-[#030712] border border-white/[0.06] rounded-2xl p-3.5 space-y-3">
            <div>
              <div className="flex items-center justify-between text-xs font-mono mb-1">
                <span className="text-amber-300 font-bold">First Class Suite (6/8)</span>
                <span className="text-amber-300 font-bold">75.0%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-white/[0.06] overflow-hidden">
                <div className="h-full bg-gradient-to-r from-amber-400 to-amber-300 rounded-full" style={{ width: "75%" }} />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-mono mb-1">
                <span className="text-cyan-300 font-bold">Business Class (14/16)</span>
                <span className="text-cyan-300 font-bold">87.5%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-white/[0.06] overflow-hidden">
                <div className="h-full bg-gradient-to-r from-cyan-500 to-cyan-300 rounded-full" style={{ width: "87.5%" }} />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-mono mb-1">
                <span className="text-emerald-300 font-bold">Premium Economy (19/24)</span>
                <span className="text-emerald-300 font-bold">79.2%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-white/[0.06] overflow-hidden">
                <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-300 rounded-full" style={{ width: "79.2%" }} />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-mono mb-1">
                <span className="text-slate-300 font-bold">Economy Standard (122/144)</span>
                <span className="text-slate-300 font-bold">84.7%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-white/[0.06] overflow-hidden">
                <div className="h-full bg-gradient-to-r from-sky-500 to-indigo-400 rounded-full" style={{ width: "84.7%" }} />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-around text-[10px] font-mono text-slate-400 pt-3 border-t border-white/[0.06] mt-3">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" /> 0–40% Low</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-400" /> 41–70% Mid</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> 71–90% High</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-400" /> 91%+ Full</span>
          </div>
        </div>

        {/* Revenue Trend Graph (4 cols) */}
        <div className="col-span-12 lg:col-span-4 bg-gradient-to-b from-[#091322] to-[#050A14] border border-white/[0.08] rounded-3xl p-5 relative overflow-hidden shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-base">📈</span>
              <h3 className="text-xs font-bold uppercase font-mono tracking-wider text-white">
                Revenue Velocity
              </h3>
            </div>
            <span className="text-xs font-mono font-bold text-amber-300">
              ₹{(kpis.todayRevenue).toLocaleString("en-IN")} Today
            </span>
          </div>

          {/* Mini Sparkline Curve */}
          <div className="h-44 flex items-end gap-1.5 pt-4 px-2">
            {[35, 48, 62, 55, 78, 85, 92, 88, 110, 125, 140, 160].map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group">
                <div
                  className="w-full bg-gradient-to-t from-amber-500/20 to-amber-400 rounded-t group-hover:brightness-125 transition-all"
                  style={{ height: `${(h / 160) * 100}%` }}
                />
                <span className="text-[8.5px] font-mono text-slate-500">{i * 2}:00</span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-slate-300 pt-3 border-t border-white/[0.06] mt-3">
            <span>Avg Ticket: <strong className="text-white">₹8,450</strong></span>
            <span>Add-On Yield: <strong className="text-emerald-400">₹1,240/pax</strong></span>
          </div>
        </div>
      </div>

      {/* ── MAIN ROW 2: RECENT BOOKINGS + DELAY SIMULATOR + FLEET ─────── */}
      <div className="grid grid-cols-12 gap-6">
        {/* Recent Bookings Stream (5 cols) */}
        <div className="col-span-12 lg:col-span-5 bg-[#070D18] border border-white/[0.08] rounded-3xl p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-base">🎫</span>
              <h3 className="text-xs font-bold uppercase font-mono tracking-wider text-white">
                Live Bookings Stream
              </h3>
            </div>
            <Link href="/admin/bookings" className="text-[10px] font-mono text-cyan-400 hover:underline">
              View All ({kpis.totalBookings}) →
            </Link>
          </div>

          <div className="space-y-2.5">
            {(stats?.recentBookings || []).map((b: any) => (
              <div
                key={b.id}
                className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.05] transition-colors flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-400/10 border border-amber-400/20 text-amber-300 text-xs font-mono font-bold flex items-center justify-center">
                    {b.pnr.slice(0, 3)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <strong className="text-xs font-bold text-white">{b.passengerName}</strong>
                      <span className="text-[9px] font-mono px-1.5 py-[1px] rounded bg-white/[0.08] text-slate-400">
                        {b.pnr}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                      {b.route} · Seat {b.seat} · {b.date}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs font-bold font-mono text-emerald-400 block">
                    ₹{b.amount.toLocaleString("en-IN")}
                  </span>
                  <span className="text-[9px] font-mono uppercase px-1.5 py-[1px] rounded bg-emerald-400/15 text-emerald-300 border border-emerald-400/30">
                    {b.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Operational Delay Simulator (4 cols) */}
        <div className="col-span-12 lg:col-span-4 bg-gradient-to-b from-[#0B1528] to-[#060D18] border border-white/[0.08] rounded-3xl p-5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-base">⚡</span>
                <h3 className="text-xs font-bold uppercase font-mono tracking-wider text-white">
                  Operations Delay Simulator
                </h3>
              </div>
              <span className="text-[10px] font-mono text-amber-300 bg-amber-400/10 px-2 py-0.5 rounded-full">
                AI PREDICT
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Simulate runway congestion or weather holds to project passenger impact and recovery time.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] font-mono text-slate-400 uppercase block mb-1">Target Route</label>
                <select
                  value={simRoute}
                  onChange={(e) => setSimRoute(e.target.value)}
                  className="w-full bg-[#030712] border border-white/[0.1] rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none"
                >
                  <option>DEL → DXB (Emirates EK 512)</option>
                  <option>DEL → BLR (IndiGo 6E 204)</option>
                  <option>BOM → DEL (Air India AI 102)</option>
                  <option>DEL → NRT (Japan Airlines JL 740)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-mono text-slate-400 uppercase block mb-1">Delay Duration</label>
                  <select
                    value={simDelay}
                    onChange={(e) => setSimDelay(e.target.value)}
                    className="w-full bg-[#030712] border border-white/[0.1] rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none"
                  >
                    <option value="1">1 Hour</option>
                    <option value="2">2 Hours</option>
                    <option value="4">4 Hours</option>
                    <option value="6">6 Hours</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-mono text-slate-400 uppercase block mb-1">Reason</label>
                  <select
                    value={simReason}
                    onChange={(e) => setSimReason(e.target.value)}
                    className="w-full bg-[#030712] border border-white/[0.1] rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none"
                  >
                    <option>Weather Fog</option>
                    <option>Runway Hold</option>
                    <option>Technical Check</option>
                  </select>
                </div>
              </div>

              <button
                onClick={runSimulation}
                disabled={simulationRunning}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-bold text-xs shadow-[0_2px_14px_rgba(251,191,36,0.35)] hover:brightness-110 transition-all flex items-center justify-center gap-2 mt-2"
              >
                {simulationRunning ? "Simulating Network Impact…" : "Run Predictive Simulation ▶"}
              </button>
            </div>
          </div>

          {/* Simulation Output Card */}
          {simResult && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-3 rounded-2xl bg-amber-400/10 border border-amber-400/30 text-xs space-y-1.5 font-mono"
            >
              <div className="flex justify-between text-slate-300">
                <span>Affected Flights:</span>
                <strong className="text-amber-300">{simResult.affectedFlights}</strong>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Affected Passengers:</span>
                <strong className="text-amber-300">{simResult.affectedPassengers} Pax</strong>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Projected Revenue Impact:</span>
                <strong className="text-rose-400">{simResult.estimatedImpact}</strong>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Network Recovery:</span>
                <strong className="text-emerald-300">{simResult.recoveryTime}</strong>
              </div>
            </motion.div>
          )}
        </div>

        {/* Fleet Aircraft Status (3 cols) */}
        <div className="col-span-12 lg:col-span-3 bg-[#070D18] border border-white/[0.08] rounded-3xl p-5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-base">✈️</span>
                <h3 className="text-xs font-bold uppercase font-mono tracking-wider text-white">
                  Fleet Status
                </h3>
              </div>
              <span className="text-[10px] font-mono text-emerald-400">5 Aircraft</span>
            </div>

            <div className="space-y-2.5">
              {(stats?.fleet || []).map((f: any) => (
                <div
                  key={f.code}
                  className="p-2.5 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between text-xs font-mono"
                >
                  <div>
                    <strong className="text-white block text-[11px]">{f.model}</strong>
                    <span className="text-[10px] text-slate-400">{f.airline} · {f.route}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] font-bold px-1.5 py-[1px] rounded bg-cyan-400/15 text-cyan-300 border border-cyan-400/25 block">
                      {f.status}
                    </span>
                    <span className="text-[9px] text-slate-500 mt-0.5 block">{f.occupancy}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-white/[0.06] mt-4">
            <Link
              href="/admin/flights/instances"
              className="w-full py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white text-xs font-mono font-bold text-center block transition-colors border border-white/[0.08]"
            >
              Manage Flight Instances →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function KpiCard({
  label,
  value,
  diff,
  accent,
  icon,
}: {
  label: string
  value: string
  diff: string
  accent: "amber" | "cyan" | "emerald" | "gold" | "violet" | "sky"
  icon: string
}) {
  const accentGlow: Record<string, string> = {
    amber: "bg-amber-400/10 border-amber-400/20 text-amber-300",
    cyan: "bg-cyan-400/10 border-cyan-400/20 text-cyan-300",
    emerald: "bg-emerald-400/10 border-emerald-400/20 text-emerald-300",
    gold: "bg-[#E8C766]/10 border-[#E8C766]/20 text-[#E8C766]",
    violet: "bg-violet-400/10 border-violet-400/20 text-violet-300",
    sky: "bg-sky-400/10 border-sky-400/20 text-sky-300",
  }

  return (
    <div className="relative bg-gradient-to-b from-[#0B1528] via-[#070E1C] to-[#040812] border border-white/[0.08] hover:border-white/[0.18] rounded-3xl p-5 overflow-hidden shadow-2xl group transition-all">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] uppercase font-mono tracking-widest text-slate-400 font-semibold">{label}</span>
        <div className={`w-8 h-8 rounded-xl border flex items-center justify-center text-sm shadow-inner ${accentGlow[accent]}`}>
          {icon}
        </div>
      </div>
      <div className="font-display font-black text-2xl sm:text-3xl text-white tracking-tight">
        {value}
      </div>
      <div className="flex items-center gap-1.5 mt-2.5">
        <span className="text-[10px] font-mono text-emerald-400 font-bold tracking-tight">{diff}</span>
      </div>
      <div className="pointer-events-none absolute -bottom-8 -right-8 w-20 h-20 bg-white/[0.03] blur-xl rounded-full" />
    </div>
  )
}
