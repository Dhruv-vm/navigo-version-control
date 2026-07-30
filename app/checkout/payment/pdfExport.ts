// Requires two packages:
//   npm install jspdf html2canvas-pro
//
// ✅ FIXED: this used to hardcode every PDF page to a 1.586:1 ratio,
// assuming the boarding pass was exactly credit-card-shaped. It isn't —
// its real height depends on how much content a given pass has (Extras
// Included chips, etc.), so forcing that mismatched image into a fixed
// ratio stretched/squashed it — the "compressed" look. Now each page is
// sized from that specific card's ACTUAL captured width/height, so the
// PDF always exactly matches what's on screen, no matter how tall any
// individual pass turns out to be.
//
// Uses html2canvas-pro, not html2canvas — plain html2canvas can't parse
// the oklab()/color-mix() color functions Tailwind v4 generates for any
// opacity-modifier class, which this card uses throughout.

export async function exportPassesToPdf(elements: HTMLElement[], filename: string) {
  if (elements.length === 0) return

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas-pro"),
    import("jspdf"),
  ])

  const pageWidthMm = 280 // fixed width; height follows each card's real ratio
  let pdf: InstanceType<typeof jsPDF> | null = null

  for (let i = 0; i < elements.length; i++) {
    const canvas = await html2canvas(elements[i], {
      scale: 2, // crisp on high-DPI screens/printers
      backgroundColor: "#0A1424",
      useCORS: true,
    })

    const ratio = canvas.height / canvas.width
    const pageHeightMm = pageWidthMm * ratio
    const orientation = pageHeightMm > pageWidthMm ? "portrait" : "landscape"
    const imgData = canvas.toDataURL("image/png")

    if (!pdf) {
      pdf = new jsPDF({ orientation, unit: "mm", format: [pageWidthMm, pageHeightMm] })
    } else {
      pdf.addPage([pageWidthMm, pageHeightMm], orientation)
    }
    pdf.addImage(imgData, "PNG", 0, 0, pageWidthMm, pageHeightMm)
  }

  pdf?.save(filename)
}