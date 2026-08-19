// Requires two packages:
//   npm install jspdf html2canvas-pro
//
// ✅ Real A4 document: fixed 210×297mm pages with a premium airline-style
// header — full-width navy band, white logo chip, wordmark + subtitle and
// a gold accent rule — plus an airline-style footer (arrival/ID/
// gate-closing boilerplate + page numbering). All header/footer chrome is
// drawn with jsPDF's own primitives so it stays crisp at any zoom or
// print size instead of being part of the captured image.
//
// Passes are captured once up front, their real rendered heights
// measured, then greedily packed onto pages — a page holds as many
// passes as actually fit rather than a fixed count. Passes are
// top-aligned under the header band, exactly how airline boarding-pass
// PDFs lay out, so a 1-pass page reads as a deliberate document rather
// than floating in the middle of an empty page.
//
// Uses html2canvas-pro, not html2canvas — plain html2canvas can't parse
// the oklab()/color-mix() color functions Tailwind v4 generates for any
// opacity-modifier class, which this card uses throughout.

const A4_WIDTH_MM = 210
const A4_HEIGHT_MM = 297
const MARGIN_X_MM = 12
const CONTENT_WIDTH_MM = A4_WIDTH_MM - MARGIN_X_MM * 2
const HEADER_BAND_MM = 28 // sleek executive band height
const CONTENT_TOP_MM = HEADER_BAND_MM + 9 // generous breathing room below gold line
const CONTENT_BOTTOM_MM = 268 // above footer rule
const PASS_GAP_MM = 6

const NAVY: [number, number, number] = [8, 17, 32] // #081120 Luxury Navy
const GOLD: [number, number, number] = [212, 175, 55] // #D4AF37 Gold
const CYAN: [number, number, number] = [56, 189, 248] // #38BDF8 Sky

async function loadImageDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

function drawHeader(pdf: any, logoDataUrl: string | null) {
  // 1. Full-width luxury navy band
  pdf.setFillColor(NAVY[0], NAVY[1], NAVY[2])
  pdf.rect(0, 0, A4_WIDTH_MM, HEADER_BAND_MM, "F")

  // 2. Full-width Cyan & Gold precision accent rules at bottom
  pdf.setFillColor(CYAN[0], CYAN[1], CYAN[2])
  pdf.rect(0, HEADER_BAND_MM - 0.4, A4_WIDTH_MM, 0.4, "F")
  pdf.setFillColor(GOLD[0], GOLD[1], GOLD[2])
  pdf.rect(0, HEADER_BAND_MM, A4_WIDTH_MM, 0.8, "F")

  // 3. Logo Placement (Crisp, perfectly sized & vertically centered without harsh white block)
  const logoSize = 15
  const logoX = MARGIN_X_MM
  const logoY = 6.5

  if (logoDataUrl) {
    pdf.addImage(logoDataUrl, "PNG", logoX, logoY, logoSize, logoSize)
  }

  const textX = logoX + logoSize + 4.5

  // 4. Wordmark
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(16.5)
  pdf.setTextColor(255, 255, 255)
  pdf.text("NAVIGO", textX, 13)

  // 5. Official Subtitles & Badge
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(7)
  pdf.setTextColor(GOLD[0], GOLD[1], GOLD[2])
  pdf.text("OFFICIAL E-BOARDING PASS", textX, 18)

  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(6.5)
  pdf.setTextColor(148, 163, 184)
  pdf.text("ELECTRONIC PASSENGER COUPON  ·  SECURE TRAVEL DOCUMENT", textX, 22.5)

  // 6. Right-aligned document status / meta block
  const rightX = A4_WIDTH_MM - MARGIN_X_MM

  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(6.2)
  pdf.setTextColor(148, 163, 184)
  pdf.text("DATE OF ISSUE", rightX, 10.5, { align: "right" })

  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(9)
  pdf.setTextColor(255, 255, 255)
  pdf.text(
    new Date().toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
    rightX,
    15.5,
    { align: "right" }
  )

  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(6.8)
  pdf.setTextColor(GOLD[0], GOLD[1], GOLD[2])
  pdf.text("navigo.app  ·  VALIDATED", rightX, 20.5, { align: "right" })
}

