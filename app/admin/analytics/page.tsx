"use client"

import { useState, useEffect } from "react"

export default function AdminAnalyticsPage() {
  const [stats, setStats] = useState<any>(null)

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setStats(d)
      })
      .catch((err) => console.error(err))
  }, [])

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-black text-white tracking-tight">
              Airport Operations Analytics
            </h1>
            <span className="text-[10px] font-mono font-bold bg-cyan-400/15 text-cyan-300 px-2 py-0.5 rounded-full border border-cyan-400/30">
              BIG DATA TELEMETRY
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Route yields, cabin conversion rates, DigiYatra smart check-in adoption trends, and on-time reliability metrics.
          </p>
        </div>
      </div>

      {/* ── METRICS STRIP ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-3xl bg-[#070D18] border border-white/[0.08] shadow-xl">
          <span className="text-[10px] text-slate-400 uppercase">On-Time Performance</span>
          <div className="font-display font-black text-2xl text-emerald-400 mt-1">87.4%</div>
          <span className="text-[10px] text-emerald-400">+4.8% vs last month</span>
        </div>
        <div className="p-5 rounded-3xl bg-[#070D18] border border-white/[0.08] shadow-xl">
          <span className="text-[10px] text-slate-400 uppercase">DigiYatra Adoption</span>
          <div className="font-display font-black text-2xl text-cyan-300 mt-1">52.8%</div>
          <span className="text-[10px] text-cyan-400">+18.2% month-on-month</span>
        </div>
        <div className="p-5 rounded-3xl bg-[#070D18] border border-white/[0.08] shadow-xl">
          <span className="text-[10px] text-slate-400 uppercase">Average Booking Value</span>
          <div className="font-display font-black text-2xl text-amber-300 mt-1">₹8,450</div>
          <span className="text-[10px] text-amber-400">High yield across international</span>
        </div>
        <div className="p-5 rounded-3xl bg-[#070D18] border border-white/[0.08] shadow-xl">
          <span className="text-[10px] text-slate-400 uppercase">Ancillary Conversion</span>
          <div className="font-display font-black text-2xl text-violet-300 mt-1">41.2%</div>
          <span className="text-[10px] text-slate-400">Meals & Extra Bags leading</span>
        </div>
      </div>

      {/* ── TOP ROUTES TABLE ───────────────────────────────────────── */}
      <div className="bg-[#070D18] border border-white/[0.08] rounded-3xl p-5 shadow-xl space-y-4">
        <h3 className="font-display text-xs font-bold uppercase text-white">
          Top Revenue Routes (Current Quarter)
        </h3>
        <div className="space-y-3">
          {(stats?.topRoutes || [
            { route: "DEL → DXB", bookings: 1246, revenue: 10650000 },
            { route: "DEL → BLR", bookings: 982, revenue: 5892000 },
            { route: "BOM → BLR", bookings: 876, revenue: 4818000 },
            { route: "MAA → DEL", bookings: 765, revenue: 4207500 },
            { route: "HYD → BOM", bookings: 654, revenue: 3270000 },
          ]).map((r: any, idx: number) => (
            <div key={idx} className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-lg bg-white/[0.06] flex items-center justify-center font-bold text-white text-[10px]">
                  #{idx + 1}
                </span>
                <strong className="text-white text-xs">{r.route}</strong>
              </div>
              <div className="flex items-center gap-6">
                <span className="text-slate-400">{r.bookings} Bookings</span>
                <strong className="text-emerald-400 font-bold">₹{r.revenue.toLocaleString("en-IN")}</strong>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
