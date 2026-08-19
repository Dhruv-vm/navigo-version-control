"use client"

import { forwardRef } from "react"
import { motion } from "framer-motion"
import { QRCodeSVG } from "qrcode.react"
import { getAirlineTheme } from "./boardingPassThemes"
import { PseudoBarcode } from "./barcode"

export type PassAddon = { id: string; title: string }

const ADDON_ICON: Record<string, string> = {
  baggage: "🧳",
  baggage10: "🧳",
  legroom: "💺",
  meal: "🍽️",
  lounge: "🛋️",
  priority: "🚶",
  insurance: "🛡️",
  wifi: "📶",
  fasttrack: "🏃",
}

export type BoardingPassCardProps = {
  pnr: string
  passengerName: string
  airline: string
  logoSrc?: string
  origin: string
  destination: string
  dateLabel?: string
  timeLabel?: string
  gate?: string
  flightNumber?: string
  seat?: string
  legLabel?: string
  addons?: PassAddon[]
  index?: number
  // ✅ New — for past/completed trips. The QR is grayed out and covered
  // with a lock icon (it should never scan-verify again once the flight
  // has flown), and the whole pass gets a subtle desaturation + an
  // "EXPIRED" ribbon so it reads as a keepsake, not a valid document.
  expired?: boolean
  // ✅ Smart Check-In / DigiYatra biometric verification indicator
  smartBoardingVerified?: boolean
  qrToken?: string
}

function buildVerifyUrl(pnr: string, legLabel?: string, qrToken?: string) {
  const base = typeof window !== "undefined" ? window.location.origin : "https://navigo.app"
  if (qrToken) {
    return `${base}/gate/verify?token=${encodeURIComponent(qrToken)}`
  }
  const params = new URLSearchParams({ pnr })
  if (legLabel) params.set("leg", legLabel.toLowerCase())
  return `${base}/gate/verify?${params.toString()}`
}

