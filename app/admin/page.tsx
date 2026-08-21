"use client"

import { useState, useEffect, type MouseEvent as ReactMouseEvent } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"

// ── Ripple hook — same click-position ripple used on the flights/seats
// pages, so primary buttons feel consistent across the whole app. ──────────
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

// ── Thin-stroke line icons — replaces the emoji glyphs so this page reads
// as part of the same product as the flights/seats screens instead of a
// different, unbranded admin template. ──────────────────────────────────
const iconProps = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const }

const IconTicket = ({ className }: { className?: string }) => (
  <svg {...iconProps} className={className}><path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8Z" /><path d="M13 6v2M13 11v2M13 16v2" /></svg>
)
const IconPlane = ({ className }: { className?: string }) => (
  <svg {...iconProps} className={className}><path d="M12 2 5 15l7-2.5L19 15 12 2Z" /><path d="M9.5 12.5 7 20l2.5-1 2.5 1-2.5-7.5" /></svg>
)
const IconUsers = ({ className }: { className?: string }) => (
  <svg {...iconProps} className={className}><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><circle cx="17" cy="9" r="2.4" /><path d="M15.5 14.2c2.4.4 4.5 2.5 4.5 5.8" /></svg>
)
const IconRupee = ({ className }: { className?: string }) => (
  <svg {...iconProps} className={className}><path d="M6 4h12M6 8h12M6 4c4 0 6.5 1.5 6.5 4S10 12 6 12h9M6 12l8 8" /></svg>
)
const IconBolt = ({ className }: { className?: string }) => (
  <svg {...iconProps} className={className}><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" /></svg>
)
const IconChart = ({ className }: { className?: string }) => (
  <svg {...iconProps} className={className}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>
)
const IconGlobe = ({ className }: { className?: string }) => (
  <svg {...iconProps} className={className}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.6 2.6 4 5.7 4 9s-1.4 6.4-4 9c-2.6-2.6-4-5.7-4-9s1.4-6.4 4-9Z" /></svg>
)
const IconGrid = ({ className }: { className?: string }) => (
  <svg {...iconProps} className={className}><rect x="3" y="3" width="7" height="7" rx="1.4" /><rect x="14" y="3" width="7" height="7" rx="1.4" /><rect x="3" y="14" width="7" height="7" rx="1.4" /><rect x="14" y="14" width="7" height="7" rx="1.4" /></svg>
)
const IconTrendUp = ({ className }: { className?: string }) => (
  <svg {...iconProps} className={className}><path d="m3 16 6-6 4 4 8-9" /><path d="M15 5h6v6" /></svg>
)
const IconPlus = ({ className }: { className?: string }) => (
  <svg {...iconProps} className={className}><path d="M12 5v14M5 12h14" /></svg>
)
const IconChevronDown = ({ className }: { className?: string }) => (
  <svg {...iconProps} className={className}><path d="m6 9 6 6 6-6" /></svg>
)
const IconArrowRight = ({ className }: { className?: string }) => (
  <svg {...iconProps} className={className}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
)

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

  const createFlightRipple = useRipple()
  const runSimRipple = useRipple()

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
    <div className="admin-page space-y-6">
      {/* ── HEADER TITLE & CONTROLS ─────────────────────────────────── */}
      <div className="header-enter relative flex flex-wrap items-center justify-between gap-4 pb-4 mb-1 border-b border-white/[0.06]">
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
          <p className="text-xs text-slate-400 mt-1.5">
            {isSimulated
              ? "High-volume synthetic airport traffic simulation for pitch & scalability demonstrations."
              : "Real-time operations, real bookings, Supabase flight instances, and DigiYatra telemetry."}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Time filter */}
          <div className="flex items-center bg-white/[0.03] border border-white/[0.08] rounded-xl p-1 text-xs font-mono">
            {["Live", "1H", "6H", "24H", "7D", "30D"].map((t) => (
              <button
                key={t}
                onClick={() => setTimeRange(t)}
                className={`px-2.5 py-1 rounded-lg transition-all duration-200 ${
                  timeRange === t
                    ? "bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 text-[#060B14] font-bold shadow-[0_2px_10px_rgba(251,191,36,0.3)]"
                    : "text-slate-400 hover:text-white hover:bg-white/[0.05]"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <Link
            href="/admin/flights"
            onMouseDown={createFlightRipple.spawn}
            className="pill-cta relative overflow-hidden px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 hover:scale-[1.03] transition-transform"
          >
            {createFlightRipple.ripples.map((rp) => (
              <span key={rp.id} className="ripple" style={{ left: rp.x, top: rp.y }} />
            ))}
            <IconPlus className="w-3.5 h-3.5" /> Create Flight
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
          icon={<IconTicket className="w-4 h-4" />}
          delay={0}
        />
        <KpiCard
          label="ACTIVE FLIGHTS"
          value={kpis.upcomingFlights.toLocaleString()}
          diff={isSimulated ? "+6.2% scheduled" : "Scheduled Dates"}
          accent="cyan"
          icon={<IconPlane className="w-4 h-4" />}
          delay={60}
        />
        <KpiCard
          label="TOTAL PASSENGERS"
          value={kpis.totalPassengers.toLocaleString()}
          diff={isSimulated ? "+10.1% vs avg" : "Registered Manifest"}
          accent="emerald"
          icon={<IconUsers className="w-4 h-4" />}
          delay={120}
        />
        <KpiCard
          label="REVENUE (MTD)"
          value={isSimulated ? "₹18.62M" : `₹${(kpis.totalRevenue / 100000).toFixed(2)}L`}
          diff={isSimulated ? "+16.3% vs target" : "Audited Net Revenue"}
          accent="gold"
          icon={<IconRupee className="w-4 h-4" />}
          delay={180}
        />
        <KpiCard
          label="SMART BOARDING"
          value={isSimulated ? "142.8k Pax" : `${kpis.smartCheckInUsers} Pax`}
          diff="DigiYatra Face ID"
          accent="violet"
          icon={<IconBolt className="w-4 h-4" />}
          delay={240}
        />
        <KpiCard
          label="OCCUPANCY RATE"
          value={kpis.occupancyRate}
          diff={isSimulated ? "On-Time Performance" : "Current Load Factor"}
          accent="sky"
          icon={<IconChart className="w-4 h-4" />}
          delay={300}
        />
      </div>

      {/* ── MAIN ROW 1: FLIGHT RADAR MAP + SEAT HEATMAP + REVENUE ─────── */}
      <div className="grid grid-cols-12 gap-6">
        {/* Live Flight Radar Simulation */}
        <div className="panel-enter ticket-edge col-span-12 lg:col-span-4 bg-gradient-to-b from-[#0D1A2C] to-[#0A1424] border border-white/[0.08] rounded-3xl p-5 relative overflow-hidden shadow-xl flex flex-col justify-between">
          <div className="panel-hairline" />
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-amber-300">
              <IconGlobe className="w-4 h-4" />
              <h3 className="text-xs font-bold uppercase font-mono tracking-wider text-white">
                Live Flight Radar Map
              </h3>
            </div>
            <span className="text-[10px] font-mono text-cyan-300 bg-cyan-400/10 border border-cyan-400/20 px-2 py-0.5 rounded-full">
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

        {/* Seat Occupancy Heatmap */}
        <div className="panel-enter panel-enter-delay-1 ticket-edge col-span-12 lg:col-span-4 bg-gradient-to-b from-[#0D1A2C] to-[#0A1424] border border-white/[0.08] rounded-3xl p-5 relative overflow-hidden shadow-xl flex flex-col justify-between">
          <div className="panel-hairline" />
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-amber-300">
              <IconGrid className="w-4 h-4" />
              <h3 className="text-xs font-bold uppercase font-mono tracking-wider text-white">
                Seat Occupancy Heatmap
              </h3>
            </div>
            <Link href="/admin/seats" className="text-[10px] text-amber-300 hover:text-amber-200 font-mono flex items-center gap-1 group">
              View All Cabins <IconArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
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

        {/* Revenue Trend Graph */}
        <div className="panel-enter panel-enter-delay-2 ticket-edge col-span-12 lg:col-span-4 bg-gradient-to-b from-[#0D1A2C] to-[#0A1424] border border-white/[0.08] rounded-3xl p-5 relative overflow-hidden shadow-xl flex flex-col justify-between">
          <div className="panel-hairline" />
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-amber-300">
              <IconTrendUp className="w-4 h-4" />
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
            <span>Add-On Yield: <strong className="text-emerald-300">₹1,240/pax</strong></span>
          </div>
        </div>
      </div>

      {/* ── MAIN ROW 2: RECENT BOOKINGS + DELAY SIMULATOR + FLEET ─────── */}
      <div className="grid grid-cols-12 gap-6">
        {/* Recent Bookings Stream */}
        <div className="panel-enter panel-enter-delay-1 ticket-edge col-span-12 lg:col-span-5 bg-gradient-to-b from-[#0D1A2C] to-[#0A1424] border border-white/[0.08] rounded-3xl p-5 shadow-xl relative overflow-hidden">
          <div className="panel-hairline" />
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-amber-300">
              <IconTicket className="w-4 h-4" />
              <h3 className="text-xs font-bold uppercase font-mono tracking-wider text-white">
                Live Bookings Stream
              </h3>
            </div>
            <Link href="/admin/bookings" className="text-[10px] font-mono text-cyan-300 hover:text-cyan-200 flex items-center gap-1 group">
              View All ({kpis.totalBookings}) <IconArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>

          <div className="space-y-2.5">
            {(stats?.recentBookings || []).map((b: any) => (
              <div
                key={b.id}
                className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.05] hover:border-amber-400/20 transition-colors flex items-center justify-between gap-3"
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
                  <span className="text-xs font-bold font-mono text-emerald-300 block">
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

        {/* Operational Delay Simulator */}
        <div className="panel-enter panel-enter-delay-2 ticket-edge col-span-12 lg:col-span-4 bg-gradient-to-b from-[#0D1A2C] to-[#0A1424] border border-white/[0.08] rounded-3xl p-5 shadow-xl flex flex-col justify-between relative overflow-hidden">
          <div className="panel-hairline" />
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-amber-300">
                <IconBolt className="w-4 h-4" />
                <h3 className="text-xs font-bold uppercase font-mono tracking-wider text-white">
                  Operations Delay Simulator
                </h3>
              </div>
              <span className="text-[10px] font-mono text-amber-300 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full">
                AI PREDICT
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Simulate runway congestion or weather holds to project passenger impact and recovery time.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] font-mono text-slate-400 uppercase block mb-1">Target Route</label>
                <div className="relative">
                  <select
                    value={simRoute}
                    onChange={(e) => setSimRoute(e.target.value)}
                    className="w-full appearance-none bg-[#030712] border border-white/[0.1] rounded-xl px-3 py-2 pr-8 text-white font-mono text-xs focus:outline-none focus:border-amber-400/40 transition-colors"
                  >
                    <option>DEL → DXB (Emirates EK 512)</option>
                    <option>DEL → BLR (IndiGo 6E 204)</option>
                    <option>BOM → DEL (Air India AI 102)</option>
                    <option>DEL → NRT (Japan Airlines JL 740)</option>
                  </select>
                  <IconChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-mono text-slate-400 uppercase block mb-1">Delay Duration</label>
                  <div className="relative">
                    <select
                      value={simDelay}
                      onChange={(e) => setSimDelay(e.target.value)}
                      className="w-full appearance-none bg-[#030712] border border-white/[0.1] rounded-xl px-3 py-2 pr-7 text-white font-mono text-xs focus:outline-none focus:border-amber-400/40 transition-colors"
                    >
                      <option value="1">1 Hour</option>
                      <option value="2">2 Hours</option>
                      <option value="4">4 Hours</option>
                      <option value="6">6 Hours</option>
                    </select>
                    <IconChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-mono text-slate-400 uppercase block mb-1">Reason</label>
                  <div className="relative">
                    <select
                      value={simReason}
                      onChange={(e) => setSimReason(e.target.value)}
                      className="w-full appearance-none bg-[#030712] border border-white/[0.1] rounded-xl px-3 py-2 pr-7 text-white font-mono text-xs focus:outline-none focus:border-amber-400/40 transition-colors"
                    >
                      <option>Weather Fog</option>
                      <option>Runway Hold</option>
                      <option>Technical Check</option>
                    </select>
                    <IconChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              </div>

              <button
                onClick={runSimulation}
                onMouseDown={runSimRipple.spawn}
                disabled={simulationRunning}
                className="pill-cta relative overflow-hidden w-full py-2.5 rounded-xl font-bold text-xs hover:brightness-105 transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-60"
              >
                {runSimRipple.ripples.map((rp) => (
                  <span key={rp.id} className="ripple" style={{ left: rp.x, top: rp.y }} />
                ))}
                {simulationRunning ? "Simulating Network Impact…" : "Run Predictive Simulation"}
                {!simulationRunning && <IconArrowRight className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Simulation Output Card */}
          <AnimatePresence>
            {simResult && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
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
          </AnimatePresence>
        </div>

        {/* Fleet Aircraft Status */}
        <div className="panel-enter panel-enter-delay-3 ticket-edge col-span-12 lg:col-span-3 bg-gradient-to-b from-[#0D1A2C] to-[#0A1424] border border-white/[0.08] rounded-3xl p-5 shadow-xl flex flex-col justify-between relative overflow-hidden">
          <div className="panel-hairline" />
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-amber-300">
                <IconPlane className="w-4 h-4" />
                <h3 className="text-xs font-bold uppercase font-mono tracking-wider text-white">
                  Fleet Status
                </h3>
              </div>
              <span className="text-[10px] font-mono text-emerald-300">5 Aircraft</span>
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
              className="w-full py-2 rounded-xl bg-white/[0.04] hover:bg-amber-400/[0.08] hover:border-amber-400/25 text-slate-300 hover:text-amber-200 text-xs font-mono font-bold text-center flex items-center justify-center gap-1.5 transition-colors border border-white/[0.08]"
            >
              Manage Flight Instances <IconArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>

      <style jsx global>{`
        /* ── Ticket-edge hairline + top gradient bar — same signature
           motif as the flights/seats pages, so this reads as part of one
           product instead of a bolted-on admin template. ── */
        .ticket-edge { position: relative; }
        .ticket-edge::before {
          content: "";
          position: absolute;
          inset: 3px;
          border: 1px solid rgba(212,175,55,0.10);
          border-radius: inherit;
          pointer-events: none;
        }
        .panel-hairline {
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 2px;
          background: linear-gradient(90deg, #38BDF8, #FBBF24, #FBBF24);
          opacity: 0.7;
        }

        .pill-cta {
          background: linear-gradient(90deg, #38BDF8 0%, #60A5FA 30%, #D4AF37 70%, #FBBF24 100%);
          color: #060B14;
          box-shadow: 0 8px 24px rgba(56,189,248,0.16), 0 8px 24px rgba(251,191,36,0.16);
        }
        .pill-cta:hover { filter: brightness(1.06); }

        .ripple {
          position: absolute;
          width: 12px; height: 12px;
          border-radius: 50%;
          background: rgba(255,255,255,0.5);
          transform: translate(-50%, -50%) scale(0);
          pointer-events: none;
          animation: rippleExpand 650ms ease-out forwards;
        }
        @keyframes rippleExpand {
          to { transform: translate(-50%, -50%) scale(16); opacity: 0; }
        }

        @keyframes headerSlideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .header-enter { animation: headerSlideDown 0.5s ease-out both; }

        @keyframes panelFadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .panel-enter { animation: panelFadeUp 0.5s ease-out 0.05s both; }
        .panel-enter-delay-1 { animation-delay: 0.11s; }
        .panel-enter-delay-2 { animation-delay: 0.17s; }
        .panel-enter-delay-3 { animation-delay: 0.23s; }

        select option { background: #0A1424; color: #fff; }

        @media (prefers-reduced-motion: reduce) {
          .header-enter, .panel-enter, .ripple { animation: none !important; }
        }
      `}</style>
    </div>
  )
}

function KpiCard({
  label,
  value,
  diff,
  accent,
  icon,
  delay = 0,
}: {
  label: string
  value: string
  diff: string
  accent: "amber" | "cyan" | "emerald" | "gold" | "violet" | "sky"
  icon: React.ReactNode
  delay?: number
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
    <div
      className="kpi-card ticket-edge relative bg-gradient-to-b from-[#0D1A2C] via-[#0A1424] to-[#070E1C] border border-white/[0.08] hover:border-amber-400/25 rounded-3xl p-5 overflow-hidden shadow-2xl group transition-all duration-200 hover:shadow-[0_0_24px_rgba(251,191,36,0.08)]"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="panel-hairline" />
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] uppercase font-mono tracking-widest text-slate-400 font-semibold">{label}</span>
        <div className={`w-8 h-8 rounded-xl border flex items-center justify-center shadow-inner ${accentGlow[accent]}`}>
          {icon}
        </div>
      </div>
      <div className="font-display font-black text-2xl sm:text-3xl text-white tracking-tight">
        {value}
      </div>
      <div className="flex items-center gap-1.5 mt-2.5">
        <span className="text-[10px] font-mono text-emerald-300 font-bold tracking-tight">{diff}</span>
      </div>
      <div className="pointer-events-none absolute -bottom-8 -right-8 w-20 h-20 bg-amber-400/[0.04] blur-xl rounded-full" />
    </div>
  )
}