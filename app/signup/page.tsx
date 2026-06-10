"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function SignupPage() {
  const router = useRouter()

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSignup = async () => {
    setError("")

    if (password !== confirm) {
      setError("Passwords do not match")
      return
    }

    setLoading(true)

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          phone,
          password,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Signup failed")
        setLoading(false)
        return
      }

      // 🔥 redirect to login after signup
      router.push("/login")

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

      {/* 🌑 GRADIENT OVERLAY */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#020617]/90 via-[#020617]/60 to-[#020617]/30" />

      <div className="relative z-10 flex min-h-screen">

        {/* LEFT SIDE */}
        <div className="hidden lg:flex w-1/2 flex-col justify-center px-16">

          {/* LOGO */}
          <div className="flex items-center gap-3 mb-10">
            <img src="/logo.png" className="h-12 w-auto object-contain" />
            <div>
              <h1 className="text-xl font-bold">NAVIGO</h1>
              <p className="text-blue-400 text-sm">
                Your Journey, Simplified
              </p>
            </div>
          </div>

          {/* TEXT */}
          <h1 className="text-6xl font-bold leading-tight max-w-xl">
            Start Your Journey with{" "}
            <span className="bg-gradient-to-r from-blue-400 via-cyan-300 to-yellow-400 text-transparent bg-clip-text">
              NAVIGO
            </span>
          </h1>

          <p className="mt-6 text-gray-300 text-lg">
            Create your account and unlock smart travel.
          </p>

          <div className="mt-6 space-y-3 text-gray-300">
            <p>✈ Smart Booking — AI finds best flights</p>
            <p>💺 Comfort First — choose your seat</p>
            <p>🔒 Secure & Reliable — your data is safe</p>
          </div>
        </div>

        {/* RIGHT FORM */}
        <div className="w-full lg:w-1/2 flex items-center justify-center px-6">

          <div className="w-full max-w-md 
            bg-white/5 backdrop-blur-xl 
            border border-white/10 
            rounded-2xl p-8 shadow-2xl">

            <h2 className="text-3xl font-bold mb-2">
              Create Account
            </h2>

            <p className="text-gray-400 mb-6">
              Join Navigo and start exploring
            </p>

            {/* NAME */}
            <input
              type="text"
              placeholder="Full Name"
              className="w-full mb-3 p-3 rounded-lg bg-black/40 border border-white/10 outline-none focus:border-blue-400"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            {/* EMAIL */}
            <input
              type="email"
              placeholder="Email"
              className="w-full mb-3 p-3 rounded-lg bg-black/40 border border-white/10 outline-none focus:border-blue-400"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            {/* PHONE */}
            <input
              type="text"
              placeholder="Phone Number"
              className="w-full mb-3 p-3 rounded-lg bg-black/40 border border-white/10 outline-none focus:border-blue-400"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />

            {/* PASSWORD */}
            <input
              type="password"
              placeholder="Password"
              className="w-full mb-3 p-3 rounded-lg bg-black/40 border border-white/10 outline-none focus:border-blue-400"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            {/* CONFIRM */}
            <input
              type="password"
              placeholder="Confirm Password"
              className="w-full mb-3 p-3 rounded-lg bg-black/40 border border-white/10 outline-none focus:border-blue-400"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />

            {/* ERROR */}
            {error && (
              <p className="text-red-400 text-sm mb-3">
                {error}
              </p>
            )}

            {/* BUTTON */}
            <button
              onClick={handleSignup}
              disabled={loading}
              className="w-full py-3 rounded-lg font-semibold 
              bg-gradient-to-r from-blue-500 via-cyan-400 to-yellow-400 
              text-black hover:opacity-90 transition"
            >
              {loading ? "Creating..." : "Create Account →"}
            </button>

            {/* LOGIN LINK */}
            <p className="text-center text-sm text-gray-400 mt-6">
              Already have an account?{" "}
              <span
                className="text-blue-400 cursor-pointer"
                onClick={() => router.push("/login")}
              >
                Login
              </span>
            </p>

          </div>
        </div>
      </div>
    </div>
  )
}