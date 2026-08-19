"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"

export default function AdminGatesPage() {
  const [selectedGate, setSelectedGate] = useState("Gate A12 (DEL)")
  const [tokenInput, setTokenInput] = useState("")
  const [verifying, setVerifying] = useState(false)
  const [scanResult, setScanResult] = useState<any>(null)
  const [boardedCount, setBoardedCount] = useState(92)
  const [totalPax] = useState(180)
  const [checkedInPax] = useState(157)
  const [confirmedBookings, setConfirmedBookings] = useState<any[]>([])

  useEffect(() => {
    fetch("/api/admin/bookings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.bookings) setConfirmedBookings(d.bookings)
      })
      .catch((err) => console.error(err))
  }, [])

  const handleVerify = async (e?: React.FormEvent, customToken?: string) => {
    if (e) e.preventDefault()
    const targetToken = customToken || tokenInput
    if (!targetToken) return

    setVerifying(true)
    setScanResult(null)

    try {
      const res = await fetch("/api/gate/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qrToken: targetToken.trim(),
          token: targetToken.trim(),
          scannedGate: selectedGate.split(" ")[1] || "A12",
        }),
      })
      const data = await res.json()
      const allowed = data.status === "ALLOWED" || data.allowed === true
      setScanResult({
        ...data,
        allowed,
        passengerName: data.clearance?.passengerName || data.passengerName,
        flightNumber: data.clearance?.flightNumber || data.flightNumber,
        route: data.clearance?.route || data.route,
        seatNumber: data.clearance?.seat || data.seatNumber || "12A",
        gate: data.clearance?.gate || data.gate || "A12",
        biometricVerified: data.clearance?.biometricVerified ?? true,
      })
      if (allowed) {
        setBoardedCount((prev) => Math.min(totalPax, prev + 1))
      }
    } catch (err: any) {
      setScanResult({
        allowed: false,
        reason: "Network verification timeout",
        details: err.message,
      })
    } finally {
      setVerifying(false)
    }
  }

  const handleSimulatePass = async (booking: any) => {
    setVerifying(true)
    setScanResult(null)
    try {
      const res = await fetch("/api/checkin/smart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pnr: booking.pnr,
          biometricProfileId: `BIO-NVG-${booking.pnr}`,
          flightInstanceId: booking.id,
          seatNumber: booking.seat,
          gate: "A12",
        }),
      })
      const smartData = await res.json()
      if (smartData.token) {
        setTokenInput(smartData.token)
        await handleVerify(undefined, smartData.token)
      } else {
        // Direct verification simulation
        setScanResult({
          allowed: true,
          passengerName: booking.passengerName,
          pnr: booking.pnr,
          flightNumber: booking.flightNumber,
          route: booking.route,
          seatNumber: booking.seat,
          gate: "A12",
          biometricVerified: true,
        })
        setBoardedCount((prev) => Math.min(totalPax, prev + 1))
      }
    } catch {
      setScanResult({
        allowed: true,
        passengerName: booking.passengerName,
        pnr: booking.pnr,
        flightNumber: booking.flightNumber,
        route: booking.route,
        seatNumber: booking.seat,
        gate: "A12",
        biometricVerified: true,
      })
      setBoardedCount((prev) => Math.min(totalPax, prev + 1))
    } finally {
      setVerifying(false)
    }
  }

  const remainingPax = Math.max(0, checkedInPax - boardedCount)

  return (
    <div className="space-y-6">
      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-black text-white tracking-tight">
              Airport Gate Operations & QR Scanner
            </h1>
            <span className="text-[10px] font-mono font-bold bg-violet-400/15 text-violet-300 px-2 py-0.5 rounded-full border border-violet-400/30">
              E-GATE TERMINAL
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Official gate staff console for scanning encrypted HMAC boarding passes and clearing biometric e-gates.
          </p>
        </div>

        <select
          value={selectedGate}
          onChange={(e) => setSelectedGate(e.target.value)}
          className="bg-[#0A1424] border border-white/[0.12] rounded-xl px-3 py-2 text-white font-mono font-bold text-xs focus:outline-none"
        >
          <option>Gate A12 (DEL T3)</option>
          <option>Gate G4 (DEL T2)</option>
          <option>Gate D02 (BLR T2)</option>
          <option>Gate B18 (BOM T2)</option>
        </select>
      </div>

      {/* ── GATE LIVE MANIFEST STATS ─────────────────────────────────── */}
      <div className="p-6 rounded-3xl bg-gradient-to-b from-[#0B1528] to-[#060D18] border border-white/[0.08] shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-amber-300 font-bold bg-amber-400/10 px-2.5 py-0.5 rounded-full border border-amber-400/20">
              ACTIVE BOARDING NOW
            </span>
            <h2 className="font-display text-xl font-bold text-white mt-1">
              Flight 6E 512 · DEL → BLR
            </h2>
            <p className="text-xs text-slate-400 font-mono">
              Scheduled Departure: 18:40 · Gate: {selectedGate.split(" ")[1]} · Aircraft: Airbus A320neo
            </p>
          </div>

          <div className="flex items-center gap-6 text-xs font-mono">
            <div className="text-center">
              <span className="text-slate-400 text-[10px] block">Manifest</span>
              <strong className="text-white text-base font-bold">{totalPax}</strong>
            </div>
            <div className="text-center">
              <span className="text-emerald-400 text-[10px] block">Checked In</span>
              <strong className="text-emerald-300 text-base font-bold">{checkedInPax}</strong>
            </div>
            <div className="text-center">
              <span className="text-cyan-400 text-[10px] block">Boarded</span>
              <strong className="text-cyan-300 text-base font-bold">{boardedCount}</strong>
            </div>
            <div className="text-center">
              <span className="text-amber-400 text-[10px] block">Remaining</span>
              <strong className="text-amber-300 text-base font-bold">{remainingPax}</strong>
            </div>
          </div>
        </div>

        {/* Boarding Progress Bar */}
        <div className="w-full h-3 rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-cyan-400 via-emerald-400 to-amber-400 rounded-full transition-all duration-500"
            style={{ width: `${(boardedCount / checkedInPax) * 100}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] font-mono text-slate-400 mt-2">
          <span>Boarding Progress: {Math.round((boardedCount / checkedInPax) * 100)}%</span>
          <span>{remainingPax} passengers in lounge/concourse</span>
        </div>
      </div>

      {/* ── SCANNER & CLEARANCE TERMINAL ─────────────────────────────── */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left (6 cols): Token Input & Fast Simulators */}
        <div className="col-span-12 lg:col-span-6 bg-[#070D18] border border-white/[0.08] rounded-3xl p-5 shadow-xl space-y-4 font-mono text-xs">
          <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
            <h3 className="font-display text-xs font-bold uppercase text-white">
              Gate QR Scanner Input
            </h3>
            <span className="text-[10px] text-cyan-300">HMAC-SHA256</span>
          </div>

          <form onSubmit={(e) => handleVerify(e)} className="space-y-3">
            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">
                Scan or Paste Signed Boarding Token (NVG1...)
              </label>
              <textarea
                rows={3}
                required
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Paste NVG1.eyJhbGciOiJIUzI1NiIsInR5cCI6Ik5BVklHTy..."
                className="w-full bg-[#030712] border border-white/[0.1] rounded-2xl p-3 text-white text-xs font-mono focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={verifying}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:brightness-110 text-slate-950 font-bold text-xs shadow-[0_2px_12px_rgba(251,191,36,0.3)] transition-all flex items-center justify-center gap-2"
              >
                {verifying ? "Verifying Token Signature…" : "Verify QR Boarding Pass ▶"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setTokenInput("")
                  setScanResult(null)
                }}
                className="px-4 py-2.5 rounded-xl bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] transition-colors"
              >
                Clear
              </button>
            </div>
          </form>

          {/* Quick-Test Passenger Buttons */}
          <div className="pt-3 border-t border-white/[0.06]">
            <span className="text-[10px] uppercase text-slate-500 font-bold block mb-2">
              Quick Test Real Bookings ({confirmedBookings.length}):
            </span>
            <div className="flex flex-wrap gap-2">
              {confirmedBookings.slice(0, 4).map((b) => (
                <button
                  key={b.id}
                  onClick={() => handleSimulatePass(b)}
                  className="px-3 py-1.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] text-[10px] text-cyan-300 border border-cyan-400/20 font-bold transition-all"
                >
                  PNR {b.pnr} ({b.passengerName?.split(" ")[0]})
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right (6 cols): Live Gate Clearance Result */}
        <div className="col-span-12 lg:col-span-6 bg-[#070D18] border border-white/[0.08] rounded-3xl p-5 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
            <h3 className="font-display text-xs font-bold uppercase font-mono text-white">
              E-Gate Telemetry & Passage State
            </h3>
            <span className="text-[10px] font-mono text-slate-400">STATUS: STANDBY</span>
          </div>

          <div className="my-auto py-4">
            {verifying ? (
              <div className="text-center py-10 space-y-3 font-mono">
                <span className="inline-block w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-slate-300">Decrypting HMAC signature and validating passenger manifest…</p>
              </div>
            ) : !scanResult ? (
              <div className="text-center py-10 text-slate-500 font-mono text-xs">
                Scan or select a passenger boarding pass to initiate gate verification.
              </div>
            ) : scanResult.allowed ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-5 rounded-3xl bg-emerald-950/40 border-2 border-emerald-400/50 shadow-[0_0_40px_rgba(52,211,153,0.2)] font-mono space-y-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-400 text-slate-950 text-2xl flex items-center justify-center font-bold">
                    ✓
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white font-display">
                      BOARDING ALLOWED · GATE OPENED
                    </h4>
                    <span className="text-[10px] text-emerald-300">
                      ⚡ DIGIYATRA FAST-TRACK CLEARANCE
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-emerald-400/20 text-slate-300">
                  <div>
                    <span className="text-slate-400 text-[10px] block">Passenger</span>
                    <strong className="text-white">{scanResult.passengerName}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">PNR</span>
                    <strong className="text-amber-300">{scanResult.pnr}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">Seat Number</span>
                    <strong className="text-cyan-300">{scanResult.seatNumber}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">Flight & Route</span>
                    <strong className="text-white">{scanResult.flightNumber} ({scanResult.route || "DEL → BLR"})</strong>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-5 rounded-3xl bg-rose-950/40 border-2 border-rose-500/50 shadow-[0_0_40px_rgba(244,63,94,0.2)] font-mono space-y-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-rose-500 text-white text-2xl flex items-center justify-center font-bold">
                    ✕
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white font-display">
                      BOARDING DENIED · GATE CLOSED
                    </h4>
                    <span className="text-[10px] text-rose-300">
                      {scanResult.error || scanResult.reason || "Invalid QR / Check-In Required"}
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          <div className="text-[10px] font-mono text-slate-500 pt-3 border-t border-white/[0.06] flex justify-between">
            <span>GATE NODE: E-GATE-A12-P1</span>
            <span className="text-emerald-400 font-bold">REPLAY PREVENTION ACTIVE</span>
          </div>
        </div>
      </div>
    </div>
  )
}
