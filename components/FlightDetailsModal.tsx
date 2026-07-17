"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Flight = {
  airline: string;
  origin: string;
  destination: string;
  departure_time: string;
  arrival_time: string;
  price: number;
  duration: string;
  aircraft: string;
  stops?: number;
  tag?: string;
  passengers?: number;
};

const airlineLogos: Record<string, string> = {
  "IndiGo": "/airlines/indigo.png",
  "Air India": "/airlines/airindia.png",
  "Vistara": "/airlines/vistara.png",
  "Akasa Air": "/airlines/akasa.png",
  "Emirates": "/airlines/emirates.png",
  "Qatar Airways": "/airlines/qatar.png",
};

// Genuine published aircraft-type specs (Boeing/Airbus spec sheets) — this
// is general info about the aircraft *type*, not a claim about this exact
// tail number's seat map, so it's labeled "Typical specifications" below
// rather than presented as flight-specific fact.
const AIRCRAFT_SPECS: Record<string, { capacity: string; layout: string; speed: string; range: string }> = {
  "a320": { capacity: "150–180 seats", layout: "3–3 Economy", speed: "828 km/h", range: "6,300 km" },
  "a321": { capacity: "185–220 seats", layout: "3–3 Economy", speed: "828 km/h", range: "5,950 km" },
  "a319": { capacity: "120–156 seats", layout: "3–3 Economy", speed: "828 km/h", range: "6,850 km" },
  "a330": { capacity: "250–300 seats", layout: "2–4–2 Economy", speed: "870 km/h", range: "11,750 km" },
  "737": { capacity: "160–190 seats", layout: "3–3 Economy", speed: "842 km/h", range: "5,600 km" },
  "787": { capacity: "240–290 seats", layout: "3–3–3 Economy", speed: "913 km/h", range: "13,530 km" },
  "777": { capacity: "300–396 seats", layout: "3–4–3 Economy", speed: "905 km/h", range: "15,000 km" },
};

function getAircraftSpecs(aircraft: string) {
  const key = aircraft.toLowerCase();
  const match = Object.keys(AIRCRAFT_SPECS).find((k) => key.includes(k));
  return match ? AIRCRAFT_SPECS[match] : null;
}

