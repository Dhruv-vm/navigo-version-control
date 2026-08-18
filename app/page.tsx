"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Navbar from "@/components/navbar"
import SearchBox from "@/components/searchbox"
import { computeDynamicPrice } from "@/lib/pricing"

// ── Taxes & Fee Constants ──────────────────────────────────────────────────
// 12% GST + 7% Airport Development / Security fees (19% total), matching checkout
const TAX_RATE = 0.19

// ── Route Definitions ──────────────────────────────────────────────────────
type RouteData = {
  from: string
  to: string
  label: string
  basePrice: number
  price: string
  taxLabel: string
  totalFare: number
  tag: string | null
  tagType?: "drop" | "booked" | "quick" | "top"
  bookingCount?: number
}

const DEFAULT_ROUTES_BASE = [
  { from: "DEL", to: "BLR", label: "Delhi → Bangalore", basePrice: 5200, tag: "Most Booked", tagType: "booked" as const },
  { from: "BLR", to: "DEL", label: "Bangalore → Delhi", basePrice: 5200, tag: "Price Drop", tagType: "drop" as const },
  { from: "BOM", to: "DEL", label: "Mumbai → Delhi",    basePrice: 3800, tag: "Price Drop", tagType: "drop" as const },
  { from: "BLR", to: "HYD", label: "Bangalore → Hyd",  basePrice: 2200, tag: "Quick Hop",  tagType: "quick" as const },
  { from: "DEL", to: "DXB", label: "Delhi → Dubai",     basePrice: 29000, tag: "International", tagType: "top" as const },
  { from: "DEL", to: "NRT", label: "Delhi → Tokyo",     basePrice: 48000, tag: "Top Corridor", tagType: "top" as const },
  { from: "MAA", to: "BOM", label: "Chennai → Mumbai",  basePrice: 2800, tag: null, tagType: undefined },
]

function getInitialRoutes(): RouteData[] {
  const todayStr = new Date().toISOString().slice(0, 10)
  return DEFAULT_ROUTES_BASE.map((r) => {
    const pricing = computeDynamicPrice({
      basePrice: r.basePrice,
      availableSeats: 94,
      travelDate: todayStr,
    })
    const total = pricing.finalPrice
    const tax = Math.round(total * (TAX_RATE / (1 + TAX_RATE)))
    return {
      ...r,
      totalFare: total,
      price: `₹${total.toLocaleString("en-IN")}`,
      taxLabel: `incl. ₹${tax.toLocaleString("en-IN")} taxes`,
    }
  })
}

const DEFAULT_ROUTES: RouteData[] = getInitialRoutes()

function generate7DayPrices(basePrice: number) {
  const today = new Date()
  const days = []

  for (let i = 0; i < 7; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, "0")
    const dd = String(d.getDate()).padStart(2, "0")
    const dateStr = `${yyyy}-${mm}-${dd}`

    const pricing = computeDynamicPrice({
      basePrice,
      availableSeats: 94,
      travelDate: dateStr,
      today,
    })

    const calculatedPrice = pricing.finalPrice
    const calculatedBase = pricing.basePrice

    const level =
      pricing.combinedMultiplier <= 0.96
        ? 1
        : pricing.combinedMultiplier <= 1.05
        ? 2
        : pricing.combinedMultiplier <= 1.2
        ? 3
        : 4

    const dayLabel =
      i === 0
        ? "Today"
        : i === 1
        ? "Tmrw"
        : d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric" })

    const fullDate = d.toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
    })

    const taxAmount = Math.round(calculatedPrice * (TAX_RATE / (1 + TAX_RATE)))
    const netBase = calculatedPrice - taxAmount

    days.push({
      date: dayLabel,
      fullDate,
      dateStr,
      baseFare: netBase,
      taxAmount,
      totalPrice: calculatedPrice,
      price: `₹${calculatedPrice.toLocaleString("en-IN")}`,
      level,
    })
  }

  return days
}

