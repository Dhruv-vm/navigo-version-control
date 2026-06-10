"use client"

import { useState } from "react"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(false)

  const handleReset = async () => {
    setLoading(true)
    setMessage("")

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      })

      const data = await res.json()

      setMessage(data.message || "Check your email")
    } catch {
      setMessage("Something went wrong")
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#020617] text-white">

      <div className="w-full max-w-md p-8 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10">

        <h2 className="text-2xl font-bold mb-3">
          Reset Password
        </h2>

        <p className="text-gray-400 mb-6">
          Enter your email to receive reset instructions
        </p>

        <input
          type="email"
          placeholder="Enter your email"
          className="w-full mb-4 p-3 rounded-lg bg-black/40 border border-white/10 outline-none"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <button
          onClick={handleReset}
          className="w-full py-3 rounded-lg bg-gradient-to-r from-blue-500 via-cyan-400 to-yellow-400 text-black font-semibold"
        >
          {loading ? "Sending..." : "Send Reset Link"}
        </button>

        {message && (
          <p className="mt-4 text-sm text-gray-300">
            {message}
          </p>
        )}
      </div>
    </div>
  )
}