function formatTime(timeStr?: string) {
  if (!timeStr) return "--:--";
  const match = timeStr.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (match) {
    const hours = Number(match[1]);
    const minutes = match[2];
    const period = hours >= 12 ? "PM" : "AM";
    const displayHour = hours % 12 === 0 ? 12 : hours % 12;
    return `${displayHour}:${minutes} ${period}`;
  }
  const d = new Date(timeStr);
  if (isNaN(d.getTime())) return "--:--";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getStopsText(stops?: number) {
  if (!stops || stops === 0) return "Non-stop";
  if (stops === 1) return "1 Stop";
  return `${stops} Stops`;
}

type Tab = "overview" | "fare";

export default function FlightDetailsModal({
  flight,
  totalPrice,
  safePrice,
  pax,
  onClose,
}: {
  flight: Flight;
  totalPrice: number;
  safePrice: number;
  pax: number;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>("overview");

  // Portal target isn't available during SSR — render nothing until
  // mounted on the client, then portal straight to <body>. This means the
  // modal's position:fixed is always relative to the real viewport, no
  // matter what animations or transforms exist anywhere in the page tree
  // it was triggered from (that's the actual bug class this avoids).
  const [portalReady, setPortalReady] = useState(false);
  useEffect(() => setPortalReady(true), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Prevent the page behind the modal from scrolling while it's open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const logo = airlineLogos[flight.airline] || "/airlines/default.png";
  const specs = getAircraftSpecs(flight.aircraft);

  // Matches the exact formula used at real checkout (passengers-page.tsx:
  // taxesAndFees = round(baseFare * 0.19)) so this preview never shows a
  // number that disagrees with what the customer is actually charged.
  // Labeled "Est." because the real total is computed once for the whole
  // booking (departure + return combined) at checkout, not per card.
  const estTaxes = Math.round(totalPrice * 0.19);
  const estGrandTotal = totalPrice + estTaxes;

  if (!portalReady) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/65 backdrop-blur-sm px-4 modal-backdrop-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-3xl max-h-[88vh] overflow-y-auto bg-gradient-to-b from-[#0D1A2C] to-[#0A1424] border border-white/[0.08] rounded-[28px] shadow-[0_30px_90px_rgba(0,0,0,0.55)] ticket-edge modal-card-in"
      >
        <div className="sticky top-0 z-10 bg-gradient-to-b from-[#0D1A2C] to-[#0D1A2C]/95 backdrop-blur">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-400 via-amber-400 to-amber-300" />

          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors"
          >
            ✕
          </button>

          <div className="p-6 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/95 flex items-center justify-center shadow-[0_4px_14px_rgba(0,0,0,0.3)] ring-1 ring-white/10 overflow-hidden shrink-0">
                <img src={logo} className="w-8 h-8 object-contain" alt={flight.airline} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-display font-bold text-lg text-white">{flight.airline}</p>
                  {flight.tag && (
                    <span className="text-[9px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full bg-amber-400/15 text-amber-300 border border-amber-400/25">
                      {flight.tag}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400">{flight.aircraft} · Economy Class</p>
              </div>
            </div>
          </div>

          {/* Route timeline — always visible above the tabs */}
          <div className="px-6 pb-4">
            <div className="flex items-center justify-between bg-white/[0.02] border border-white/[0.06] rounded-2xl px-5 py-4">
              <div>
                <p className="font-display text-2xl font-extrabold text-white tabular-nums">{formatTime(flight.departure_time)}</p>
                <p className="text-xs text-gray-500 uppercase tracking-wide mt-0.5">{flight.origin}</p>
              </div>

              <div className="flex flex-col items-center flex-1 mx-4">
                <p className="text-[11px] text-gray-400 mb-1.5 font-medium">{flight.duration || "--"}</p>
                <div className="relative w-full h-px bg-white/10 rounded-full">
                  <div className="absolute left-0 top-0 h-px w-full bg-gradient-to-r from-amber-300/70 via-cyan-300/70 to-amber-300/70 rounded-full" />
                  <div className="absolute -top-[3.5px] left-0 w-2 h-2 bg-amber-300 rounded-full shadow-[0_0_8px_rgba(252,211,77,0.7)]" />
                  {(flight.stops ?? 0) > 0 && (
                    <div className="absolute -top-[3px] left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-white/60 rounded-full" />
                  )}
                  <div className="absolute -top-[3.5px] right-0 w-2 h-2 bg-amber-300 rounded-full shadow-[0_0_8px_rgba(252,211,77,0.7)]" />
                </div>
                <p className="text-[11px] text-gray-500 mt-2">{getStopsText(flight.stops)}</p>
              </div>

              <div className="text-right">
                <p className="font-display text-2xl font-extrabold text-white tabular-nums">{formatTime(flight.arrival_time)}</p>
                <p className="text-xs text-gray-500 uppercase tracking-wide mt-0.5">{flight.destination}</p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="px-6 flex items-center gap-6 border-b border-white/[0.06]">
            {([
              { key: "overview", label: "Overview" },
              { key: "fare", label: "Fare Details" },
            ] as { key: Tab; label: string }[]).map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`relative pb-3 text-sm font-medium transition-colors ${
                  tab === t.key ? "text-white" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {t.label}
                {tab === t.key && (
                  <span className="absolute left-0 right-0 -bottom-px h-[2px] bg-gradient-to-r from-amber-300 to-amber-500 tab-underline" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── OVERVIEW TAB ── */}
        {tab === "overview" && (
          <div className="p-6 grid grid-cols-1 sm:grid-cols-[1.3fr_1fr] gap-5 tab-fade-in">
            <div className="space-y-5">
              <div>
                <p className="text-[11px] uppercase tracking-widest text-gray-500 mb-2.5">Onboard</p>
                <div className="flex flex-wrap items-center gap-2 text-gray-300 text-[12px]">
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.06]">📶 Wifi</span>
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.06]">🧳 Baggage</span>
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.06]">💺 Seat</span>
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.06]">🍽️ Meal</span>
                </div>
              </div>

              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-5 py-4">
                <p className="text-[11px] uppercase tracking-widest text-gray-500 mb-1">Journey</p>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {flight.origin} to {flight.destination} · {flight.duration || "--"} · {getStopsText(flight.stops)}
                  {(flight.stops ?? 0) > 0 && " — exact layover city/duration shown once you select this flight."}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-8 h-8 rounded-lg bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-amber-300">✈</span>
                <p className="font-display font-bold text-sm text-white">{flight.aircraft}</p>
              </div>
              {specs ? (
                <>
                  <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-2.5">Typical specifications</p>
                  <div className="space-y-2 text-[13px]">
                    <div className="flex justify-between"><span className="text-slate-400">Capacity</span><span className="text-slate-200">{specs.capacity}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Cabin Layout</span><span className="text-slate-200">{specs.layout}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Cruising Speed</span><span className="text-slate-200">{specs.speed}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Range</span><span className="text-slate-200">{specs.range}</span></div>
                  </div>
                </>
              ) : (
                <p className="text-xs text-slate-500">Aircraft specifications aren't available for this type yet.</p>
              )}
            </div>
          </div>
        )}

        {/* ── FARE DETAILS TAB ── */}
        {tab === "fare" && (
          <div className="p-6 tab-fade-in">
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-5 py-4 space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Fare ({pax} × ₹{safePrice.toLocaleString()})</span>
                <span className="text-slate-200">₹{totalPrice.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Est. Taxes &amp; Fees</span>
                <span className="text-slate-200">₹{estTaxes.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Seat Selection</span>
                <span className="text-slate-500">Chosen later</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Meals</span>
                <span className="text-slate-500">Chosen later</span>
              </div>
            </div>

            <div className="border border-blue-400/25 bg-blue-500/[0.07] rounded-2xl px-5 py-4 flex items-center justify-between mt-4">
              <div>
                <p className="text-[11px] uppercase tracking-widest text-gray-400">Estimated Total</p>
                <p className="text-[11px] text-gray-500 mt-0.5">Final tax is calculated with your full booking at checkout</p>
              </div>
              <p className="font-display text-2xl font-extrabold text-amber-300 tabular-nums">₹{estGrandTotal.toLocaleString()}</p>
            </div>

            <div className="flex items-center gap-2.5 mt-4 rounded-xl border border-dashed border-violet-400/20 bg-violet-400/[0.04] px-4 py-3">
              <span aria-hidden>🎁</span>
              <p className="text-xs text-violet-300/80">Earn reward points on this booking — coming soon</p>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes modalBackdropIn { from { opacity: 0; } to { opacity: 1; } }
        .modal-backdrop-in { animation: modalBackdropIn 200ms ease-out; }
        @keyframes modalCardIn {
          from { opacity: 0; transform: scale(0.94) translateY(10px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        .modal-card-in { animation: modalCardIn 260ms cubic-bezier(0.22,1,0.36,1); }
        @keyframes tabUnderlineIn { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        .tab-underline { transform-origin: left; animation: tabUnderlineIn 220ms ease-out; }
        @keyframes tabFadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .tab-fade-in { animation: tabFadeIn 220ms ease-out; }
        @media (prefers-reduced-motion: reduce) {
          .modal-backdrop-in, .modal-card-in, .tab-underline, .tab-fade-in { animation: none !important; }
        }
      `}</style>
    </div>,
    document.body
  );
}