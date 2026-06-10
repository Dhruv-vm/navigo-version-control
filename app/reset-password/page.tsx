"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"

export default function ResetPasswordPage() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const token = searchParams.get("token")

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    if (!token) {
      setError("Invalid or missing token")
    }
  }, [token])

  const handleReset = async () => {
    setLoading(true)
    setError("")
    setMessage("")

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      setLoading(false)
      return
    }

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          password,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Something went wrong")
      } else {
        setMessage("Password updated successfully 🚀")

        setTimeout(() => {
          router.push("/login")
        }, 2000)
      }
    } catch (err) {
      setError("Server error")
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#020617] text-white">

      <div className="w-full max-w-md bg-white/5 backdrop-blur-xl p-8 rounded-2xl border border-white/10">

        <h2 className="text-2xl font-bold mb-2">
          Reset Password
        </h2>

        <p className="text-gray-400 mb-6">
          Enter your new password
        </p>

        {/* PASSWORD */}
        <input
          type="password"
          placeholder="New Password"
          className="w-full mb-4 p-3 rounded-lg bg-black/40 border border-white/10"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {/* CONFIRM PASSWORD */}
        <input
          type="password"
          placeholder="Confirm Password"
          className="w-full mb-4 p-3 rounded-lg bg-black/40 border border-white/10"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />

        {/* ERROR */}
        {error && (
          <p className="text-red-400 text-sm mb-3">{error}</p>
        )}

        {/* SUCCESS */}
        {message && (
          <p className="text-green-400 text-sm mb-3">{message}</p>
        )}

        {/* BUTTON */}
        <button
          onClick={handleReset}
          disabled={loading || !token}
          className="w-full py-3 rounded-lg font-semibold 
          bg-gradient-to-r from-blue-500 via-cyan-400 to-yellow-400 
          text-black"
        >
          {loading ? "Updating..." : "Update Password →"}
        </button>

      </div>
    </div>
  )
}