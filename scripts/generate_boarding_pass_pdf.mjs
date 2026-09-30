import fs from "fs"
import path from "path"
import vm from "vm"
import { jsPDF } from "jspdf"

// 1. Extract qrcodegen from bundled node_modules
const qrJsContent = fs.readFileSync("node_modules/qrcode.react/lib/index.js", "utf8")
const match = qrJsContent.match(/var qrcodegen;\n\(\(qrcodegen2\) => \{[\s\S]*?var qrcodegen_default = qrcodegen;/)
if (!match) throw new Error("Could not find qrcodegen inside qrcode.react")

const qrCodeContext = { module: { exports: {} }, exports: {} }
vm.runInNewContext(match[0] + "; module.exports = qrcodegen_default;", qrCodeContext)
const qrcodegen = qrCodeContext.module.exports

// 2. Booking Data for the user's dry run reservation
const booking = {
  pnr: "F53FM2",
  passengerName: "DHRUV SHARMA",
  passengerType: "Adult / Primary",
  airline: "Akasa Air",
  flightNumber: "QP-1302",
  aircraft: "Boeing 737 MAX 8",
  originCode: "DEL",
  originCity: "Delhi",
  originAirport: "Indira Gandhi International Airport, Terminal 3",
  destCode: "BLR",
  destCity: "Bengaluru",
  destAirport: "Kempegowda International Airport, Terminal 1",
  travelDate: "Tuesday, 25 Aug 2026",
  departureTime: "19:10 IST",
  arrivalTime: "21:55 IST",
  duration: "2h 45m",
  gate: "G4",
  seat: "14B",
  seatClass: "Economy Class",
  seatType: "Standard Seat · Window",
  boardingTime: "18:30 IST",
  gateCloses: "18:50 IST",
  baggage: "Cabin 7 kg  |  Check-in 15 kg",
  status: "CONFIRMED & CHECKED IN",
  biometricVerified: true,
  checkInId: "CKIN-F53FM2-01",
  securityToken: "NVG1.F53FM2.QP1302.20260825.VERIFIED.SECURE",
  issuedDate: "24 Sep 2026",
}

// 3. Create PDF
const doc = new jsPDF({
  orientation: "portrait",
  unit: "mm",
  format: "a4",
})

const A4_W = 210
const A4_H = 297
const MARGIN_X = 12
const CONTENT_W = A4_W - MARGIN_X * 2

// Colors
const NAVY = [8, 17, 32]
const GOLD = [212, 175, 55]
const CYAN = [56, 189, 248]
const SLATE_DARK = [15, 23, 42]
const SLATE_MUTED = [100, 116, 139]
const AKASA_ORANGE = [255, 106, 19]
const AKASA_DARK_ORANGE = [140, 59, 11]
const CARD_BG = [248, 246, 240]
const GREEN_VERIFIED = [16, 185, 129]

// ==========================================
// 1. TOP HEADER BAND
// ==========================================
const HEADER_H = 28
doc.setFillColor(...NAVY)
doc.rect(0, 0, A4_W, HEADER_H, "F")

// Cyan & Gold precision accent rules
doc.setFillColor(...CYAN)
doc.rect(0, HEADER_H - 0.5, A4_W, 0.4, "F")
doc.setFillColor(...GOLD)
doc.rect(0, HEADER_H, A4_W, 0.8, "F")

// Logo
const logoBuf = fs.readFileSync("public/logo.png")
const logoData = "data:image/png;base64," + logoBuf.toString("base64")
doc.addImage(logoData, "PNG", MARGIN_X, 6.5, 15, 15)

// Brand text
const textX = MARGIN_X + 15 + 4
doc.setFont("helvetica", "bold")
doc.setFontSize(16.5)
doc.setTextColor(255, 255, 255)
doc.text("NAVIGO", textX, 13)

doc.setFont("helvetica", "bold")
doc.setFontSize(7.5)
doc.setTextColor(...GOLD)
doc.text("OFFICIAL E-BOARDING PASS", textX, 18)

doc.setFont("helvetica", "normal")
doc.setFontSize(6.5)
doc.setTextColor(148, 163, 184)
doc.text("ELECTRONIC PASSENGER COUPON  ·  SECURE AIRPORT TRAVEL DOCUMENT", textX, 22.5)

// Right block: Issue Date & Status
const rightX = A4_W - MARGIN_X
doc.setFont("helvetica", "bold")
doc.setFontSize(6.5)
doc.setTextColor(148, 163, 184)
doc.text("DATE OF ISSUE", rightX, 10.5, { align: "right" })

doc.setFont("helvetica", "bold")
doc.setFontSize(9)
doc.setTextColor(255, 255, 255)
doc.text(booking.issuedDate, rightX, 15.5, { align: "right" })

doc.setFont("helvetica", "bold")
doc.setFontSize(7)
doc.setTextColor(...GOLD)
doc.text("navigo.app  ·  VALIDATED", rightX, 20.5, { align: "right" })

// ==========================================
// 2. MAIN BOARDING PASS CARD
// ==========================================
const CARD_X = MARGIN_X
const CARD_Y = 36
const CARD_W = CONTENT_W
const CARD_H = 118
const STUB_RATIO = 0.70 // 70% main coupon, 30% stub
const STUB_SPLIT_X = CARD_X + CARD_W * STUB_RATIO

// Card Background
doc.setFillColor(...CARD_BG)
doc.roundedRect(CARD_X, CARD_Y, CARD_W, CARD_H, 4, 4, "F")
doc.setDrawColor(203, 213, 225)
doc.setLineWidth(0.3)
doc.roundedRect(CARD_X, CARD_Y, CARD_W, CARD_H, 4, 4, "S")

// Card Header Bar (Akasa Air Orange)
const CARD_HDR_H = 22
doc.setFillColor(...AKASA_ORANGE)
// Custom path or rounded top
doc.roundedRect(CARD_X, CARD_Y, CARD_W, CARD_HDR_H + 4, 4, 4, "F")
// Flatten bottom of header
doc.rect(CARD_X, CARD_Y + 14, CARD_W, 12, "F")

// Akasa Slanted Stripe
doc.setFillColor(...AKASA_DARK_ORANGE)
doc.triangle(CARD_X, CARD_Y, CARD_X + 16, CARD_Y, CARD_X, CARD_Y + CARD_HDR_H + 4, "F")

// Akasa Logo badge
const akasaBuf = fs.readFileSync("public/airlines/akasa.png")
const akasaData = "data:image/png;base64," + akasaBuf.toString("base64")
doc.setFillColor(255, 255, 255)
doc.roundedRect(CARD_X + 9, CARD_Y + 4, 16, 16, 2, 2, "F")
doc.addImage(akasaData, "PNG", CARD_X + 10.5, CARD_Y + 5.5, 13, 13)

// Airline Title & Flight Header
doc.setFont("helvetica", "bold")
doc.setFontSize(14)
doc.setTextColor(255, 255, 255)
doc.text("AKASA AIR", CARD_X + 28, CARD_Y + 12)

doc.setFont("helvetica", "normal")
doc.setFontSize(8)
doc.setTextColor(255, 235, 220)
doc.text(`Flight ${booking.flightNumber}  ·  ${booking.aircraft}`, CARD_X + 28, CARD_Y + 18)

// Header Right side (DigiYatra badge + E-Boarding Pass)
doc.setFont("helvetica", "bold")
doc.setFontSize(11)
doc.setTextColor(255, 255, 255)
doc.text("E-BOARDING PASS", CARD_X + CARD_W - 8, CARD_Y + 11, { align: "right" })

// DigiYatra Pill Badge in Header
doc.setFillColor(254, 240, 138) // soft gold/yellow pill
doc.roundedRect(CARD_X + CARD_W - 52, CARD_Y + 14, 44, 5, 2, 2, "F")
doc.setFont("helvetica", "bold")
doc.setFontSize(6.5)
doc.setTextColor(113, 63, 18)
doc.text("DIGIYATRA VERIFIED", CARD_X + CARD_W - 30, CARD_Y + 17.6, { align: "center" })

// Perforation Divider Line between Main Coupon and Stub
doc.setDrawColor(180, 190, 205)
doc.setLineWidth(0.4)
doc.setLineDash([1.5, 1.5], 0)
doc.line(STUB_SPLIT_X, CARD_Y + CARD_HDR_H + 4, STUB_SPLIT_X, CARD_Y + CARD_H)
doc.setLineDash([], 0) // reset dash

// Perforation notch cutouts (top and bottom of split)
doc.setFillColor(255, 255, 255)
doc.circle(STUB_SPLIT_X, CARD_Y + CARD_HDR_H + 4, 2.5, "F")
doc.circle(STUB_SPLIT_X, CARD_Y + CARD_H, 2.5, "F")

// ------------------------------------------
// MAIN COUPON (LEFT SIDE: CARD_X + 6 to STUB_SPLIT_X - 6)
// ------------------------------------------
const COUPON_LEFT = CARD_X + 8

// Passenger Name & PNR
doc.setFont("helvetica", "normal")
doc.setFontSize(7)
doc.setTextColor(...SLATE_MUTED)
doc.text("PASSENGER NAME", COUPON_LEFT, CARD_Y + 34)

doc.setFont("helvetica", "bold")
doc.setFontSize(14)
doc.setTextColor(...SLATE_DARK)
doc.text(booking.passengerName, COUPON_LEFT, CARD_Y + 41)

// PNR & Booking Ref
const PNR_X = STUB_SPLIT_X - 10
doc.setFont("helvetica", "normal")
doc.setFontSize(7)
doc.setTextColor(...SLATE_MUTED)
doc.text("BOOKING REFERENCE (PNR)", PNR_X, CARD_Y + 34, { align: "right" })

doc.setFont("helvetica", "bold")
doc.setFontSize(14)
doc.setTextColor(...AKASA_ORANGE)
doc.text(booking.pnr, PNR_X, CARD_Y + 41, { align: "right" })

// Horizontal separator line
doc.setDrawColor(226, 232, 240)
doc.setLineWidth(0.25)
doc.line(COUPON_LEFT, CARD_Y + 45, STUB_SPLIT_X - 8, CARD_Y + 45)

// Route Section: DEL -> BLR
// DEL
doc.setFont("helvetica", "bold")
doc.setFontSize(22)
doc.setTextColor(...SLATE_DARK)
doc.text(booking.originCode, COUPON_LEFT, CARD_Y + 56)

doc.setFont("helvetica", "bold")
doc.setFontSize(8)
doc.setTextColor(71, 85, 105)
doc.text(booking.originCity, COUPON_LEFT, CARD_Y + 61)

doc.setFont("helvetica", "normal")
doc.setFontSize(6.5)
doc.setTextColor(...SLATE_MUTED)
doc.text(booking.originAirport, COUPON_LEFT, CARD_Y + 65)

// Flight Arrow & Duration
const MID_ROUTE_X = COUPON_LEFT + 56
doc.setFont("helvetica", "normal")
doc.setFontSize(7.5)
doc.setTextColor(...SLATE_MUTED)
doc.text(`Non-Stop  ·  ${booking.duration}`, MID_ROUTE_X, CARD_Y + 54, { align: "center" })

doc.setDrawColor(...AKASA_ORANGE)
doc.setLineWidth(0.6)
doc.line(MID_ROUTE_X - 16, CARD_Y + 58, MID_ROUTE_X + 16, CARD_Y + 58)
doc.setFillColor(...AKASA_ORANGE)
doc.triangle(MID_ROUTE_X + 16, CARD_Y + 56.5, MID_ROUTE_X + 19, CARD_Y + 58, MID_ROUTE_X + 16, CARD_Y + 59.5, "F")

// BLR
const DEST_X = STUB_SPLIT_X - 10
doc.setFont("helvetica", "bold")
doc.setFontSize(22)
doc.setTextColor(...SLATE_DARK)
doc.text(booking.destCode, DEST_X, CARD_Y + 56, { align: "right" })

doc.setFont("helvetica", "bold")
doc.setFontSize(8)
doc.setTextColor(71, 85, 105)
doc.text(booking.destCity, DEST_X, CARD_Y + 61, { align: "right" })

doc.setFont("helvetica", "normal")
doc.setFontSize(6.5)
doc.setTextColor(...SLATE_MUTED)
doc.text(booking.destAirport, DEST_X, CARD_Y + 65, { align: "right" })

// Flight Info Grid Box (Gate, Seat, Departure, Boarding)
const GRID_Y = CARD_Y + 70
const GRID_W = STUB_SPLIT_X - 8 - COUPON_LEFT
doc.setFillColor(241, 245, 249) // Slate-100 bg box
doc.roundedRect(COUPON_LEFT, GRID_Y, GRID_W, 22, 2, 2, "F")

const colW = GRID_W / 4

// Col 1: Gate
doc.setFont("helvetica", "normal")
doc.setFontSize(6.5)
doc.setTextColor(...SLATE_MUTED)
doc.text("GATE", COUPON_LEFT + 6, GRID_Y + 6)
doc.setFont("helvetica", "bold")
doc.setFontSize(14)
doc.setTextColor(...SLATE_DARK)
doc.text(booking.gate, COUPON_LEFT + 6, GRID_Y + 14)
doc.setFont("helvetica", "normal")
doc.setFontSize(6)
doc.setTextColor(180, 83, 9) // amber notice
doc.text("Closes " + booking.gateCloses, COUPON_LEFT + 6, GRID_Y + 19)

// Col 2: Seat
const col2X = COUPON_LEFT + colW
doc.setFont("helvetica", "normal")
doc.setFontSize(6.5)
doc.setTextColor(...SLATE_MUTED)
doc.text("SEAT", col2X + 4, GRID_Y + 6)
doc.setFont("helvetica", "bold")
doc.setFontSize(14)
doc.setTextColor(...AKASA_ORANGE)
doc.text(booking.seat, col2X + 4, GRID_Y + 14)
doc.setFont("helvetica", "normal")
doc.setFontSize(6)
doc.setTextColor(...SLATE_MUTED)
doc.text(booking.seatClass, col2X + 4, GRID_Y + 19)

// Col 3: Boarding Time
const col3X = COUPON_LEFT + colW * 2
doc.setFont("helvetica", "normal")
doc.setFontSize(6.5)
doc.setTextColor(...SLATE_MUTED)
doc.text("BOARDING", col3X + 4, GRID_Y + 6)
doc.setFont("helvetica", "bold")
doc.setFontSize(12)
doc.setTextColor(220, 38, 38) // red accent for urgency
doc.text(booking.boardingTime, col3X + 4, GRID_Y + 14)
doc.setFont("helvetica", "normal")
doc.setFontSize(6)
doc.setTextColor(...SLATE_MUTED)
doc.text("Starts on-time", col3X + 4, GRID_Y + 19)

// Col 4: Departure Time & Date
const col4X = COUPON_LEFT + colW * 3
doc.setFont("helvetica", "normal")
doc.setFontSize(6.5)
doc.setTextColor(...SLATE_MUTED)
doc.text("DEPARTURE", col4X + 4, GRID_Y + 6)
doc.setFont("helvetica", "bold")
doc.setFontSize(12)
doc.setTextColor(...SLATE_DARK)
doc.text(booking.departureTime, col4X + 4, GRID_Y + 14)
doc.setFont("helvetica", "normal")
doc.setFontSize(6)
doc.setTextColor(...SLATE_MUTED)
doc.text("25 Aug 2026", col4X + 4, GRID_Y + 19)

// Bottom Barcode & Travel Notes
const BARCODE_Y = CARD_Y + 98
// Draw authentic Code128-style barcode pattern
function generateBarWidths(seed, bars = 48) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  const next = () => {
    h ^= h << 13; h >>>= 0
    h ^= h >>> 17
    h ^= h << 5; h >>>= 0
    return h / 4294967295
  }
  return Array.from({ length: bars }, () => (next() > 0.52 ? 0.65 : 0.3) + (next() > 0.8 ? 0.35 : 0))
}

const barWidths = generateBarWidths(`${booking.pnr}:${booking.originCode}:${booking.destCode}:${booking.seat}`)
let barX = COUPON_LEFT
doc.setFillColor(15, 23, 42)
for (const bw of barWidths) {
  doc.rect(barX, BARCODE_Y, bw, 8.5, "F")
  barX += bw + 0.32
}

doc.setFont("helvetica", "bold")
doc.setFontSize(6)
doc.setTextColor(...SLATE_MUTED)
doc.text(`* ${booking.pnr} *  ·  ETKT: 2026-981244  ·  SEQ: 028`, COUPON_LEFT, BARCODE_Y + 12)

// Important note on the right of barcode
doc.setFont("helvetica", "italic")
doc.setFontSize(5.8)
doc.setTextColor(100, 116, 139)
doc.text("Boarding gates close 40 minutes before departure.", STUB_SPLIT_X - 10, BARCODE_Y + 4, { align: "right" })
doc.text("Report to boarding gate by 18:30 IST.", STUB_SPLIT_X - 10, BARCODE_Y + 7.5, { align: "right" })
doc.text("Carry valid government photo ID.", STUB_SPLIT_X - 10, BARCODE_Y + 11, { align: "right" })

// ------------------------------------------
// PASSENGER STUB (RIGHT SIDE: STUB_SPLIT_X to CARD_X + CARD_W)
// ------------------------------------------
const STUB_LEFT = STUB_SPLIT_X + 6
const STUB_RIGHT = CARD_X + CARD_W - 6

doc.setFont("helvetica", "bold")
doc.setFontSize(7.5)
doc.setTextColor(...SLATE_MUTED)
doc.text("BOARDING PASS", STUB_LEFT, CARD_Y + 34)

doc.setFont("helvetica", "bold")
doc.setFontSize(9)
doc.setTextColor(...SLATE_DARK)
doc.text(booking.passengerName, STUB_LEFT, CARD_Y + 41)

doc.setFont("helvetica", "normal")
doc.setFontSize(6.5)
doc.setTextColor(...SLATE_MUTED)
doc.text("FLIGHT", STUB_LEFT, CARD_Y + 48)
doc.setFont("helvetica", "bold")
doc.setFontSize(8)
doc.setTextColor(...SLATE_DARK)
doc.text(booking.flightNumber, STUB_LEFT, CARD_Y + 53)

doc.setFont("helvetica", "normal")
doc.setFontSize(6.5)
doc.setTextColor(...SLATE_MUTED)
doc.text("SEAT", STUB_LEFT + 22, CARD_Y + 48)
doc.setFont("helvetica", "bold")
doc.setFontSize(8.5)
doc.setTextColor(...AKASA_ORANGE)
doc.text(booking.seat, STUB_LEFT + 22, CARD_Y + 53)

doc.setFont("helvetica", "normal")
doc.setFontSize(6.5)
doc.setTextColor(...SLATE_MUTED)
doc.text("GATE", STUB_RIGHT, CARD_Y + 48, { align: "right" })
doc.setFont("helvetica", "bold")
doc.setFontSize(8)
doc.setTextColor(...SLATE_DARK)
doc.text(booking.gate, STUB_RIGHT, CARD_Y + 53, { align: "right" })

doc.setFont("helvetica", "normal")
doc.setFontSize(6.5)
doc.setTextColor(...SLATE_MUTED)
doc.text("ROUTE", STUB_LEFT, CARD_Y + 60)
doc.setFont("helvetica", "bold")
doc.setFontSize(8)
doc.setTextColor(...SLATE_DARK)
doc.text(`${booking.originCode} -> ${booking.destCode}`, STUB_LEFT, CARD_Y + 65)

doc.setFont("helvetica", "normal")
doc.setFontSize(6.5)
doc.setTextColor(...SLATE_MUTED)
doc.text("DATE", STUB_RIGHT, CARD_Y + 60, { align: "right" })
doc.setFont("helvetica", "bold")
doc.setFontSize(8)
doc.setTextColor(...SLATE_DARK)
doc.text("25 AUG 2026", STUB_RIGHT, CARD_Y + 65, { align: "right" })

// Generate and draw high-res 2D Vector QR Code
const qrUrl = `https://navigo.app/gate/verify?token=${encodeURIComponent(booking.securityToken)}&pnr=${booking.pnr}`
const qr = qrcodegen.QrCode.encodeText(qrUrl, qrcodegen.QrCode.Ecc.MEDIUM)
const qrSize = qr.size
const QR_BOX_SIZE = 29 // 29mm on paper
const QR_X = STUB_LEFT + ((STUB_RIGHT - STUB_LEFT) - QR_BOX_SIZE) / 2
const QR_Y = CARD_Y + 72
const cellSize = QR_BOX_SIZE / qrSize

// QR Background
doc.setFillColor(255, 255, 255)
doc.roundedRect(QR_X - 1.5, QR_Y - 1.5, QR_BOX_SIZE + 3, QR_BOX_SIZE + 3, 1.5, 1.5, "F")
doc.setDrawColor(226, 232, 240)
doc.setLineWidth(0.2)
doc.roundedRect(QR_X - 1.5, QR_Y - 1.5, QR_BOX_SIZE + 3, QR_BOX_SIZE + 3, 1.5, 1.5, "S")

// Render crisp QR modules
doc.setFillColor(15, 23, 42)
for (let r = 0; r < qrSize; r++) {
  for (let c = 0; c < qrSize; c++) {
    if (qr.getModule(c, r)) {
      doc.rect(QR_X + c * cellSize, QR_Y + r * cellSize, cellSize + 0.05, cellSize + 0.05, "F")
    }
  }
}

// QR Subtitle & Security Notice
doc.setFont("helvetica", "bold")
doc.setFontSize(6.2)
doc.setTextColor(...GREEN_VERIFIED)
doc.text("DIGIYATRA SMART PASS", QR_X + QR_BOX_SIZE / 2, QR_Y + QR_BOX_SIZE + 4.5, { align: "center" })

doc.setFont("helvetica", "normal")
doc.setFontSize(5.5)
doc.setTextColor(...SLATE_MUTED)
doc.text("Scan at Security & E-Gate", QR_X + QR_BOX_SIZE / 2, QR_Y + QR_BOX_SIZE + 7.5, { align: "center" })

// ==========================================
// 3. DIGIYATRA BIOMETRIC STATUS BANNER
// ==========================================
const DY_Y = 160
const DY_H = 22
doc.setFillColor(240, 253, 244) // emerald-50
doc.roundedRect(MARGIN_X, DY_Y, CONTENT_W, DY_H, 2.5, 2.5, "F")
doc.setDrawColor(187, 247, 208) // emerald-200
doc.setLineWidth(0.3)
doc.roundedRect(MARGIN_X, DY_Y, CONTENT_W, DY_H, 2.5, 2.5, "S")

// Icon circle & checkmark drawn cleanly
doc.setFillColor(16, 185, 129) // emerald-500
doc.circle(MARGIN_X + 8, DY_Y + 11, 4.5, "F")
doc.setDrawColor(255, 255, 255)
doc.setLineWidth(0.7)
// checkmark lines:
doc.line(MARGIN_X + 6.2, DY_Y + 11, MARGIN_X + 7.6, DY_Y + 12.6)
doc.line(MARGIN_X + 7.6, DY_Y + 12.6, MARGIN_X + 10.2, DY_Y + 9.5)

// Verification text
doc.setFont("helvetica", "bold")
doc.setFontSize(8.5)
doc.setTextColor(6, 95, 70) // emerald-800
doc.text("DigiYatra Contactless Fast-Track Enrolled & Verified", MARGIN_X + 16, DY_Y + 8)

doc.setFont("helvetica", "normal")
doc.setFontSize(7)
doc.setTextColor(21, 128, 61) // emerald-700
doc.text("Biometric profile matched with Aadhaar credentials. Proceed through dedicated DigiYatra e-gates at Delhi T3 without physical document verification.", MARGIN_X + 16, DY_Y + 13.5)

doc.setFont("helvetica", "bold")
doc.setFontSize(6.5)
doc.setTextColor(4, 120, 87)
doc.text(`Digital Verification ID: DY-DEL-${booking.pnr}-2026  ·  Token: HS256-SIGNED-OK`, MARGIN_X + 16, DY_Y + 18.5)

// ==========================================
// 4. AIRPORT TRAVEL GUIDELINES & PASSENGER ADVISORY
// ==========================================
const ADV_Y = 188
doc.setFont("helvetica", "bold")
doc.setFontSize(8.5)
doc.setTextColor(...SLATE_DARK)
doc.text("IMPORTANT PASSENGER ADVISORY & TRAVEL GUIDELINES", MARGIN_X, ADV_Y)

doc.setDrawColor(203, 213, 225)
doc.setLineWidth(0.2)
doc.line(MARGIN_X, ADV_Y + 2, MARGIN_X + CONTENT_W, ADV_Y + 2)

const guidelines = [
  {
    title: "1. Mandatory Identification",
    desc: "All passengers must present a government-issued photo ID (Aadhaar Card, Passport, Voter ID, or Driving License) matching the name on this boarding pass at the airport terminal entry."
  },
  {
    title: "2. Check-in Baggage Drop & Deadlines",
    desc: "Check-in baggage allowance is 15 kg (1 piece). Baggage drop counters close strictly 60 minutes prior to scheduled departure. Excess baggage will be charged at standard airline counter rates."
  },
  {
    title: "3. Hand Baggage Restrictions",
    desc: "Only one piece of hand baggage (max 7 kg) plus one personal item (laptop bag/handbag) is permitted in the cabin. All power banks, spare lithium batteries, and e-cigarettes must be carried in cabin baggage only."
  },
  {
    title: "4. Boarding Gate Closure",
    desc: "Boarding gates open 45 minutes prior to departure and close strictly 20 minutes before flight departure (18:50 IST). Passengers failing to report before gate closure will not be allowed to board."
  },
  {
    title: "5. Security & Prohibited Items",
    desc: "Liquids, gels, and aerosols over 100ml are prohibited in hand baggage. Ensure compliance with BCAS regulations. Cooperation during security frisking is mandatory."
  }
]

let curY = ADV_Y + 7
for (const g of guidelines) {
  doc.setFont("helvetica", "bold")
  doc.setFontSize(7.2)
  doc.setTextColor(30, 41, 59)
  doc.text(g.title, MARGIN_X, curY)
  
  doc.setFont("helvetica", "normal")
  doc.setFontSize(6.6)
  doc.setTextColor(71, 85, 105)
  const wrapped = doc.splitTextToSize(g.desc, CONTENT_W)
  doc.text(wrapped, MARGIN_X, curY + 3.8)
  curY += 4 + wrapped.length * 2.8 + 1.2
}

// ==========================================
// 5. OFFICIAL FOOTER
// ==========================================
const FOOTER_Y = 268
doc.setDrawColor(...GOLD)
doc.setLineWidth(0.3)
doc.line(MARGIN_X, FOOTER_Y, A4_W - MARGIN_X, FOOTER_Y)

const footerRules = [
  "• This document is an officially issued Electronic Boarding Pass by Navigo Flight Booking Systems for Akasa Air QP-1302.",
  "• This travel coupon is non-transferable and valid only for the passenger named herein on the specified date and flight.",
  "• In case of flight delays or gate changes, refer to flight information display systems (FIDS) or Navigo mobile portal updates.",
]

doc.setFont("helvetica", "normal")
doc.setFontSize(6.5)
doc.setTextColor(100, 116, 139)

let fy = FOOTER_Y + 4.5
for (const line of footerRules) {
  doc.text(line, MARGIN_X, fy)
  fy += 3.2
}

doc.setFont("helvetica", "bold")
doc.setFontSize(7.2)
doc.setTextColor(71, 85, 105)
doc.text(
  "Navigo Aviation Portal  ·  support@navigo.app  ·  Issued Under IATA Electronic Ticketing Standards  ·  Page 1 of 1",
  A4_W / 2,
  291,
  { align: "center" }
)

// ==========================================
// SAVE PDF
// ==========================================
const pdfBytes = Buffer.from(doc.output("arraybuffer"))

// 1. Save in public/ for web access
const publicPath = path.resolve("public/boarding-pass-F53FM2.pdf")
fs.writeFileSync(publicPath, pdfBytes)

// 2. Save in artifact directory
const artifactDir = "/Users/dhruv/.gemini/antigravity/brain/67b46b1c-8a51-4e0f-8507-a9e32c6aeb33"
const artifactPath = path.join(artifactDir, "boarding-pass-F53FM2.pdf")
fs.writeFileSync(artifactPath, pdfBytes)

console.log("PDF Boarding Pass successfully generated!")
console.log(`Public path: ${publicPath} (${pdfBytes.length} bytes)`)
console.log(`Artifact path: ${artifactPath} (${pdfBytes.length} bytes)`)
