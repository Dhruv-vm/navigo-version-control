// Requires two new packages:
//   npm install jspdf html2canvas-pro
//
// ✅ FIXED: uses html2canvas-pro, not html2canvas. Plain html2canvas can't
// parse the oklab()/color-mix() color functions Tailwind v4 generates for
// ANY opacity-modifier class (text-white/45, bg-black/[0.12], etc.) —
// which this card uses throughout — so every export was crashing with
// "Attempting to parse an unsupported color function 'oklab'".
// html2canvas-pro is a drop-in fork that added support for exactly this;
// same API, no other code changes needed.
//
// Renders each given DOM element (a boarding pass card) into a PDF page via
// a canvas snapshot — this is what makes the printout come out in full
// color: canvas capture reproduces gradients/backgrounds exactly as
// rendered, unlike the browser's native print stylesheet, which strips
// background colors by default unless every element opts in with
// print-color-adjust. Dynamically imported so these (fairly large)
// libraries only load when someone actually clicks "Download".

export async function exportPassesToPdf(elements: HTMLElement[], filename: string) {
  if (elements.length === 0) return

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas-pro"),
    import("jspdf"),
  ])

  // Boarding pass cards use a 1.586:1 ratio throughout (standard card
  // proportions) — build PDF pages to match directly instead of forcing
  // onto A4, so nothing gets letterboxed or cropped.
  const pageWidthMm = 240
  const pageHeightMm = pageWidthMm / 1.586

  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: [pageWidthMm, pageHeightMm] })

  for (let i = 0; i < elements.length; i++) {
    const canvas = await html2canvas(elements[i], {
      scale: 2, // crisp on high-DPI screens/printers
      backgroundColor: "#0A1424",
      useCORS: true,
    })
    const imgData = canvas.toDataURL("image/png")
    if (i > 0) pdf.addPage([pageWidthMm, pageHeightMm], "landscape")
    pdf.addImage(imgData, "PNG", 0, 0, pageWidthMm, pageHeightMm)
  }

  pdf.save(filename)
}