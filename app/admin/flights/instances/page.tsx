"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"

export default function AdminFlightInstancesPage() {
  const [instances, setInstances] = useState<any[]>([])
  const [flights, setFlights] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [dateFilter, setDateFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [generateModalOpen, setGenerateModalOpen] = useState(false)
  const [generating, setGenerating] = useState(false)

  // Batch Generation Form
  const [genForm, setGenForm] = useState({
    flightId: "",
    startDate: "2026-08-25",
    endDate: "2026-08-31",
    seatsEconomy: 144,
    seatsPremium: 18,
    seatsBusiness: 12,
    seatsFirst: 6,
    gate: "G4",
  })

  const loadData = () => {
    setLoading(true)
    Promise.all([
      fetch("/api/admin/instances").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/admin/flights").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([iData, fData]) => {
        if (iData?.instances) setInstances(iData.instances)
        if (fData?.flights) {
          setFlights(fData.flights)
          if (fData.flights.length > 0 && !genForm.flightId) {
            setGenForm((prev) => ({ ...prev, flightId: fData.flights[0].id }))
          }
        }
      })
      .catch((err) => console.error("Failed to load instances:", err))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      const res = await fetch("/api/admin/instances", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus }),
      })
      if (res.ok) {
        setInstances((prev) =>
          prev.map((item) => (item.id === id ? { ...item, status: newStatus } : item))
        )
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    setGenerating(true)
    try {
      const res = await fetch("/api/admin/instances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(genForm),
      })
      if (res.ok) {
        setGenerateModalOpen(false)
        loadData()
      }
    } catch (err) {
      console.error(err)
    } finally {
      setGenerating(false)
    }
  }

  const [tabFilter, setTabFilter] = useState<"ALL" | "UPCOMING" | "TODAY" | "PAST">("UPCOMING")

  const filtered = instances.filter((inst) => {
    // Tab filter
    if (tabFilter === "UPCOMING" && !inst.isUpcoming && !inst.isToday) return false
    if (tabFilter === "TODAY" && !inst.isToday) return false
    if (tabFilter === "PAST" && !inst.isPast) return false

    const matchesStatus = statusFilter === "ALL" || inst.status === statusFilter
    const matchesDate = !dateFilter || inst.travelDate === dateFilter
    const q = search.toLowerCase()
    const matchesSearch =
      !q ||
      inst.flightNumber?.toLowerCase().includes(q) ||
      inst.airline?.toLowerCase().includes(q) ||
      inst.origin?.toLowerCase().includes(q) ||
      inst.destination?.toLowerCase().includes(q) ||
      inst.travelDate?.includes(q)
    return matchesStatus && matchesDate && matchesSearch
  })

  return (
    <div className="space-y-6">
      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-black text-white tracking-tight">
              Flight Instances & Operational Schedule
            </h1>
            <span className="text-[10px] font-mono font-bold bg-cyan-400/15 text-cyan-300 px-2 py-0.5 rounded-full border border-cyan-400/30">
              DATE-SPECIFIC SCHEDULE
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time flight operational statuses, upcoming vs departed date tracking, and gate inventory.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setGenerateModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:brightness-110 text-slate-950 font-bold text-xs shadow-[0_2px_14px_rgba(251,191,36,0.3)] transition-all flex items-center gap-2"
          >
            <span>⚡</span> Batch Generate Dates
          </button>
        </div>
      </div>

      {/* ── QUICK DATE TABS & DAY-WISE SELECTOR ──────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        {/* Main Tabs */}
        <div className="flex items-center bg-white/[0.04] border border-white/[0.08] rounded-2xl p-1 text-xs font-mono">
          {[
            { id: "UPCOMING", label: "Upcoming Flights", count: instances.filter((i) => i.isUpcoming || i.isToday).length },
            { id: "TODAY", label: "Today (Aug 19)", count: instances.filter((i) => i.isToday).length },
            { id: "PAST", label: "Departed / Past Dates", count: instances.filter((i) => i.isPast).length },
            { id: "ALL", label: "All Instances", count: instances.length },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTabFilter(t.id as any)}
              className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-2 ${
                tabFilter === t.id
                  ? "bg-amber-400 text-slate-950 font-bold shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <span>{t.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${tabFilter === t.id ? "bg-black/20 text-slate-950" : "bg-white/10 text-slate-300"}`}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {/* Day-wise quick date pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-[11px] font-mono">
          <button
            onClick={() => setDateFilter("")}
            className={`px-2.5 py-1 rounded-xl border transition-all ${
              dateFilter === ""
                ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-bold"
                : "bg-white/[0.02] text-slate-400 border-white/[0.06] hover:text-white"
            }`}
          >
            All Dates
          </button>
          {["2026-08-19", "2026-08-20", "2026-08-21", "2026-08-22", "2026-08-23", "2026-08-24", "2026-08-25", "2026-08-26"].map((d) => (
            <button
              key={d}
              onClick={() => setDateFilter(dateFilter === d ? "" : d)}
              className={`px-2.5 py-1 rounded-xl border transition-all whitespace-nowrap ${
                dateFilter === d
                  ? "bg-amber-400 text-slate-950 font-bold border-amber-400"
                  : "bg-white/[0.02] text-slate-400 border-white/[0.06] hover:text-white"
              }`}
            >
              {d === "2026-08-19" ? "Today (19 Aug)" : d.slice(5)}
            </button>
          ))}
        </div>
      </div>

      {/* ── FILTERS BAR ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#070D18] border border-white/[0.08] p-3 rounded-2xl">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <span className="text-slate-400 pl-2">🔍</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search flight number, route, airline..."
            className="w-full bg-transparent text-xs text-white placeholder:text-slate-500 focus:outline-none font-mono"
          />
        </div>

        <div className="flex items-center gap-3 text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 text-[11px]">Exact Date:</span>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="bg-[#030712] border border-white/[0.1] rounded-xl px-2.5 py-1 text-white text-xs focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 text-[11px]">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#030712] border border-white/[0.1] rounded-xl px-2.5 py-1 text-white text-xs focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="CHECK_IN_OPEN">Check-In Open</option>
              <option value="BOARDING">Boarding</option>
              <option value="DEPARTED">Departed (Past)</option>
              <option value="DELAYED">Delayed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── INSTANCES TABLE ────────────────────────────────────────── */}
      <div className="bg-[#070D18] border border-white/[0.08] rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[#0A1424] border-b border-white/[0.08] text-slate-400 text-[10px] uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4 font-bold">Flight & Route</th>
                <th className="py-3.5 px-4 font-bold">Travel Date</th>
                <th className="py-3.5 px-4 font-bold">Gate</th>
                <th className="py-3.5 px-4 font-bold">Cabin Capacities</th>
                <th className="py-3.5 px-4 font-bold">Occupancy</th>
                <th className="py-3.5 px-4 font-bold">Status</th>
                <th className="py-3.5 px-4 font-bold text-right">Seat Operations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 font-mono">
                    Loading flight instances inventory…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 font-mono">
                    No instances matching filter criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((inst) => (
                  <tr key={inst.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <strong className="text-white font-bold text-xs">{inst.flightNumber}</strong>
                        <span className="text-[10px] text-amber-300 font-mono">
                          {inst.origin} → {inst.destination}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 block font-mono mt-0.5">
                        {inst.airline} · {inst.aircraft}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-white">
                      {inst.travelDate}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded bg-white/[0.06] text-cyan-300 font-bold border border-white/[0.1]">
                        {inst.gate}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-[11px] text-slate-300">
                      <div>E: <strong className="text-white">{inst.seatsEconomy || 144}</strong> | PE: <strong className="text-emerald-300">{inst.seatsPremiumEconomy || 18}</strong></div>
                      <div className="text-[10px] text-slate-400">B: <strong className="text-cyan-300">{inst.seatsBusiness || 12}</strong> | F: <strong className="text-amber-300">{inst.seatsFirst || 6}</strong></div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 rounded-full bg-white/[0.08] overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-cyan-400 to-amber-400 rounded-full"
                            style={{ width: `${inst.occupancyPct}%` }}
                          />
                        </div>
                        <span className="font-bold text-white text-[11px]">{inst.occupancyPct}%</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                        {inst.availableSeats} / {inst.totalSeats} seats free
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <select
                        value={inst.status || "SCHEDULED"}
                        onChange={(e) => handleUpdateStatus(inst.id, e.target.value)}
                        className={`text-[10px] font-bold px-2 py-1 rounded-lg border bg-[#030712] focus:outline-none font-mono ${
                          inst.status === "BOARDING"
                            ? "border-emerald-400/50 text-emerald-300 bg-emerald-400/10"
                            : inst.status === "DELAYED"
                            ? "border-rose-400/50 text-rose-300 bg-rose-400/10"
                            : inst.status === "CHECK_IN_OPEN"
                            ? "border-cyan-400/50 text-cyan-300 bg-cyan-400/10"
                            : "border-white/[0.15] text-slate-300"
                        }`}
                      >
                        <option value="SCHEDULED">SCHEDULED</option>
                        <option value="CHECK_IN_OPEN">CHECK-IN OPEN</option>
                        <option value="BOARDING">BOARDING</option>
                        <option value="DEPARTED">DEPARTED</option>
                        <option value="LANDED">LANDED</option>
                        <option value="DELAYED">DELAYED</option>
                        <option value="CANCELLED">CANCELLED</option>
                      </select>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link
                        href={`/admin/seats?flightInstanceId=${inst.id}`}
                        className="px-3 py-1 rounded-xl bg-amber-400/10 hover:bg-amber-400/20 text-amber-300 text-[10px] font-bold border border-amber-400/30 transition-colors inline-block"
                      >
                        Seat Map & Block 💺
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── BATCH GENERATION MODAL ─────────────────────────────────── */}
      <AnimatePresence>
        {generateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setGenerateModalOpen(false)}
              className="fixed inset-0 bg-[#020617]/85 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              className="relative w-full max-w-lg bg-[#0A1424] border border-white/[0.14] rounded-3xl p-6 shadow-2xl z-10"
            >
              <h3 className="font-display text-lg font-bold text-white mb-2">
                Generate Flight Instances Batch
              </h3>
              <p className="text-xs text-slate-400 mb-4 font-mono">
                Populate date-specific flight inventory and cabin quotas across a scheduled calendar range.
              </p>

              <form onSubmit={handleGenerate} className="space-y-3.5 text-xs font-mono">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase block mb-1">Master Airline Route</label>
                  <select
                    value={genForm.flightId}
                    onChange={(e) => setGenForm({ ...genForm, flightId: e.target.value })}
                    className="w-full bg-[#030712] border border-white/[0.1] rounded-xl px-3 py-2 text-white focus:outline-none"
                  >
                    {flights.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.airline} ({f.origin} → {f.destination}) - Base: ₹{f.base_price}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase block mb-1">Start Date</label>
                    <input
                      type="date"
                      required
                      value={genForm.startDate}
                      onChange={(e) => setGenForm({ ...genForm, startDate: e.target.value })}
                      className="w-full bg-[#030712] border border-white/[0.1] rounded-xl px-3 py-2 text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase block mb-1">End Date</label>
                    <input
                      type="date"
                      required
                      value={genForm.endDate}
                      onChange={(e) => setGenForm({ ...genForm, endDate: e.target.value })}
                      className="w-full bg-[#030712] border border-white/[0.1] rounded-xl px-3 py-2 text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <label className="text-[9px] text-slate-400 uppercase block mb-1">Economy</label>
                    <input
                      type="number"
                      value={genForm.seatsEconomy}
                      onChange={(e) => setGenForm({ ...genForm, seatsEconomy: Number(e.target.value) })}
                      className="w-full bg-[#030712] border border-white/[0.1] rounded-xl px-2.5 py-1.5 text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-slate-400 uppercase block mb-1">Prem Econ</label>
                    <input
                      type="number"
                      value={genForm.seatsPremium}
                      onChange={(e) => setGenForm({ ...genForm, seatsPremium: Number(e.target.value) })}
                      className="w-full bg-[#030712] border border-white/[0.1] rounded-xl px-2.5 py-1.5 text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-slate-400 uppercase block mb-1">Business</label>
                    <input
                      type="number"
                      value={genForm.seatsBusiness}
                      onChange={(e) => setGenForm({ ...genForm, seatsBusiness: Number(e.target.value) })}
                      className="w-full bg-[#030712] border border-white/[0.1] rounded-xl px-2.5 py-1.5 text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-slate-400 uppercase block mb-1">First</label>
                    <input
                      type="number"
                      value={genForm.seatsFirst}
                      onChange={(e) => setGenForm({ ...genForm, seatsFirst: Number(e.target.value) })}
                      className="w-full bg-[#030712] border border-white/[0.1] rounded-xl px-2.5 py-1.5 text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/[0.08]">
                  <button
                    type="button"
                    onClick={() => setGenerateModalOpen(false)}
                    className="px-4 py-2 rounded-full border border-white/[0.1] text-slate-300 hover:bg-white/[0.05]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={generating}
                    className="px-5 py-2 rounded-full bg-amber-400 text-slate-950 font-bold shadow-[0_2px_12px_rgba(251,191,36,0.3)] hover:bg-amber-300 disabled:opacity-50"
                  >
                    {generating ? "Generating Dates…" : "Generate Schedule Batch"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
