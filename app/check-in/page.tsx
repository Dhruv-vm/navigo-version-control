"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import Navbar from "@/components/navbar"
import CheckInModal from "@/components/CheckInModal"
import BoardingPassModal, { ModalBooking } from "@/components/BoardingPassModal"

export default function CheckInPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialPnr = searchParams.get("pnr") || ""

  const [pnrInput, setPnrInput] = useState(initialPnr)
  const [lastNameInput, setLastNameInput] = useState("")
  const [checkInModalOpen, setCheckInModalOpen] = useState(false)
  const [selectedPnr, setSelectedPnr] = useState(initialPnr)

  // Boarding Pass modal
  const [activeBooking, setActiveBooking] = useState<ModalBooking | null>(null)
  const [passModalOpen, setPassModalOpen] = useState(false)
  const [upcomingTrips, setUpcomingTrips] = useState<any[]>([])

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) return

    fetch("/api/bookings", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        const list = Array.isArray(data) ? data : data?.bookings ?? []
        const now = Date.now()
        const upcoming = list.filter(
          (b: any) => b.travelDate && new Date(b.travelDate).getTime() >= now && b.status === "confirmed"
        )
        setUpcomingTrips(upcoming)
      })
      .catch(() => {})
  }, [])

  const handleLaunchCheckIn = (pnrToUse?: string) => {
    setSelectedPnr((pnrToUse || pnrInput).trim().toUpperCase())
    setCheckInModalOpen(true)
  }

  const handleCheckInSuccess = async (pnr: string, isSmart?: boolean, qrToken?: string) => {
    // Fetch full booking for boarding pass preview
    try {
      const token = localStorage.getItem("token")
      const res = await fetch("/api/checkin/verify-pnr", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ pnr }),
      })
      const data = await res.json()
      if (data?.booking) {
        setActiveBooking(data.booking)
        setPassModalOpen(true)
      }
    } catch {
      // Fallback
    }
  }

  return (
    <div className="min-h-screen bg-[#040812] text-slate-100 selection:bg-amber-400/30 selection:text-amber-200">
      <Navbar />

      <main className="relative pt-28 pb-20 px-4 sm:px-6 max-w-6xl mx-auto">
        {/* Ambient Glows */}
        <div className="pointer-events-none absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-amber-400/10 blur-[130px] rounded-full" />
        <div className="pointer-events-none absolute top-40 right-10 w-[400px] h-[300px] bg-cyan-400/10 blur-[110px] rounded-full" />

        {/* Hero Section */}
        <div className="text-center max-w-2xl mx-auto pt-6 pb-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-400/10 border border-cyan-400/25 text-cyan-300 text-xs font-mono font-bold tracking-widest uppercase mb-4 shadow-[0_0_20px_rgba(56,189,248,0.2)]">
            <span>⚡</span> NAVIGO SMART CHECK-IN
          </div>
          <h1 className="font-display text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
            Seamless Airport Check-In & Face Boarding
          </h1>
          <p className="text-sm sm:text-base text-slate-400 mt-3 leading-relaxed">
            Enter your PNR reference to retrieve your boarding pass, enable biometric fast-track e-gates, and breeze through security checkpoints.
          </p>
        </div>

        {/* Central Search Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="max-w-xl mx-auto bg-gradient-to-b from-[#0B1528] to-[#070E1C] border border-white/[0.12] rounded-3xl p-6 sm:p-8 shadow-[0_30px_90px_rgba(0,0,0,0.6)] relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-400 via-amber-400 to-emerald-400" />

          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleLaunchCheckIn()
            }}
            className="space-y-4"
          >
            <div>
              <label className="text-[11px] uppercase tracking-wider text-slate-400 block mb-1.5 font-semibold">
                PNR / Booking Reference
              </label>
              <input
                type="text"
                value={pnrInput}
                onChange={(e) => setPnrInput(e.target.value.toUpperCase())}
                placeholder="e.g. 6D9F2A"
                maxLength={8}
                className="w-full bg-white/[0.04] border border-white/[0.12] rounded-2xl px-5 py-3.5 text-base text-white font-mono uppercase tracking-widest placeholder:text-slate-600 focus:outline-none focus:border-amber-400/60"
              />
            </div>

            <div>
              <label className="text-[11px] uppercase tracking-wider text-slate-400 block mb-1.5 font-semibold">
                Passenger Last Name (Optional)
              </label>
              <input
                type="text"
                value={lastNameInput}
                onChange={(e) => setLastNameInput(e.target.value)}
                placeholder="e.g. Sharma"
                className="w-full bg-white/[0.04] border border-white/[0.12] rounded-2xl px-5 py-3.5 text-base text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-400/60"
              />
            </div>

            <button
              type="submit"
              disabled={!pnrInput.trim()}
              className="w-full py-4 rounded-2xl pill-cta text-sm font-bold shadow-[0_4px_20px_rgba(251,191,36,0.35)] flex items-center justify-center gap-2 mt-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span>🛫</span> Find Booking & Start Check-In →
            </button>
          </form>

          {/* Quick upcoming flights chips */}
          {upcomingTrips.length > 0 && (
            <div className="mt-6 pt-5 border-t border-white/[0.08]">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 block mb-2">
                Your Upcoming Flights
              </span>
              <div className="flex flex-wrap gap-2">
                {upcomingTrips.map((trip) => (
                  <button
                    key={trip.id}
                    onClick={() => handleLaunchCheckIn(trip.pnr)}
                    className="px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:border-amber-400/40 hover:bg-white/[0.08] text-xs font-mono text-slate-300 flex items-center gap-2 transition-all"
                  >
                    <span className="text-amber-300 font-bold">{trip.pnr}</span>
                    <span className="text-slate-500">·</span>
                    <span>{trip.legs?.[0]?.origin || "DEL"} → {trip.legs?.[0]?.destination || "BLR"}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </motion.div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-16 max-w-5xl mx-auto">
          <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] transition-colors">
            <div className="w-12 h-12 rounded-2xl bg-cyan-400/10 border border-cyan-400/20 text-cyan-300 flex items-center justify-center text-xl mb-4">
              👤
            </div>
            <h3 className="font-display text-base font-bold text-white">Apple-Style Face ID</h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Register once and use your biometric profile across all future flights. Zero physical document friction.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] transition-colors">
            <div className="w-12 h-12 rounded-2xl bg-amber-400/10 border border-amber-400/20 text-amber-300 flex items-center justify-center text-xl mb-4">
              ⚡
            </div>
            <h3 className="font-display text-base font-bold text-white">DigiYatra Express Gates</h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Bypass terminal queues with automated e-gate facial recognition at Delhi, Bengaluru, and Dubai.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] transition-colors">
            <div className="w-12 h-12 rounded-2xl bg-emerald-400/10 border border-emerald-400/20 text-emerald-300 flex items-center justify-center text-xl mb-4">
              🛡️
            </div>
            <h3 className="font-display text-base font-bold text-white">Cryptographic QR Pass</h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Every boarding pass includes a 256-bit HMAC signed token to guarantee authenticity and prevent tampering.
            </p>
          </div>
        </div>
      </main>

      {/* CheckIn Modal */}
      <CheckInModal
        isOpen={checkInModalOpen}
        onClose={() => setCheckInModalOpen(false)}
        defaultPnr={selectedPnr}
        onSuccess={handleCheckInSuccess}
      />

      {/* Boarding Pass Modal */}
      <BoardingPassModal
        booking={activeBooking}
        isOpen={passModalOpen}
        onClose={() => setPassModalOpen(false)}
      />
    </div>
  )
}
