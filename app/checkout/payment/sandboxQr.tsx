"use client"

import { useMemo } from "react"

// ---------------------------------------------------------------------------
// ⚠️ SANDBOX ONLY — this is NOT a real QR encoder. It deterministically
// derives a module grid from a seed string so the same seed always renders
// the same pattern (looks stable across re-renders), and it stamps the
// three finder-pattern corner squares so it *reads* as a QR code visually —
// but it will not scan with a real QR reader.
//
// For a production UPI QR or boarding-pass QR, swap this out for a real
// encoder fed with the actual payment string / PNR, e.g.:
//   npm install qrcode.react
//   import { QRCodeSVG } from "qrcode.react"
//   <QRCodeSVG value={`upi://pay?pa=...&am=...`} />
// ---------------------------------------------------------------------------

export function generateQrModules(seed: string, size = 21): boolean[][] {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0
  }
  const next = () => {
    h ^= h << 13; h >>>= 0
    h ^= h >>> 17
    h ^= h << 5; h >>>= 0
    return h / 4294967295
  }

  const modules: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false))
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      modules[y][x] = next() > 0.55
    }
  }

  const stampFinder = (ox: number, oy: number) => {
    for (let y = 0; y < 7; y++) {
      for (let x = 0; x < 7; x++) {
        const onRing = x === 0 || x === 6 || y === 0 || y === 6
        const onCore = x >= 2 && x <= 4 && y >= 2 && y <= 4
        modules[oy + y][ox + x] = onRing || onCore
      }
    }
  }
  stampFinder(0, 0)
  stampFinder(size - 7, 0)
  stampFinder(0, size - 7)

  return modules
}

export function PseudoQr({
  seed,
  size = 21,
  pixelSize = 6,
  className,
}: {
  seed: string
  size?: number
  pixelSize?: number
  className?: string
}) {
  const modules = useMemo(() => generateQrModules(seed, size), [seed, size])
  const dim = size * pixelSize

  return (
    <svg
      width={dim}
      height={dim}
      viewBox={`0 0 ${dim} ${dim}`}
      className={className}
      role="img"
      aria-label="Sandbox QR code — visual only, not scannable"
    >
      <rect width={dim} height={dim} fill="#F8F5EC" rx={8} />
      {modules.map((row, y) =>
        row.map(
          (on, x) =>
            on && (
              <rect
                key={`${x}-${y}`}
                x={x * pixelSize}
                y={y * pixelSize}
                width={pixelSize}
                height={pixelSize}
                fill="#0A1424"
              />
            )
        )
      )}
    </svg>
  )
}