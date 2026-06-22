"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { DateRange } from "react-date-range"
import "react-date-range/dist/styles.css"
import "react-date-range/dist/theme/default.css"

function toDateOnly(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function formatDisplay(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

export default function SearchBox() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [tripType, setTripType] = useState("roundtrip")
  const [from, setFrom] = useState("DEL")
  const [to, setTo] = useState("BLR")
  const [passengers, setPassengers] = useState(1)
  const [showCalendar, setShowCalendar] = useState(false)
  const [months, setMonths] = useState(2)

  const [range, setRange] = useState<any>({
    startDate: new Date(),
    endDate: new Date(),
    key: "selection",
  })

  // Responsive: show 1 month on small screens
  useEffect(() => {
    const update = () => setMonths(window.innerWidth < 680 ? 1 : 2)
    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [])

  useEffect(() => {
    const originParam = searchParams.get("origin")
    const destParam = searchParams.get("destination")
    const departParam = searchParams.get("depart")
    const returnParam = searchParams.get("return")
    const paxParam = searchParams.get("pax")
    const modeParam = searchParams.get("mode")

    if (originParam) setFrom(originParam)
    if (destParam) setTo(destParam)
    if (paxParam) setPassengers(Number(paxParam))
    if (modeParam === "roundtrip") setTripType("roundtrip")
    if (modeParam === "oneway") setTripType("oneway")

    if (departParam) {
      const parseLocalDate = (value: string) => {
        const [y, m, d] = value.split("-").map(Number)
        if (!y || !m || !d) return new Date(value)
        return new Date(y, m - 1, d)
      }
      const start = parseLocalDate(departParam)
      const end = returnParam ? parseLocalDate(returnParam) : start
      setRange({ startDate: start, endDate: end, key: "selection" })
    }
  }, [searchParams])

  const swap = () => {
    setFrom(to)
    setTo(from)
  }

  const search = () => {
    let url = `/flights?origin=${from}&destination=${to}&depart=${toDateOnly(range.startDate)}&pax=${passengers}&mode=${tripType}`
    if (tripType === "roundtrip") {
      url += `&return=${toDateOnly(range.endDate)}`
    }
    router.push(url)
  }

  const days =
    range.startDate && range.endDate
      ? Math.max(0, Math.ceil((range.endDate.getTime() - range.startDate.getTime()) / (1000 * 60 * 60 * 24)))
      : 0

  return (
    <>
      <style>{`
        /* ── Reset & tokens ────────────────────────────────────── */
        .sb-root {
          --indigo: #6366F1;
          --cyan:   #22D3EE;
          --gold:   #F59E0B;
          --navy:   #0A0F1E;
          --glass:  rgba(255,255,255,0.05);
          --border: rgba(255,255,255,0.10);
          --text:   #F0F4FF;
          --muted:  #94A3B8;
          font-family: 'Inter', system-ui, sans-serif;
          position: relative;
        }

        /* ── Outer card ────────────────────────────────────────── */
        .sb-card {
          background: linear-gradient(135deg,
            rgba(99,102,241,0.12) 0%,
            rgba(10,15,30,0.85) 40%,
            rgba(34,211,238,0.08) 100%);
          border: 1px solid var(--border);
          border-radius: 24px;
          padding: 28px 32px 32px;
          backdrop-filter: blur(24px);
          box-shadow:
            0 0 0 1px rgba(99,102,241,0.15),
            0 32px 64px rgba(0,0,0,0.6),
            inset 0 1px 0 rgba(255,255,255,0.08);
          position: relative;
          overflow: visible;
        }

        /* ── Trip-type tabs ────────────────────────────────────── */
        .sb-tabs {
          display: flex;
          gap: 4px;
          background: rgba(0,0,0,0.3);
          border-radius: 12px;
          padding: 4px;
          width: fit-content;
        }
        .sb-tab {
          padding: 6px 18px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          color: var(--muted);
          cursor: pointer;
          transition: all 0.2s;
          border: none;
          background: transparent;
          letter-spacing: 0.01em;
        }
        .sb-tab:hover { color: var(--text); }
        .sb-tab.active {
          background: linear-gradient(135deg, var(--indigo), #818CF8);
          color: #fff;
          box-shadow: 0 2px 12px rgba(99,102,241,0.45);
        }

        /* ── Passenger control ─────────────────────────────────── */
        .sb-pax {
          display: flex;
          align-items: center;
          gap: 12px;
          background: rgba(0,0,0,0.35);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 6px 14px;
          color: var(--text);
          font-size: 14px;
        }
        .sb-pax-btn {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: 1px solid var(--border);
          background: rgba(255,255,255,0.08);
          color: var(--text);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 16px;
          line-height: 1;
          transition: background 0.15s;
        }
        .sb-pax-btn:hover { background: rgba(99,102,241,0.35); }
        .sb-pax-label {
          font-size: 11px;
          color: var(--muted);
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin-right: 6px;
        }

        /* ── Main row ──────────────────────────────────────────── */
        .sb-row {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          align-items: stretch;
          margin-top: 18px;
        }

        /* ── Input tiles ───────────────────────────────────────── */
        .sb-field {
          background: rgba(0,0,0,0.4);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 14px 18px;
          transition: border-color 0.2s, box-shadow 0.2s;
          cursor: text;
        }
        .sb-field:focus-within {
          border-color: rgba(99,102,241,0.6);
          box-shadow: 0 0 0 3px rgba(99,102,241,0.12);
        }
        .sb-label {
          font-size: 10px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--muted);
          margin-bottom: 4px;
        }
        .sb-iata {
          background: transparent;
          border: none;
          outline: none;
          font-size: 26px;
          font-weight: 700;
          color: var(--text);
          width: 100%;
          letter-spacing: 0.04em;
        }
        .sb-city {
          font-size: 11px;
          color: var(--muted);
          margin-top: 2px;
        }

        /* ── Route group ───────────────────────────────────────── */
        .sb-route {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 1;
          min-width: 260px;
        }
        .sb-route .sb-field { flex: 1; }
        .sb-swap {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: 1px solid var(--border);
          background: rgba(255,255,255,0.06);
          color: var(--text);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 18px;
          flex-shrink: 0;
          transition: background 0.2s, transform 0.25s;
          align-self: center;
          margin-top: 18px;
        }
        .sb-swap:hover {
          background: rgba(99,102,241,0.25);
          transform: rotate(180deg);
        }

        /* ── Date tile ─────────────────────────────────────────── */
        .sb-date {
          min-width: 200px;
          flex: 1;
          background: rgba(0,0,0,0.4);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 14px 18px;
          cursor: pointer;
          transition: border-color 0.2s, box-shadow 0.2s;
          user-select: none;
        }
        .sb-date:hover {
          border-color: rgba(34,211,238,0.4);
          box-shadow: 0 0 0 3px rgba(34,211,238,0.08);
        }
        .sb-date-val {
          font-size: 16px;
          font-weight: 600;
          color: var(--text);
          margin-top: 4px;
          white-space: nowrap;
        }
        .sb-date-sub {
          font-size: 11px;
          color: var(--cyan);
          margin-top: 3px;
        }

        /* ── Search button ─────────────────────────────────────── */
        .sb-btn {
          padding: 0 32px;
          height: auto;
          min-height: 72px;
          border-radius: 16px;
          font-size: 15px;
          font-weight: 700;
          letter-spacing: 0.04em;
          cursor: pointer;
          border: none;
          background: linear-gradient(135deg, var(--indigo) 0%, var(--cyan) 60%, var(--gold) 100%);
          color: #fff;
          box-shadow:
            0 4px 20px rgba(99,102,241,0.5),
            0 1px 0 rgba(255,255,255,0.15) inset;
          transition: opacity 0.2s, transform 0.15s, box-shadow 0.2s;
          white-space: nowrap;
          align-self: stretch;
          flex-shrink: 0;
        }
        .sb-btn:hover {
          opacity: 0.92;
          transform: translateY(-1px);
          box-shadow: 0 8px 28px rgba(99,102,241,0.55);
        }
        .sb-btn:active { transform: translateY(0); }

        /* ── Calendar portal ───────────────────────────────────── */
        /* Fixed overlay centered on viewport — never clips */
        .sb-cal-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(5,8,20,0.65);
          backdrop-filter: blur(6px);
          padding: 16px;
        }
        .sb-cal-wrap {
          background: #13172B;
          border: 1px solid rgba(99,102,241,0.3);
          border-radius: 20px;
          overflow: hidden;
          box-shadow:
            0 0 0 1px rgba(99,102,241,0.15),
            0 40px 80px rgba(0,0,0,0.8);
          max-width: calc(100vw - 32px);
          max-height: calc(100vh - 32px);
          overflow-y: auto;
        }
        /* Style the DateRange calendar to match dark theme */
        .sb-cal-wrap .rdrCalendarWrapper,
        .sb-cal-wrap .rdrDateRangeWrapper {
          background: transparent !important;
          color: #F0F4FF;
        }
        .sb-cal-wrap .rdrMonth { width: 290px; }
        .sb-cal-wrap .rdrMonthAndYearPickers select,
        .sb-cal-wrap .rdrMonthAndYearWrapper {
          background: transparent;
          color: #F0F4FF;
        }
        .sb-cal-wrap .rdrDayNumber span { color: #F0F4FF; }
        .sb-cal-wrap .rdrDayPassive .rdrDayNumber span { color: #3a4060; }
        .sb-cal-wrap .rdrDayToday .rdrDayNumber span:after { background: #6366F1; }
        .sb-cal-wrap .rdrStartEdge,
        .sb-cal-wrap .rdrEndEdge { background: #6366F1; border-radius: 50%; }
        .sb-cal-wrap .rdrInRange { background: rgba(99,102,241,0.18); }
        .sb-cal-wrap .rdrDay:not(.rdrDayPassive) .rdrInRange ~ .rdrDayNumber span { color: #F0F4FF; }
        .sb-cal-wrap .rdrMonthAndYearPickers select { color: #F0F4FF; }
        .sb-cal-wrap .rdrNextPrevButton { background: rgba(255,255,255,0.06); border-radius: 8px; }
        .sb-cal-wrap .rdrNextPrevButton:hover { background: rgba(99,102,241,0.3); }
        .sb-cal-wrap .rdrPprevButton i { border-right-color: #F0F4FF; }
        .sb-cal-wrap .rdrNextButton i { border-left-color: #F0F4FF; }
        .sb-cal-wrap .rdrWeekDay { color: #94A3B8; }
        .sb-cal-wrap .rdrMonthPicker select,
        .sb-cal-wrap .rdrYearPicker select {
          background: rgba(0,0,0,0.4);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          padding: 4px 8px;
          color: #F0F4FF;
        }
        /* Calendar close + done bar */
        .sb-cal-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 14px 20px;
          border-top: 1px solid rgba(255,255,255,0.08);
          background: rgba(0,0,0,0.3);
        }
        .sb-cal-info {
          font-size: 13px;
          color: #94A3B8;
        }
        .sb-cal-done {
          padding: 8px 24px;
          border-radius: 10px;
          background: linear-gradient(135deg, #6366F1, #22D3EE);
          color: #fff;
          font-weight: 600;
          font-size: 14px;
          border: none;
          cursor: pointer;
          transition: opacity 0.2s;
        }
        .sb-cal-done:hover { opacity: 0.88; }

        /* ── Responsive ────────────────────────────────────────── */
        @media (max-width: 640px) {
          .sb-card { padding: 20px 16px 24px; }
          .sb-row { flex-direction: column; }
          .sb-btn { min-height: 56px; padding: 0 20px; width: 100%; }
          .sb-iata { font-size: 22px; }
          .sb-date-val { font-size: 14px; }
          .sb-cal-wrap .rdrMonth { width: 100%; }
        }
      `}</style>

      <div className="sb-root">
        <div className="sb-card">

          {/* ── Top bar ── */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>

            <div className="sb-tabs">
              {[
                { key: "roundtrip", label: "Round Trip" },
                { key: "oneway",    label: "One Way"    },
                { key: "multi",     label: "Multi-City" },
              ].map((t) => (
                <button
                  key={t.key}
                  className={`sb-tab${tripType === t.key ? " active" : ""}`}
                  onClick={() => setTripType(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "12px", color: "var(--muted)", letterSpacing: "0.06em" }}>ECONOMY</span>
              <div className="sb-pax">
                <span className="sb-pax-label">PAX</span>
                <button className="sb-pax-btn" onClick={() => setPassengers(Math.max(1, passengers - 1))}>−</button>
                <span style={{ fontWeight: 700, minWidth: "18px", textAlign: "center" }}>{passengers}</span>
                <button className="sb-pax-btn" onClick={() => setPassengers(Math.min(10, passengers + 1))}>+</button>
              </div>
            </div>
          </div>

          {/* ── Main row ── */}
          <div className="sb-row">

            {/* Route */}
            <div className="sb-route">
              <div className="sb-field">
                <div className="sb-label">From</div>
                <input
                  className="sb-iata"
                  value={from}
                  onChange={(e) => setFrom(e.target.value.toUpperCase().slice(0, 3))}
                  maxLength={3}
                />
                <div className="sb-city">{from === "DEL" ? "Indira Gandhi Intl" : from === "BLR" ? "Kempegowda Intl" : "—"}</div>
              </div>

              <button className="sb-swap" onClick={swap} aria-label="Swap airports">⇄</button>

              <div className="sb-field">
                <div className="sb-label">To</div>
                <input
                  className="sb-iata"
                  value={to}
                  onChange={(e) => setTo(e.target.value.toUpperCase().slice(0, 3))}
                  maxLength={3}
                />
                <div className="sb-city">{to === "BLR" ? "Kempegowda Intl" : to === "DEL" ? "Indira Gandhi Intl" : "—"}</div>
              </div>
            </div>

            {/* Dates */}
            <div
              className="sb-date"
              onClick={() => setShowCalendar(true)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && setShowCalendar(true)}
            >
              <div className="sb-label">{tripType === "oneway" ? "Depart" : "Depart — Return"}</div>
              <div className="sb-date-val">
                {formatDisplay(range.startDate)}
                {tripType !== "oneway" && <span style={{ color: "var(--muted)", fontWeight: 400 }}> → </span>}
                {tripType !== "oneway" && formatDisplay(range.endDate)}
              </div>
              {tripType !== "oneway" && (
                <div className="sb-date-sub">
                  {days === 0 ? "Same day return" : `${days} night${days !== 1 ? "s" : ""}`}
                </div>
              )}
            </div>

            {/* Search */}
            <button className="sb-btn" onClick={search}>
              Search Flights →
            </button>
          </div>
        </div>

        {/* ── Calendar portal — fixed + centered, never out of bounds ── */}
        {showCalendar && (
          <div
            className="sb-cal-overlay"
            onClick={() => setShowCalendar(false)}
          >
            <div
              className="sb-cal-wrap"
              onClick={(e) => e.stopPropagation()}
            >
              <DateRange
                ranges={[range]}
                onChange={(item: any) => setRange(item.selection)}
                moveRangeOnFirstSelection={false}
                months={months}
                direction={months === 1 ? "vertical" : "horizontal"}
                minDate={new Date()}
                rangeColors={["#6366F1"]}
              />
              <div className="sb-cal-footer">
                <span className="sb-cal-info">
                  {tripType !== "oneway" && days > 0
                    ? `${days} night${days !== 1 ? "s" : ""} selected`
                    : "Select your travel dates"}
                </span>
                <button className="sb-cal-done" onClick={() => setShowCalendar(false)}>
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}