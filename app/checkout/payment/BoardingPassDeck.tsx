"use client"

import { useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { BoardingPassCard } from "./BoardingPassCard"
import { exportPassesToPdf } from "./pdfExport"

export type BoardingPassData = {
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
  addons?: { id: string; title: string }[]
}

export function BoardingPassDeck({
  passes,
  formattedAmount,
  onDone,
}: {
  passes: BoardingPassData[]
  formattedAmount: string
  onDone: () => void
}) {
  const [index, setIndex] = useState(0)
  const [downloading, setDownloading] = useState<"departure" | "return" | null>(null)
  const active = passes[index]

  // Every pass — not just the currently-visible one — needs a real DOM
  // node to snapshot for the PDF, including ones the traveler never
  // navigates to. This hidden set stays mounted the whole time so a
  // "Download Departure Passes" click can grab all of them at once.
  const cardRefs = useRef<Record<number, HTMLDivElement | null>>({})

  const groups = useMemo(() => {
    const departure: number[] = []
    const returnLeg: number[] = []
    passes.forEach((p, i) => {
      if (p.legLabel === "Return") returnLeg.push(i)
      else departure.push(i) // covers "Departure" label and one-way (no label)
    })
    return { departure, returnLeg }
  }, [passes])

  const hasReturn = groups.returnLeg.length > 0

  function go(delta: number) {
    setIndex((i) => Math.max(0, Math.min(passes.length - 1, i + delta)))
  }

  async function handleDownload(group: "departure" | "return") {
    const indices = group === "departure" ? groups.departure : groups.returnLeg
    const elements = indices.map((i) => cardRefs.current[i]).filter((el): el is HTMLDivElement => !!el)
    if (elements.length === 0) return
    setDownloading(group)
    try {
      const label = group === "departure" ? (hasReturn ? "departure" : "boarding-pass") : "return"
      await exportPassesToPdf(elements, `navigo-${label}-${active?.pnr ?? "pass"}.pdf`)
    } catch (err) {
      console.error("PDF export failed:", err)
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div className="max-w-3xl mx-auto text-center py-10">
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 18 }}
        className="w-16 h-16 rounded-full bg-emerald-400/15 border border-emerald-400/30 flex items-center justify-center text-emerald-300 text-3xl mx-auto mb-4"
      >
        ✓
      </motion.div>
      <h1 className="font-display text-2xl font-extrabold text-white">Booking Confirmed</h1>
      <p className="text-sm text-slate-500 mt-1">{formattedAmount} paid successfully</p>

      <div className="inline-flex items-center gap-2.5 mt-4 px-4 py-2 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/25">
        <span className="text-[10px] uppercase tracking-widest text-slate-500">Booking Reference (PNR)</span>
        <span className="font-display text-base font-extrabold tracking-[0.2em] text-[#E8C766]">{active?.pnr}</span>
      </div>

      {passes.length > 1 && (
        <div className="flex items-center justify-center gap-3 mt-5">
          <button
            onClick={() => go(-1)}
            disabled={index === 0}
            className="w-8 h-8 rounded-full border border-white/[0.12] text-slate-300 disabled:opacity-30 hover:bg-white/[0.06] transition-colors flex items-center justify-center"
            aria-label="Previous pass"
          >
            ←
          </button>
          <p className="text-xs text-slate-500">
            {active?.legLabel ? `${active.legLabel} · ` : ""}{active?.passengerName} — Pass {index + 1} of {passes.length}
          </p>
          <button
            onClick={() => go(1)}
            disabled={index === passes.length - 1}
            className="w-8 h-8 rounded-full border border-white/[0.12] text-slate-300 disabled:opacity-30 hover:bg-white/[0.06] transition-colors flex items-center justify-center"
            aria-label="Next pass"
          >
            →
          </button>
        </div>
      )}

      <div className="relative mt-6" style={{ minHeight: 300 }}>
        {passes.length > 1 && (
          <>
            <div className="absolute inset-x-6 top-3 h-full rounded-2xl bg-white/[0.03] border border-white/[0.06] -rotate-2" aria-hidden />
            <div className="absolute inset-x-3 top-1.5 h-full rounded-2xl bg-white/[0.05] border border-white/[0.08] rotate-1" aria-hidden />
          </>
        )}
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.25 }}
            className="relative"
          >
            {active && <BoardingPassCard {...active} index={0} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {passes.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-5">
          {passes.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className={`h-1.5 rounded-full transition-all ${i === index ? "w-6 bg-[#E8C766]" : "w-1.5 bg-white/20"}`}
              aria-label={`Go to pass ${i + 1}`}
            />
          ))}
        </div>
      )}

      {/* hidden capture set — off-screen, always mounted, one per pass */}
      <div aria-hidden style={{ position: "fixed", top: 0, left: -99999 }}>
        {passes.map((p, i) => (
          <BoardingPassCard key={i} {...p} index={0} ref={(el) => { cardRefs.current[i] = el }} />
        ))}
      </div>

      <div className="flex items-center justify-center gap-3 mt-8 flex-wrap">
        <button
          onClick={() => handleDownload("departure")}
          disabled={downloading !== null}
          className="px-5 py-2.5 rounded-full text-sm font-semibold border border-white/[0.12] text-slate-200 hover:bg-white/[0.04] transition-colors disabled:opacity-50"
        >
          {downloading === "departure" ? "Preparing PDF…" : hasReturn ? "Download Departure Passes (PDF)" : "Download Boarding Pass (PDF)"}
        </button>
        {hasReturn && (
          <button
            onClick={() => handleDownload("return")}
            disabled={downloading !== null}
            className="px-5 py-2.5 rounded-full text-sm font-semibold border border-white/[0.12] text-slate-200 hover:bg-white/[0.04] transition-colors disabled:opacity-50"
          >
            {downloading === "return" ? "Preparing PDF…" : "Download Return Passes (PDF)"}
          </button>
        )}
        <button onClick={onDone} className="px-5 py-2.5 rounded-full pill-cta text-sm font-semibold">
          View My Trips
        </button>
      </div>
    </div>
  )
}