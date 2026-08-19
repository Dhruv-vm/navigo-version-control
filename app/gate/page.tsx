"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function GateIndexPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/gate/verify")
  }, [router])

  return (
    <div className="min-h-screen bg-[#02050E] flex items-center justify-center text-slate-400 font-mono text-xs">
      Routing to airport gate verification terminal…
    </div>
  )
}
