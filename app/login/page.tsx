"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleLogin = async () => {
    setLoading(true)
    setError("")

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Login failed")
        setLoading(false)
        return
      }

      localStorage.setItem("token", data.token)
      router.push("/")
    } catch (err) {
      setError("Something went wrong")
    }

    setLoading(false)
  }

  return (
    <div className="relative min-h-screen text-white overflow-hidden">

      {/* 🌌 FULL BACKGROUND */}
      <img
        src="/login-bg.png"
        className="absolute inset-0 w-full h-full object-cover object-center"
      />

      {/* 🌑 GRADIENT OVERLAY (NO BLUR) */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#020617]/90 via-[#020617]/60 to-[#020617]/30" />

      {/* 🔷 CONTENT WRAPPER */}
      <div className="relative z-10 flex min-h-screen">

        {/* LEFT TEXT SECTION */}
        <div className="hidden lg:flex w-1/2 flex-col justify-center px-16">

          {/* LOGO */}
          <div className="flex items-center gap-3 mb-10">
            <img
              src="/logo.png"
              className="h-12 w-auto object-contain"
            />
            <div>
              <h1 className="text-xl font-bold">NAVIGO</h1>
              <p className="text-blue-400 text-sm">
                Your Journey, Simplified
              </p>
            </div>
          </div>

          {/* HERO TEXT */}
          <h1 className="text-6xl font-bold leading-tight max-w-xl">
            Every Journey Begins with{" "}
            <span className="bg-gradient-to-r from-blue-400 via-cyan-300 to-yellow-400 text-transparent bg-clip-text">
              NAVIGO
            </span>
          </h1>

          <p className="mt-6 text-gray-300 text-lg">
            Smart booking. Dynamic pricing. Personalized for you.
          </p>

          {/* FEATURES */}
          <div className="mt-6 space-y-3 text-gray-300">
            <p>✈ Smart Booking — AI finds best flights</p>
            <p>💺 Comfort First — choose your seat</p>
            <p>🔒 Secure & Reliable — your data is safe</p>
          </div>

          <p className="mt-10 text-sm text-gray-400">
            Trusted by 2M+ travelers
          </p>
        </div>

        {/* RIGHT LOGIN CARD */}
        <div className="w-full lg:w-1/2 flex items-center justify-center px-6">

          <div className="w-full max-w-md 
            bg-white/5 backdrop-blur-xl 
            border border-white/10 
            rounded-2xl p-8 shadow-2xl">

            <h2 className="text-3xl font-bold mb-2">
              Welcome Back!
            </h2>

            <p className="text-gray-400 mb-6">
              Login to continue your journey
            </p>

            {/* EMAIL */}
            <input
              type="email"
              placeholder="Email or Phone Number"
              className="w-full mb-4 p-3 rounded-lg bg-black/40 border border-white/10 outline-none focus:border-blue-400"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            {/* PASSWORD */}
            <input
              type="password"
              placeholder="Password"
              className="w-full mb-3 p-3 rounded-lg bg-black/40 border border-white/10 outline-none focus:border-blue-400"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            {/* ERROR */}
            {error && (
              <p className="text-red-400 text-sm mb-3">
                {error}
              </p>
            )}

            {/* OPTIONS */}
            <div className="flex justify-between items-center text-sm mb-5">
              <label className="flex items-center gap-2">
                <input type="checkbox" />
                Remember me
              </label>

              <span className="text-blue-400 cursor-pointer">
                Forgot Password?
              </span>
            </div>

            {/* LOGIN BUTTON */}
            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full py-3 rounded-lg font-semibold 
              bg-gradient-to-r from-blue-500 via-cyan-400 to-yellow-400 
              text-black hover:opacity-90 transition"
            >
              {loading ? "Logging in..." : "Login →"}
            </button>

            {/* DIVIDER */}
            <div className="flex items-center my-6">
              <div className="flex-1 h-px bg-white/10" />
              <span className="px-3 text-gray-400 text-sm">OR</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            {/* SOCIAL */}
            <div className="flex gap-4">
              <button className="flex-1 py-3 rounded-lg bg-white/10 hover:bg-white/20 transition">
                Google
              </button>

              <button className="flex-1 py-3 rounded-lg bg-white/10 hover:bg-white/20 transition">
                Apple
              </button>
            </div>

            {/* SIGNUP */}
            <p className="text-center text-sm text-gray-400 mt-6">
              Don’t have an account?{" "}
              <span
                className="text-blue-400 cursor-pointer"
                onClick={() => router.push("/signup")}
              >
                Sign Up
              </span>
            </p>

            {/* SECURITY */}
            <p className="text-center text-xs text-gray-500 mt-3">
              🔒 256-bit encryption
            </p>

          </div>
        </div>
      </div>
    </div>
  )
}