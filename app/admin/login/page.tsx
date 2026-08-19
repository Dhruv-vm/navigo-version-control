"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { motion } from "framer-motion"
import { DEMO_ADMIN_ACCOUNTS, verifyAdminCredentials } from "@/lib/admin-auth"

export default function AdminLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("admin@navigo.app")
  const [password, setPassword] = useState("admin")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const user = verifyAdminCredentials(email, password)
    if (user) {
      if (typeof window !== "undefined") {
        localStorage.setItem("navigo_admin_session", JSON.stringify(user))
      }
      setTimeout(() => {
        router.push("/admin")
      }, 500)
    } else {
      setLoading(false)
      setError("Invalid administrative credentials. Use the 1-Click Demo accounts below.")
    }
  }

  const handleQuickLogin = (demoAccount: typeof DEMO_ADMIN_ACCOUNTS[0]) => {
    setEmail(demoAccount.email)
    setPassword(demoAccount.password)
    if (typeof window !== "undefined") {
      localStorage.setItem(
        "navigo_admin_session",
        JSON.stringify({
          id: demoAccount.id,
          name: demoAccount.name,
          email: demoAccount.email,
          role: demoAccount.role,
          badgeNumber: demoAccount.badgeNumber,
          department: demoAccount.department,
          lastActive: new Date().toISOString(),
        })
      )
    }
    router.push("/admin")
  }

  return (
    <div className="min-h-screen bg-[#030712] text-slate-100 flex flex-col justify-between p-4 sm:p-6 relative overflow-hidden font-mono selection:bg-amber-400/30 selection:text-amber-200">
      {/* Ambient background glows */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-30" />
      <div className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-cyan-500/10 blur-[160px] rounded-full" />
      <div className="pointer-events-none absolute bottom-10 right-10 w-[400px] h-[300px] bg-amber-500/10 blur-[140px] rounded-full" />

      {/* Top Bar */}
      <header className="relative z-10 flex items-center justify-between max-w-5xl mx-auto w-full py-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-400/20 via-cyan-400/20 to-emerald-400/20 border border-amber-300/30 flex items-center justify-center text-xl shadow-[0_0_20px_rgba(251,191,36,0.2)]">
            ✈️
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display font-black text-sm tracking-[0.1em] text-white">NAVIGO</span>
              <span className="text-[9px] font-bold bg-amber-400/15 text-amber-300 px-1.5 py-[1px] rounded border border-amber-400/30 tracking-wider">
                ADMIN CONSOLE
              </span>
            </div>
            <span className="text-[10px] text-slate-500">AIRPORT OPERATIONS SYSTEM</span>
          </div>
        </Link>

        <Link
          href="/"
          className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1"
        >
          ← Back to Passenger App
        </Link>
      </header>

      {/* Main Login Card */}
      <main className="relative z-10 max-w-lg mx-auto w-full my-auto py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 sm:p-8 rounded-3xl bg-[#070E1C]/90 border border-white/[0.12] shadow-[0_20px_60px_rgba(0,0,0,0.6)] backdrop-blur-xl"
        >
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-2xl mx-auto mb-3">
              🔒
            </div>
            <h1 className="font-display text-xl font-bold text-white tracking-tight">
              Airport Command Authentication
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Restricted portal for flight controllers, gate security, and reservations staff.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 text-xs">
            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">
                Authorized Staff Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@navigo.app"
                className="w-full bg-[#030712] border border-white/[0.12] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-amber-400/60 transition-colors"
              />
            </div>

            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">
                Security Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#030712] border border-white/[0.12] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-amber-400/60 transition-colors"
              />
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-[11px]">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 via-amber-400 to-amber-500 text-slate-950 font-bold text-xs shadow-[0_2px_14px_rgba(251,191,36,0.35)] hover:brightness-110 transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
            >
              {loading ? "Authenticating Staff Badge…" : "Access Operations Command Center →"}
            </button>
          </form>

          {/* 1-Click Role Quick Login */}
          <div className="pt-6 border-t border-white/[0.08] mt-6">
            <span className="text-[10px] uppercase text-slate-500 font-bold block mb-3 text-center tracking-wider">
              1-Click Role Quick Access (Demo Accounts)
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {DEMO_ADMIN_ACCOUNTS.map((acc) => (
                <button
                  key={acc.id}
                  onClick={() => handleQuickLogin(acc)}
                  className="p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] text-left transition-all group flex items-start gap-2"
                >
                  <span className="text-base mt-0.5">
                    {acc.role === "SUPER_ADMIN"
                      ? "👑"
                      : acc.role === "FLIGHT_OPERATIONS"
                      ? "✈️"
                      : acc.role === "BOOKING_AGENT"
                      ? "🎫"
                      : acc.role === "FINANCE"
                      ? "💰"
                      : "🚪"}
                  </span>
                  <div className="overflow-hidden">
                    <div className="text-[11px] font-bold text-white group-hover:text-amber-300 transition-colors truncate">
                      {acc.role.replace("_", " ")}
                    </div>
                    <span className="text-[9px] text-slate-400 block font-mono">
                      {acc.email} / {acc.password}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 text-center text-[10px] text-slate-600 py-4">
        NAVIGO AIRPORT OPERATIONS COMMAND SYSTEM · NODE DEL-T3 · ENCRYPTED SHA-256 SESSION
      </footer>
    </div>
  )
}
