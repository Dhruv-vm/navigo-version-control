// Requires two packages:
//   npm install jspdf html2canvas-pro
//
// ✅ Real A4 document: fixed 210×297mm pages with a Navigo header (logo,
// title, generated-date, gold/gray rule) and an airline-style footer
// (arrival/ID/gate-closing boilerplate + page numbering), both drawn with
// jsPDF's own text/line primitives so they stay crisp at any zoom or
// print size instead of being part of the captured image.
//
// Passes are captured once up front, their real rendered heights
// measured, then greedily packed onto pages — a page holds as many
// passes as actually fit rather than a fixed count. When a page's
// packed passes don't fill the available content area, they're
// vertically centered instead of pinned to the top, so a 1-pass page
// doesn't look like an accident with a huge gap underneath.
//
// Uses html2canvas-pro, not html2canvas — plain html2canvas can't parse
// the oklab()/color-mix() color functions Tailwind v4 generates for any
// opacity-modifier class, which this card uses throughout.

const A4_WIDTH_MM = 210
const A4_HEIGHT_MM = 297
const MARGIN_X_MM = 15
const CONTENT_WIDTH_MM = A4_WIDTH_MM - MARGIN_X_MM * 2
const CONTENT_TOP_MM = 34 // below header + rule
const CONTENT_BOTTOM_MM = 267 // above footer rule
const PASS_GAP_MM = 8

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
  let textX = MARGIN_X_MM

  if (logoDataUrl) {
    pdf.addImage(logoDataUrl, "PNG", MARGIN_X_MM, 9, 11, 11)
    textX = MARGIN_X_MM + 15
  }

  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(17)
  pdf.setTextColor(10, 20, 36)
  pdf.text("NAVIGO", textX, 16)

  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(8.5)
  pdf.setTextColor(100, 100, 100)
  pdf.text("E-BOARDING PASS · OFFICIAL TRAVEL DOCUMENT", textX, 20.5)

  pdf.setFontSize(8)
  pdf.setTextColor(130, 130, 130)
  const generatedLabel = `Generated ${new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}`
  pdf.text(generatedLabel, A4_WIDTH_MM - MARGIN_X_MM, 12, { align: "right" })

  // gold accent rule, thin gray rule underneath — matches the amber/navy
  // accent used throughout the checkout flow rather than a generic line
  pdf.setDrawColor(212, 175, 55)
  pdf.setLineWidth(0.6)
  pdf.line(MARGIN_X_MM, 25.5, A4_WIDTH_MM - MARGIN_X_MM, 25.5)
  pdf.setDrawColor(225, 225, 225)
  pdf.setLineWidth(0.2)
  pdf.line(MARGIN_X_MM, 26.3, A4_WIDTH_MM - MARGIN_X_MM, 26.3)
}

function drawFooter(pdf: any, pageNum: number, totalPages: number) {
  pdf.setDrawColor(225, 225, 225)
  pdf.setLineWidth(0.2)
  pdf.line(MARGIN_X_MM, CONTENT_BOTTOM_MM, A4_WIDTH_MM - MARGIN_X_MM, CONTENT_BOTTOM_MM)

  const rules = [
    "Please arrive at the airport at least 2 hours before domestic departure and 3 hours before international departure.",
    "Carry a valid government-issued photo ID matching the passenger name shown on this pass at every security checkpoint.",
    "Boarding gates close 40 minutes prior to scheduled departure. Late arrivals may be denied boarding.",
    "This is a computer-generated document and does not require a signature or stamp to be valid.",
  ]

  pdf.setFont("helvetica", "italic")
  pdf.setFontSize(7.2)
  pdf.setTextColor(115, 115, 115)

  let y = CONTENT_BOTTOM_MM + 5
  for (const line of rules) {
    const wrapped = pdf.splitTextToSize(line, CONTENT_WIDTH_MM)
    pdf.text(wrapped, MARGIN_X_MM, y)
    y += wrapped.length * 3.2
  }

  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(7.5)
  pdf.setTextColor(140, 140, 140)
  pdf.text(
    `Navigo Airways · support@navigo.app · Page ${pageNum} of ${totalPages}`,
    A4_WIDTH_MM / 2,
    293,
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

    const totalPassHeight =
      pagePasses.reduce((sum, e) => sum + e.heightMm, 0) + PASS_GAP_MM * (pagePasses.length - 1)
    const centeringOffset = Math.max(0, (availableHeight - totalPassHeight) / 2)

    let y = CONTENT_TOP_MM + centeringOffset
    for (const entry of pagePasses) {
      const imgData = entry.canvas.toDataURL("image/png")
      pdf.addImage(imgData, "PNG", MARGIN_X_MM, y, CONTENT_WIDTH_MM, entry.heightMm)
      y += entry.heightMm + PASS_GAP_MM
    }

    drawFooter(pdf, pageIndex + 1, pages.length)
  })

  pdf.save(filename)
}