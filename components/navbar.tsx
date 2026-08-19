"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter, usePathname } from "next/navigation"

const CURRENCIES = [
  { code: "INR", symbol: "₹", label: "Indian Rupee" },
  { code: "USD", symbol: "$", label: "US Dollar" },
  { code: "EUR", symbol: "€", label: "Euro" },
  { code: "AED", symbol: "د.إ", label: "UAE Dirham" },
]

export default function Navbar() {
  const router = useRouter()
  const pathname = usePathname()

  const [user, setUser] = useState<any>(null)
  const [currency, setCurrency] = useState(CURRENCIES[0])
  const [currencyOpen, setCurrencyOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

  const currencyRef = useRef<HTMLDivElement>(null)
  const profileRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const token = localStorage.getItem("token")

    if (!token) return

    fetch("/api/auth/me", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(res => res.json())
      .then(data => {
        if (data.user) setUser(data.user)
      })
  }, [])

  // close either dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (currencyRef.current && !currencyRef.current.contains(e.target as Node)) setCurrencyOpen(false)
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const handleLogout = () => {
    localStorage.removeItem("token")
    router.push("/login")
  }

  const initials = (user?.name as string | undefined)
    ?.trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || null

  return (
    <div className="fixed top-0 left-0 w-full z-50 bg-[#060B14]/85 backdrop-blur-xl border-b border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.25)]">
      {/* signature accent bar — same blue → gold pairing used across the
          checkout flow, so the navbar reads as part of the same product
          instead of a bare dark header. */}
      <div className="h-[2px] w-full bg-gradient-to-r from-blue-400 via-amber-400 to-amber-300" />

      <div className="max-w-7xl mx-auto flex justify-between items-center px-6 md:px-10 py-2.5">

        {/* LOGO */}
        <div
          onClick={() => router.push("/")}
          className="flex items-center gap-3.5 cursor-pointer group shrink-0"
        >
          <div className="relative">
            <span className="absolute inset-0 rounded-full bg-amber-400/20 blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative rounded-full ring-1 ring-amber-300/25 group-hover:ring-amber-300/50 transition-all duration-300">
              <img
                src="/logo.png"
                alt="Navigo"
                className="relative w-16 h-16 object-contain transition-transform duration-300 group-hover:scale-105"
              />
            </div>
          </div>

          <div className="leading-tight">
            <h1 className="text-lg font-bold tracking-[0.08em] text-white">
              NAVIGO
            </h1>
            <p className="text-[11px] text-amber-300/70 font-medium tracking-wide">
              Your Travel Partner
            </p>
          </div>
        </div>

        {/* CENTER NAV */}
        <div className="hidden md:flex items-center gap-1 text-sm bg-white/[0.03] border border-white/[0.06] rounded-full px-1.5 py-1.5">

          <button
            onClick={() => router.push("/")}
            className={`relative px-4 py-1.5 rounded-full font-medium transition-all duration-200 ${
              pathname === "/"
                ? "text-[#060B14] bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 shadow-[0_2px_12px_rgba(251,191,36,0.35)]"
                : "text-slate-400 hover:text-white hover:bg-white/[0.05]"
            }`}
          >
            Home
          </button>

          {/* ✅ Replaced the old "Flights" tab (which only enabled once a
              search was already in progress) with a direct link to the
              dashboard — always available, no gating condition needed. */}
          <button
            onClick={() => router.push("/dashboard")}
            className={`relative px-4 py-1.5 rounded-full font-medium transition-all duration-200 ${
              pathname === "/dashboard"
                ? "text-[#060B14] bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 shadow-[0_2px_12px_rgba(251,191,36,0.35)]"
                : "text-slate-400 hover:text-white hover:bg-white/[0.05]"
            }`}
          >
            Dashboard
          </button>

          <button
            onClick={() => router.push("/my-trips")}
            className={`relative px-4 py-1.5 rounded-full font-medium transition-all duration-200 ${
              pathname === "/my-trips" || pathname === "/trips"
                ? "text-[#060B14] bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 shadow-[0_2px_12px_rgba(251,191,36,0.35)]"
                : "text-slate-400 hover:text-white hover:bg-white/[0.05]"
            }`}
          >
            My Trips
          </button>

          <button
            onClick={() => router.push("/check-in")}
            className={`relative px-3.5 py-1.5 rounded-full font-medium transition-all duration-200 flex items-center gap-1.5 ${
              pathname === "/check-in"
                ? "text-[#060B14] bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 shadow-[0_2px_12px_rgba(251,191,36,0.35)]"
                : "text-slate-400 hover:text-white hover:bg-white/[0.05]"
            }`}
          >
            <span>Check-In</span>
            <span className="text-[8.5px] font-mono font-bold bg-amber-400/20 text-amber-300 px-1 py-[0.5px] rounded tracking-wider">
              FAST
            </span>
          </button>

          <p className="px-4 py-1.5 rounded-full font-medium text-slate-400 hover:text-white hover:bg-white/[0.05] cursor-pointer transition-all duration-200">
            Deals
          </p>

          <div className="flex items-center gap-1.5 pl-4 pr-3 py-1.5 rounded-full font-medium text-slate-400 hover:text-white hover:bg-white/[0.05] cursor-pointer transition-all duration-200">
            NavBot
            <span className="text-[9px] font-bold bg-cyan-400/15 text-cyan-300 px-1.5 py-[1px] rounded-full tracking-wide navbot-pulse">
              NEW
            </span>
          </div>

        </div>

        {/* RIGHT */}
        <div className="flex items-center gap-3 md:gap-4 shrink-0">

          {/* Currency — was a dead "USD" label; now a real INR-default
              switcher styled like the rest of the site's dark popovers. */}
          <div className="relative hidden sm:block" ref={currencyRef}>
            <button
              onClick={() => setCurrencyOpen((v) => !v)}
              className={`flex items-center gap-1.5 text-sm px-2.5 py-1.5 rounded-full border transition-colors ${
                currencyOpen
                  ? "text-amber-300 border-amber-400/30 bg-amber-400/[0.08]"
                  : "text-slate-300 border-transparent hover:text-white hover:bg-white/[0.05]"
              }`}
            >
              <span className="font-semibold">{currency.symbol}</span>
              {currency.code}
              <svg
                width="10" height="10" viewBox="0 0 10 10" fill="none"
                className={`opacity-60 transition-transform duration-200 ${currencyOpen ? "rotate-180" : ""}`}
              >
                <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {currencyOpen && (
              <div className="absolute right-0 mt-2 w-44 bg-gradient-to-b from-[#0D1A2C] to-[#0A1424] border border-white/[0.08] rounded-xl shadow-[0_16px_48px_rgba(0,0,0,0.4)] overflow-hidden py-1.5 dropdown-in">
                {CURRENCIES.map((c) => (
                  <button
                    key={c.code}
                    onClick={() => { setCurrency(c); setCurrencyOpen(false) }}
                    className={`w-full flex items-center justify-between px-3.5 py-2 text-sm transition-colors ${
                      c.code === currency.code
                        ? "text-amber-300 bg-amber-400/[0.08]"
                        : "text-slate-300 hover:text-white hover:bg-white/[0.04]"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="font-semibold w-5">{c.symbol}</span>
                      {c.label}
                    </span>
                    {c.code === currency.code && <span aria-hidden>✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Theme toggle */}
          <button
            aria-label="Toggle theme"
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-300 hover:text-amber-300 hover:bg-white/[0.05] transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          <div className="w-px h-6 bg-white/[0.08] hidden sm:block" />

          {/* PROFILE — now a real dropdown instead of static "Hi, X /
              Logout" text sitting permanently in the header. */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setProfileOpen((v) => !v)}
              className="flex items-center gap-2.5 group"
            >
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all ${
                  user
                    ? "bg-gradient-to-br from-amber-300 to-amber-500 text-[#060B14] shadow-[0_0_14px_rgba(251,191,36,0.3)]"
                    : "bg-white/[0.06] text-slate-500 border border-white/[0.1]"
                } ${profileOpen ? "ring-2 ring-amber-300/50 ring-offset-2 ring-offset-[#060B14]" : ""}`}
              >
                {initials ?? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 12a4.5 4.5 0 100-9 4.5 4.5 0 000 9zM4 20.5c0-3.6 3.6-6.5 8-6.5s8 2.9 8 6.5"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>

              <div className="hidden md:block leading-tight text-left">
                <p className="text-sm text-white font-medium">
                  {user ? `Hi, ${user.name}` : "Guest"}
                </p>
                <p className="text-[11px] text-slate-500">
                  {user ? "My account" : "Sign in"}
                </p>
              </div>

              <svg
                width="10" height="10" viewBox="0 0 10 10" fill="none"
                className={`hidden md:block opacity-50 text-slate-400 transition-transform duration-200 ${profileOpen ? "rotate-180" : ""}`}
              >
                <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {profileOpen && (
              <div className="absolute right-0 mt-2 w-52 bg-gradient-to-b from-[#0D1A2C] to-[#0A1424] border border-white/[0.08] rounded-xl shadow-[0_16px_48px_rgba(0,0,0,0.4)] overflow-hidden dropdown-in">
                {user ? (
                  <>
                    <div className="px-4 py-3 border-b border-white/[0.06]">
                      <p className="text-sm text-white font-medium truncate">{user.name}</p>
                      {user.email && <p className="text-[11px] text-slate-500 truncate mt-0.5">{user.email}</p>}
                    </div>
                    <button
                      onClick={() => { setProfileOpen(false); router.push("/my-trips") }}
                      className="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-white/[0.04] transition-colors flex items-center gap-2.5"
                    >
                      <span aria-hidden>🧳</span> My Trips
                    </button>
                    <button
                      onClick={() => { setProfileOpen(false); router.push("/account") }}
                      className="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-white/[0.04] transition-colors flex items-center gap-2.5"
                    >
                      <span aria-hidden>⚙</span> Account Settings
                    </button>
                    <div className="border-t border-white/[0.06]" />
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2.5 text-sm text-rose-400 hover:text-rose-300 hover:bg-rose-400/[0.06] transition-colors flex items-center gap-2.5"
                    >
                      <span aria-hidden>↪</span> Logout
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => { setProfileOpen(false); router.push("/login") }}
                    className="w-full text-left px-4 py-3 text-sm text-amber-300 hover:bg-amber-400/[0.08] transition-colors flex items-center gap-2.5"
                  >
                    <span aria-hidden>→</span> Sign in
                  </button>
                )}
              </div>
            )}
          </div>

        </div>

      </div>

      <style jsx global>{`
        @keyframes dropdownIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        .dropdown-in { animation: dropdownIn 160ms ease-out; }
        @keyframes navbotPulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(34,211,238,0.35); } 50% { box-shadow: 0 0 0 4px rgba(34,211,238,0); } }
        .navbot-pulse { animation: navbotPulse 2.2s ease-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .dropdown-in, .navbot-pulse { animation: none !important; }
        }
      `}</style>
    </div>
  )
}