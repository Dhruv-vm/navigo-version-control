"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Navbar from "@/components/navbar"

export default function GateScannerPage() {
  const [tokenInput, setTokenInput] = useState("")
  const [verifying, setVerifying] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [gateNumber, setGateNumber] = useState("G4")
  const [recentBookings, setRecentBookings] = useState<any[]>([])

  // Camera scanner state
  const [cameraActive, setCameraActive] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    // Fetch recent bookings to provide easy test tokens
    const token = localStorage.getItem("token")
    if (!token) return

    fetch("/api/bookings", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        const list = Array.isArray(data) ? data : data?.bookings ?? []
        setRecentBookings(list.slice(0, 4))
      })
      .catch(() => {})
  }, [])

  const handleVerify = async (tokenToVerify?: string) => {
    const raw = (tokenToVerify || tokenInput).trim()
    if (!raw) return

    setVerifying(true)
    setResult(null)

    try {
      const res = await fetch("/api/gate/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qrToken: raw,
          scannedGate: gateNumber,
        }),
      })

      const data = await res.json()
      setResult(data)
    } catch (err: any) {
      setResult({
        status: "DENIED",
        reason: err.message || "Failed to communicate with airport gate server.",
      })
    } finally {
      setVerifying(false)
    }
  }

  const handleQuickScanPnr = async (pnr: string) => {
    setVerifying(true)
    try {
      // 1. Get smart check-in token for this PNR
      const verifyRes = await fetch("/api/checkin/verify-pnr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pnr }),
      })
      const verifyData = await verifyRes.json()

      if (verifyData?.booking) {
        const smartRes = await fetch("/api/checkin/smart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bookingId: verifyData.booking.id,
            passengerId: verifyData.booking.passengers[0]?.id,
            flightInstanceId: verifyData.booking.legs[0]?.flightInstanceId,
            pnr,
            passengerName: verifyData.booking.passengers[0]?.name,
          }),
        })
        const smartData = await smartRes.json()
        if (smartData?.qrToken) {
          setTokenInput(smartData.qrToken)
          await handleVerify(smartData.qrToken)
          return
        }
      }
      throw new Error("Unable to generate gate token for this PNR")
    } catch (err: any) {
      setResult({
        status: "DENIED",
        reason: err.message || "PNR could not be verified at gate.",
      })
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#030712] text-slate-100 selection:bg-cyan-500/30 selection:text-cyan-200">
      <Navbar />

      {/* Admin Protected Banner */}
      <div className="bg-amber-400/10 border-b border-amber-400/20 px-4 py-2 text-center text-xs font-mono text-amber-300 flex items-center justify-center gap-3">
        <span>🔒 Official Airport Operations: Gate scanning is managed under the Admin Operations Command Center.</span>
        <a href="/admin/gates" className="underline font-bold text-white hover:text-amber-200">
          Open Admin Gate Console →
        </a>
      </div>

      <main className="relative pt-28 pb-20 px-4 sm:px-6 max-w-5xl mx-auto">
        {/* Ambient Glows */}
        <div className="pointer-events-none absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-cyan-500/10 blur-[140px] rounded-full" />

        {/* Top Header */}
        <div className="text-center max-w-2xl mx-auto pt-4 pb-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-400/10 border border-cyan-400/25 text-cyan-300 text-xs font-mono font-bold tracking-widest uppercase mb-3">
            <span>🛡️</span> AIRPORT SECURITY & E-GATE TERMINAL
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            DigiYatra Gate Scanner Portal
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-2">
            Simulate airport e-gate boarding pass verification. Scans HMAC-signed QR tokens and cross-references reservations in real-time.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Scanner Controls */}
          <div className="lg:col-span-6 space-y-6">
            <div className="bg-[#091222] border border-white/[0.1] rounded-3xl p-6 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan-400 via-amber-400 to-emerald-400" />

              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <span>📷</span> Scan Boarding QR Token
                </h3>
                <div className="flex items-center gap-1.5 text-xs font-mono bg-white/[0.05] border border-white/[0.1] px-2.5 py-1 rounded-lg">
                  <span className="text-slate-400">GATE:</span>
                  <input
                    type="text"
                    value={gateNumber}
                    onChange={(e) => setGateNumber(e.target.value.toUpperCase())}
                    className="w-10 bg-transparent text-amber-300 font-bold focus:outline-none"
                    maxLength={4}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-slate-400 block mb-1.5 font-semibold">
                    Encrypted Token String (NVG1.xxx)
                  </label>
                  <textarea
                    rows={3}
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="Paste full signed QR token from boarding pass..."
                    className="w-full bg-white/[0.03] border border-white/[0.1] rounded-xl p-3 text-xs text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-cyan-400/50 resize-none"
                  />
                </div>

                <button
                  onClick={() => handleVerify()}
                  disabled={verifying || !tokenInput.trim()}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-[0_4px_16px_rgba(6,182,212,0.3)] transition-all flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  {verifying ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Authenticating Biometrics & Token…
                    </>
                  ) : (
                    <>
                      <span>⚡</span> Execute Gate Verification
                    </>
                  )}
                </button>
              </div>

              {/* Sample test buttons */}
              {recentBookings.length > 0 && (
                <div className="mt-6 pt-5 border-t border-white/[0.08]">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 block mb-2">
                    Quick Test with Your Confirmed Trips
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {recentBookings.map((b) => (
                      <button
                        key={b.id}
                        onClick={() => handleQuickScanPnr(b.pnr)}
                        disabled={verifying}
                        className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] hover:border-cyan-400/40 text-left transition-all group disabled:opacity-50"
                      >
                        <div className="flex items-center justify-between text-xs font-mono font-bold text-amber-300">
                          <span>{b.pnr}</span>
                          <span className="text-[10px] text-cyan-400 group-hover:translate-x-0.5 transition-transform">→</span>
                        </div>
                        <p className="text-[10px] text-slate-400 truncate mt-0.5">
                          {b.legs?.[0]?.origin || "DEL"} → {b.legs?.[0]?.destination || "BLR"}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Gate Clearance Visual Display */}
          <div className="lg:col-span-6">
            <div className="bg-[#070D18] border border-white/[0.1] rounded-3xl p-6 sm:p-8 shadow-2xl relative min-h-[420px] flex flex-col justify-between overflow-hidden">
              {/* Top Gate Status Banner */}
              <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
                <div className="flex items-center gap-2 font-mono text-xs">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                  <span className="text-slate-400">STATUS:</span>
                  <span className="font-bold text-white uppercase">E-GATE ONLINE</span>
                </div>
                <span className="font-mono text-xs text-amber-300 bg-amber-400/10 px-2.5 py-1 rounded-lg border border-amber-400/20">
                  TERMINAL GATE {gateNumber}
                </span>
              </div>

              {/* Clearance Results */}
              <div className="my-auto py-6">
                <AnimatePresence mode="wait">
                  {verifying ? (
                    <motion.div
                      key="verifying"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-center py-8"
                    >
                      <div className="w-20 h-20 rounded-full border-4 border-cyan-400 border-t-transparent animate-spin mx-auto mb-4" />
                      <h4 className="font-display text-lg font-bold text-white">
                        Scanning Biometric Credentials
                      </h4>
                      <p className="text-xs text-slate-400 mt-1 font-mono">
                        Verifying 256-bit HMAC Token & Passenger Manifest...
                      </p>
                    </motion.div>
                  ) : result?.status === "ALLOWED" ? (
                    /* GREEN ALLOWED ANIMATION */
                    <motion.div
                      key="allowed"
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ type: "spring", damping: 20, stiffness: 220 }}
                      className="text-center"
                    >
                      {/* Gate Open Light Ring */}
                      <div className="relative w-24 h-24 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-4xl text-emerald-300 mx-auto mb-4 shadow-[0_0_50px_rgba(52,211,153,0.4)]">
                        ✓
                        <div className="absolute inset-0 rounded-full border border-emerald-400 animate-ping opacity-30" />
                      </div>

                      <div className="inline-block px-3 py-1 rounded-full bg-emerald-400/15 border border-emerald-400/30 text-emerald-300 font-mono text-xs font-bold tracking-widest uppercase mb-2">
                        BOARDING ALLOWED · GATE OPENED
                      </div>

                      <h3 className="font-display text-2xl font-extrabold text-white">
                        {result.clearance?.passengerName}
                      </h3>

                      {/* Passenger Details Pill Grid */}
                      <div className="grid grid-cols-3 gap-2 mt-4 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] text-left text-xs font-mono">
                        <div>
                          <span className="text-[10px] text-slate-500 block">FLIGHT</span>
                          <span className="font-bold text-white">{result.clearance?.flightNumber}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">SEAT</span>
                          <span className="font-bold text-amber-300">{result.clearance?.seat}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">GATE</span>
                          <span className="font-bold text-cyan-300">{result.clearance?.gate}</span>
                        </div>
                      </div>

                      <p className="text-[11px] text-emerald-400/90 font-mono mt-3">
                        ✓ Biometric Match: 99.8% · DigiYatra Identity Verified
                      </p>
                    </motion.div>
                  ) : result?.status === "DENIED" ? (
                    /* RED DENIED ANIMATION */
                    <motion.div
                      key="denied"
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ type: "spring", damping: 20, stiffness: 220 }}
                      className="text-center"
                    >
                      <div className="w-20 h-20 rounded-full bg-rose-500/20 border-2 border-rose-400 flex items-center justify-center text-3xl text-rose-300 mx-auto mb-4 shadow-[0_0_40px_rgba(244,63,94,0.4)]">
                        ✕
                      </div>

                      <div className="inline-block px-3 py-1 rounded-full bg-rose-400/15 border border-rose-400/30 text-rose-300 font-mono text-xs font-bold tracking-widest uppercase mb-2">
                        BOARDING DENIED · GATE CLOSED
                      </div>

                      <h4 className="font-display text-lg font-bold text-white mt-1">
                        Access Restricted
                      </h4>

                      <p className="text-xs text-rose-300 bg-rose-400/10 border border-rose-400/20 rounded-xl p-3 mt-3 leading-relaxed">
                        {result.reason || "Invalid boarding pass credentials."}
                      </p>
                    </motion.div>
                  ) : (
                    /* Standby idle state */
                    <div className="text-center text-slate-500 py-10">
                      <span className="text-4xl block mb-2">🛫</span>
                      <p className="text-xs font-mono uppercase tracking-wider">
                        Awaiting Boarding Pass Scan
                      </p>
                    </div>
                  )}
                </AnimatePresence>
              </div>

              {/* Bottom Gate Info Bar */}
              <div className="pt-4 border-t border-white/[0.06] text-[11px] text-slate-500 font-mono flex items-center justify-between">
                <span>SYSTEM: NAVIGO AIRPORT GATE v2.4</span>
                <span>SECURED WITH SHA-256</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
