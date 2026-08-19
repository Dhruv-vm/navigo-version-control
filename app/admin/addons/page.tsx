"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"

export default function AdminAddonsPage() {
  const [addons, setAddons] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editingAddon, setEditingAddon] = useState<any>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const fetchAddons = () => {
    fetch("/api/addons")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.addons) setAddons(d.addons)
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchAddons()
  }, [])

  const toggleActive = async (id: string) => {
    try {
      const res = await fetch("/api/addons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "TOGGLE_ACTIVE", id }),
      })
      const data = await res.json()
      if (data.addons) setAddons(data.addons)
    } catch (err) {
      console.error(err)
    }
  }

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingAddon) return

    try {
      const res = await fetch("/api/addons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPDATE_PRICE",
          id: editingAddon.id,
          price: Number(editingAddon.price),
        }),
      })
      const data = await res.json()
      if (data.addons) setAddons(data.addons)
      setEditingAddon(null)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2500)
    } catch (err) {
      console.error(err)
    }
  }

  const totalAddonRev = addons.reduce((sum, a) => sum + (a.totalRevenue || 0), 0)

  return (
    <div className="space-y-6">
      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-black text-white tracking-tight">
              Ancillary Add-On Services Catalog
            </h1>
            <span className="text-[10px] font-mono font-bold bg-cyan-400/15 text-cyan-300 px-2 py-0.5 rounded-full border border-cyan-400/30">
              MERCHANDISING
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Manage baggage allowances, lounge vouchers, priority fast-track passes, and in-flight catering offerings.
          </p>
        </div>

        <span className="text-xs font-mono text-emerald-400 font-bold">
          Total Add-On Revenue: ₹{(totalAddonRev / 100000).toFixed(2)} Lakhs
        </span>
      </div>

      {/* ── ADDONS CATALOG GRID ────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {addons.map((a) => (
          <div
            key={a.id}
            className="p-6 rounded-3xl bg-gradient-to-b from-[#0B1528] to-[#060D18] border border-white/[0.08] hover:border-amber-400/30 shadow-xl flex flex-col justify-between font-mono text-xs transition-all group relative overflow-hidden"
          >
            <div className="pointer-events-none absolute -top-12 -right-12 w-28 h-28 bg-amber-400/5 blur-2xl rounded-full group-hover:bg-amber-400/15 transition-all" />

            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-11 h-11 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-xl text-amber-300 shadow-inner group-hover:scale-105 transition-transform">
                  {a.category === "Baggage" && "🧳"}
                  {a.category === "Catering" && "🍽️"}
                  {a.category === "Hospitality" && "🍸"}
                  {a.category === "Airport Services" && "⚡"}
                  {a.category === "Connectivity" && "📡"}
                  {a.category === "Protection" && "🛡️"}
                </div>

                <button
                  onClick={() => toggleActive(a.id)}
                  className={`text-[9px] font-bold px-2.5 py-1 rounded-full border transition-all ${
                    a.active
                      ? "bg-emerald-400/15 text-emerald-300 border-emerald-400/30 shadow-[0_0_10px_rgba(52,211,153,0.15)]"
                      : "bg-slate-500/15 text-slate-400 border-slate-500/30"
                  }`}
                >
                  {a.active ? "ACTIVE ON PORTAL ✓" : "DISABLED"}
                </button>
              </div>

              <strong className="text-sm font-bold text-white block mb-1 font-display tracking-tight group-hover:text-amber-300 transition-colors">
                {a.name}
              </strong>
              <span className="text-[10px] text-cyan-400 font-bold block mb-3 uppercase tracking-wider">{a.category}</span>

              <div className="space-y-2 pt-3 border-t border-white/[0.06] text-slate-300">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Unit Price:</span>
                  <strong className="text-emerald-400 font-bold text-sm">₹{a.price.toLocaleString("en-IN")}</strong>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Sales Volume:</span>
                  <span className="text-white font-bold">{a.salesCount} units</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Yield Turnover:</span>
                  <span className="text-amber-300 font-bold">₹{a.totalRevenue.toLocaleString("en-IN")}</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-white/[0.06] mt-4 flex items-center justify-end">
              <button
                onClick={() => setEditingAddon(a)}
                className="px-4 py-2 rounded-xl bg-white/[0.04] hover:bg-amber-400 hover:text-slate-950 text-slate-300 text-[11px] font-bold border border-white/[0.08] hover:border-amber-400 transition-all shadow-sm"
              >
                Modify Pricing ✏️
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ── EDIT PRICE MODAL ───────────────────────────────────────── */}
      <AnimatePresence>
        {editingAddon && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingAddon(null)}
              className="fixed inset-0 bg-[#020617]/85 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              className="relative w-full max-w-md bg-[#0A1424] border border-white/[0.14] rounded-3xl p-6 shadow-2xl z-10 font-mono text-xs"
            >
              <h3 className="font-display text-base font-bold text-white mb-4">
                Update Pricing: {editingAddon.name}
              </h3>
              <form onSubmit={handleSaveEdit} className="space-y-3.5">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase block mb-1">Unit Price (₹)</label>
                  <input
                    type="number"
                    required
                    value={editingAddon.price}
                    onChange={(e) =>
                      setEditingAddon({ ...editingAddon, price: Number(e.target.value) })
                    }
                    className="w-full bg-[#030712] border border-white/[0.1] rounded-xl px-3 py-2 text-white text-xs focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/[0.08]">
                  <button
                    type="button"
                    onClick={() => setEditingAddon(null)}
                    className="px-4 py-2 rounded-full border border-white/[0.1] text-slate-300 hover:bg-white/[0.05]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-full bg-amber-400 text-slate-950 font-bold hover:bg-amber-300"
                  >
                    Save Price
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
