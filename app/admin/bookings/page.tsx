"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [selectedBooking, setSelectedBooking] = useState<any>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const loadBookings = () => {
    setLoading(true)
    fetch("/api/admin/bookings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.bookings) setBookings(d.bookings)
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadBookings()
  }, [])

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    setActionLoading(true)
    try {
      const res = await fetch("/api/admin/bookings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus }),
      })
      if (res.ok) {
        setBookings((prev) =>
          prev.map((b) => (b.id === id ? { ...b, status: newStatus } : b))
        )
        if (selectedBooking?.id === id) {
          setSelectedBooking((prev: any) => ({ ...prev, status: newStatus }))
        }
      }
    } catch (err) {
      console.error(err)
    } finally {
      setActionLoading(false)
    }
  }

  const filtered = bookings.filter((b) => {
    const matchesStatus = statusFilter === "ALL" || b.status === statusFilter
    const q = search.toLowerCase()
    const matchesSearch =
      !q ||
      b.pnr?.toLowerCase().includes(q) ||
      b.passengerName?.toLowerCase().includes(q) ||
      b.email?.toLowerCase().includes(q) ||
      b.flightNumber?.toLowerCase().includes(q) ||
      b.route?.toLowerCase().includes(q)
    return matchesStatus && matchesSearch
  })

  return (
    <div className="space-y-6">
      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-black text-white tracking-tight">
              Bookings & Reservations
            </h1>
            <span className="text-[10px] font-mono font-bold bg-amber-400/15 text-amber-300 px-2 py-0.5 rounded-full border border-amber-400/30">
              RESERVATIONS DESK
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Search customer reservations, audit payment settlements, inspect passenger manifests, and manage booking lifecycles.
          </p>
        </div>

        <span className="text-xs font-mono text-slate-400">
          Showing <strong className="text-white">{filtered.length}</strong> of {bookings.length} reservations
        </span>
      </div>

      {/* ── SEARCH & FILTERS ────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#070D18] border border-white/[0.08] p-3 rounded-2xl">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <span className="text-slate-400 pl-2">🔍</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search PNR (e.g. MB5BRS), Passenger Name, Email, Flight..."
            className="w-full bg-transparent text-xs text-white placeholder:text-slate-500 focus:outline-none font-mono"
          />
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-slate-400 text-[11px]">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#030712] border border-white/[0.1] rounded-xl px-2.5 py-1.5 text-white text-xs focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="confirmed">Confirmed</option>
            <option value="pending">Pending</option>
            <option value="cancelled">Cancelled</option>
            <option value="completed">Completed</option>
            <option value="refunded">Refunded</option>
          </select>
        </div>
      </div>

      {/* ── BOOKINGS TABLE ─────────────────────────────────────────── */}
      <div className="bg-[#070D18] border border-white/[0.08] rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[#0A1424] border-b border-white/[0.08] text-slate-400 text-[10px] uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4 font-bold">PNR & Booking Date</th>
                <th className="py-3.5 px-4 font-bold">Primary Passenger</th>
                <th className="py-3.5 px-4 font-bold">Flight & Route</th>
                <th className="py-3.5 px-4 font-bold">Travel Date</th>
                <th className="py-3.5 px-4 font-bold">Seat & Cabin</th>
                <th className="py-3.5 px-4 font-bold">Amount & Method</th>
                <th className="py-3.5 px-4 font-bold">Status</th>
                <th className="py-3.5 px-4 font-bold text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 font-mono">
                    Loading customer reservations…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 font-mono">
                    No reservations matching filter criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((b) => (
                  <tr key={b.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-4">
                      <strong className="text-amber-300 font-bold text-xs block">{b.pnr}</strong>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {b.createdAt ? new Date(b.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <strong className="text-white font-bold text-xs block">{b.passengerName}</strong>
                      <span className="text-[10px] text-slate-400 font-mono truncate max-w-[140px] block">
                        {b.email}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-white font-bold block">{b.flightNumber}</span>
                      <span className="text-[10px] text-cyan-300 font-mono">{b.route}</span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-white">
                      {b.travelDate}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded bg-white/[0.06] text-amber-300 font-bold border border-white/[0.1]">
                        {b.seat || "Assigned"}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                        {b.cabinClass}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <strong className="text-emerald-400 font-bold text-xs block">
                        ₹{Number(b.paidAmount).toLocaleString("en-IN")}
                      </strong>
                      <span className="text-[10px] text-slate-400 font-mono uppercase">
                        {b.paymentMethod}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          b.status === "confirmed"
                            ? "bg-emerald-400/15 text-emerald-300 border border-emerald-400/30"
                            : b.status === "cancelled"
                            ? "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                            : b.status === "refunded"
                            ? "bg-violet-500/15 text-violet-300 border border-violet-500/30"
                            : "bg-amber-400/15 text-amber-300 border border-amber-400/30"
                        }`}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => setSelectedBooking(b)}
                        className="px-3 py-1 rounded-xl bg-cyan-400/10 hover:bg-cyan-400/20 text-cyan-300 text-[10px] font-bold border border-cyan-400/30 transition-colors"
                      >
                        Details 📋
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── BOOKING INSPECTION DRAWER / MODAL ───────────────────────── */}
      <AnimatePresence>
        {selectedBooking && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedBooking(null)}
              className="fixed inset-0 bg-[#020617]/85 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              className="relative w-full max-w-2xl bg-[#0A1424] border border-white/[0.14] rounded-3xl p-6 shadow-2xl z-10 max-h-[90vh] overflow-y-auto"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-white/[0.08] mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-lg font-bold text-white">
                      Reservation PNR: {selectedBooking.pnr}
                    </h3>
                    <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-400/15 text-emerald-300 border border-emerald-400/30">
                      {selectedBooking.status}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    Booking ID: {selectedBooking.id}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedBooking(null)}
                  className="w-8 h-8 rounded-full bg-white/[0.06] text-slate-400 hover:text-white flex items-center justify-center"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4 text-xs font-mono">
                {/* Flight & Leg */}
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                  <h4 className="text-[10px] uppercase font-bold text-amber-300 mb-2">Flight Details</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-slate-300">
                    <div>
                      <span className="text-slate-500 text-[10px] block">Flight</span>
                      <strong className="text-white">{selectedBooking.flightNumber}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">Route</span>
                      <strong className="text-cyan-300">{selectedBooking.route}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">Travel Date</span>
                      <strong className="text-white">{selectedBooking.travelDate}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">Seat Number</span>
                      <strong className="text-amber-300">{selectedBooking.seat} ({selectedBooking.cabinClass})</strong>
                    </div>
                  </div>
                </div>

                {/* Passenger Roster */}
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                  <h4 className="text-[10px] uppercase font-bold text-cyan-300 mb-2">
                    Passenger Roster ({selectedBooking.passengers?.length || 1})
                  </h4>
                  <div className="space-y-2">
                    {(selectedBooking.passengers || []).map((pax: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                        <div>
                          <strong className="text-white block">{pax.name}</strong>
                          <span className="text-[10px] text-slate-400">
                            {pax.type} · Frequent Flyer: {pax.frequentFlyer || "None"}
                          </span>
                        </div>
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-cyan-400/10 text-cyan-300 border border-cyan-400/20">
                          DigiYatra Active
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                  <h4 className="text-[10px] uppercase font-bold text-emerald-400 mb-2">Financial Breakdown</h4>
                  <div className="space-y-1.5 text-slate-300">
                    <div className="flex justify-between">
                      <span>Base Fare:</span>
                      <span className="text-white">₹{selectedBooking.baseFare}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Taxes & Airport Security Fees:</span>
                      <span className="text-white">₹{selectedBooking.taxesAndFees}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Seat Selection & Add-Ons:</span>
                      <span className="text-white">₹{selectedBooking.seatPrice}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-white/[0.08] font-bold text-sm">
                      <span className="text-white">Total Amount Paid:</span>
                      <span className="text-emerald-400">₹{selectedBooking.paidAmount.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 pt-1">
                      Settled via {selectedBooking.paymentMethod} on {selectedBooking.paidAt ? new Date(selectedBooking.paidAt).toLocaleString("en-IN") : "—"}
                    </div>
                  </div>
                </div>

                {/* Status Modification Actions */}
                <div className="pt-4 border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
                  <span className="text-[10px] text-slate-400">Operational Actions:</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleUpdateStatus(selectedBooking.id, "confirmed")}
                      className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold"
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleUpdateStatus(selectedBooking.id, "cancelled")}
                      className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-bold"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleUpdateStatus(selectedBooking.id, "refunded")}
                      className="px-3 py-1.5 rounded-xl bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 border border-violet-500/30 text-xs font-bold"
                    >
                      Process Refund
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
