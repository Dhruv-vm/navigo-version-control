"use client"

import { useMemo } from "react"

// ---------------------------------------------------------------------------
// ⚠️ SANDBOX ONLY — same idea as sandboxQr.tsx: a deterministic bar pattern
// derived from a seed string (so the same PNR always renders the same
// barcode), styled to read as a Code128-style barcode. It does NOT encode
// the seed in a real, scannable way. For a production boarding pass, swap
// in a real encoder, e.g.:
//   npm install jsbarcode
//   JsBarcode(svgRef.current, pnr, { format: "CODE128" })
// ---------------------------------------------------------------------------

function generateBarWidths(seed: string, bars = 46): number[] {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  const next = () => {
    h ^= h << 13; h >>>= 0
    h ^= h >>> 17
    h ^= h << 5; h >>>= 0
    return h / 4294967295
  }
  return Array.from({ length: bars }, () => (next() > 0.55 ? 3 : 1) + (next() > 0.75 ? 1 : 0))
}

export function PseudoBarcode({
  seed,
  height = 40,
  barColor = "#171310",
  className,
}: {
  seed: string
  height?: number
  barColor?: string
  className?: string
}) {
  const widths = useMemo(() => generateBarWidths(seed), [seed])
  const totalWidth = widths.reduce((sum, w) => sum + w + 1, 0)

  let x = 0
  const bars = widths.map((w, i) => {
    const bar = <rect key={i} x={x} y={0} width={w} height={height} fill={barColor} />
    x += w + 1
    return bar
  })

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${totalWidth} ${height}`}
      preserveAspectRatio="none"
      className={className}
      role="img"
      aria-label="Sandbox barcode — visual only, not scannable"
    >
      {bars}
    </svg>
  )
}