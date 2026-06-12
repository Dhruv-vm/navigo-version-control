"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Navbar from "@/components/navbar"
import SearchBox from "@/components/searchbox"

export default function Home() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem("token")

      if (!token) {
        router.replace("/login")
        return
      }

      try {
        const res = await fetch("/api/auth/me", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (!res.ok) {
          localStorage.removeItem("token")
          router.replace("/login")
          return
        }

        setLoading(false)
      } catch (err) {
        localStorage.removeItem("token")
        router.replace("/login")
      }
    }

    checkAuth()
  }, [router])

  // 🔥 LOADING SCREEN
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#020617] text-white">
        <div className="animate-pulse text-lg">Loading Navigo...</div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen text-white overflow-hidden bg-[#020617]">

      {/* 🌌 BACKGROUND */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <img
          src="/hero-bg.png"
          alt="background"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#020617]/90 via-[#020617]/70 to-transparent" />
        <div className="absolute inset-0 bg-[#020617]/30" />
      </div>

      {/* 🔥 CONTENT WRAPPER (IMPORTANT) */}
      <div className="relative z-10">

        {/* 🧭 NAVBAR */}
        <Navbar />

        {/* ✨ HERO */}
        <div className="max-w-7xl mx-auto px-10 pt-24 pb-10">
          <h1 className="text-6xl font-bold leading-tight max-w-2xl">
            Where will your{" "}
            <span className="bg-gradient-to-r from-blue-400 via-cyan-300 to-yellow-400 text-transparent bg-clip-text">
              journey take you?
            </span>
          </h1>

          <p className="mt-5 text-gray-400 text-lg">
            Smart booking. Dynamic pricing. Personalized for you.
          </p>

          <button className="mt-6 px-6 py-2 rounded-full border border-blue-400 text-blue-300 hover:bg-blue-500/10 transition">
            ✨ Save more with AI-powered prices
          </button>
        </div>

        {/* 🔍 SEARCH */}
        <div className="max-w-7xl mx-auto px-10 pb-10">
          <SearchBox />
        </div>

        {/* 🔥 DATA SECTIONS */}
        <div className="max-w-7xl mx-auto px-10 grid md:grid-cols-3 gap-6 pb-20">

          <div className="bg-white/5 p-5 rounded-xl border border-white/10">
            <h2 className="mb-4 text-lg font-semibold">
              Explore Popular Routes
            </h2>
            <p className="text-gray-400 text-sm">
              Routes will appear based on user searches.
            </p>
          </div>

          <div className="bg-white/5 p-5 rounded-xl border border-white/10">
            <h2 className="mb-4 text-lg font-semibold">
              Cheapest Dates
            </h2>
            <p className="text-gray-400 text-sm">
              Price trends will be shown after selecting a route.
            </p>
          </div>

          <div className="bg-white/5 p-5 rounded-xl border border-white/10 text-center">
            <h2 className="mb-4 text-lg font-semibold">
              Price Insight
            </h2>
            <p className="text-gray-400 text-sm">
              AI-based pricing insights coming soon.
            </p>
          </div>

        </div>

      </div>
    </div>
  )
}