"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"

export default function AdminSeatsPage() {
  const [instances, setInstances] = useState<any[]>([])
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>("")
  const [seatData, setSeatData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectedSeatModal, setSelectedSeatModal] = useState<any>(null)
  const [actionLoading, setActionLoading] = useState(false)

  // Load instances
  useEffect(() => {
    fetch("/api/admin/instances")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.instances && d.instances.length > 0) {
          setInstances(d.instances)
          setSelectedInstanceId(d.instances[0].id)
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [])

  // Load seat map for instance
  const loadSeatMap = (instanceId: string) => {
    if (!instanceId) return
    fetch(`/api/admin/seats?flightInstanceId=${instanceId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setSeatData(d)
      })
      .catch((err) => console.error(err))
  }

  useEffect(() => {
    if (selectedInstanceId) loadSeatMap(selectedInstanceId)
  }, [selectedInstanceId])

  const toggleSeatBlock = async (seatNumber: string, isBlocked: boolean) => {
    setActionLoading(true)
    try {
      const res = await fetch("/api/admin/seats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flightInstanceId: selectedInstanceId,
          seatNumber,
          action: isBlocked ? "UNBLOCK" : "BLOCK",
        }),
      })
      if (res.ok) {
        loadSeatMap(selectedInstanceId)
        setSelectedSeatModal(null)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setActionLoading(false)
    }
  }

  const bookedSet = new Set(seatData?.bookedSeats || [])
  const blockedSet = new Set(seatData?.blockedSeats || [])
  const bookedDetailsMap = new Map((seatData?.bookedDetails || []).map((b: any) => [b.seatNumber, b]))

  // Only show upcoming flight instances OR instances with active bookings
  const bookedOrUpcomingInstances = instances.filter(
    (i) => i.bookedSeats > 0 || i.isUpcoming || i.isToday
  )

  const activeInstance = instances.find((i) => i.id === selectedInstanceId) || bookedOrUpcomingInstances[0]

  // Real cabin seat counts
  const totalFirst = Number(activeInstance?.seatsFirst) || 8
  const totalBiz = Number(activeInstance?.seatsBusiness) || 16
  const totalPrem = Number(activeInstance?.seatsPremiumEconomy) || 24
  const totalEcon = Number(activeInstance?.seatsEconomy) || 144

  const bookedList = seatData?.bookedDetails || []
  const bookedFirst = bookedList.filter((b: any) => b.cabinClass === "first").length
  const bookedBiz = bookedList.filter((b: any) => b.cabinClass === "business").length
  const bookedPrem = bookedList.filter((b: any) => b.cabinClass === "premium_economy").length
  const bookedEcon = Math.max(0, (seatData?.bookedSeats?.length || 0) - (bookedFirst + bookedBiz + bookedPrem))

  // Generate realistic A320/B777 rows 1 to 24
  const rows = Array.from({ length: 24 }, (_, i) => i + 1)
  const cols = ["A", "B", "C", "D", "E", "F"]

  return (
    <div className="space-y-6">
      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-black text-white tracking-tight">
              Seat Inventory & Cabin Layouts
            </h1>
            <span className="text-[10px] font-mono font-bold bg-amber-400/15 text-amber-300 px-2 py-0.5 rounded-full border border-amber-400/30">
              REAL CABIN INVENTORY
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time visual seat map showing {bookedOrUpcomingInstances.length} active scheduled routes with real passenger seat reservations.
          </p>
        </div>

        {/* Flight Instance Selector */}
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-slate-400 font-bold">Active Flight:</span>
          <select
            value={selectedInstanceId}
            onChange={(e) => setSelectedInstanceId(e.target.value)}
            className="bg-[#0A1424] border border-amber-400/30 rounded-xl px-3 py-2 text-white font-bold text-xs focus:outline-none max-w-sm shadow-md truncate"
          >
            {bookedOrUpcomingInstances.map((i) => (
              <option key={i.id} value={i.id}>
                {i.flightNumber} ({i.origin} → {i.destination}) · {i.travelDate} {i.bookedSeats > 0 ? `[${i.bookedSeats} Pax]` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── OCCUPANCY STRIP ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-[#070D18] border border-white/[0.08]">
          <span className="text-[10px] font-mono text-amber-300 block uppercase font-bold">First Class Suites</span>
          <div className="font-display font-black text-xl text-white mt-1">
            {bookedFirst} / {totalFirst} Seats
          </div>
          <span className="text-[10px] font-mono text-amber-400 font-bold">
            {totalFirst > 0 ? Math.round((bookedFirst / totalFirst) * 100) : 0}% Occupied
          </span>
        </div>
        <div className="p-4 rounded-2xl bg-[#070D18] border border-white/[0.08]">
          <span className="text-[10px] font-mono text-cyan-300 block uppercase font-bold">Business Class</span>
          <div className="font-display font-black text-xl text-white mt-1">
            {bookedBiz} / {totalBiz} Seats
          </div>
          <span className="text-[10px] font-mono text-cyan-400 font-bold">
            {totalBiz > 0 ? Math.round((bookedBiz / totalBiz) * 100) : 0}% Occupied
          </span>
        </div>
        <div className="p-4 rounded-2xl bg-[#070D18] border border-white/[0.08]">
          <span className="text-[10px] font-mono text-emerald-300 block uppercase font-bold">Premium Economy</span>
          <div className="font-display font-black text-xl text-white mt-1">
            {bookedPrem} / {totalPrem} Seats
          </div>
          <span className="text-[10px] font-mono text-emerald-400 font-bold">
            {totalPrem > 0 ? Math.round((bookedPrem / totalPrem) * 100) : 0}% Occupied
          </span>
        </div>
        <div className="p-4 rounded-2xl bg-[#070D18] border border-white/[0.08]">
          <span className="text-[10px] font-mono text-slate-300 block uppercase font-bold">Economy Standard</span>
          <div className="font-display font-black text-xl text-white mt-1">
            {bookedEcon} / {totalEcon} Seats
          </div>
          <span className="text-[10px] font-mono text-slate-300 font-bold">
            {totalEcon > 0 ? Math.round((bookedEcon / totalEcon) * 100) : 0}% Occupied
          </span>
        </div>
      </div>

      {/* ── VISUAL SEAT MAP CONSOLE ─────────────────────────────────── */}
      <div className="bg-[#070D18] border border-white/[0.08] rounded-3xl p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/[0.08] mb-6">
          <div>
            <h3 className="font-display text-sm font-bold text-white uppercase font-mono">
              Aircraft Fuselage: {activeInstance?.aircraft || "Airbus A320neo"}
            </h3>
            <p className="text-[11px] text-slate-400 font-mono">
              Flight: {activeInstance?.flightNumber} · Route: {activeInstance?.origin} → {activeInstance?.destination} · Date: {activeInstance?.travelDate}
            </p>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded bg-cyan-400/20 border border-cyan-400/40" /> Available
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded bg-amber-400/30 border border-amber-400/50 text-amber-300" /> Booked
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded bg-rose-500/30 border border-rose-500/50 text-rose-300" /> Blocked
            </span>
          </div>
        </div>

        {/* Fuselage Container */}
        <div className="max-w-2xl mx-auto bg-[#040812] border-2 border-white/[0.1] rounded-[40px] p-6 shadow-2xl relative overflow-hidden">
          {/* Cockpit Curve */}
          <div className="w-28 h-8 mx-auto bg-white/[0.04] border-t border-x border-white/[0.1] rounded-t-full mb-6 flex items-center justify-center text-[9px] font-mono text-slate-500 uppercase tracking-widest">
            Cockpit ✈️
          </div>

          {/* Seat Grid Rows */}
          <div className="space-y-2 font-mono">
            {rows.map((rowNum) => {
              const isFirst = rowNum <= 2
              const isBiz = rowNum >= 3 && rowNum <= 6
              const isPrem = rowNum >= 7 && rowNum <= 9

              return (
                <div key={rowNum} className="flex items-center justify-center gap-2 text-xs">
                  {/* Left Row Number */}
                  <span className="w-6 text-[10px] text-slate-500 text-right font-bold">{rowNum}</span>

                  {/* Left Triplet: A, B, C */}
                  <div className="flex items-center gap-1.5">
                    {["A", "B", "C"].map((col) => {
                      const seatNum = `${rowNum}${col}`
                      const isBooked = bookedSet.has(seatNum)
                      const isBlocked = blockedSet.has(seatNum)

                      let bg = "bg-cyan-400/10 border-cyan-400/30 text-cyan-300 hover:bg-cyan-400/25"
                      if (isBooked) bg = "bg-amber-400/20 border-amber-400/40 text-amber-300 hover:bg-amber-400/35"
                      if (isBlocked) bg = "bg-rose-500/20 border-rose-500/40 text-rose-300 hover:bg-rose-500/35"

                      return (
                        <button
                          key={seatNum}
                          onClick={() =>
                            setSelectedSeatModal({
                              seatNum,
                              rowNum,
                              col,
                              isBooked,
                              isBlocked,
                              cabinClass: isFirst ? "First" : isBiz ? "Business" : isPrem ? "Prem Econ" : "Economy",
                              booking: bookedDetailsMap.get(seatNum),
                            })
                          }
                          className={`w-9 h-8 rounded-lg border text-[10px] font-bold transition-all flex items-center justify-center relative ${bg}`}
                        >
                          {isBlocked ? "🔒" : seatNum}
                        </button>
                      )
                    })}
                  </div>

                  {/* Aisle */}
                  <div className="w-8 text-center text-[9px] text-slate-600 font-bold">||</div>

                  {/* Right Triplet: D, E, F */}
                  <div className="flex items-center gap-1.5">
                    {["D", "E", "F"].map((col) => {
                      const seatNum = `${rowNum}${col}`
                      const isBooked = bookedSet.has(seatNum)
                      const isBlocked = blockedSet.has(seatNum)

                      let bg = "bg-cyan-400/10 border-cyan-400/30 text-cyan-300 hover:bg-cyan-400/25"
                      if (isBooked) bg = "bg-amber-400/20 border-amber-400/40 text-amber-300 hover:bg-amber-400/35"
                      if (isBlocked) bg = "bg-rose-500/20 border-rose-500/40 text-rose-300 hover:bg-rose-500/35"

                      return (
                        <button
                          key={seatNum}
                          onClick={() =>
                            setSelectedSeatModal({
                              seatNum,
                              rowNum,
                              col,
                              isBooked,
                              isBlocked,
                              cabinClass: isFirst ? "First" : isBiz ? "Business" : isPrem ? "Prem Econ" : "Economy",
                              booking: bookedDetailsMap.get(seatNum),
                            })
                          }
                          className={`w-9 h-8 rounded-lg border text-[10px] font-bold transition-all flex items-center justify-center relative ${bg}`}
                        >
                          {isBlocked ? "🔒" : seatNum}
                        </button>
                      )
                    })}
                  </div>

                  {/* Right Row Number */}
                  <span className="w-6 text-[10px] text-slate-500 text-left font-bold">{rowNum}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── SEAT DETAILS & BLOCKING MODAL ──────────────────────────── */}
      <AnimatePresence>
        {selectedSeatModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedSeatModal(null)}
              className="fixed inset-0 bg-[#020617]/85 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              className="relative w-full max-w-md bg-[#0A1424] border border-white/[0.14] rounded-3xl p-6 shadow-2xl z-10"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.08] mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-xl">💺</span>
                  <div>
                    <h3 className="font-display text-base font-bold text-white">
                      Seat {selectedSeatModal.seatNum} Details
                    </h3>
                    <span className="text-[10px] font-mono text-cyan-300">
                      {selectedSeatModal.cabinClass} Cabin
                    </span>
                  </div>
                </div>
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                    selectedSeatModal.isBlocked
                      ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                      : selectedSeatModal.isBooked
                      ? "bg-amber-400/20 text-amber-300 border border-amber-400/30"
                      : "bg-emerald-400/20 text-emerald-300 border border-emerald-400/30"
                  }`}
                >
                  {selectedSeatModal.isBlocked ? "BLOCKED 🔒" : selectedSeatModal.isBooked ? "BOOKED ✓" : "AVAILABLE"}
                </span>
              </div>

              <div className="space-y-2.5 text-xs font-mono">
                {selectedSeatModal.booking ? (
                  <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-1">
                    <div className="text-slate-400">
                      Passenger: <strong className="text-white">{selectedSeatModal.booking.passengerName}</strong>
                    </div>
                    <div className="text-slate-400">
                      Booking Ref: <strong className="text-amber-300">{selectedSeatModal.booking.bookingId?.slice(0, 8)}…</strong>
                    </div>
                    <div className="text-slate-400">
                      Seat Price: <strong className="text-emerald-400">₹{selectedSeatModal.booking.price || 0}</strong>
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-400">This seat is currently unassigned and open for customer selection.</p>
                )}

                <div className="pt-4 border-t border-white/[0.08] flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setSelectedSeatModal(null)}
                    className="px-4 py-2 rounded-full border border-white/[0.1] text-slate-300 hover:bg-white/[0.05]"
                  >
                    Close
                  </button>

                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => toggleSeatBlock(selectedSeatModal.seatNum, selectedSeatModal.isBlocked)}
                    className={`px-5 py-2 rounded-full font-bold text-xs shadow-lg transition-all ${
                      selectedSeatModal.isBlocked
                        ? "bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                        : "bg-rose-600 text-white hover:bg-rose-500"
                    }`}
                  >
                    {actionLoading
                      ? "Updating…"
                      : selectedSeatModal.isBlocked
                      ? "Unblock Seat For Sale"
                      : "Block Seat (Operations Lock)"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
