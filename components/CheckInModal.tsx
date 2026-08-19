"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import SmartCheckInIntroModal from "./SmartCheckInIntroModal"
import FaceRegistrationModal from "./FaceRegistrationModal"

export interface VerifiedBookingDetails {
  id: string
  pnr: string
  status: string
  travelDate: string | null
  legs: {
    legLabel: "Departure" | "Return" | null
    flightInstanceId: string
    airline: string
    flightNumber: string
    origin: string
    destination: string
    travelDate: string
    departureTime?: string
    arrivalTime?: string
    aircraft?: string
    gate?: string
  }[]
  passengers: {
    id: string
    name: string
    firstName?: string
    lastName?: string
    email?: string
    isPrimary?: boolean
  }[]
  seats: {
    flightInstanceId: string
    passengerId: string
    seatNumber: string
    cabinClass?: string
  }[]
}

export default function CheckInModal({
  isOpen,
  onClose,
  defaultPnr = "",
  onSuccess,
}: {
  isOpen: boolean
  onClose: () => void
  defaultPnr?: string
  onSuccess?: (pnr: string, isSmartCheckIn?: boolean, qrToken?: string) => void
}) {
  const [pnr, setPnr] = useState(defaultPnr)
  const [lastName, setLastName] = useState("")
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Verified booking data state
  const [verifiedBooking, setVerifiedBooking] = useState<VerifiedBookingDetails | null>(null)
  const [hasBiometricProfile, setHasBiometricProfile] = useState(false)
  const [biometricProfile, setBiometricProfile] = useState<any>(null)

  // Smart Check-in Flow Sub-modals & Success state
  const [showIntroModal, setShowIntroModal] = useState(false)
  const [showFaceModal, setShowFaceModal] = useState(false)
  const [smartProcessing, setSmartProcessing] = useState(false)
  const [smartSuccess, setSmartSuccess] = useState<any>(null)

  if (!isOpen) return null

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!pnr.trim()) {
      setError("Please enter your 6-character PNR reference.")
      return
    }

    setChecking(true)
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
      const res = await fetch("/api/checkin/verify-pnr", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          pnr: pnr.trim().toUpperCase(),
          lastName: lastName.trim(),
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to find booking for this PNR")
      }

      setVerifiedBooking(data.booking)
      setHasBiometricProfile(data.hasBiometricProfile)
      setBiometricProfile(data.biometricProfile)
    } catch (err: any) {
      setError(err.message || "Unable to verify PNR reference.")
    } finally {
      setChecking(false)
    }
  }

  // Complete Standard Check-in
  const handleStandardCheckIn = () => {
    if (!verifiedBooking) return
    onClose()
    if (onSuccess) {
      onSuccess(verifiedBooking.pnr, false)
    }
  }

  // Initiate Smart Check-In Flow
  const handleStartSmartCheckIn = () => {
    if (!verifiedBooking) return

    if (hasBiometricProfile) {
      // User already has registered face — execute 1-click smart check-in
      finalizeSmartCheckIn(biometricProfile?.biometricProfileId)
    } else {
      // Show intro screen
      setShowIntroModal(true)
    }
  }

  // Finalize Smart Check-In with Backend
  const finalizeSmartCheckIn = async (profileId?: string, faceEmbedding?: number[]) => {
    if (!verifiedBooking) return
    setSmartProcessing(true)
    setShowIntroModal(false)
    setShowFaceModal(false)

    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
      const primaryPax = verifiedBooking.passengers[0]
      const primaryLeg = verifiedBooking.legs[0]

      const res = await fetch("/api/checkin/smart", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          bookingId: verifiedBooking.id,
          passengerId: primaryPax?.id,
          flightInstanceId: primaryLeg?.flightInstanceId,
          pnr: verifiedBooking.pnr,
          biometricProfileId: profileId,
          faceEmbedding,
          passengerName: primaryPax?.name,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to complete Smart Check-In")
      }

      setSmartSuccess({
        pnr: verifiedBooking.pnr,
        passengerName: primaryPax?.name || "Traveler",
        flightNumber: primaryLeg?.flightNumber || "NVG101",
        airline: primaryLeg?.airline || "Navigo Airlines",
        route: `${primaryLeg?.origin} → ${primaryLeg?.destination}`,
        travelDate: primaryLeg?.travelDate,
        seat: verifiedBooking.seats[0]?.seatNumber || "Assigned",
        qrToken: data.qrToken,
      })
    } catch (err: any) {
      setError(err.message || "Failed to complete Smart Check-In")
    } finally {
      setSmartProcessing(false)
    }
  }

  const handleFinishSmart = () => {
    if (!smartSuccess) return
    onClose()
    if (onSuccess) {
      onSuccess(smartSuccess.pnr, true, smartSuccess.qrToken)
    }
  }

  return (
    <>
      <AnimatePresence>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#020617]/85 backdrop-blur-md"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ type: "spring", damping: 25, stiffness: 280 }}
            className="relative w-full max-w-lg bg-[#0A1424] border border-white/[0.12] rounded-3xl p-6 sm:p-7 shadow-[0_30px_90px_rgba(0,0,0,0.7)] z-10 overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-400 via-amber-400 to-emerald-400" />

            <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">🛫</span>
                <h3 className="font-display text-lg font-bold text-white">Online Web Check-In</h3>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/[0.05] border border-white/[0.1] text-slate-400 hover:text-white flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Smart Boarding Success View */}
            {smartSuccess ? (
              <div className="space-y-5 pt-4 text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-400/20 border border-emerald-400/40 flex items-center justify-center text-3xl mx-auto text-emerald-300 shadow-[0_0_30px_rgba(52,211,153,0.35)]">
                  ✓
                </div>
                <div>
                  <span className="text-[10px] font-mono font-bold tracking-widest text-emerald-400 uppercase bg-emerald-400/10 px-2.5 py-1 rounded-full border border-emerald-400/20">
                    IDENTITY VERIFIED
                  </span>
                  <h3 className="font-display text-xl sm:text-2xl font-black text-white mt-2 tracking-tight">
                    SMART BOARDING ENABLED ✓
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Your cryptographic boarding pass is ready for fast-track airport gate verification.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] text-left text-xs font-mono space-y-2.5">
                  <div className="flex justify-between pb-2 border-b border-white/[0.06]">
                    <span className="text-slate-400">Passenger:</span>
                    <strong className="text-white">{smartSuccess.passengerName}</strong>
                  </div>
                  <div className="flex justify-between pb-2 border-b border-white/[0.06]">
                    <span className="text-slate-400">Flight:</span>
                    <strong className="text-cyan-300">{smartSuccess.flightNumber} ({smartSuccess.airline})</strong>
                  </div>
                  <div className="flex justify-between pb-2 border-b border-white/[0.06]">
                    <span className="text-slate-400">Route:</span>
                    <strong className="text-white">{smartSuccess.route}</strong>
                  </div>
                  <div className="flex justify-between pb-2 border-b border-white/[0.06]">
                    <span className="text-slate-400">Travel Date:</span>
                    <strong className="text-white">{smartSuccess.travelDate}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Seat:</span>
                    <strong className="text-amber-300">{smartSuccess.seat}</strong>
                  </div>
                </div>

                <button
                  onClick={handleFinishSmart}
                  className="w-full py-3.5 rounded-2xl pill-cta text-xs font-bold shadow-[0_4px_20px_rgba(251,191,36,0.35)] flex items-center justify-center gap-2"
                >
                  <span>🎟️</span> View Boarding Pass & QR →
                </button>
              </div>
            ) : !verifiedBooking ? (
              /* Step 1: PNR Lookup Form */
              <form onSubmit={handleVerify} className="space-y-4 pt-4">
                <p className="text-xs text-slate-400">
                  Web check-in opens 48 hours before departure. Enter your booking details below.
                </p>

                <div>
                  <label className="text-[11px] uppercase tracking-wider text-slate-400 block mb-1.5 font-semibold">
                    PNR / Booking Reference
                  </label>
                  <input
                    type="text"
                    value={pnr}
                    onChange={(e) => setPnr(e.target.value.toUpperCase())}
                    placeholder="e.g. 6D9F2A"
                    maxLength={8}
                    className="w-full bg-white/[0.04] border border-white/[0.1] rounded-xl px-4 py-2.5 text-sm text-white font-mono uppercase tracking-widest placeholder:text-slate-600 focus:outline-none focus:border-amber-400/50"
                  />
                </div>

                <div>
                  <label className="text-[11px] uppercase tracking-wider text-slate-400 block mb-1.5 font-semibold">
                    Passenger Last Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="e.g. Sharma"
                    className="w-full bg-white/[0.04] border border-white/[0.1] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-400/50"
                  />
                </div>

                {error && (
                  <p className="text-xs text-rose-300 bg-rose-400/10 border border-rose-400/20 rounded-lg p-2.5">
                    {error}
                  </p>
                )}

                <div className="flex items-center justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-full border border-white/[0.1] text-xs font-semibold text-slate-300 hover:bg-white/[0.05]"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={checking}
                    className="px-5 py-2 rounded-full pill-cta text-xs font-bold shadow-[0_2px_12px_rgba(251,191,36,0.3)] flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {checking ? "Verifying Booking…" : "Find Booking →"}
                  </button>
                </div>
              </form>
            ) : (
              /* Step 2: Verified Booking Preview & Smart Check-In Selection */
              <div className="space-y-5 pt-4">
                {/* Flight & Passenger Info Card */}
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] relative overflow-hidden">
                  <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
                    <div>
                      <span className="text-[10px] font-mono text-cyan-300 uppercase tracking-wider font-semibold">
                        {verifiedBooking.legs[0]?.airline || "Navigo Airlines"} · {verifiedBooking.legs[0]?.flightNumber}
                      </span>
                      <h4 className="font-display text-lg font-bold text-white mt-0.5">
                        {verifiedBooking.legs[0]?.origin} → {verifiedBooking.legs[0]?.destination}
                      </h4>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block font-mono">PNR</span>
                      <span className="font-display text-sm font-bold text-amber-300 tracking-wider">
                        {verifiedBooking.pnr}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-3 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase">Travel Date</span>
                      <span className="font-semibold text-slate-200">{verifiedBooking.legs[0]?.travelDate}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase">Primary Traveler</span>
                      <span className="font-semibold text-slate-200 truncate block">
                        {verifiedBooking.passengers[0]?.name || "Traveler"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase">Seat</span>
                      <span className="font-semibold text-amber-300">
                        {verifiedBooking.seats[0]?.seatNumber || "Assigned at Gate"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Biometric Status Pill */}
                {hasBiometricProfile ? (
                  <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs">
                    <span className="text-base">✓</span>
                    <span>Active Face Profile Found. Eligible for 1-click Smart Boarding.</span>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-2xl bg-amber-400/[0.08] border border-amber-400/20 text-xs">
                    <div className="font-bold text-amber-300 flex items-center gap-1.5">
                      <span>✨</span> SMART CHECK-IN
                    </div>
                    <p className="text-slate-300 mt-1">
                      Make your airport journey faster with Navigo Smart Boarding.
                    </p>
                  </div>
                )}

                {error && (
                  <p className="text-xs text-rose-300 bg-rose-400/10 border border-rose-400/20 rounded-lg p-2.5">
                    {error}
                  </p>
                )}

                {/* Check-In Action Choices */}
                <div className="space-y-3 pt-2">
                  {/* Primary Premium CTA: Smart Check-In */}
                  <button
                    onClick={handleStartSmartCheckIn}
                    disabled={smartProcessing}
                    className="w-full py-3 px-5 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 text-slate-950 font-bold text-sm shadow-[0_4px_20px_rgba(251,191,36,0.4)] hover:shadow-[0_6px_25px_rgba(251,191,36,0.6)] hover:scale-[1.01] transition-all flex items-center justify-between group disabled:opacity-50"
                  >
                    <div className="flex items-center gap-3 text-left">
                      <span className="w-8 h-8 rounded-xl bg-slate-950/10 flex items-center justify-center text-lg">
                        👤
                      </span>
                      <div>
                        <div className="font-extrabold tracking-tight flex items-center gap-2">
                          <span>Proceed with Smart Check-In</span>
                          <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-950/15 tracking-wider">
                            FAST-TRACK
                          </span>
                        </div>
                        <span className="text-[11px] font-normal text-slate-800">
                          {hasBiometricProfile ? "1-Click verification using existing face profile" : "Biometric registration & secure gate clearance"}
                        </span>
                      </div>
                    </div>
                    <span className="text-base group-hover:translate-x-1 transition-transform">→</span>
                  </button>

                  {/* Secondary Option: Standard Check-In */}
                  <button
                    onClick={handleStandardCheckIn}
                    disabled={smartProcessing}
                    className="w-full py-2.5 px-4 rounded-xl border border-white/[0.1] text-xs font-semibold text-slate-300 hover:bg-white/[0.04] hover:text-white transition-colors flex items-center justify-center gap-2"
                  >
                    <span>Continue with Standard Check-In</span>
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </AnimatePresence>

      {/* Sub-modals for Smart Check-In Flow */}
      <SmartCheckInIntroModal
        isOpen={showIntroModal}
        onClose={() => setShowIntroModal(false)}
        onContinue={() => {
          setShowIntroModal(false)
          setShowFaceModal(true)
        }}
        onDecline={() => {
          setShowIntroModal(false)
          handleStandardCheckIn()
        }}
      />

      <FaceRegistrationModal
        isOpen={showFaceModal}
        onClose={() => setShowFaceModal(false)}
        passengerName={verifiedBooking?.passengers[0]?.name}
        pnr={verifiedBooking?.pnr}
        onComplete={({ faceEmbedding, profileId }) => {
          finalizeSmartCheckIn(profileId, faceEmbedding)
        }}
      />
    </>
  )
}
