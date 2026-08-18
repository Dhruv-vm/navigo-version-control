"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function TripsRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/my-trips")
  }, [router])

  return (
    <div className="min-h-screen bg-[#04070F] flex items-center justify-center text-white">
      <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