function drawFooter(pdf: any, pageNum: number, totalPages: number) {
  pdf.setDrawColor(212, 175, 55)
  pdf.setLineWidth(0.3)
  pdf.line(MARGIN_X_MM, CONTENT_BOTTOM_MM, A4_WIDTH_MM - MARGIN_X_MM, CONTENT_BOTTOM_MM)

  const rules = [
    "• Please arrive at the airport at least 2 hours before domestic departure and 3 hours before international departure.",
    "• Carry a valid government-issued photo ID / passport matching the passenger name shown on this pass at security checkpoints.",
    "• Boarding gates close 40 minutes prior to scheduled departure. Late arrivals may be denied boarding.",
    "• This is a verified electronic travel document issued via Navigo Booking Systems.",
  ]

  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(6.8)
  pdf.setTextColor(115, 125, 140)

  let y = CONTENT_BOTTOM_MM + 4.5
  for (const line of rules) {
    const wrapped = pdf.splitTextToSize(line, CONTENT_WIDTH_MM)
    pdf.text(wrapped, MARGIN_X_MM, y)
    y += wrapped.length * 2.8
  }

  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(7.2)
  pdf.setTextColor(100, 115, 130)
  pdf.text(
    `Navigo Aviation Portal  ·  support@navigo.app  ·  Page ${pageNum} of ${totalPages}`,
    A4_WIDTH_MM / 2,
    292,
    { align: "center" }
  )
}

export async function exportPassesToPdf(elements: HTMLElement[], filename: string) {
  if (elements.length === 0) return

  const [{ default: html2canvas }, { jsPDF }, logoDataUrl] = await Promise.all([
    import("html2canvas-pro"),
    import("jspdf"),
    loadImageDataUrl("/logo.png"),
  ])

  // 1) Capture every pass once and measure its real scaled height up
  // front — pagination below needs actual heights, not an assumed ratio.
  const entries: { canvas: HTMLCanvasElement; heightMm: number }[] = []
  for (const el of elements) {
    const canvas = await html2canvas(el, {
      scale: 2, // crisp on high-DPI screens/printers
      backgroundColor: "#FFFFFF", // real printable page, not the dark app bg
      useCORS: true,
    })
    const heightMm = CONTENT_WIDTH_MM * (canvas.height / canvas.width)
    entries.push({ canvas, heightMm })
  }

  // 2) Greedily pack passes onto A4 pages by real height, so a page holds
  // as many as actually fit instead of a fixed count per page.
  const availableHeight = CONTENT_BOTTOM_MM - CONTENT_TOP_MM
  const pages: (typeof entries)[] = []
  let current: typeof entries = []
  let used = 0

  for (const entry of entries) {
    const needed = entry.heightMm + (current.length > 0 ? PASS_GAP_MM : 0)
    if (current.length > 0 && used + needed > availableHeight) {
      pages.push(current)
      current = [entry]
      used = entry.heightMm
    } else {
      current.push(entry)
      used += needed
    }
  }
  if (current.length) pages.push(current)

  // 3) Draw every page: header, packed pass images (vertically centered
  // when they don't fill the content area), footer.
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })

  pages.forEach((pagePasses, pageIndex) => {
    if (pageIndex > 0) pdf.addPage("a4", "portrait")

    drawHeader(pdf, logoDataUrl)

    // Passes stack from the top of the content area, under the header
    // band — the layout real airline boarding-pass PDFs use. No vertical
    // centering: a single pass sits right below the header, with the
    // footer fine print anchored at the bottom of the page.
    let y = CONTENT_TOP_MM
    for (const entry of pagePasses) {
      const imgData = entry.canvas.toDataURL("image/png")
      pdf.addImage(imgData, "PNG", MARGIN_X_MM, y, CONTENT_WIDTH_MM, entry.heightMm)
      y += entry.heightMm + PASS_GAP_MM
    }

    drawFooter(pdf, pageIndex + 1, pages.length)
  })

  pdf.save(filename)
}