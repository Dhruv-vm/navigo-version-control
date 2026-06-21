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

  return (
    <div className="fixed top-0 left-0 w-full z-50 
    bg-[#020617]/80 backdrop-blur-md border-b border-white/10">

      <div className="max-w-7xl mx-auto flex justify-between items-center px-10 py-4">

        {/* 🔷 LEFT (LOGO) */}
        <div
          onClick={() => router.push("/")}
          className="flex items-center gap-5 cursor-pointer group"
        >
          <img
            src="/logo.png"
            alt="Navigo"
            className="w-14 h-14 object-contain transition group-hover:scale-105"
          />

          <div className="leading-tight">
            <h1 className="text-xl font-bold tracking-wide text-white">
              NAVIGO
            </h1>
            <p className="text-xs text-blue-400">
              Your Travel Partner
            </p>
          </div>
        </div>

        {/* 🔷 CENTER NAV */}
        <div className="hidden md:flex gap-8 text-sm relative">

          {/* HOME */}
          <button
            onClick={() => router.push("/")}
            className={`relative pb-1 transition ${
              pathname === "/"
                ? "text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Home
            {pathname === "/" && (
              <span className="absolute left-0 bottom-0 w-full h-[2px] bg-blue-400 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.7)]" />
            )}
          </button>

          {/* FLIGHTS */}
          <button
            onClick={() => {
              if (hasSearch) {
                router.push(`/flights?${searchParams.toString()}`)
              }
            }}
            title={!hasSearch ? "Search flights first" : ""}
            className={`relative pb-1 transition ${
              pathname === "/flights"
                ? "text-white"
                : hasSearch
                ? "text-gray-400 hover:text-white"
                : "text-gray-600 cursor-not-allowed"
            }`}
          >
            Flights
            {pathname === "/flights" && (
              <span className="absolute left-0 bottom-0 w-full h-[2px] bg-blue-400 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.7)]" />
            )}
          </button>

          {/* DEALS */}
          <p className="text-gray-400 hover:text-white cursor-pointer transition">
            Deals
          </p>

          {/* TRIPS */}
          <p className="text-gray-400 hover:text-white cursor-pointer transition">
            My Trips
          </p>

          {/* NAVBOT */}
          <div className="flex items-center gap-1 text-gray-400 hover:text-white cursor-pointer transition">
            NavBot
            <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-[2px] rounded-full">
              NEW
            </span>
          </div>

        </div>

        {/* 🔷 RIGHT */}
        <div className="flex items-center gap-6 text-gray-300 text-sm">

          {/* Currency */}
          <span className="hover:text-white cursor-pointer transition">
            USD ▾
          </span>

          {/* Theme */}
          <span className="cursor-pointer text-lg hover:scale-110 transition">
            🌙
          </span>

          {/* PROFILE */}
          <div className="flex items-center gap-3">

            <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center border border-white/10">
              👤
            </div>

            <div className="hidden md:block leading-tight">
              <p className="text-sm text-white">
                Hi, {user?.name || "Traveler"}
              </p>

              {user ? (
                <button
                  onClick={handleLogout}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Logout
                </button>
              ) : (
                <p className="text-xs text-gray-400">
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