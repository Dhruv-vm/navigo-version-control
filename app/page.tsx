"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Navbar from "@/components/navbar"
import SearchBox from "@/components/searchbox"

// ── Static data ────────────────────────────────────────────────────────────
const POPULAR_ROUTES = [
  { from: "DEL", to: "BLR", label: "Delhi → Bangalore", price: "₹3,299", tag: "Most Booked" },
  { from: "BOM", to: "DEL", label: "Mumbai → Delhi",    price: "₹2,899", tag: "Price Drop" },
  { from: "BLR", to: "HYD", label: "Bangalore → Hyd",  price: "₹1,599", tag: "Quick Hop"  },
  { from: "MAA", to: "BOM", label: "Chennai → Mumbai",  price: "₹2,199", tag: null         },
]

const CHEAP_DATES = [
  { date: "Wed 25 Jun", price: "₹2,899", level: 1 },
  { date: "Thu 26 Jun", price: "₹3,450", level: 3 },
  { date: "Fri 27 Jun", price: "₹4,100", level: 4 },
  { date: "Sat 28 Jun", price: "₹2,650", level: 1 },
  { date: "Sun 29 Jun", price: "₹3,100", level: 2 },
  { date: "Mon 30 Jun", price: "₹2,450", level: 1 },
  { date: "Tue 1 Jul",  price: "₹2,750", level: 2 },
]

const INSIGHTS = [
  { icon: "📉", title: "Prices dropping", body: "DEL–BLR fares down 12% vs last week. Good time to book." },
  { icon: "⚡", title: "Book in 2 days",  body: "Fares on this route typically rise 48 hrs before departure." },
  { icon: "🌙", title: "Fly mid-week",    body: "Tuesday & Wednesday flights average 18% cheaper." },
]

const PRICE_BAR_COLORS = ["#22D3EE", "#6366F1", "#818CF8", "#F59E0B"]