function getRouteInsights(
  from: string,
  to: string,
  minTotal: number,
  avgTotal: number,
  isMostBooked: boolean
) {
  const dropPct = Math.round(((avgTotal - minTotal) / (avgTotal || 1)) * 100)
  return [
    {
      icon: "📉",
      title: isMostBooked ? "High Demand Corridor" : "Prices dropping",
      body: isMostBooked
        ? `${from}–${to} is our #1 booked route. Total all-inclusive fares start from ₹${minTotal.toLocaleString("en-IN")}.`
        : `${from}–${to} all-in fares down ${Math.max(8, dropPct)}% vs peak weekend. Good time to book.`,
    },
    {
      icon: "⚡",
      title: "Book 48h in advance",
      body: `Fares on ${from}–${to} climb 18–25% within 48 hours of departure as economy inventory tightens.`,
    },
    {
      icon: "🌙",
      title: "Fly mid-week & save",
      body: `Tuesday & Wednesday all-inclusive departures average ₹${Math.round(
        avgTotal * 0.15
      ).toLocaleString("en-IN")} cheaper than weekend flights.`,
    },
  ]
}

export default function Home() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [routes, setRoutes] = useState<RouteData[]>(DEFAULT_ROUTES)
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0)

  // Auth check & load live bookings to dynamically rank routes
  useEffect(() => {
    const checkAuthAndBookings = async () => {
      const token = localStorage.getItem("token")
      if (!token) {
        router.replace("/login")
        return
      }
      try {
        const res = await fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) {
          localStorage.removeItem("token")
          router.replace("/login")
          return
        }

        // Fetch bookings to dynamically score and rank popular routes
        try {
          const bookingsRes = await fetch("/api/bookings", {
            headers: { Authorization: `Bearer ${token}` },
          })
          if (bookingsRes.ok) {
            const bookingsData = await bookingsRes.json()
            const bookingsList = Array.isArray(bookingsData)
              ? bookingsData
              : bookingsData?.bookings ?? []

            // Count bookings per route
            const counts: Record<string, number> = {}
            for (const b of bookingsList) {
              const from = b.origin || b.legs?.[0]?.origin
              const to = b.destination || b.legs?.[0]?.destination
              if (from && to) {
                const key = `${from}-${to}`
                counts[key] = (counts[key] || 0) + 1
              }
            }

            // Re-order and enrich routes with live booking data & tax-inclusive prices
            const updatedRoutes = DEFAULT_ROUTES.map((r) => {
              const count = counts[`${r.from}-${r.to}`] || 0
              let tag = r.tag
              let tagType = r.tagType
              if (count > 0) {
                tag = count >= 2 ? "Most Booked" : "Frequent Pick"
                tagType = count >= 2 ? "booked" : "drop"
              }
              return { ...r, bookingCount: count, tag, tagType }
            })

            // Sort: routes with bookings first
            updatedRoutes.sort((a, b) => (b.bookingCount || 0) - (a.bookingCount || 0))
            setRoutes(updatedRoutes)
          }
        } catch (bErr) {
          console.warn("Could not fetch bookings for route analytics:", bErr)
        }

        setLoading(false)
      } catch {
        localStorage.removeItem("token")
        router.replace("/login")
      }
    }
    checkAuthAndBookings()
  }, [router])

  const selectedRoute = routes[selectedRouteIndex] || routes[0]

  // Dynamic 7-day prices for the currently selected route (with taxes included)
  const cheapDates = useMemo(() => {
    return generate7DayPrices(selectedRoute.basePrice)
  }, [selectedRoute.basePrice])

  // Find the cheapest date among the 7 days
  const cheapestDay = useMemo(() => {
    return [...cheapDates].sort((a, b) => a.totalPrice - b.totalPrice)[0] || cheapDates[0]
  }, [cheapDates])

  const avgTotal = useMemo(() => {
    const sum = cheapDates.reduce((acc, curr) => acc + curr.totalPrice, 0)
    return Math.round(sum / cheapDates.length)
  }, [cheapDates])

  // Dynamic AI Insights for selected route
  const dynamicInsights = useMemo(() => {
    const isMostBooked = selectedRoute.tag === "Most Booked" || (selectedRoute.bookingCount || 0) > 0
    return getRouteInsights(
      selectedRoute.from,
      selectedRoute.to,
      cheapestDay.totalPrice,
      avgTotal,
      isMostBooked
    )
  }, [selectedRoute, cheapestDay, avgTotal])

  // Bar height computation relative to min and max prices
  const minBarPrice = Math.min(...cheapDates.map((d) => d.totalPrice))
  const maxBarPrice = Math.max(...cheapDates.map((d) => d.totalPrice))
  const span = maxBarPrice - minBarPrice || 1

  const handleSelectDate = (dateStr: string) => {
    router.push(
      `/flights?origin=${selectedRoute.from}&destination=${selectedRoute.to}&depart=${dateStr}&mode=oneway&pax=1`
    )
  }

  const handleLaunchRouteSearch = () => {
    router.push(
      `/flights?origin=${selectedRoute.from}&destination=${selectedRoute.to}&depart=${cheapestDay.dateStr}&mode=oneway&pax=1`
    )
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#020617] text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 rounded-full border-2 border-cyan-400/30 border-t-cyan-400 animate-spin" />
          <div className="text-sm text-slate-400 tracking-wide">Loading Navigo...</div>
        </div>
      </div>
    )
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@700;800&display=swap');

        /* ── Tokens ── */
        :root {
          --gold: #F59E0B;
          --gold-soft: #FBBF24;
          --blue: #60A5FA;
          --cyan: #22D3EE;
          --navy: #020617;
          --card: rgba(255,255,255,0.045);
          --card-hover: rgba(255,255,255,0.065);
          --border: rgba(255,255,255,0.09);
          --border-hover: rgba(251,191,36,0.28);
          --text: #F5F7FF;
          --muted: #64748B;
          --soft: #94A3B8;
          font-family: 'Manrope', ui-sans-serif, system-ui, sans-serif;
        }

        @keyframes hpFadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes hpFloatGlow {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(-8px, 8px); }
        }

        .hp-hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 18px;
          border-radius: 999px;
          font-size: 13px;
          font-weight: 600;
          color: #fde68a;
          background: linear-gradient(135deg, rgba(56,189,248,0.14), rgba(245,158,11,0.14));
          border: 1px solid rgba(251,191,36,0.35);
          box-shadow: 0 4px 20px -6px rgba(251,191,36,0.35);
          cursor: pointer;
          transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s;
          animation: hpFadeUp 0.6s ease-out 0.15s both;
        }
        .hp-hero-badge:hover {
          border-color: rgba(251,191,36,0.6);
          box-shadow: 0 6px 26px -6px rgba(251,191,36,0.5);
          transform: translateY(-1px);
        }

        /* ── Section grid ── */
        .hp-sections {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 22px;
        }
        @media (max-width: 900px) {
          .hp-sections { grid-template-columns: 1fr; }
        }

        /* ── Card base ── */
        .hp-card {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 22px;
          padding: 26px;
          backdrop-filter: blur(20px);
          position: relative;
          overflow: hidden;
          transition: border-color 0.3s, box-shadow 0.3s, background 0.3s, transform 0.3s;
          animation: hpFadeUp 0.6s ease-out both;
          box-shadow: 0 4px 24px -8px rgba(0,0,0,0.4);
        }
        .hp-card::before {
          content: "";
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 2px;
          background: linear-gradient(90deg, var(--blue), var(--gold-soft), var(--gold));
          opacity: 0.85;
        }
        .hp-card:nth-child(1) { animation-delay: 0.05s; }
        .hp-card:nth-child(2) { animation-delay: 0.12s; }
        .hp-card:nth-child(3) { animation-delay: 0.19s; }
        .hp-card:hover {
          border-color: var(--border-hover);
          background: var(--card-hover);
          box-shadow: 0 16px 48px -12px rgba(0,0,0,0.55);
          transform: translateY(-3px);
        }
        .hp-card-glow {
          position: absolute;
          width: 200px; height: 200px;
          border-radius: 50%;
          filter: blur(70px);
          opacity: 0.24;
          pointer-events: none;
          top: -50px; right: -50px;
          animation: hpFloatGlow 8s ease-in-out infinite;
        }

        /* ── Card headers ── */
        .hp-card-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
        }
        .hp-card-title {
          font-family: 'Manrope', ui-sans-serif, system-ui, sans-serif;
          font-size: 16px;
          font-weight: 800;
          color: var(--text);
          letter-spacing: 0.005em;
        }
        .hp-card-eyebrow {
          font-size: 10.5px;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--muted);
          margin-bottom: 6px;
        }
        .hp-card-icon {
          width: 38px; height: 38px;
          border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          font-size: 17px;
          background: rgba(251,191,36,0.14);
          border: 1px solid rgba(251,191,36,0.3);
        }

        /* ── Route rows ── */
        .hp-route-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 14px;
          border-radius: 14px;
          margin-bottom: 8px;
          background: rgba(255,255,255,0.025);
          border: 1px solid transparent;
          cursor: pointer;
          transition: background 0.2s, border-color 0.2s, transform 0.2s;
        }
        .hp-route-row:hover {
          background: rgba(251,191,36,0.1);
          border-color: rgba(251,191,36,0.3);
          transform: translateX(2px);
        }
        .hp-route-row.is-active {
          background: rgba(251,191,36,0.12);
          border-color: rgba(251,191,36,0.5);
          box-shadow: 0 0 16px rgba(251,191,36,0.18);
        }
        .hp-route-left { display: flex; align-items: center; gap: 10px; }
        .hp-route-plane {
          width: 26px; height: 26px;
          border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          font-size: 12px;
          background: linear-gradient(135deg, rgba(251,191,36,0.22), rgba(34,211,238,0.15));
          flex-shrink: 0;
        }
        .hp-route-label { font-size: 13.5px; color: var(--text); font-weight: 600; }
        .hp-route-price {
          font-family: 'Manrope', ui-sans-serif, system-ui, sans-serif;
          font-size: 14.5px; font-weight: 800; color: var(--gold-soft);
          text-align: right;
        }
        .hp-route-tax-label {
          font-size: 9px;
          color: #10B981;
          font-weight: 600;
          text-align: right;
          letter-spacing: 0.02em;
        }
        .hp-route-tag {
          font-size: 9.5px;
          padding: 3px 9px;
          border-radius: 20px;
          background: rgba(251,191,36,0.16);
          border: 1px solid rgba(251,191,36,0.35);
          color: #fbbf24;
          font-weight: 800;
          letter-spacing: 0.05em;
          margin-left: 4px;
          text-transform: uppercase;
        }
        .hp-route-tag.drop { background: rgba(34,211,238,0.14); border-color: rgba(34,211,238,0.35); color: var(--cyan); }

        /* ── Price bars ── */
        .hp-bars {
          display: flex;
          align-items: flex-end;
          gap: 7px;
          height: 92px;
          margin-bottom: 12px;
          padding-top: 4px;
        }
        .hp-bar-wrap {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          height: 100%;
          justify-content: flex-end;
          cursor: pointer;
          transition: transform 0.2s;
        }
        .hp-bar-wrap:hover { transform: translateY(-2px); }
        .hp-bar {
          width: 100%;
          border-radius: 8px 8px 3px 3px;
          background-image: linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0) 40%);
          background-blend-mode: overlay;
          transition: opacity 0.2s, filter 0.2s, transform 0.2s, height 0.4s ease-out;
          min-height: 8px;
        }
        .hp-bar-wrap:hover .hp-bar { filter: brightness(1.15); }
        .hp-bar-date {
          font-size: 9px;
          color: var(--muted);
          text-align: center;
          white-space: nowrap;
          letter-spacing: 0.02em;
          margin-top: 4px;
        }
        .hp-bar-price {
          font-size: 9px;
          color: var(--soft);
          font-weight: 700;
        }
        .hp-bar-best {
          font-size: 11.5px;
          color: var(--gold-soft);
          font-weight: 700;
          margin-top: 8px;
          padding: 8px 12px;
          border-radius: 10px;
          background: rgba(251,191,36,0.08);
          border: 1px solid rgba(251,191,36,0.22);
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: pointer;
          transition: background 0.2s, border-color 0.2s;
        }
        .hp-bar-best:hover {
          background: rgba(251,191,36,0.15);
          border-color: rgba(251,191,36,0.4);
        }

        /* ── Insight items ── */
        .hp-insight-row {
          display: flex;
          gap: 14px;
          align-items: flex-start;
          padding: 13px 0;
          border-bottom: 1px solid var(--border);
        }
        .hp-insight-row:last-child { border-bottom: none; padding-bottom: 0; }
        .hp-insight-icon {
          width: 38px; height: 38px;
          border-radius: 11px;
          background: linear-gradient(135deg, rgba(34,211,238,0.18), rgba(245,158,11,0.14));
          border: 1px solid rgba(255,255,255,0.08);
          display: flex; align-items: center; justify-content: center;
          font-size: 18px;
          flex-shrink: 0;
        }
        .hp-insight-title {
          font-size: 13.5px; font-weight: 600; color: var(--text);
          margin-bottom: 3px;
        }
        .hp-insight-body { font-size: 12px; color: var(--soft); line-height: 1.55; }

        /* ── Section label ── */
        .hp-section-label {
          font-size: 11.5px;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--muted);
          margin-bottom: 22px;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .hp-section-label::before {
          content: "";
          width: 6px; height: 6px;
          border-radius: 50%;
          background: var(--cyan);
          box-shadow: 0 0 8px rgba(34,211,238,0.8);
        }
        .hp-section-label::after {
          content: "";
          flex: 1;
          height: 1px;
          background: linear-gradient(90deg, var(--border), transparent);
        }

        .hp-ai-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 10.5px;
          padding: 5px 12px;
          border-radius: 20px;
          background: linear-gradient(135deg, rgba(34,211,238,0.2), rgba(251,191,36,0.12));
          border: 1px solid rgba(34,211,238,0.35);
          color: #a5f3fc;
          font-weight: 700;
          letter-spacing: 0.05em;
        }

        .hp-nav-btn {
          margin-top: 20px;
          width: 100%;
          padding: 12px;
          border-radius: 14px;
          background: linear-gradient(135deg, rgba(34,211,238,0.16), rgba(251,191,36,0.14));
          border: 1px solid rgba(34,211,238,0.3);
          color: #a5f3fc;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          letter-spacing: 0.03em;
          transition: background 0.25s, border-color 0.25s, transform 0.2s;
        }
        .hp-nav-btn:hover {
          background: linear-gradient(135deg, rgba(34,211,238,0.26), rgba(251,191,36,0.22));
          border-color: rgba(34,211,238,0.5);
          transform: translateY(-1px);
        }
      `}</style>

      <div className="relative min-h-screen text-white overflow-hidden bg-[#020617]">

        {/* ── BACKGROUND ── */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <img src="/hero-bg.png" alt="background" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#020617]/90 via-[#020617]/70 to-transparent" />
          <div className="absolute inset-0 bg-[#020617]/30" />
        </div>

        {/* ── CONTENT ── */}
        <div className="relative z-10">
          <Navbar />

          {/* ── HERO ── */}
          <div className="max-w-7xl mx-auto px-10 pt-24 pb-10">
            <h1
              className="text-6xl font-extrabold leading-[1.05] max-w-2xl tracking-tight"
              style={{ animation: "hpFadeUp 0.7s ease-out both" }}
            >
              Where will your{" "}
              <span className="bg-gradient-to-br from-blue-400 via-cyan-300 to-amber-400 text-transparent bg-clip-text">
                journey take you?
              </span>
            </h1>
            <p
              className="mt-5 text-gray-400 text-lg max-w-xl"
              style={{ animation: "hpFadeUp 0.7s ease-out 0.08s both" }}
            >
              Smart booking. Dynamic pricing. All-inclusive transparent fares.
            </p>
            <div
              onClick={handleLaunchRouteSearch}
              className="hp-hero-badge mt-7"
            >
              ✨ AI-optimized fares · All-inclusive {selectedRoute.from} → {selectedRoute.to} from {selectedRoute.price}
            </div>
          </div>

          {/* ── SEARCH BOX ── */}
          <div className="max-w-7xl mx-auto px-10 pb-14">
            <SearchBox />
          </div>

          {/* ── DIVIDER LABEL ── */}
          <div className="max-w-7xl mx-auto px-10 mb-5">
            <div className="hp-section-label">Explore &amp; Plan</div>
          </div>

          {/* ── DATA SECTIONS ── */}
          <div className="max-w-7xl mx-auto px-10 pb-24">
            <div className="hp-sections">

              {/* Card 1 — Popular Routes */}
              <div className="hp-card">
                <div className="hp-card-glow" style={{ background: "#60A5FA" }} />
                <div className="hp-card-head">
                  <div>
                    <div className="hp-card-eyebrow">Trending & Booked</div>
                    <div className="hp-card-title">Popular Routes</div>
                  </div>
                  <div className="hp-card-icon">✈️</div>
                </div>

                <div className="space-y-1">
                  {routes.map((r, idx) => {
                    const isSelected = selectedRouteIndex === idx
                    return (
                      <div
                        key={`${r.from}-${r.to}`}
                        onClick={() => setSelectedRouteIndex(idx)}
                        className={`hp-route-row ${isSelected ? "is-active" : ""}`}
                      >
                        <div className="hp-route-left">
                          <div className="hp-route-plane">✈</div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="hp-route-label">{r.label}</span>
                              {r.tag && (
                                <span
                                  className={`hp-route-tag${
                                    r.tagType === "drop" ? " drop" : ""
                                  }`}
                                >
                                  {r.tag}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 font-normal">
                              Base ₹{r.basePrice.toLocaleString("en-IN")} + GST
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end">
                          <div className="flex items-center gap-1.5">
                            <span className="hp-route-price">{r.price}</span>
                            {isSelected && (
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                            )}
                          </div>
                          <span className="hp-route-tax-label">incl. taxes &amp; fees</span>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-slate-400">
                  <span>✓ All fares include GST &amp; fees</span>
                  <span className="text-amber-300 font-medium">Click to compare</span>
                </div>
              </div>

              {/* Card 2 — Cheapest Dates */}
              <div className="hp-card">
                <div className="hp-card-glow" style={{ background: "#22D3EE" }} />
                <div className="hp-card-head">
                  <div>
                    <div className="hp-card-eyebrow font-mono text-cyan-300 font-bold">
                      {selectedRoute.from} → {selectedRoute.to}
                    </div>
                    <div className="hp-card-title">Cheapest Dates (All-in)</div>
                  </div>
                  <div className="hp-card-icon">📅</div>
                </div>

                <div className="hp-bars">
                  {cheapDates.map((d) => {
                    const pct = Math.round(
                      30 + ((d.totalPrice - minBarPrice) / span) * 60
                    )
                    const color =
                      d.level === 1
                        ? "#22D3EE"
                        : d.level === 2
                        ? "#60A5FA"
                        : d.level === 3
                        ? "#FBBF24"
                        : "#F59E0B"
                    const isLowest = d.totalPrice === cheapestDay.totalPrice

                    return (
                      <div
                        key={d.dateStr}
                        onClick={() => handleSelectDate(d.dateStr)}
                        className="hp-bar-wrap"
                        title={`Click to book ${d.fullDate}: ${d.price} (Base ₹${d.baseFare} + ₹${d.taxAmount} Taxes)`}
                      >
                        <span className="hp-bar-price">{d.price}</span>
                        <div
                          className="hp-bar"
                          style={{
                            height: `${pct}%`,
                            backgroundColor: color,
                            boxShadow: isLowest ? `0 0 14px ${color}99` : "none",
                          }}
                        />
                        <span className="hp-bar-date">{d.date}</span>
                      </div>
                    )
                  })}
                </div>

                <div
                  onClick={() => handleSelectDate(cheapestDay.dateStr)}
                  className="hp-bar-best"
                  title="Click to search cheapest date"
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span>✦</span>
                      <span>Cheapest: {cheapestDay.fullDate} · {cheapestDay.price}</span>
                    </div>
                    <div className="text-[10px] text-emerald-400 font-normal mt-0.5">
                      Base ₹{cheapestDay.baseFare.toLocaleString("en-IN")} + ₹{cheapestDay.taxAmount.toLocaleString("en-IN")} taxes &amp; fees
                    </div>
                  </div>
                  <span className="text-[10px] text-cyan-300 hover:underline shrink-0">Select →</span>
                </div>

                <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 10 }}>
                  *Prices shown are total payable fares with zero hidden charges
                </p>
              </div>

              {/* Card 3 — AI Price Insight */}
              <div className="hp-card">
                <div className="hp-card-glow" style={{ background: "#F59E0B" }} />
                <div className="hp-card-head">
                  <div>
                    <div className="hp-card-eyebrow font-mono text-amber-300 font-bold">
                      {selectedRoute.from} → {selectedRoute.to}
                    </div>
                    <div className="hp-card-title">Price Insights</div>
                  </div>
                  <span className="hp-ai-badge">✦ NavBot</span>
                </div>

                <div className="space-y-0.5">
                  {dynamicInsights.map((ins) => (
                    <div key={ins.title} className="hp-insight-row">
                      <div className="hp-insight-icon">{ins.icon}</div>
                      <div>
                        <div className="hp-insight-title">{ins.title}</div>
                        <div className="hp-insight-body">{ins.body}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleLaunchRouteSearch}
                  className="hp-nav-btn flex items-center justify-center gap-1.5"
                >
                  <span>Search {selectedRoute.from} → {selectedRoute.to} Flights</span>
                  <span>→</span>
                </button>
              </div>

            </div>
          </div>
        </div>
      </div>
    </>
  )
}