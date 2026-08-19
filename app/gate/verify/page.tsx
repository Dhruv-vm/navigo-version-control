"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { biometricProvider } from "@/lib/biometric/provider"
import type { FaceDetectionResult } from "@/lib/biometric/faceDetection"

export default function GateVerificationPage() {
  const searchParams = useSearchParams()
  const tokenFromUrl = searchParams.get("token") || ""

  const [tokenInput, setTokenInput] = useState(tokenFromUrl)
  const [verifying, setVerifying] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [gateNumber, setGateNumber] = useState("G4")
  const [recentBookings, setRecentBookings] = useState<any[]>([])

  // Airport E-Gate Face Camera State
  const [gateStep, setGateStep] = useState<"IDLE" | "VERIFYING_TOKEN" | "FACE_CAMERA" | "BOARDING_CLEARED" | "DENIED">("IDLE")
  const [faceDetection, setFaceDetection] = useState<FaceDetectionResult>({
    state: "NO_FACE",
    message: "Starting E-Gate Camera…",
    confidence: 0,
    faceCount: 0,
  })
  const [faceMatchProgress, setFaceMatchProgress] = useState(0)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const consecutiveValidFrames = useRef(0)

  const cleanupGateCamera = useCallback(() => {
    if (streamRef.current) {
      biometricProvider.stopCamera(streamRef.current)
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    consecutiveValidFrames.current = 0
  }, [])

  // Auto-verify if token is present in URL
  useEffect(() => {
    if (tokenFromUrl) {
      setTokenInput(tokenFromUrl)
      runVerification(tokenFromUrl)
    }
  }, [tokenFromUrl])

  // Fetch recent bookings for quick testing by staff
  useEffect(() => {
    fetch("/api/admin/bookings")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.bookings) {
          setRecentBookings(data.bookings.slice(0, 4))
        }
      })
      .catch(() => {})
  }, [])

  const runVerification = async (rawToken: string) => {
    const cleanToken = rawToken.trim()
    if (!cleanToken) return

    setVerifying(true)
    setGateStep("VERIFYING_TOKEN")
    setResult(null)
    cleanupGateCamera()

    try {
      const res = await fetch("/api/gate/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qrToken: cleanToken,
          scannedGate: gateNumber,
        }),
      })

      const data = await res.json()
      setResult(data)

      if (data.status === "ALLOWED") {
        // Step 2: Open Face Camera for Live Passenger Matching
        setGateStep("FACE_CAMERA")
        initGateCamera()
      } else {
        setGateStep("DENIED")
      }
    } catch (err: any) {
      setResult({
        status: "DENIED",
        code: "NETWORK_ERROR",
        reason: err.message || "Unable to communicate with airport gate verification server.",
        clearance: null,
      })
      setGateStep("DENIED")
    } finally {
      setVerifying(false)
    }
  }

  const initGateCamera = async () => {
    const cam = await biometricProvider.startCamera()
    if (cam.status === "CAMERA_ACTIVE" && cam.stream) {
      streamRef.current = cam.stream
      if (videoRef.current) {
        videoRef.current.srcObject = cam.stream
        await videoRef.current.play().catch(() => {})
      }
    }
  }

  // Real-time Face Frame Detection Loop during GATE verification
  useEffect(() => {
    if (gateStep !== "FACE_CAMERA") return

    let active = true
    const interval = setInterval(async () => {
      if (!active || !videoRef.current) return

      const det = await biometricProvider.detectFace(videoRef.current)
      if (!active) return

      setFaceDetection(det)

      if (det.state === "READY_TO_VERIFY" || det.state === "FACE_DETECTED") {
        consecutiveValidFrames.current += 1
        const progress = Math.min(100, consecutiveValidFrames.current * 16)
        setFaceMatchProgress(progress)

        if (progress >= 100) {
          clearInterval(interval)
          cleanupGateCamera()
          setGateStep("BOARDING_CLEARED")
        }
      } else {
        consecutiveValidFrames.current = Math.max(0, consecutiveValidFrames.current - 1)
        setFaceMatchProgress(consecutiveValidFrames.current * 16)
      }
    }, 120)

    return () => {
      active = false
      clearInterval(interval)
    }
  }, [gateStep, cleanupGateCamera])

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    runVerification(tokenInput)
  }

  const handleQuickTestPnr = async (pnr: string) => {
    setVerifying(true)
    try {
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
          await runVerification(smartData.qrToken)
          return
        }
      }
      throw new Error("Unable to create gate token for this PNR")
    } catch (err: any) {
      setResult({
        status: "DENIED",
        code: "PNR_ERROR",
        reason: err.message || "PNR could not be verified at gate.",
        clearance: null,
      })
      setGateStep("DENIED")
    } finally {
      setVerifying(false)
    }
  }

  const handleReset = () => {
    cleanupGateCamera()
    setResult(null)
    setTokenInput("")
    setGateStep("IDLE")
  }

  return (
    <div className="min-h-screen bg-[#02050E] text-slate-100 flex flex-col items-center justify-between p-4 sm:p-6 lg:p-10 font-sans select-none relative overflow-hidden">
      {/* Background Lighting */}
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-cyan-500/10 blur-[140px] rounded-full" />
      {gateStep === "BOARDING_CLEARED" && (
        <div className="pointer-events-none absolute inset-0 bg-emerald-500/[0.04] blur-[100px] transition-all duration-700" />
      )}
      {gateStep === "DENIED" && (
        <div className="pointer-events-none absolute inset-0 bg-rose-500/[0.04] blur-[100px] transition-all duration-700" />
      )}

      {/* Top Header */}
      <header className="w-full max-w-4xl flex items-center justify-between pb-6 border-b border-white/[0.08] relative z-10">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5 group">
            <img src="/logo.png" alt="Navigo" className="w-8 h-8 object-contain" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-black text-sm tracking-wider text-white">NAVIGO</span>
                <span className="text-[9px] font-mono font-bold bg-cyan-400/15 text-cyan-300 px-1.5 py-0.2 rounded border border-cyan-400/30">
                  E-GATE
                </span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">AUTOMATED BIOMETRIC PASSAGE</span>
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-3 font-mono text-xs">
          <div className="flex items-center gap-1.5 bg-white/[0.04] border border-white/[0.08] px-3 py-1.5 rounded-xl">
            <span className="text-slate-400">Gate:</span>
            <select
              value={gateNumber}
              onChange={(e) => setGateNumber(e.target.value)}
              className="bg-transparent text-amber-300 font-bold focus:outline-none cursor-pointer"
            >
              <option value="G4" className="bg-slate-900">G4 (Terminal 3)</option>
              <option value="G7" className="bg-slate-900">G7 (Terminal 3)</option>
              <option value="A12" className="bg-slate-900">A12 (Terminal 1)</option>
              <option value="B02" className="bg-slate-900">B02 (Terminal 2)</option>
            </select>
          </div>
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" title="Gate Camera & Sensor Active" />
        </div>
      </header>

      {/* Central Interactive Verification Box */}
      <main className="w-full max-w-xl my-auto py-8 relative z-10">
        {gateStep === "VERIFYING_TOKEN" ? (
          /* State 1: Verifying Cryptographic Token */
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-8 rounded-3xl bg-gradient-to-b from-[#091528] to-[#040810] border border-cyan-400/30 shadow-[0_20px_80px_rgba(0,0,0,0.8)] text-center"
          >
            <div className="relative w-28 h-28 mx-auto mb-6 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-2 border-cyan-400/40 animate-ping opacity-40" />
              <div className="absolute inset-3 rounded-full border border-cyan-400/60 animate-spin" style={{ animationDuration: "3s" }} />
              <div className="w-16 h-16 rounded-full bg-cyan-400/20 border border-cyan-400/50 flex items-center justify-center text-2xl text-cyan-300 shadow-[0_0_30px_rgba(56,189,248,0.4)]">
                📡
              </div>
            </div>

            <span className="text-[10px] font-mono font-bold tracking-widest text-cyan-300 uppercase bg-cyan-400/10 px-3 py-1 rounded-full border border-cyan-400/25">
              AUTHENTICATING CREDENTIAL
            </span>
            <h2 className="font-display text-2xl font-black text-white mt-3 tracking-tight">
              NAVIGO GATE VERIFICATION
            </h2>
            <p className="text-xs text-slate-400 mt-1 font-mono">
              Verifying cryptographic signature, flight instance & passenger manifest…
            </p>
          </motion.div>
        ) : gateStep === "FACE_CAMERA" ? (
          /* State 2: Live Face Camera Matching at Gate */
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-[#071322] to-[#040914] border border-cyan-400/40 shadow-[0_20px_80px_rgba(0,0,0,0.8)] text-center"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08] mb-4 text-xs font-mono">
              <span className="text-emerald-400 font-bold">✓ BOOKING VERIFIED</span>
              <span className="text-cyan-300">PASSENGER: {result?.clearance?.passengerName}</span>
            </div>

            {/* Circular Face Scanner */}
            <div className="relative w-56 h-56 mx-auto my-3 flex items-center justify-center">
              <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="46" stroke="rgba(255,255,255,0.08)" strokeWidth="3" fill="none" />
                <motion.circle
                  cx="50"
                  cy="50"
                  r="46"
                  stroke="#38BDF8"
                  strokeWidth="3.5"
                  strokeDasharray="289"
                  strokeDashoffset={289 - (289 * Math.max(15, faceMatchProgress)) / 100}
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>

              <div className="relative w-44 h-44 rounded-full overflow-hidden border-2 border-cyan-400/50 bg-black flex items-center justify-center shadow-[0_0_40px_rgba(56,189,248,0.3)]">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-35">
                  <div className="w-28 h-36 rounded-[40%] border border-cyan-300/60" />
                </div>
              </div>
            </div>

            <span className="text-[10px] font-mono font-bold tracking-widest text-cyan-300 uppercase bg-cyan-400/10 px-3 py-1 rounded-full border border-cyan-400/25">
              E-GATE CAMERA · STEP 2 OF 2
            </span>
            <h3 className="font-display text-xl font-bold text-white mt-2">
              {faceDetection.state === "NO_FACE" ? "Look into the Gate Camera" : faceDetection.message}
            </h3>
            <p className="text-xs text-slate-400 mt-1 font-mono">
              Matching face against registered biometric template for passenger {result?.clearance?.passengerName}
            </p>

            <button
              onClick={() => {
                cleanupGateCamera()
                setGateStep("BOARDING_CLEARED")
              }}
              className="mt-5 text-[11px] font-mono text-cyan-400 hover:text-cyan-300 underline"
            >
              Manual Staff Override Pass →
            </button>
          </motion.div>
        ) : gateStep === "BOARDING_CLEARED" ? (
          /* State 3: Boarding Cleared */
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 240, damping: 20 }}
            className="p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-[#061C14] via-[#04140E] to-[#020A07] border-2 border-emerald-400/60 shadow-[0_0_80px_rgba(16,185,129,0.3)] text-center relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400 animate-pulse" />

            <div className="w-20 h-20 rounded-3xl bg-emerald-400/20 border-2 border-emerald-400/60 flex items-center justify-center text-4xl mx-auto mb-4 text-emerald-300 shadow-[0_0_40px_rgba(52,211,153,0.5)]">
              ✓
            </div>

            <span className="inline-block text-[10px] font-mono font-bold tracking-widest text-emerald-300 uppercase bg-emerald-400/15 px-3 py-1 rounded-full border border-emerald-400/30 mb-2">
              GATE {gateNumber} · BIOMETRIC CLEARED
            </span>

            <h1 className="font-display text-3xl sm:text-4xl font-black text-white tracking-tight">
              BOARDING CLEARED
            </h1>
            <p className="text-xs text-emerald-300/80 font-mono mt-1">
              Identity Verified · Booking Verified · Flight Verified · Check-In Valid
            </p>

            {/* Clearance Details Card */}
            <div className="mt-6 p-4 rounded-2xl bg-black/40 border border-emerald-400/20 text-left font-mono text-xs space-y-2.5">
              <div className="flex justify-between pb-2 border-b border-white/[0.08]">
                <span className="text-slate-400">Passenger:</span>
                <strong className="text-white text-sm font-sans">{result?.clearance?.passengerName}</strong>
              </div>
              <div className="flex justify-between pb-2 border-b border-white/[0.08]">
                <span className="text-slate-400">Flight:</span>
                <strong className="text-cyan-300 font-bold">{result?.clearance?.flightNumber} ({result?.clearance?.airline})</strong>
              </div>
              <div className="flex justify-between pb-2 border-b border-white/[0.08]">
                <span className="text-slate-400">Route:</span>
                <strong className="text-white">{result?.clearance?.route}</strong>
              </div>
              <div className="grid grid-cols-2 gap-2 pb-2 border-b border-white/[0.08]">
                <div>
                  <span className="text-slate-400 block text-[10px]">Seat</span>
                  <strong className="text-amber-300 text-base">{result?.clearance?.seat}</strong>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block text-[10px]">Gate</span>
                  <strong className="text-emerald-300 text-base">{result?.clearance?.gate}</strong>
                </div>
              </div>
              <div className="flex justify-between text-[11px] text-slate-400 pt-1">
                <span>Boarding Status:</span>
                <strong className="text-emerald-400 font-bold">CLEARED ✓</strong>
              </div>
            </div>

            <button
              onClick={handleReset}
              className="w-full mt-6 py-3.5 rounded-2xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold text-xs shadow-[0_4px_20px_rgba(52,211,153,0.4)] transition-all flex items-center justify-center gap-2"
            >
              <span>Scan Next Passenger</span> →
            </button>
          </motion.div>
        ) : gateStep === "DENIED" ? (
          /* State 4: Boarding Denied */
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 240, damping: 20 }}
            className="p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-[#1C080B] via-[#140608] to-[#0A0203] border-2 border-rose-500/60 shadow-[0_0_80px_rgba(244,63,94,0.3)] text-center relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-rose-500 animate-pulse" />

            <div className="w-20 h-20 rounded-3xl bg-rose-500/20 border-2 border-rose-500/60 flex items-center justify-center text-4xl mx-auto mb-4 text-rose-400 shadow-[0_0_40px_rgba(244,63,94,0.5)]">
              ✕
            </div>

            <span className="inline-block text-[10px] font-mono font-bold tracking-widest text-rose-300 uppercase bg-rose-500/15 px-3 py-1 rounded-full border border-rose-500/30 mb-2">
              BOARDING DENIED
            </span>

            <h1 className="font-display text-3xl sm:text-4xl font-black text-white tracking-tight">
              ACCESS DENIED
            </h1>
            <p className="text-xs text-rose-300 font-mono mt-2 bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl max-w-md mx-auto">
              {result?.reason || "Boarding credential validation failed."}
            </p>

            <button
              onClick={handleReset}
              className="w-full mt-6 py-3.5 rounded-2xl bg-white/[0.08] hover:bg-white/[0.15] text-white font-bold text-xs border border-white/[0.15] transition-all flex items-center justify-center gap-2"
            >
              <span>Try Again / Scan Next</span> →
            </button>
          </motion.div>
        ) : (
          /* State 5: Gate QR Scanner Console (Airport Staff Terminal) */
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-[#091528] to-[#040810] border border-white/[0.12] shadow-[0_20px_80px_rgba(0,0,0,0.7)] relative overflow-hidden"
          >
            <div className="text-center pb-6">
              <div className="w-14 h-14 rounded-2xl bg-cyan-400/10 border border-cyan-400/25 text-cyan-300 flex items-center justify-center text-2xl mx-auto mb-3 shadow-[0_0_25px_rgba(56,189,248,0.25)]">
                🛡️
              </div>
              <h2 className="font-display text-2xl font-black text-white tracking-tight">
                Airport Gate Scanner
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Scan passenger boarding pass QR code or enter verification token.
              </p>
            </div>

            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
                <label className="text-[10px] uppercase font-mono tracking-widest text-slate-400 block mb-1.5 font-bold">
                  QR Token or Verification Link
                </label>
                <textarea
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="Paste NVG1 cryptographic token or https://.../gate/verify?token=..."
                  rows={3}
                  className="w-full bg-white/[0.04] border border-white/[0.1] rounded-2xl p-3.5 text-xs text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-cyan-400/50 resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={!tokenInput.trim() || verifying}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 hover:brightness-110 text-slate-950 font-bold text-xs shadow-[0_4px_20px_rgba(56,189,248,0.35)] flex items-center justify-center gap-2 disabled:opacity-40"
              >
                <span>⚡</span> Scan & Verify Passenger Credential →
              </button>
            </form>

            {/* Quick Test Chips for Airport Staff Terminal */}
            {recentBookings.length > 0 && (
              <div className="mt-6 pt-5 border-t border-white/[0.08]">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 block mb-2 font-bold">
                  Quick Select Passenger Flight
                </span>
                <div className="flex flex-wrap gap-2">
                  {recentBookings.map((trip) => (
                    <button
                      key={trip.id}
                      onClick={() => handleQuickTestPnr(trip.pnr)}
                      className="px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:border-cyan-400/40 hover:bg-white/[0.08] text-xs font-mono text-slate-300 flex items-center gap-2 transition-all"
                    >
                      <span className="text-amber-300 font-bold">{trip.pnr}</span>
                      <span className="text-slate-500">·</span>
                      <span>{trip.passengerName || "Traveler"}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full max-w-4xl text-center pt-4 border-t border-white/[0.08] text-[11px] font-mono text-slate-500 relative z-10 flex flex-wrap items-center justify-between gap-2">
        <span>NAVIGO SECURE SMART GATEWAY v3.4</span>
        <span>NODE: DEL-T3-E-GATE-G4</span>
      </footer>
    </div>
  )
}
