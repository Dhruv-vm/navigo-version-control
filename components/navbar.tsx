"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"

export default function Navbar() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [user, setUser] = useState<any>(null)

  // ✅ detect if search exists
  const hasSearch =
    searchParams.get("origin") &&
    searchParams.get("destination") &&
    searchParams.get("depart")

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
      <div className="max-w-7xl mx-auto flex justify-between items-center px-6 md:px-10 py-2.5">

        {/* LOGO */}
        <div
          onClick={() => router.push("/")}
          className="flex items-center gap-3.5 cursor-pointer group shrink-0"
        >
          <div className="relative">
            <span className="absolute inset-0 rounded-full bg-amber-400/20 blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <img
              src="/logo.png"
              alt="Navigo"
              className="relative w-16 h-16 object-contain transition-transform duration-300 group-hover:scale-105"
            />
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

          <button
            onClick={() => {
              if (hasSearch) {
                router.push(`/flights?${searchParams.toString()}`)
              }
            }}
            title={!hasSearch ? "Search flights first" : ""}
            className={`relative px-4 py-1.5 rounded-full font-medium transition-all duration-200 ${
              pathname === "/flights"
                ? "text-[#060B14] bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 shadow-[0_2px_12px_rgba(251,191,36,0.35)]"
                : hasSearch
                ? "text-slate-400 hover:text-white hover:bg-white/[0.05]"
                : "text-slate-600 cursor-not-allowed"
            }`}
          >
            Flights
          </button>

          <p className="px-4 py-1.5 rounded-full font-medium text-slate-400 hover:text-white hover:bg-white/[0.05] cursor-pointer transition-all duration-200">
            Deals
          </p>

          <p className="px-4 py-1.5 rounded-full font-medium text-slate-400 hover:text-white hover:bg-white/[0.05] cursor-pointer transition-all duration-200">
            My Trips
          </p>

          <div className="flex items-center gap-1.5 pl-4 pr-3 py-1.5 rounded-full font-medium text-slate-400 hover:text-white hover:bg-white/[0.05] cursor-pointer transition-all duration-200">
            NavBot
            <span className="text-[9px] font-bold bg-cyan-400/15 text-cyan-300 px-1.5 py-[1px] rounded-full tracking-wide">
              NEW
            </span>
          </div>

        </div>

        {/* RIGHT */}
        <div className="flex items-center gap-4 md:gap-5 shrink-0">

          {/* Currency */}
          <button className="hidden sm:flex items-center gap-1 text-sm text-slate-300 hover:text-white transition-colors">
            USD
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="opacity-60">
              <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

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

          {/* PROFILE */}
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                user
                  ? "bg-gradient-to-br from-amber-300 to-amber-500 text-[#060B14] shadow-[0_0_14px_rgba(251,191,36,0.3)]"
                  : "bg-white/[0.06] text-slate-500 border border-white/[0.1]"
              }`}
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

            <div className="hidden md:block leading-tight">
              <p className="text-sm text-white font-medium">
                Hi, {user?.name || "Traveler"}
              </p>

              {user ? (
                <button
                  onClick={handleLogout}
                  className="text-xs text-red-400/90 hover:text-red-300 transition-colors"
                >
                  Logout
                </button>
              ) : (
                <p className="text-xs text-slate-500">
                  Guest
                </p>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  )
}