export default function Home() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem("token")
      if (!token) { router.replace("/login"); return }
      try {
        const res = await fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })
        if (!res.ok) { localStorage.removeItem("token"); router.replace("/login"); return }
        setLoading(false)
      } catch {
        localStorage.removeItem("token")
        router.replace("/login")
      }
    }
    checkAuth()
  }, [router])

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#020617] text-white">
        <div className="animate-pulse text-lg">Loading Navigo...</div>
      </div>
    )
  }

  return (
    <>
      <style>{`
        /* ── Tokens ── */
        :root {
          --indigo: #6366F1;
          --cyan:   #22D3EE;
          --gold:   #F59E0B;
          --navy:   #020617;
          --card:   rgba(255,255,255,0.04);
          --border: rgba(255,255,255,0.08);
          --text:   #F0F4FF;
          --muted:  #64748B;
          --soft:   #94A3B8;
        }

        /* ── Section grid ── */
        .hp-sections {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
        }
        @media (max-width: 900px) {
          .hp-sections { grid-template-columns: 1fr; }
        }

        /* ── Card base ── */
        .hp-card {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 20px;
          padding: 24px;
          backdrop-filter: blur(16px);
          position: relative;
          overflow: hidden;
          transition: border-color 0.25s, box-shadow 0.25s;
        }
        .hp-card:hover {
          border-color: rgba(99,102,241,0.3);
          box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        }
        .hp-card-glow {
          position: absolute;
          width: 180px; height: 180px;
          border-radius: 50%;
          filter: blur(60px);
          opacity: 0.12;
          pointer-events: none;
          top: -40px; right: -40px;
        }

        /* ── Card headers ── */
        .hp-card-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 18px;
        }
        .hp-card-title {
          font-size: 15px;
          font-weight: 700;
          color: var(--text);
          letter-spacing: 0.01em;
        }
        .hp-card-eyebrow {
          font-size: 10px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--muted);
          margin-bottom: 6px;
        }

        /* ── Route rows ── */
        .hp-route-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 12px;
          border-radius: 12px;
          margin-bottom: 8px;
          background: rgba(255,255,255,0.03);
          border: 1px solid transparent;
          cursor: pointer;
          transition: background 0.18s, border-color 0.18s;
        }
        .hp-route-row:hover {
          background: rgba(99,102,241,0.1);
          border-color: rgba(99,102,241,0.25);
        }
        .hp-route-label { font-size: 13px; color: var(--text); font-weight: 500; }
        .hp-route-price { font-size: 14px; font-weight: 700; color: var(--cyan); }
        .hp-route-tag {
          font-size: 10px;
          padding: 2px 8px;
          border-radius: 20px;
          background: rgba(99,102,241,0.2);
          color: #a5b4fc;
          font-weight: 600;
          letter-spacing: 0.04em;
          margin-left: 8px;
        }
        .hp-route-tag.drop { background: rgba(34,211,238,0.15); color: var(--cyan); }

        /* ── Price bars ── */
        .hp-bars {
          display: flex;
          align-items: flex-end;
          gap: 6px;
          height: 80px;
          margin-bottom: 10px;
        }
        .hp-bar-wrap {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          height: 100%;
          justify-content: flex-end;
        }
        .hp-bar {
          width: 100%;
          border-radius: 5px 5px 2px 2px;
          transition: opacity 0.2s;
          min-height: 6px;
        }
        .hp-bar-wrap:hover .hp-bar { opacity: 0.75; }
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
          font-weight: 600;
        }
        .hp-bar-best {
          font-size: 10px;
          color: var(--cyan);
          font-weight: 700;
          margin-top: 6px;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        /* ── Insight items ── */
        .hp-insight-row {
          display: flex;
          gap: 14px;
          align-items: flex-start;
          padding: 12px 0;
          border-bottom: 1px solid var(--border);
        }
        .hp-insight-row:last-child { border-bottom: none; padding-bottom: 0; }
        .hp-insight-icon {
          width: 36px; height: 36px;
          border-radius: 10px;
          background: rgba(99,102,241,0.15);
          display: flex; align-items: center; justify-content: center;
          font-size: 18px;
          flex-shrink: 0;
        }
        .hp-insight-title {
          font-size: 13px; font-weight: 600; color: var(--text);
          margin-bottom: 3px;
        }
        .hp-insight-body { font-size: 12px; color: var(--soft); line-height: 1.5; }

        /* ── Section label ── */
        .hp-section-label {
          font-size: 11px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--muted);
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .hp-section-label::after {
          content: "";
          flex: 1;
          height: 1px;
          background: var(--border);
        }

        /* ── AI badge on insight card ── */
        .hp-ai-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 10px;
          padding: 3px 10px;
          border-radius: 20px;
          background: linear-gradient(135deg, rgba(99,102,241,0.25), rgba(34,211,238,0.15));
          border: 1px solid rgba(99,102,241,0.3);
          color: #a5b4fc;
          font-weight: 600;
          letter-spacing: 0.05em;
        }
      `}</style>

      <div className="relative min-h-screen text-white overflow-hidden bg-[#020617]">

        {/* ── BACKGROUND (unchanged) ── */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <img src="/hero-bg.png" alt="background" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#020617]/90 via-[#020617]/70 to-transparent" />
          <div className="absolute inset-0 bg-[#020617]/30" />
        </div>

        {/* ── CONTENT ── */}
        <div className="relative z-10">
          <Navbar />

          {/* ── HERO (unchanged) ── */}
          <div className="max-w-7xl mx-auto px-10 pt-24 pb-10">
            <h1 className="text-6xl font-bold leading-tight max-w-2xl">
              Where will your{" "}
              <span className="bg-gradient-to-r from-blue-400 via-cyan-300 to-yellow-400 text-transparent bg-clip-text">
                journey take you?
              </span>
            </h1>
            <p className="mt-5 text-gray-400 text-lg">
              Smart booking. Dynamic pricing. Personalized for you.
            </p>
            <button className="mt-6 px-6 py-2 rounded-full border border-blue-400 text-blue-300 hover:bg-blue-500/10 transition">
              ✨ Save more with AI-powered prices
            </button>
          </div>

          {/* ── SEARCH BOX (unchanged) ── */}
          <div className="max-w-7xl mx-auto px-10 pb-12">
            <SearchBox />
          </div>

          {/* ── DIVIDER LABEL ── */}
          <div className="max-w-7xl mx-auto px-10 mb-4">
            <div className="hp-section-label">Explore & Plan</div>
          </div>

          {/* ── DATA SECTIONS ── */}
          <div className="max-w-7xl mx-auto px-10 pb-24">
            <div className="hp-sections">

              {/* Card 1 — Popular Routes */}
              <div className="hp-card">
                <div className="hp-card-glow" style={{ background: "#6366F1" }} />
                <div className="hp-card-head">
                  <div>
                    <div className="hp-card-eyebrow">Trending</div>
                    <div className="hp-card-title">Popular Routes</div>
                  </div>
                  <span style={{ fontSize: 20 }}>✈️</span>
                </div>

                {POPULAR_ROUTES.map((r) => (
                  <div key={r.label} className="hp-route-row">
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span className="hp-route-label">{r.label}</span>
                      {r.tag && (
                        <span className={`hp-route-tag${r.tag === "Price Drop" ? " drop" : ""}`}>
                          {r.tag}
                        </span>
                      )}
                    </div>
                    <span className="hp-route-price">{r.price}</span>
                  </div>
                ))}

                <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 12, textAlign: "center" }}>
                  Based on searches in the last 24 hours
                </p>
              </div>

              {/* Card 2 — Cheapest Dates */}
              <div className="hp-card">
                <div className="hp-card-glow" style={{ background: "#22D3EE" }} />
                <div className="hp-card-head">
                  <div>
                    <div className="hp-card-eyebrow">DEL → BLR</div>
                    <div className="hp-card-title">Cheapest Dates</div>
                  </div>
                  <span style={{ fontSize: 20 }}>📅</span>
                </div>

                <div className="hp-bars">
                  {CHEAP_DATES.map((d, i) => {
                    const heights = [30, 55, 75, 90, 60, 25, 45]
                    const pct = heights[i]
                    const color = d.level === 1 ? "#22D3EE" : d.level === 2 ? "#6366F1" : d.level === 3 ? "#818CF8" : "#F59E0B"
                    return (
                      <div key={d.date} className="hp-bar-wrap" title={`${d.date}: ${d.price}`}>
                        <span className="hp-bar-price">{d.price}</span>
                        <div
                          className="hp-bar"
                          style={{ height: `${pct}%`, background: color, opacity: d.level === 1 ? 1 : 0.55 }}
                        />
                        <span className="hp-bar-date">{d.date.split(" ").slice(0, 2).join(" ")}</span>
                      </div>
                    )
                  })}
                </div>

                <div className="hp-bar-best">
                  <span>✦</span>
                  <span>Cheapest: Mon 30 Jun · ₹2,450</span>
                </div>

                <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>
                  Select a route above to see live price trends
                </p>
              </div>

              {/* Card 3 — AI Price Insight */}
              <div className="hp-card">
                <div className="hp-card-glow" style={{ background: "#F59E0B" }} />
                <div className="hp-card-head">
                  <div>
                    <div className="hp-card-eyebrow">Powered by AI</div>
                    <div className="hp-card-title">Price Insights</div>
                  </div>
                  <span className="hp-ai-badge">✦ NavBot</span>
                </div>

                {INSIGHTS.map((ins) => (
                  <div key={ins.title} className="hp-insight-row">
                    <div className="hp-insight-icon">{ins.icon}</div>
                    <div>
                      <div className="hp-insight-title">{ins.title}</div>
                      <div className="hp-insight-body">{ins.body}</div>
                    </div>
                  </div>
                ))}

                <button
                  style={{
                    marginTop: 18,
                    width: "100%",
                    padding: "10px",
                    borderRadius: 12,
                    background: "linear-gradient(135deg, rgba(99,102,241,0.2), rgba(34,211,238,0.1))",
                    border: "1px solid rgba(99,102,241,0.3)",
                    color: "#a5b4fc",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    letterSpacing: "0.03em",
                    transition: "background 0.2s",
                  }}
                >
                  Ask NavBot for full analysis →
                </button>
              </div>

            </div>
          </div>
        </div>
      </div>
    </>
  )
}