export const BoardingPassCard = forwardRef<HTMLDivElement, BoardingPassCardProps>(function BoardingPassCard(
  {
    pnr,
    passengerName,
    airline,
    logoSrc,
    origin,
    destination,
    dateLabel,
    timeLabel,
    gate,
    flightNumber,
    seat,
    legLabel,
    addons,
    index = 0,
    expired = false,
    smartBoardingVerified = true,
    qrToken,
  },
  ref
) {
  const theme = getAirlineTheme(airline)
  const darkTitle = theme.titleColor === "#FFFFFF"

  const verifyUrl = buildVerifyUrl(pnr, legLabel, qrToken)
  const barcodeSeed = `${pnr}:${origin}:${destination}:${legLabel ?? ""}`

  return (
    <motion.div
      initial={{ opacity: 0, y: 28, rotateX: -12 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 22, delay: index * 0.1 }}
      style={{ perspective: 1200 }}
      className="relative w-full max-w-[820px] mx-auto"
    >
      <div
        ref={ref}
        data-pass-color={theme.stripe}
        className={`relative rounded-2xl overflow-hidden shadow-[0_30px_70px_rgba(0,0,0,0.45)] bg-[#F8F6F0] transition-[filter,opacity] duration-300 ${
          expired ? "grayscale-[0.55] opacity-[0.92]" : ""
        }`}
      >
        {/* ✅ EXPIRED ribbon — only for completed trips */}
        {expired && (
          <div className="absolute top-4 -right-11 z-20 rotate-45 w-40 py-1 bg-[#0A1424]/90 border-y border-white/10 text-center pointer-events-none">
            <span className="font-display text-[10px] font-extrabold tracking-[0.2em] uppercase text-slate-300">Trip Completed</span>
          </div>
        )}

        {/* ── Header band ─────────────────────────────────────────── */}
        <div className="relative grid grid-cols-[68%_32%] h-[84px]" style={{ background: theme.headerBg }}>
          <div className="absolute inset-y-0 left-0 w-14 overflow-hidden" aria-hidden>
            <div
              className="absolute -left-5 -top-3 -bottom-3 w-16"
              style={{ background: theme.stripe, transform: "skewX(-18deg)" }}
            />
          </div>

          <div className="relative flex items-center gap-3 pl-9 pr-4">
            {logoSrc && (
              <span className="w-10 h-10 rounded-md bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                <img src={logoSrc} alt={airline} className="w-7 h-7 object-contain" />
              </span>
            )}
            <span className="font-display text-base font-bold uppercase tracking-wide whitespace-nowrap" style={{ color: theme.titleColor }}>{airline}</span>
            <span className="hidden sm:flex ml-auto shrink-0 items-center gap-3">
              <img src="/logo.png" alt="Navigo" className="w-11 h-11 object-contain" />
              <div className="flex flex-col items-end">
                <span className="font-display text-[14px] font-extrabold tracking-[0.22em] whitespace-nowrap" style={{ color: theme.titleColor }}>
                  E-BOARDING PASS
                </span>
                {smartBoardingVerified && (
                  <span className="inline-flex items-center gap-1 text-[8.5px] font-mono font-bold tracking-widest uppercase text-amber-300 bg-amber-400/20 border border-amber-400/40 px-1.5 py-[1px] rounded-full mt-0.5">
                    <span>⚡</span> DIGIYATRA VERIFIED
                  </span>
                )}
              </div>
            </span>
          </div>

          <div className="relative flex items-center justify-center">
            {logoSrc && (
              <span className="w-9 h-9 rounded-md bg-white flex items-center justify-center overflow-hidden shadow-sm">
                <img src={logoSrc} alt="" className="w-6 h-6 object-contain" />
              </span>
            )}
          </div>

          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
            <div
              className="boarding-shimmer absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/20 to-transparent"
              style={{ animationDelay: `${index * 0.4}s` }}
            />
          </div>
        </div>

        {/* ── Body ─────────────────────────────────────────────────── */}
        <div className="relative grid grid-cols-[68%_32%]">
          <div
            className="pointer-events-none absolute inset-0 opacity-60"
            style={{ backgroundImage: "radial-gradient(circle, rgba(10,20,30,0.10) 1px, transparent 1px)", backgroundSize: "9px 9px" }}
            aria-hidden
          />
          <div className="pointer-events-none absolute inset-y-0 left-[68%] border-l-2 border-dashed border-[#0A1424]/20" aria-hidden />

          {/* main stub */}
          <div className="relative px-6 py-4 text-[#171310]">
            <div className="flex items-start justify-between gap-4">
              <div>
                {legLabel && (
                  <span
                    className="inline-block font-display text-[9px] font-bold tracking-[0.2em] uppercase px-2 py-0.5 rounded-full mb-1"
                    style={{ color: darkTitle ? "#0A1424" : theme.stripe, background: "rgba(10,20,30,0.07)" }}
                  >
                    {legLabel}
                  </span>
                )}
                <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-[#171310]/45">Passenger Name</p>
                <p className="font-display text-lg font-bold uppercase tracking-tight whitespace-nowrap">{passengerName}</p>
              </div>

              <div className="text-right shrink-0 flex items-start gap-6">
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-[#171310]/45">PNR</p>
                  <p className="font-display text-sm font-extrabold uppercase tracking-[0.15em] whitespace-nowrap" style={{ color: theme.stripe }}>{pnr}</p>
                </div>
                {(dateLabel || timeLabel) && (
                  <div>
                    <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-[#171310]/45">Departs</p>
                    <p className="font-display text-sm font-bold uppercase whitespace-nowrap">{[dateLabel, timeLabel].filter(Boolean).join(" · ")}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-8 mt-3">
              <Field label="Gate" value={gate || "TBA"} />
              <Field label="Flight Number" value={flightNumber || "TBA"} />
              <Field label="Seat" value={seat || "TBA"} />
            </div>

            <div className="flex gap-10 mt-3">
              <Field label="From" value={origin} />
              <Field label="To" value={destination} />
            </div>

            {addons && addons.length > 0 && (
              <div className="mt-3">
                <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-[#171310]/45 mb-1.5">Extras Included</p>
                <div className="flex flex-wrap gap-1.5">
                  {addons.map((a) => (
                    <span
                      key={a.id}
                      className="inline-flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-full font-display text-[9px] font-bold uppercase tracking-wide"
                      style={{ background: "rgba(212,175,55,0.14)", color: darkTitle ? "#7A5A0A" : theme.stripe }}
                    >
                      <span className="text-[11px]" aria-hidden>{ADDON_ICON[a.id] ?? "✦"}</span>
                      {a.title}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-end justify-between mt-5 gap-4">
              <div className="w-36 shrink-0">
                <PseudoBarcode seed={barcodeSeed} height={30} />
                <p className="font-display text-[9px] font-semibold tracking-[0.2em] uppercase text-[#171310]/50 mt-1">{pnr}</p>
              </div>
              <p className="text-[9px] italic text-[#171310]/50 text-right max-w-[220px]">
                {expired ? "This flight has already departed." : "Gate closes 40 minutes before departure"}
              </p>
            </div>
          </div>

          {/* stub */}
          <div className="relative px-4 py-4 text-[#171310] flex flex-col">
            <p className="text-[8px] font-semibold uppercase tracking-[0.15em] text-[#171310]/45">Passenger Name</p>
            <p className="font-display text-[12px] font-bold uppercase whitespace-nowrap">{passengerName}</p>

            <div className="flex gap-4 mt-3">
              <Field label="Gate" value={gate || "TBA"} compact />
              <Field label="Flight" value={flightNumber || "TBA"} compact />
              <Field label="Seat" value={seat || "TBA"} compact />
            </div>

            <div className="flex flex-col gap-2 mt-3">
              <Field label="From" value={origin} compact />
              <Field label="To" value={destination} compact />
            </div>

            <div className="flex items-end justify-between mt-5">
              <img src="/logo.png" alt="Navigo" className="w-14 h-14 object-contain" />

              {/* ✅ QR lock — grayed out + covered when expired, so it
                  reads as inert rather than a still-valid boarding QR */}
              <div className="relative">
                <QRCodeSVG
                  value={verifyUrl}
                  size={68}
                  bgColor="#F8F5EC"
                  fgColor={expired ? "#8A8A85" : "#0A1424"}
                  level="M"
                  className={`rounded-md transition-opacity duration-300 ${expired ? "opacity-30" : ""}`}
                />
                {expired && (
                  <div
                    className="absolute inset-0 flex items-center justify-center"
                    title="This boarding pass has expired — trip completed"
                  >
                    <span className="w-8 h-8 rounded-full bg-[#0A1424]/85 border border-white/15 flex items-center justify-center text-slate-200">
                      <LockIcon />
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes boardingShimmer {
          0% { transform: translateX(-120%); }
          60%, 100% { transform: translateX(280%); }
        }
        .boarding-shimmer { animation: boardingShimmer 3.2s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .boarding-shimmer { animation: none; }
        }
      `}</style>
    </motion.div>
  )
})

function Field({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div>
      <p className={`font-semibold uppercase tracking-[0.15em] text-[#171310]/45 ${compact ? "text-[8px]" : "text-[9px]"}`}>{label}</p>
      <p className={`font-display font-bold uppercase whitespace-nowrap ${compact ? "text-[11px]" : "text-sm"}`}>{value}</p>
    </div>
  )
}

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="11" width="16" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 018 0v4" />
    </svg>
  )
}