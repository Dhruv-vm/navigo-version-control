"use client"

import { useEffect, useRef, useState } from "react"
import { motion, useMotionValue, useSpring, useTransform, AnimatePresence } from "framer-motion"
import type { CardBrand } from "./cardUtils"
import { cardNumberDisplay } from "./cardUtils"

export function PaymentCard({
  name,
  numberDigits,
  expiry,
  cvv,
  brand,
  isFlipped,
}: {
  name: string
  numberDigits: string
  expiry: string
  cvv: string
  brand: CardBrand
  isFlipped: boolean
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReducedMotion(mq.matches)
    const handler = () => setReducedMotion(mq.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  // Hover tilt — raw pointer position -> spring-smoothed rotation.
  const tiltX = useMotionValue(0)
  const tiltY = useMotionValue(0)
  const springX = useSpring(tiltX, { stiffness: 150, damping: 18 })
  const springY = useSpring(tiltY, { stiffness: 150, damping: 18 })
  // Small opposite-direction offset applied to inner elements (chip, logo)
  // for a subtle parallax "depth" read, separate from the tilt itself.
  const parallaxX = useTransform(springY, [-8, 8], [-4, 4])
  const parallaxY = useTransform(springX, [-8, 8], [4, -4])

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (reducedMotion || !wrapRef.current) return
    const rect = wrapRef.current.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width - 0.5
    const py = (e.clientY - rect.top) / rect.height - 0.5
    tiltY.set(px * 16)
    tiltX.set(py * -16)
  }
  function handleMouseLeave() {
    tiltX.set(0)
    tiltY.set(0)
  }

  const displayNumber = cardNumberDisplay(numberDigits, brand)
  const displayName = name.trim() ? name.toUpperCase() : "YOUR NAME"
  const displayExpiry = expiry || "MM/YY"

  return (
    <div
      ref={wrapRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ perspective: 1400 }}
      className="w-full max-w-[420px] mx-auto select-none"
    >
      <motion.div
        style={{
          rotateX: reducedMotion ? 0 : springX,
          rotateY: reducedMotion ? 0 : springY,
          transformStyle: "preserve-3d",
        }}
        className="relative"
      >
        <motion.div
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{ type: "spring", stiffness: 220, damping: 24 }}
          style={{ transformStyle: "preserve-3d" }}
          className="relative aspect-[1.586/1] w-full"
        >
          {/* ── FRONT ─────────────────────────────────────────────── */}
          <div
            style={{ backfaceVisibility: "hidden" }}
            className="absolute inset-0 rounded-2xl overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,0.55)] border border-[#D4AF37]/25"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-[#101B2C] via-[#0B1729] to-[#060B14]" />
            <div className="absolute inset-0 bg-gradient-to-br from-[#D4AF37]/[0.10] via-transparent to-transparent" />
            {/* fine guilloché-style linework, purely decorative */}
            <svg className="absolute inset-0 w-full h-full opacity-[0.08]" preserveAspectRatio="none" viewBox="0 0 420 265">
              {Array.from({ length: 14 }).map((_, i) => (
                <path
                  key={i}
                  d={`M -20 ${20 + i * 20} C 140 ${i * 14}, 280 ${260 - i * 14}, 440 ${20 + i * 20}`}
                  stroke="#E8C766"
                  strokeWidth="0.6"
                  fill="none"
                />
              ))}
            </svg>
            <div className="pointer-events-none absolute -top-10 -right-10 w-40 h-40 bg-[#D4AF37]/[0.16] blur-[60px] rounded-full" />

            <div className="relative h-full flex flex-col justify-between p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display text-[15px] font-extrabold tracking-[0.08em] text-[#E8C766]">NAVIGO ELITE</p>
                  <p className="text-[9px] tracking-[0.2em] text-slate-400 mt-0.5">PREMIUM MEMBER</p>
                </div>
                <motion.div style={{ x: parallaxX, y: parallaxY }}>
                  <BrandMark brand={brand} />
                </motion.div>
              </div>

              <motion.div style={{ x: parallaxX, y: parallaxY }} className="w-11 h-8 rounded-[5px] bg-gradient-to-br from-[#F1D98A] via-[#D4AF37] to-[#B8860B] shadow-inner relative overflow-hidden">
                <div className="absolute inset-[2px] rounded-[3px] border border-[#8a6a1f]/40" />
                <div className="absolute inset-y-0 left-1/3 w-px bg-[#8a6a1f]/40" />
                <div className="absolute inset-y-0 left-2/3 w-px bg-[#8a6a1f]/40" />
                <div className="absolute inset-x-0 top-1/2 h-px bg-[#8a6a1f]/40" />
              </motion.div>

              <div>
                <div className="flex gap-[3px] font-mono text-[19px] sm:text-[21px] tracking-[0.08em] text-white h-7 items-center overflow-hidden">
                  {displayNumber.split("").map((char, i) => (
                    <AnimatePresence key={i} mode="popLayout" initial={false}>
                      <motion.span
                        key={`${i}-${char}`}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.16 }}
                        className={char === "•" ? "text-white/25" : "text-white"}
                      >
                        {char === " " ? "\u00A0\u00A0" : char}
                      </motion.span>
                    </AnimatePresence>
                  ))}
                </div>

                <div className="flex items-end justify-between mt-4">
                  <div>
                    <p className="text-[8px] tracking-[0.15em] text-slate-500">CARDHOLDER</p>
                    <AnimatePresence mode="wait">
                      <motion.p
                        key={displayName}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.18 }}
                        className="text-[13px] tracking-wide text-white font-medium truncate max-w-[220px]"
                      >
                        {displayName}
                      </motion.p>
                    </AnimatePresence>
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] tracking-[0.15em] text-slate-500">EXPIRES</p>
                    <AnimatePresence mode="wait">
                      <motion.p
                        key={displayExpiry}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.18 }}
                        className="text-[13px] tracking-wide text-white font-mono"
                      >
                        {displayExpiry}
                      </motion.p>
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── BACK ──────────────────────────────────────────────── */}
          <div
            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
            className="absolute inset-0 rounded-2xl overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,0.55)] border border-[#D4AF37]/25"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-[#101B2C] via-[#0B1729] to-[#060B14]" />
            <div className="w-full h-11 bg-[#050810] mt-6" />

            <div className="px-6 mt-6">
              <div className="h-9 bg-[#EFE9D8] rounded-[3px] flex items-center justify-between px-3">
                <span className="font-display italic text-[11px] text-[#5b5646] tracking-wide">Authorized Signature</span>
                <div className="bg-white rounded px-2.5 py-1 shadow-sm">
                  <span className="font-mono text-[13px] tracking-[0.2em] text-[#0A1424]">
                    {cvv.padEnd(brand === "amex" ? 4 : 3, "•")}
                  </span>
                </div>
              </div>
              <p className="text-[8px] text-slate-500 mt-2 leading-relaxed max-w-[260px]">
                This card is property of Navigo Airways. Sandbox card — for
                testing only, not a real financial instrument.
              </p>
            </div>

            <div className="absolute bottom-5 right-6 flex items-center gap-2">
              <BrandMark brand={brand} compact />
            </div>
            <div className="absolute bottom-5 left-6">
              <p className="font-display text-[11px] font-extrabold tracking-[0.08em] text-[#E8C766]/70">NAVIGO ELITE</p>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Brand marks — deliberately simplified/restyled wordmarks in the card's
// own gold/cream palette rather than exact trademarked logo reproductions
// (this is a fictional sandbox card, not real card-network branding).
// ---------------------------------------------------------------------------

function BrandMark({ brand, compact = false }: { brand: CardBrand; compact?: boolean }) {
  const size = compact ? "scale-75 origin-right" : ""
  switch (brand) {
    case "visa":
      return <span className={`font-display italic text-white text-lg font-extrabold tracking-tight ${size}`}>VISA</span>
    case "mastercard":
      return (
        <div className={`flex items-center ${size}`}>
          <span className="w-6 h-6 rounded-full bg-[#E8C766]/80" />
          <span className="w-6 h-6 rounded-full bg-[#F8F5EC]/70 -ml-3" />
        </div>
      )
    case "amex":
      return (
        <span className={`px-2 py-1 rounded bg-[#0F2A4A] border border-[#E8C766]/40 text-[#E8C766] text-[10px] font-bold tracking-widest ${size}`}>
          AMEX
        </span>
      )
    case "rupay":
      return (
        <div className={`flex flex-col items-end ${size}`}>
          <span className="text-white text-sm font-bold tracking-tight">RuPay</span>
          <span className="w-8 h-[3px] mt-0.5 bg-gradient-to-r from-[#D4AF37] to-transparent rounded-full" />
        </div>
      )
    default:
      return <span className="w-8 h-5 rounded bg-white/10 border border-white/15" />
  }
}