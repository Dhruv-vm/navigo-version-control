"use client"

import { useState } from "react"
import { PseudoQr } from "./sandboxQr"
import { formatINR } from "./bookingUtils"

const UPI_ID_PATTERN = /^[a-zA-Z0-9.\-_]{2,}@[a-zA-Z]{2,}$/

export function UpiPanel({
  amount,
  bookingId,
  disabled,
  onPay,
}: {
  amount: number
  bookingId: string
  disabled: boolean
  onPay: () => void
}) {
  const [mode, setMode] = useState<"scan" | "id">("scan")
  const [upiId, setUpiId] = useState("")
  const [touched, setTouched] = useState(false)

  const upiValid = UPI_ID_PATTERN.test(upiId.trim())

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-0.5 rounded-lg bg-white/[0.04] border border-white/[0.08] p-0.5 w-fit">
        <button
          onClick={() => setMode("scan")}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
            mode === "scan" ? "bg-[#D4AF37]/20 text-[#E8C766]" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          Scan QR
        </button>
        <button
          onClick={() => setMode("id")}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
            mode === "id" ? "bg-[#D4AF37]/20 text-[#E8C766]" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          Enter UPI ID
        </button>
      </div>

      {mode === "scan" ? (
        <div className="flex flex-col items-center text-center bg-white/[0.02] border border-white/[0.08] rounded-2xl p-6">
          <PseudoQr seed={`${bookingId}:${amount}`} pixelSize={7} className="rounded-lg" />
          <p className="text-sm text-white font-medium mt-4">Scan with any UPI app</p>
          <p className="text-xs text-slate-500 mt-1">GPay · PhonePe · Paytm · BHIM</p>
          <p className="font-display text-lg font-bold text-amber-300 mt-3 tabular-nums">{formatINR(amount)}</p>
          <p className="text-[10px] text-slate-600 mt-3">Sandbox QR — visual only, not scannable</p>

          <button
            onClick={onPay}
            disabled={disabled}
            className="mt-5 w-full px-5 py-2.5 rounded-full pill-cta font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Simulate Scan Complete (Sandbox)
          </button>
        </div>
      ) : (
        <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-5 space-y-4">
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">UPI ID</label>
            <input
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              onBlur={() => setTouched(true)}
              placeholder="yourname@bank"
              className={`w-full bg-white/[0.04] border rounded-lg px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none transition-colors ${
                touched && upiId && !upiValid ? "border-rose-400/50" : "border-white/[0.1] focus:border-[#D4AF37]/50"
              }`}
            />
            {touched && upiId && !upiValid && (
              <p className="text-[11px] text-rose-300 mt-1.5">Enter a valid UPI ID, like name@bank</p>
            )}
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Amount</span>
            <span className="font-display font-bold text-amber-300 tabular-nums">{formatINR(amount)}</span>
          </div>

          <button
            onClick={onPay}
            disabled={disabled || !upiValid}
            className="w-full px-5 py-2.5 rounded-full pill-cta font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Pay {formatINR(amount)}
          </button>
        </div>
      )}
    </div>
  )
}