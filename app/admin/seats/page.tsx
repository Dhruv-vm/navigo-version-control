"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"

// ── Thin-stroke icons — replaces the emoji glyphs (✈️ 🔒 💺 ✓) so this
// console reads as the same product as the rest of the admin panel. ───────
const iconProps = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const }

const IconLock = ({ className }: { className?: string }) => (
  <svg {...iconProps} className={className}><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
)
const IconSeat = ({ className }: { className?: string }) => (
  <svg {...iconProps} className={className}><path d="M6 13V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v7" /><path d="M6 13h9a2 2 0 0 1 2 2v3a1 1 0 0 1-1 1H8a2 2 0 0 1-2-2v-4Z" /><path d="M17 15l2.5 1a1 1 0 0 1 .5 1.5l-.5 1" /></svg>
)
const IconCheck = ({ className }: { className?: string }) => (
  <svg {...iconProps} className={className}><path d="m5 12.5 4.5 4.5L19 7" /></svg>
)
const IconNose = ({ className }: { className?: string }) => (
  <svg {...iconProps} className={className}><path d="M12 3c3 3 4.5 6.5 4.5 10.5 0 2.5-1.5 4-4.5 6-3-2-4.5-3.5-4.5-6C7.5 9.5 9 6 12 3Z" /><circle cx="12" cy="9.5" r="1.4" fill="currentColor" stroke="none" /></svg>
)

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

  // Cabin bands — derived from the same row math the page already used
  // (isFirst / isBiz / isPrem) to visually separate the fuselage by class
  // instead of rendering one undifferentiated 24-row grid.
  const cabinBands = [
    { fromRow: 1, label: "First Class Suite", accent: "amber", hex: "#FBBF24" },
    { fromRow: 3, label: "Business Class", accent: "cyan", hex: "#22D3EE" },
    { fromRow: 7, label: "Premium Economy", accent: "emerald", hex: "#34D399" },
    { fromRow: 10, label: "Economy Standard", accent: "slate", hex: "#94A3B8" },
  ]

  return (
    <div className="seats-page relative space-y-6">
      {/* Ambient glow — same amber/cyan wash as the flights page */}
      <div className="pointer-events-none fixed top-[10%] left-[-5%] w-[420px] h-[420px] bg-amber-500/[0.05] blur-[130px] rounded-full -z-10" />
      <div className="pointer-events-none fixed bottom-[5%] right-[-5%] w-[420px] h-[420px] bg-cyan-400/[0.05] blur-[130px] rounded-full -z-10" />

      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <div className="header-enter flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/[0.06]">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="font-display text-2xl font-black text-white tracking-tight">
              Seat Inventory & Cabin Layouts
            </h1>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold bg-amber-400/15 text-amber-300 px-2 py-0.5 rounded-full border border-amber-400/30 whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" /> REAL CABIN INVENTORY
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1.5">
            Real-time visual seat map showing {bookedOrUpcomingInstances.length} active scheduled routes with real passenger seat reservations.
          </p>
        </div>

        {/* Flight Instance Selector */}
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-slate-400 font-bold whitespace-nowrap">Active Flight:</span>
          <select
            value={selectedInstanceId}
            onChange={(e) => setSelectedInstanceId(e.target.value)}
            className="bg-[#0A1424] border border-amber-400/30 rounded-xl px-3 py-2 text-white font-bold text-xs focus:outline-none focus:ring-1 focus:ring-amber-400/30 max-w-sm shadow-md truncate"
          >
            {bookedOrUpcomingInstances.map((i) => (
              <option key={i.id} value={i.id}>
                {i.flightNumber} ({i.origin} → {i.destination}) · {i.travelDate} {i.bookedSeats > 0 ? `[${i.bookedSeats} Pax]` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── OCCUPANCY STRIP — radial gauges instead of flat numbers ──── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <GaugeCard delay={0} label="First Class Suites" booked={bookedFirst} total={totalFirst} accent="amber" hex="#FBBF24" />
        <GaugeCard delay={60} label="Business Class" booked={bookedBiz} total={totalBiz} accent="cyan" hex="#22D3EE" />
        <GaugeCard delay={120} label="Premium Economy" booked={bookedPrem} total={totalPrem} accent="emerald" hex="#34D399" />
        <GaugeCard delay={180} label="Economy Standard" booked={bookedEcon} total={totalEcon} accent="slate" hex="#94A3B8" />
      </div>

      {/* ── VISUAL SEAT MAP CONSOLE ─────────────────────────────────── */}
      <div className="panel-enter ticket-edge relative bg-gradient-to-b from-[#0D1A2C] to-[#0A1424] border border-white/[0.08] rounded-3xl p-6 shadow-xl overflow-hidden">
        <div className="panel-hairline" />
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
              <span className="w-3.5 h-3.5 rounded bg-cyan-400/20 border border-cyan-400/40 legend-pulse" /> Available
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded bg-amber-400/30 border border-amber-400/50" /> Booked
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded bg-rose-500/30 border border-rose-500/50 flex items-center justify-center text-rose-300">
                <IconLock className="w-2 h-2" />
              </span>
              Blocked
            </span>
          </div>
        </div>

        {/* Fuselage Container */}
        <div className="fuselage-shell max-w-2xl mx-auto bg-[#040812] border-2 border-white/[0.1] rounded-[40px] p-6 shadow-2xl relative overflow-hidden">
          {/* Scan sweep — reinforces the "live console" feel */}
          <div className="scan-sweep pointer-events-none absolute inset-x-0 -top-full h-1/2 bg-gradient-to-b from-cyan-400/0 via-cyan-400/[0.06] to-cyan-400/0" />

          {/* Rivet strips along the fuselage edge */}
          <div className="rivet-strip absolute top-2 left-6 right-6 h-px" />
          <div className="rivet-strip absolute bottom-2 left-6 right-6 h-px" />

          {/* Cockpit nose */}
          <div className="w-28 mx-auto bg-white/[0.04] border-t border-x border-white/[0.1] rounded-t-full mb-6 flex flex-col items-center justify-center gap-1 py-2.5 relative">
            <IconNose className="w-4 h-4 text-cyan-300" />
            <span className="text-[8.5px] font-mono text-slate-500 uppercase tracking-widest">Cockpit</span>
            <span className="absolute -right-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          </div>

          {/* Seat Grid Rows, banded by cabin */}
          <div className="space-y-2 font-mono relative">
            {rows.map((rowNum) => {
              const isFirst = rowNum <= 2
              const isBiz = rowNum >= 3 && rowNum <= 6
              const isPrem = rowNum >= 7 && rowNum <= 9

              const band = cabinBands.find((b) => b.fromRow === rowNum)

              return (
                <div key={rowNum}>
                  {band && (
                    <div className="cabin-divider flex items-center gap-3 my-3 first:mt-0">
                      <span
                        className="text-[9px] font-mono font-bold uppercase tracking-widest whitespace-nowrap px-2 py-0.5 rounded-full border"
                        style={{ color: band.hex, borderColor: `${band.hex}55`, background: `${band.hex}14` }}
                      >
                        {band.label}
                      </span>
                      <span className="flex-1 h-px" style={{ background: `linear-gradient(90deg, ${band.hex}40, transparent)` }} />
                    </div>
                  )}

                  <div className="flex items-center justify-center gap-2 text-xs">
                    {/* Left Row Number */}
                    <span className="w-6 text-[10px] text-slate-500 text-right font-bold">{rowNum}</span>

                    {/* Left Triplet: A, B, C */}
                    <div className="flex items-center gap-1.5">
                      {["A", "B", "C"].map((col) => {
                        const seatNum = `${rowNum}${col}`
                        const isBooked = bookedSet.has(seatNum)
                        const isBlocked = blockedSet.has(seatNum)
                        const isOpenInModal = selectedSeatModal?.seatNum === seatNum

                        let bg = "bg-cyan-400/10 border-cyan-400/30 text-cyan-300 hover:bg-cyan-400/25 hover:shadow-[0_0_10px_rgba(34,211,238,0.35)]"
                        if (isBooked) bg = "bg-gradient-to-b from-amber-400/30 to-amber-400/10 border-amber-400/50 text-amber-200 hover:shadow-[0_0_10px_rgba(251,191,36,0.4)]"
                        if (isBlocked) bg = "bg-gradient-to-b from-rose-500/30 to-rose-500/10 border-rose-500/50 text-rose-200 hover:shadow-[0_0_10px_rgba(244,63,94,0.4)]"

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
                            className={`seat-btn w-9 h-8 rounded-lg border text-[10px] font-bold transition-all duration-150 flex items-center justify-center relative active:scale-90 ${bg} ${isOpenInModal ? "ring-2 ring-white/70 scale-110 z-10" : ""}`}
                          >
                            {isBlocked ? <IconLock className="w-3 h-3" /> : seatNum}
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
                        const isOpenInModal = selectedSeatModal?.seatNum === seatNum

                        let bg = "bg-cyan-400/10 border-cyan-400/30 text-cyan-300 hover:bg-cyan-400/25 hover:shadow-[0_0_10px_rgba(34,211,238,0.35)]"
                        if (isBooked) bg = "bg-gradient-to-b from-amber-400/30 to-amber-400/10 border-amber-400/50 text-amber-200 hover:shadow-[0_0_10px_rgba(251,191,36,0.4)]"
                        if (isBlocked) bg = "bg-gradient-to-b from-rose-500/30 to-rose-500/10 border-rose-500/50 text-rose-200 hover:shadow-[0_0_10px_rgba(244,63,94,0.4)]"

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
                            className={`seat-btn w-9 h-8 rounded-lg border text-[10px] font-bold transition-all duration-150 flex items-center justify-center relative active:scale-90 ${bg} ${isOpenInModal ? "ring-2 ring-white/70 scale-110 z-10" : ""}`}
                          >
                            {isBlocked ? <IconLock className="w-3 h-3" /> : seatNum}
                          </button>
                        )
                      })}
                    </div>

                    {/* Right Row Number */}
                    <span className="w-6 text-[10px] text-slate-500 text-left font-bold">{rowNum}</span>
                  </div>
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
              initial={{ opacity: 0, scale: 0.94, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 10 }}
              className={`modal-glow relative w-full max-w-md bg-[#0A1424] border rounded-3xl p-6 shadow-2xl z-10 ${
                selectedSeatModal.isBlocked
                  ? "border-rose-500/40 modal-glow-rose"
                  : selectedSeatModal.isBooked
                  ? "border-amber-400/40 modal-glow-amber"
                  : "border-emerald-400/40 modal-glow-emerald"
              }`}
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.08] mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
                      selectedSeatModal.isBlocked
                        ? "bg-rose-500/15 border-rose-500/30 text-rose-300"
                        : selectedSeatModal.isBooked
                        ? "bg-amber-400/15 border-amber-400/30 text-amber-300"
                        : "bg-emerald-400/15 border-emerald-400/30 text-emerald-300"
                    }`}
                  >
                    <IconSeat className="w-5 h-5" />
                  </div>
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
                  className={`inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                    selectedSeatModal.isBlocked
                      ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                      : selectedSeatModal.isBooked
                      ? "bg-amber-400/20 text-amber-300 border border-amber-400/30"
                      : "bg-emerald-400/20 text-emerald-300 border border-emerald-400/30"
                  }`}
                >
                  {selectedSeatModal.isBlocked ? (
                    <><IconLock className="w-2.5 h-2.5" /> BLOCKED</>
                  ) : selectedSeatModal.isBooked ? (
                    <><IconCheck className="w-2.5 h-2.5" /> BOOKED</>
                  ) : (
                    "AVAILABLE"
                  )}
                </span>
              </div>

              <div className="space-y-2.5 text-xs font-mono">
                {selectedSeatModal.booking ? (
                  <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-1.5 relative overflow-hidden ticket-stub">
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
                    className="px-4 py-2 rounded-full border border-white/[0.1] text-slate-300 hover:bg-white/[0.05] transition-colors"
                  >
                    Close
                  </button>

                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => toggleSeatBlock(selectedSeatModal.seatNum, selectedSeatModal.isBlocked)}
                    className={`px-5 py-2 rounded-full font-bold text-xs shadow-lg transition-all hover:scale-[1.03] disabled:opacity-60 disabled:hover:scale-100 ${
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

      <style jsx global>{`
        .seats-page .ticket-edge { position: relative; }
        .seats-page .ticket-edge::before {
          content: "";
          position: absolute;
          inset: 3px;
          border: 1px solid rgba(212,175,55,0.10);
          border-radius: inherit;
          pointer-events: none;
        }
        .seats-page .panel-hairline {
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 2px;
          background: linear-gradient(90deg, #38BDF8, #FBBF24, #FBBF24);
          opacity: 0.7;
        }

        @keyframes seatsHeaderIn {
          from { opacity: 0; transform: translateY(-10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .seats-page .header-enter { animation: seatsHeaderIn 0.5s ease-out both; }

        @keyframes seatsPanelIn {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .seats-page .panel-enter { animation: seatsPanelIn 0.55s ease-out 0.08s both; }

        @keyframes gaugeCardIn {
          from { opacity: 0; transform: translateY(14px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .seats-page .gauge-card { animation: gaugeCardIn 0.5s ease-out both; }

        .seats-page .gauge-ring { transition: stroke-dashoffset 900ms cubic-bezier(0.22,1,0.36,1); }

        /* Rivet strip — repeating dot pattern along the fuselage edge */
        .seats-page .rivet-strip {
          background-image: repeating-linear-gradient(90deg, rgba(255,255,255,0.16) 0, rgba(255,255,255,0.16) 2px, transparent 2px, transparent 10px);
        }

        /* Scan sweep — a soft cyan band drifting down the fuselage,
           reinforcing the "live operations console" read. */
        @keyframes scanSweepDown {
          0%   { transform: translateY(0%); opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { transform: translateY(340%); opacity: 0; }
        }
        .seats-page .scan-sweep { animation: scanSweepDown 5.5s ease-in-out infinite; }

        @keyframes legendPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(34,211,238,0.35); }
          50% { box-shadow: 0 0 0 4px rgba(34,211,238,0); }
        }
        .seats-page .legend-pulse { animation: legendPulse 2s ease-in-out infinite; }

        .seats-page .seat-btn { will-change: transform; }

        @keyframes modalGlowAmber {
          0%, 100% { box-shadow: 0 0 0 0 rgba(251,191,36,0.18), 0 25px 60px rgba(0,0,0,0.5); }
          50% { box-shadow: 0 0 26px 2px rgba(251,191,36,0.16), 0 25px 60px rgba(0,0,0,0.5); }
        }
        @keyframes modalGlowRose {
          0%, 100% { box-shadow: 0 0 0 0 rgba(244,63,94,0.18), 0 25px 60px rgba(0,0,0,0.5); }
          50% { box-shadow: 0 0 26px 2px rgba(244,63,94,0.16), 0 25px 60px rgba(0,0,0,0.5); }
        }
        @keyframes modalGlowEmerald {
          0%, 100% { box-shadow: 0 0 0 0 rgba(52,211,153,0.18), 0 25px 60px rgba(0,0,0,0.5); }
          50% { box-shadow: 0 0 26px 2px rgba(52,211,153,0.16), 0 25px 60px rgba(0,0,0,0.5); }
        }
        .seats-page .modal-glow-amber { animation: modalGlowAmber 2.4s ease-in-out infinite; }
        .seats-page .modal-glow-rose { animation: modalGlowRose 2.4s ease-in-out infinite; }
        .seats-page .modal-glow-emerald { animation: modalGlowEmerald 2.4s ease-in-out infinite; }

        .seats-page .ticket-stub::after {
          content: "";
          position: absolute;
          left: -1px; right: -1px; bottom: -1px;
          height: 1px;
          background-image: repeating-linear-gradient(90deg, rgba(255,255,255,0.18) 0, rgba(255,255,255,0.18) 4px, transparent 4px, transparent 9px);
        }

        @media (prefers-reduced-motion: reduce) {
          .seats-page .header-enter, .seats-page .panel-enter, .seats-page .gauge-card,
          .seats-page .scan-sweep, .seats-page .legend-pulse,
          .seats-page .modal-glow-amber, .seats-page .modal-glow-rose, .seats-page .modal-glow-emerald {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  )
}

function GaugeCard({
  label,
  booked,
  total,
  accent,
  hex,
  delay = 0,
}: {
  label: string
  booked: number
  total: number
  accent: "amber" | "cyan" | "emerald" | "slate"
  hex: string
  delay?: number
}) {
  const percent = total > 0 ? Math.round((booked / total) * 100) : 0
  const r = 30
  const circumference = 2 * Math.PI * r
  const offset = circumference - (percent / 100) * circumference

  const textAccent: Record<string, string> = {
    amber: "text-amber-300",
    cyan: "text-cyan-300",
    emerald: "text-emerald-300",
    slate: "text-slate-300",
  }

  return (
    <div
      className="gauge-card ticket-edge relative p-4 rounded-2xl bg-gradient-to-b from-[#0D1A2C] to-[#0A1424] border border-white/[0.08] hover:border-white/[0.16] transition-colors flex items-center gap-3.5 overflow-hidden"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="panel-hairline" />
      <div className="relative w-16 h-16 shrink-0">
        <svg viewBox="0 0 72 72" className="w-full h-full -rotate-90">
          <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="7" />
          <circle
            cx="36" cy="36" r={r} fill="none" stroke={hex} strokeWidth="7" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={offset}
            className="gauge-ring"
            style={{ filter: `drop-shadow(0 0 5px ${hex}80)` }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`font-display font-black text-xs ${textAccent[accent]}`}>{percent}%</span>
        </div>
      </div>
      <div className="min-w-0">
        <span className={`text-[10px] font-mono block uppercase font-bold ${textAccent[accent]} truncate`}>{label}</span>
        <div className="font-display font-black text-lg text-white mt-0.5">
          {booked} / {total}
        </div>
        <span className="text-[10px] font-mono text-slate-500">Seats Occupied</span>
      </div>
    </div>
  )
}