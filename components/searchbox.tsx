"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { DateRange } from "react-date-range"
import "react-date-range/dist/styles.css"
import "react-date-range/dist/theme/default.css"

// ✅ NEW — the From/To fields used to be plain free-text inputs, so DXB
// and NRT (the new Emirates/Japan Airlines routes) technically already
// worked if you happened to type the right 3-letter code, but nothing on
// the page told you they existed, and the city label under the code only
// recognized DEL/BLR. This list is now the single source of truth for
// both the picker dropdown and the city label.
const AIRPORTS = [
  { code: "DEL", city: "Delhi",     name: "Indira Gandhi Intl" },
  { code: "BLR", city: "Bengaluru", name: "Kempegowda Intl" },
  { code: "DXB", city: "Dubai",     name: "Dubai Intl" },
  { code: "NRT", city: "Tokyo",     name: "Narita Intl" },
]

function airportFor(code: string) {
  return AIRPORTS.find((a) => a.code === code)
}

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

  // ✅ NEW — which picker dropdown (if any) is open
  const [openPicker, setOpenPicker] = useState<"from" | "to" | null>(null)
  const fromFieldRef = useRef<HTMLDivElement>(null)
  const toFieldRef = useRef<HTMLDivElement>(null)

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

  // ✅ NEW — close whichever picker is open on an outside click
  useEffect(() => {
    if (!openPicker) return
    const handleClick = (e: MouseEvent) => {
      const ref = openPicker === "from" ? fromFieldRef : toFieldRef
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpenPicker(null)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [openPicker])

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

  const selectAirport = (field: "from" | "to", code: string) => {
    if (field === "from") setFrom(code)
    else setTo(code)
    setOpenPicker(null)
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

  const fromAirport = airportFor(from)
  const toAirport = airportFor(to)

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@700;800&display=swap');

        /* ── Reset & tokens ────────────────────────────────────── */
        /* Palette brought in line with the rest of Navigo — amber/gold as
           the primary accent, cyan as secondary, a touch of blue only in
           the shared pill-CTA gradient. The old indigo/violet theme here
           was a completely different look from the navbar/checkout flow. */
        .sb-root {
          --gold-1: #FCD34D;
          --gold-2: #FBBF24;
          --gold-3: #F59E0B;
          --cyan:   #22D3EE;
          --blue:   #60A5FA;
          --navy:   #060B14;
          --glass:  rgba(255,255,255,0.05);
          --border: rgba(255,255,255,0.10);
          --text:   #F5F7FF;
          --muted:  #94A3B8;
          font-family: 'Manrope', 'Inter', system-ui, sans-serif;
          position: relative;
          /* ✅ FIX: .sb-card uses backdrop-filter, which creates its own
             stacking context — so .sb-picker's z-index only ever competed
             against siblings INSIDE the card. Against later page sections
             (Popular Routes / Cheapest Dates, rendered after this
             component in the DOM), the whole card was just painting in
             normal document order with no z-index of its own, so a later
             section always drew on top regardless of the dropdown's
             z-index. Giving the root a z-index promotes the entire widget
             — dropdown included — above whatever comes after it on the
             page. Raised further (not just to something small like 5)
             since some marketing sections stack their own decorative
             layers with non-trivial z-index too. */
          z-index: 50;
        }

        /* ── Outer card ────────────────────────────────────────── */
        .sb-card {
          background: linear-gradient(135deg,
            rgba(212,175,55,0.10) 0%,
            rgba(10,15,30,0.88) 40%,
            rgba(34,211,238,0.07) 100%);
          border: 1px solid var(--border);
          border-radius: 24px;
          padding: 28px 32px 32px;
          backdrop-filter: blur(24px);
          box-shadow:
            0 0 0 1px rgba(212,175,55,0.12),
            0 32px 64px rgba(0,0,0,0.6),
            inset 0 1px 0 rgba(255,255,255,0.08);
          position: relative;
          overflow: visible;
        }
        /* signature top accent bar — same blue → gold pairing used across
           the navbar and checkout flow, so this card reads as the same
           product instead of a bare glass panel. */
        .sb-card::before {
          content: "";
          position: absolute;
          top: 0; left: 24px; right: 24px;
          height: 2px;
          border-radius: 2px;
          background: linear-gradient(90deg, var(--blue), var(--gold-2), var(--gold-1));
        }
        /* hairline gold ticket border, echoing the boarding-pass edge used
           on every other card in the app. */
        .sb-card::after {
          content: "";
          position: absolute;
          inset: 3px;
          border: 1px solid rgba(212,175,55,0.10);
          border-radius: 20px;
          pointer-events: none;
        }

        /* ── Trip-type tabs ────────────────────────────────────── */
        .sb-tabs {
          display: flex;
          gap: 4px;
          background: rgba(0,0,0,0.3);
          border-radius: 999px;
          padding: 4px;
          width: fit-content;
        }
        .sb-tab {
          padding: 6px 18px;
          border-radius: 999px;
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
          background: linear-gradient(135deg, var(--gold-1), var(--gold-2), var(--gold-3));
          color: var(--navy);
          font-weight: 700;
          box-shadow: 0 2px 12px rgba(251,191,36,0.4);
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
        .sb-pax-btn:hover { background: rgba(251,191,36,0.25); }
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
          cursor: pointer;
          position: relative;
        }
        .sb-field.is-open,
        .sb-field:focus-within {
          border-color: rgba(251,191,36,0.55);
          box-shadow: 0 0 0 3px rgba(251,191,36,0.12);
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
          font-weight: 800;
          font-family: 'Manrope', ui-sans-serif, system-ui, sans-serif;
          color: var(--text);
          width: 100%;
          letter-spacing: 0.02em;
        }
        .sb-city {
          font-size: 11px;
          color: var(--muted);
          margin-top: 2px;
        }

        /* ── Airport picker dropdown ───────────────────────────── */
        .sb-picker {
          position: absolute;
          top: calc(100% + 8px);
          left: 0;
          min-width: 240px;
          background: #0D1A2C;
          border: 1px solid rgba(212,175,55,0.25);
          border-radius: 14px;
          box-shadow: 0 20px 50px rgba(0,0,0,0.6), 0 0 0 1px rgba(212,175,55,0.1);
          padding: 6px;
          z-index: 60;
          cursor: default;
        }
        .sb-picker-option {
          display: flex;
          align-items: baseline;
          gap: 10px;
          padding: 10px 12px;
          border-radius: 10px;
          cursor: pointer;
          transition: background 0.15s;
        }
        .sb-picker-option:hover { background: rgba(251,191,36,0.1); }
        .sb-picker-option.is-selected { background: rgba(251,191,36,0.15); }
        .sb-picker-code {
          font-family: 'Manrope', ui-sans-serif, system-ui, sans-serif;
          font-weight: 800;
          font-size: 15px;
          color: var(--gold-1);
          min-width: 34px;
        }
        .sb-picker-text { display: flex; flex-direction: column; }
        .sb-picker-city { font-size: 13px; font-weight: 600; color: var(--text); }
        .sb-picker-name { font-size: 11px; color: var(--muted); }

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
          border: 1px solid rgba(251,191,36,0.25);
          background: rgba(251,191,36,0.06);
          color: var(--gold-1);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 18px;
          flex-shrink: 0;
          transition: background 0.2s, border-color 0.2s, transform 0.25s;
          align-self: center;
          margin-top: 18px;
        }
        .sb-swap:hover {
          background: rgba(251,191,36,0.18);
          border-color: rgba(251,191,36,0.45);
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
          font-weight: 700;
          font-family: 'Manrope', ui-sans-serif, system-ui, sans-serif;
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
        /* Same blue → gold pill gradient used for every primary CTA in
           the checkout flow (seats / passengers / flights results), so
           the very first button a visitor sees matches the last one. */
        .sb-btn {
          padding: 0 32px;
          height: auto;
          min-height: 72px;
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 15px;
          font-weight: 700;
          letter-spacing: 0.02em;
          cursor: pointer;
          border: none;
          background: linear-gradient(90deg, #38BDF8 0%, var(--blue) 30%, #D4AF37 70%, var(--gold-2) 100%);
          color: var(--navy);
          box-shadow:
            0 8px 30px rgba(56,189,248,0.18),
            0 8px 30px rgba(251,191,36,0.18);
          transition: filter 0.2s, transform 0.15s;
          white-space: nowrap;
          align-self: stretch;
          flex-shrink: 0;
        }
        .sb-btn:hover {
          filter: brightness(1.06);
          transform: translateY(-1px);
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
          background: rgba(5,8,20,0.7);
          backdrop-filter: blur(6px);
          padding: 16px;
        }
        .sb-cal-wrap {
          background: #0D1A2C;
          border: 1px solid rgba(212,175,55,0.25);
          border-radius: 20px;
          overflow: hidden;
          box-shadow:
            0 0 0 1px rgba(212,175,55,0.12),
            0 40px 80px rgba(0,0,0,0.8);
          max-width: calc(100vw - 32px);
          max-height: calc(100vh - 32px);
          overflow-y: auto;
        }
        /* Style the DateRange calendar to match dark theme */
        .sb-cal-wrap .rdrCalendarWrapper,
        .sb-cal-wrap .rdrDateRangeWrapper {
          background: transparent !important;
          color: #F5F7FF;
        }
        .sb-cal-wrap .rdrMonth { width: 290px; }
        .sb-cal-wrap .rdrMonthAndYearPickers select,
        .sb-cal-wrap .rdrMonthAndYearWrapper {
          background: transparent;
          color: #F5F7FF;
        }
        .sb-cal-wrap .rdrDayNumber span { color: #F5F7FF; }
        .sb-cal-wrap .rdrDayPassive .rdrDayNumber span { color: #3a4060; }
        .sb-cal-wrap .rdrDayToday .rdrDayNumber span:after { background: #F59E0B; }
        .sb-cal-wrap .rdrStartEdge,
        .sb-cal-wrap .rdrEndEdge { background: #F59E0B; border-radius: 50%; }
        .sb-cal-wrap .rdrInRange { background: rgba(251,191,36,0.18); }
        .sb-cal-wrap .rdrDay:not(.rdrDayPassive) .rdrInRange ~ .rdrDayNumber span { color: #F5F7FF; }
        .sb-cal-wrap .rdrMonthAndYearPickers select { color: #F5F7FF; }
        .sb-cal-wrap .rdrNextPrevButton { background: rgba(255,255,255,0.06); border-radius: 8px; }
        .sb-cal-wrap .rdrNextPrevButton:hover { background: rgba(251,191,36,0.25); }
        .sb-cal-wrap .rdrPprevButton i { border-right-color: #F5F7FF; }
        .sb-cal-wrap .rdrNextButton i { border-left-color: #F5F7FF; }
        .sb-cal-wrap .rdrWeekDay { color: #94A3B8; }
        .sb-cal-wrap .rdrMonthPicker select,
        .sb-cal-wrap .rdrYearPicker select {
          background: rgba(0,0,0,0.4);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          padding: 4px 8px;
          color: #F5F7FF;
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
          border-radius: 999px;
          background: linear-gradient(90deg, var(--blue), var(--gold-2));
          color: var(--navy);
          font-weight: 700;
          font-size: 14px;
          border: none;
          cursor: pointer;
          transition: filter 0.2s;
        }
        .sb-cal-done:hover { filter: brightness(1.08); }

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
              <div
                className={`sb-field${openPicker === "from" ? " is-open" : ""}`}
                ref={fromFieldRef}
                onClick={() => setOpenPicker(openPicker === "from" ? null : "from")}
              >
                <div className="sb-label">From</div>
                <div className="sb-iata">{from}</div>
                <div className="sb-city">{fromAirport ? fromAirport.name : "—"}</div>

                {openPicker === "from" && (
                  <div className="sb-picker" onClick={(e) => e.stopPropagation()}>
                    {AIRPORTS.map((a) => (
                      <div
                        key={a.code}
                        className={`sb-picker-option${a.code === from ? " is-selected" : ""}`}
                        onClick={() => selectAirport("from", a.code)}
                      >
                        <span className="sb-picker-code">{a.code}</span>
                        <span className="sb-picker-text">
                          <span className="sb-picker-city">{a.city}</span>
                          <span className="sb-picker-name">{a.name}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button className="sb-swap" onClick={swap} aria-label="Swap airports">⇄</button>

              <div
                className={`sb-field${openPicker === "to" ? " is-open" : ""}`}
                ref={toFieldRef}
                onClick={() => setOpenPicker(openPicker === "to" ? null : "to")}
              >
                <div className="sb-label">To</div>
                <div className="sb-iata">{to}</div>
                <div className="sb-city">{toAirport ? toAirport.name : "—"}</div>

                {openPicker === "to" && (
                  <div className="sb-picker" onClick={(e) => e.stopPropagation()}>
                    {AIRPORTS.map((a) => (
                      <div
                        key={a.code}
                        className={`sb-picker-option${a.code === to ? " is-selected" : ""}`}
                        onClick={() => selectAirport("to", a.code)}
                      >
                        <span className="sb-picker-code">{a.code}</span>
                        <span className="sb-picker-text">
                          <span className="sb-picker-city">{a.city}</span>
                          <span className="sb-picker-name">{a.name}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
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
                rangeColors={["#F59E0B"]}
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