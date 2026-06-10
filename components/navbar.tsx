"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

export default function Navbar() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)

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
        if (data.user) {
          setUser(data.user)
        }
      })
  }, [])

  const handleLogout = () => {
    localStorage.removeItem("token")
    router.push("/login")
  }

  return (
    <div className="w-full flex justify-between items-center px-12 py-5 
    bg-[#020617]/80 backdrop-blur-md border-b border-white/10">

      {/* LEFT (LOGO + TEXT) */}
      <div className="flex items-center gap-6 ml-3">
        <img
          src="/logo.png"
          alt="Navigo"
          className="w-16 h-16 object-contain scale-110"
        />

        <div className="leading-tight">
          <h1 className="text-2xl font-bold tracking-wide text-white">
            NAVIGO
          </h1>
          <p className="text-sm text-blue-400">
            Your Travel Partner
          </p>
        </div>
      </div>

      {/* CENTER */}
      <div className="hidden md:flex gap-10 text-gray-300 text-sm">
        <p className="text-blue-400 border-b border-blue-400 pb-1 cursor-pointer">
          Home
        </p>
        <p className="hover:text-white cursor-pointer transition duration-200">
          Flights
        </p>
        <p className="hover:text-white cursor-pointer transition duration-200">
          Deals
        </p>
        <p className="hover:text-white cursor-pointer transition duration-200">
          My Trips
        </p>
        <p className="hover:text-white cursor-pointer transition duration-200 flex items-center gap-1">
          NavBot
          <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-[2px] rounded-full">
            NEW
          </span>
        </p>
      </div>

      {/* RIGHT */}
      <div className="flex items-center gap-6 text-gray-300 text-sm">

        {/* Currency */}
        <span className="hover:text-white cursor-pointer transition">
          USD ▾
        </span>

        {/* Theme toggle */}
        <span className="cursor-pointer text-lg hover:scale-110 transition">
          🌙
        </span>

        {/* Profile */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-md border border-white/10">
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
  )
}