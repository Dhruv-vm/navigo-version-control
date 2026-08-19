"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"

export default function AdminPassengersPage() {
  const [passengers, setPassengers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [selectedPax, setSelectedPax] = useState<any>(null)

  const loadPassengers = () => {
    setLoading(true)
    fetch("/api/admin/passengers")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.passengers) setPassengers(d.passengers)
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadPassengers()
  }, [])

  const filtered = passengers.filter((p) => {
    const q = search.toLowerCase()
    return (
      !q ||
      p.name?.toLowerCase().includes(q) ||
      p.pnr?.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q) ||
      p.mobile?.includes(q) ||
      p.frequentFlyer?.toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-6">
      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-black text-white tracking-tight">
              Passenger Directory & Travel History
            </h1>
            <span className="text-[10px] font-mono font-bold bg-emerald-400/15 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-400/30">
              TRAVELER PROFILES
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Search travelers by PNR, frequent flyer profile, contact details, and DigiYatra biometric enrollment status.
          </p>
        </div>

        <span className="text-xs font-mono text-slate-400">
          Showing <strong className="text-white">{filtered.length}</strong> passengers
        </span>
      </div>

      {/* ── SEARCH ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 bg-[#070D18] border border-white/[0.08] p-3 rounded-2xl max-w-md">
        <span className="text-slate-400 pl-2">🔍</span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search Passenger Name, PNR, Email, Mobile..."
          className="w-full bg-transparent text-xs text-white placeholder:text-slate-500 focus:outline-none font-mono"
        />
      </div>

      {/* ── PASSENGERS TABLE ───────────────────────────────────────── */}
      <div className="bg-[#070D18] border border-white/[0.08] rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[#0A1424] border-b border-white/[0.08] text-slate-400 text-[10px] uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4 font-bold">Passenger Name</th>
                <th className="py-3.5 px-4 font-bold">Active PNR</th>
                <th className="py-3.5 px-4 font-bold">Email & Contact</th>
                <th className="py-3.5 px-4 font-bold">Nationality</th>
                <th className="py-3.5 px-4 font-bold">Frequent Flyer</th>
                <th className="py-3.5 px-4 font-bold">Smart Check-In</th>
                <th className="py-3.5 px-4 font-bold text-right">Profile</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 font-mono">
                    Loading traveler directory…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 font-mono">
                    No matching travelers found.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-4">
                      <strong className="text-white font-bold text-xs block">{p.name}</strong>
                      <span className="text-[10px] text-slate-500 font-mono">{p.passengerType || "Adult"}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-amber-300 font-bold">{p.pnr}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-white block">{p.email}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{p.mobile}</span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-300">
                      {p.nationality || "India"}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-cyan-300 font-mono font-bold">
                        {p.frequentFlyer || "—"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-400/15 text-emerald-300 border border-emerald-400/30">
                        ⚡ DIGIYATRA ENROLLED
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => setSelectedPax(p)}
                        className="px-3 py-1 rounded-xl bg-cyan-400/10 hover:bg-cyan-400/20 text-cyan-300 text-[10px] font-bold border border-cyan-400/30 transition-colors"
                      >
                        Profile 👤
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── PASSENGER PROFILE DRAWER ───────────────────────────────── */}
      <AnimatePresence>
        {selectedPax && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedPax(null)}
              className="fixed inset-0 bg-[#020617]/85 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              className="relative w-full max-w-lg bg-[#0A1424] border border-white/[0.14] rounded-3xl p-6 shadow-2xl z-10 font-mono text-xs"
            >
              <div className="flex items-center justify-between pb-4 border-b border-white/[0.08] mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-400/20 to-cyan-400/20 border border-white/10 flex items-center justify-center text-xl">
                    👤
                  </div>
                  <div>
                    <h3 className="font-display text-base font-bold text-white">
                      {selectedPax.name}
                    </h3>
                    <span className="text-[10px] text-slate-400">
                      Passenger ID: {selectedPax.id?.slice(0, 10)}…
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedPax(null)}
                  className="w-8 h-8 rounded-full bg-white/[0.06] text-slate-400 hover:text-white flex items-center justify-center"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3">
                <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-1.5 text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Email:</span>
                    <span className="text-white">{selectedPax.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Mobile Phone:</span>
                    <span className="text-white">{selectedPax.mobile}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Date of Birth:</span>
                    <span className="text-white">{selectedPax.dob || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Frequent Flyer Code:</span>
                    <span className="text-cyan-300 font-bold">{selectedPax.frequentFlyer || "None"}</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-emerald-950/30 border border-emerald-500/25 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-300 font-bold">DigiYatra Biometric Profile</span>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-400/20 text-emerald-300">
                      ACTIVE ✓
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Template: Encrypted 128-D Normalized Vector (Zero raw imagery stored in database per security guidelines).
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-white/[0.08] flex justify-end mt-4">
                <button
                  type="button"
                  onClick={() => setSelectedPax(null)}
                  className="px-5 py-2 rounded-full bg-amber-400 text-slate-950 font-bold hover:bg-amber-300"
                >
                  Close Profile
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
