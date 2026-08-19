"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"

export default function AdminFlightsPage() {
  const [flights, setFlights] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [airlineFilter, setAirlineFilter] = useState("ALL")
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editingFlight, setEditingFlight] = useState<any>(null)
  const [saving, setSaving] = useState(false)

  // Form State
  const [formData, setFormData] = useState({
    airline: "Navigo Airlines",
    origin: "DEL",
    destination: "BLR",
    departure_time: "06:00:00",
    arrival_time: "08:30:00",
    duration: "2h 30m",
    aircraft: "Airbus A320neo",
    base_price: 4500,
    stops: 0,
    stop_airport: "",
  })

  const loadFlights = () => {
    setLoading(true)
    fetch("/api/admin/flights")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.flights) setFlights(d.flights)
      })
      .catch((err) => console.error("Failed to load flights:", err))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadFlights()
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch("/api/admin/flights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })
      if (res.ok) {
        setCreateModalOpen(false)
        loadFlights()
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingFlight) return
    setSaving(true)
    try {
      const res = await fetch("/api/admin/flights", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingFlight),
      })
      if (res.ok) {
        setEditingFlight(null)
        loadFlights()
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to remove this flight?")) return
    try {
      const res = await fetch(`/api/admin/flights?id=${id}`, { method: "DELETE" })
      if (res.ok) loadFlights()
    } catch (err) {
      console.error(err)
    }
  }

  const filtered = flights.filter((f) => {
    const matchesAirline = airlineFilter === "ALL" || f.airline === airlineFilter
    const q = search.toLowerCase()
    const matchesSearch =
      !q ||
      f.airline?.toLowerCase().includes(q) ||
      f.origin?.toLowerCase().includes(q) ||
      f.destination?.toLowerCase().includes(q) ||
      f.aircraft?.toLowerCase().includes(q)
    return matchesAirline && matchesSearch
  })

  const airlines = Array.from(new Set(flights.map((f) => f.airline).filter(Boolean)))

  return (
    <div className="space-y-6">
      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-black text-white tracking-tight">
            Master Flight Directory
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Configure master airline schedules, aircraft types, routes, and baseline fare matrices.
          </p>
        </div>

        <button
          onClick={() => setCreateModalOpen(true)}
          className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs shadow-[0_2px_14px_rgba(251,191,36,0.3)] transition-colors flex items-center gap-2"
        >
          <span>+</span> Add New Route
        </button>
      </div>

      {/* ── CONTROLS & FILTERS ──────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#070D18] border border-white/[0.08] p-3 rounded-2xl">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <span className="text-slate-400 pl-2">🔍</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search airline, route (DEL → BLR), aircraft..."
            className="w-full bg-transparent text-xs text-white placeholder:text-slate-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-slate-400 text-[11px]">Airline:</span>
          <select
            value={airlineFilter}
            onChange={(e) => setAirlineFilter(e.target.value)}
            className="bg-[#030712] border border-white/[0.1] rounded-xl px-2.5 py-1.5 text-white text-xs focus:outline-none"
          >
            <option value="ALL">All Airlines ({flights.length})</option>
            {airlines.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── FLIGHTS TABLE ──────────────────────────────────────────── */}
      <div className="bg-[#070D18] border border-white/[0.08] rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[#0A1424] border-b border-white/[0.08] text-slate-400 text-[10px] uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4 font-bold">Airline & Aircraft</th>
                <th className="py-3.5 px-4 font-bold">Route</th>
                <th className="py-3.5 px-4 font-bold">Schedule & Duration</th>
                <th className="py-3.5 px-4 font-bold">Stops</th>
                <th className="py-3.5 px-4 font-bold">Base Price</th>
                <th className="py-3.5 px-4 font-bold">Rating / On-Time</th>
                <th className="py-3.5 px-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 font-mono">
                    Loading master flights registry…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 font-mono">
                    No matching flights found.
                  </td>
                </tr>
              ) : (
                filtered.map((f) => (
                  <tr key={f.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-4">
                      <strong className="text-white font-bold text-xs block">{f.airline}</strong>
                      <span className="text-[10px] text-cyan-300 font-mono">{f.aircraft || "Airbus A320neo"}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 font-bold text-white">
                        <span>{f.origin}</span>
                        <span className="text-amber-400">→</span>
                        <span>{f.destination}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">Direct Airway</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-white block font-bold">
                        {f.departure_time?.slice(0, 5)} - {f.arrival_time?.slice(0, 5)}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">{f.duration}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                          f.stops === 0
                            ? "bg-emerald-400/15 text-emerald-300 border border-emerald-400/30"
                            : "bg-amber-400/15 text-amber-300 border border-amber-400/30"
                        }`}
                      >
                        {f.stops === 0 ? "NON-STOP" : `${f.stops} STOP (${f.stop_airport || "LAYOVER"})`}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <strong className="text-emerald-400 font-bold text-xs">
                        ₹{Number(f.base_price).toLocaleString("en-IN")}
                      </strong>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-amber-300 font-bold">★ {f.rating || 4.8}</span>
                      <span className="text-[10px] text-slate-500 block font-mono">
                        {f.on_time_pct || 94}% On-Time
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/admin/flights/instances?flightId=${f.id}`}
                          className="px-3 py-1.5 rounded-xl bg-cyan-400/10 hover:bg-cyan-400/20 text-cyan-300 text-[11px] font-bold border border-cyan-400/30 transition-all flex items-center gap-1 shadow-sm"
                        >
                          Schedule ↗
                        </Link>
                        <button
                          onClick={() => setEditingFlight(f)}
                          className="px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.1] text-slate-200 hover:text-white text-[11px] font-bold border border-white/[0.08] transition-all"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(f.id)}
                          className="w-7 h-7 rounded-xl bg-rose-500/10 hover:bg-rose-500/25 text-rose-400 hover:text-rose-300 text-xs border border-rose-500/25 transition-all flex items-center justify-center"
                          title="Delete Route"
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── CREATE FLIGHT MODAL ────────────────────────────────────── */}
      <AnimatePresence>
        {createModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCreateModalOpen(false)}
              className="fixed inset-0 bg-[#020617]/85 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              className="relative w-full max-w-lg bg-[#0A1424] border border-white/[0.14] rounded-3xl p-6 shadow-2xl z-10 overflow-hidden"
            >
              <h3 className="font-display text-lg font-bold text-white mb-4">
                Register New Airline Route
              </h3>
              <form onSubmit={handleCreate} className="space-y-3.5 text-xs font-mono">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase block mb-1">Airline</label>
                    <select
                      value={formData.airline}
                      onChange={(e) => setFormData({ ...formData, airline: e.target.value })}
                      className="w-full bg-[#030712] border border-white/[0.1] rounded-xl px-3 py-2 text-white focus:outline-none"
                    >
                      <option>Navigo Airlines</option>
                      <option>Emirates</option>
                      <option>IndiGo</option>
                      <option>Air India</option>
                      <option>Japan Airlines</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase block mb-1">Aircraft</label>
                    <select
                      value={formData.aircraft}
                      onChange={(e) => setFormData({ ...formData, aircraft: e.target.value })}
                      className="w-full bg-[#030712] border border-white/[0.1] rounded-xl px-3 py-2 text-white focus:outline-none"
                    >
                      <option>Airbus A320neo</option>
                      <option>Airbus A321neo</option>
                      <option>Airbus A380-800</option>
                      <option>Boeing 777-300ER</option>
                      <option>Boeing 787-8 Dreamliner</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase block mb-1">Origin Code</label>
                    <input
                      type="text"
                      maxLength={3}
                      required
                      value={formData.origin}
                      onChange={(e) => setFormData({ ...formData, origin: e.target.value.toUpperCase() })}
                      className="w-full bg-[#030712] border border-white/[0.1] rounded-xl px-3 py-2 text-white uppercase focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase block mb-1">Destination Code</label>
                    <input
                      type="text"
                      maxLength={3}
                      required
                      value={formData.destination}
                      onChange={(e) => setFormData({ ...formData, destination: e.target.value.toUpperCase() })}
                      className="w-full bg-[#030712] border border-white/[0.1] rounded-xl px-3 py-2 text-white uppercase focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase block mb-1">Dep Time</label>
                    <input
                      type="text"
                      required
                      value={formData.departure_time}
                      onChange={(e) => setFormData({ ...formData, departure_time: e.target.value })}
                      placeholder="06:00:00"
                      className="w-full bg-[#030712] border border-white/[0.1] rounded-xl px-3 py-2 text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase block mb-1">Arr Time</label>
                    <input
                      type="text"
                      required
                      value={formData.arrival_time}
                      onChange={(e) => setFormData({ ...formData, arrival_time: e.target.value })}
                      placeholder="08:30:00"
                      className="w-full bg-[#030712] border border-white/[0.1] rounded-xl px-3 py-2 text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase block mb-1">Base Fare (₹)</label>
                    <input
                      type="number"
                      required
                      value={formData.base_price}
                      onChange={(e) => setFormData({ ...formData, base_price: Number(e.target.value) })}
                      className="w-full bg-[#030712] border border-white/[0.1] rounded-xl px-3 py-2 text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/[0.08]">
                  <button
                    type="button"
                    onClick={() => setCreateModalOpen(false)}
                    className="px-4 py-2 rounded-full border border-white/[0.1] text-slate-300 hover:bg-white/[0.05]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 rounded-full bg-amber-400 text-slate-950 font-bold shadow-[0_2px_12px_rgba(251,191,36,0.3)] hover:bg-amber-300 disabled:opacity-50"
                  >
                    {saving ? "Saving…" : "Save Route"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── EDIT FLIGHT DRAWER ─────────────────────────────────────── */}
      <AnimatePresence>
        {editingFlight && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingFlight(null)}
              className="fixed inset-0 bg-[#020617]/85 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              className="relative w-full max-w-lg bg-[#0A1424] border border-white/[0.14] rounded-3xl p-6 shadow-2xl z-10"
            >
              <h3 className="font-display text-lg font-bold text-white mb-4">
                Edit Route {editingFlight.origin} → {editingFlight.destination}
              </h3>
              <form onSubmit={handleUpdate} className="space-y-3.5 text-xs font-mono">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase block mb-1">Airline Name</label>
                  <input
                    type="text"
                    value={editingFlight.airline}
                    onChange={(e) => setEditingFlight({ ...editingFlight, airline: e.target.value })}
                    className="w-full bg-[#030712] border border-white/[0.1] rounded-xl px-3 py-2 text-white focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase block mb-1">Departure Time</label>
                    <input
                      type="text"
                      value={editingFlight.departure_time}
                      onChange={(e) => setEditingFlight({ ...editingFlight, departure_time: e.target.value })}
                      className="w-full bg-[#030712] border border-white/[0.1] rounded-xl px-3 py-2 text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase block mb-1">Arrival Time</label>
                    <input
                      type="text"
                      value={editingFlight.arrival_time}
                      onChange={(e) => setEditingFlight({ ...editingFlight, arrival_time: e.target.value })}
                      className="w-full bg-[#030712] border border-white/[0.1] rounded-xl px-3 py-2 text-white focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase block mb-1">Base Fare (₹)</label>
                  <input
                    type="number"
                    value={editingFlight.base_price}
                    onChange={(e) => setEditingFlight({ ...editingFlight, base_price: Number(e.target.value) })}
                    className="w-full bg-[#030712] border border-white/[0.1] rounded-xl px-3 py-2 text-white focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/[0.08]">
                  <button
                    type="button"
                    onClick={() => setEditingFlight(null)}
                    className="px-4 py-2 rounded-full border border-white/[0.1] text-slate-300 hover:bg-white/[0.05]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 rounded-full bg-amber-400 text-slate-950 font-bold shadow-[0_2px_12px_rgba(251,191,36,0.3)] hover:bg-amber-300 disabled:opacity-50"
                  >
                    {saving ? "Updating…" : "Save Changes"}
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
