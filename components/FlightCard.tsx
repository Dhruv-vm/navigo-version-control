"use client";

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

// Premium jewel-tone tag treatment — each tag reads as a small emblem
// rather than a flat sticker.
const tagStyles: Record<string, string> = {
  best: "from-amber-300 via-yellow-400 to-amber-500 text-black shadow-[0_0_16px_rgba(251,191,36,0.45)]",
  cheapest: "from-emerald-300 via-emerald-400 to-teal-500 text-black shadow-[0_0_16px_rgba(52,211,153,0.4)]",
  fastest: "from-sky-300 via-cyan-400 to-blue-500 text-black shadow-[0_0_16px_rgba(56,189,248,0.4)]",
  value: "from-fuchsia-300 via-purple-400 to-violet-500 text-black shadow-[0_0_16px_rgba(192,132,252,0.4)]",
};

// ✅ FIXED — DB stores departure_time / arrival_time as plain "HH:MM:SS"
// (Postgres `time` column), NOT as ISO datetime strings. `new Date("06:00:00")`
// is an Invalid Date, which silently produced "--:--" for every flight.
// We now parse the "HH:MM(:SS)?" shape directly, and only fall back to
// `Date` parsing for full ISO datetime strings (in case that format is
// used elsewhere / in the future).
function formatTime(timeStr?: string) {
  if (!timeStr) return "--:--";

  const timeOnlyMatch = timeStr.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (timeOnlyMatch) {
    const hours = Number(timeOnlyMatch[1]);
    const minutes = timeOnlyMatch[2];
    const period = hours >= 12 ? "PM" : "AM";
    const displayHour = hours % 12 === 0 ? 12 : hours % 12;
    return `${displayHour}:${minutes} ${period}`;
  }

  // Fallback: try parsing as a full ISO datetime string
  const d = new Date(timeStr);
  if (isNaN(d.getTime())) return "--:--";

  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStopsText(stops?: number) {
  if (!stops || stops === 0) return "Non-stop";
  if (stops === 1) return "1 Stop • BOM";
  return `${stops} Stops`;
}

export default function FlightCard({
  flight,
  onSelect,
  isSelected,
}: {
  flight: Flight;
  onSelect?: () => void;
  isSelected?: boolean;
}) {
  const logo = airlineLogos[flight.airline] || "/airlines/default.png";

  const pax = flight.passengers || 1;

  const basePrice = Number(flight.price ?? 0);
  const safePrice = basePrice > 0 ? basePrice : 5000;

  const totalPrice = safePrice * pax;

  const tagKey = flight.tag?.toLowerCase().replace(/\s+/g, "");
  const tagGradient =
    (tagKey && tagStyles[tagKey]) || "from-blue-300 via-cyan-400 to-blue-400 text-black";

  return (
    <div
      onClick={onSelect}
      className={`
        relative overflow-hidden
        bg-[radial-gradient(140%_140%_at_0%_0%,#111a2e_0%,#0b1220_45%,#070b16_100%)]
        border rounded-[28px] px-7 py-6
        transition-all duration-300 ease-out
        cursor-pointer group
        backdrop-blur-sm

        ${
          isSelected
            ? "border-amber-300/60 ring-1 ring-amber-300/40 scale-[1.01] shadow-[0_0_50px_rgba(251,191,36,0.18)]"
            : "border-white/[0.07] shadow-[0_10px_40px_rgba(0,0,0,0.35)] hover:border-amber-300/30 hover:-translate-y-[3px] hover:shadow-[0_16px_50px_rgba(0,0,0,0.45)]"
        }
      `}
    >
      {/* hairline top accent — the card's "trim" */}
      <div
        className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent ${
          isSelected ? "via-amber-300/80" : "via-white/20 group-hover:via-amber-300/50"
        } to-transparent transition-colors duration-300`}
      />

      {/* soft ambient glow on hover */}
      <div className="pointer-events-none absolute -top-24 -right-24 w-64 h-64 bg-amber-400/0 group-hover:bg-amber-400/[0.06] blur-3xl rounded-full transition-all duration-500" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 w-64 h-64 bg-cyan-400/0 group-hover:bg-cyan-400/[0.05] blur-3xl rounded-full transition-all duration-500" />

      {/* SELECTED CHECK */}
      {isSelected && (
        <div className="absolute top-0 right-6 bg-gradient-to-r from-amber-300 to-amber-500 text-black text-[10px] font-bold tracking-wide px-3 py-1 rounded-b-lg flex items-center gap-1 shadow-[0_4px_12px_rgba(251,191,36,0.35)]">
          ✓ SELECTED
        </div>
      )}

      {/* TOP ROW */}
      <div className="flex justify-between items-center mb-5">
        <div className="flex items-center gap-2">
          <span className="text-[11px] tracking-wide px-3 py-1 bg-white/[0.06] border border-white/[0.06] rounded-full text-gray-300 font-medium">
            {flight.aircraft}
          </span>

          {flight.tag && (
            <span
              className={`text-[10px] uppercase tracking-widest font-bold px-2.5 py-1 rounded-full bg-gradient-to-r ${tagGradient}`}
            >
              {flight.tag}
            </span>
          )}
        </div>

        <span className="text-[11px] text-amber-300/80 cursor-pointer hover:text-amber-200 tracking-wide font-medium transition-colors">
          Details →
        </span>
      </div>

      {/* MAIN GRID */}
      <div className="grid grid-cols-[1.4fr_2.8fr_auto_1.3fr] items-center gap-6">

        {/* LEFT */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-12 h-12 rounded-2xl bg-white/95 flex items-center justify-center shadow-[0_4px_14px_rgba(0,0,0,0.3)] ring-1 ring-white/10 overflow-hidden shrink-0">
            <img src={logo} className="w-8 h-8 object-contain" />
          </div>

          <div className="min-w-0">
            <p className="font-display font-bold text-lg tracking-tight whitespace-nowrap text-white">
              {flight.airline}
            </p>
            <p className="text-xs text-gray-400 tracking-wide whitespace-nowrap">
              {flight.origin} <span className="text-amber-300/70">→</span> {flight.destination}
            </p>
          </div>
        </div>

        {/* CENTER TIMELINE */}
        <div className="flex items-center justify-between min-w-0">

          {/* DEPART */}
          <div className="text-right shrink-0">
            <p className="font-display text-xl font-extrabold tabular-nums text-white whitespace-nowrap">
              {formatTime(flight.departure_time)}
            </p>
            <p className="text-[11px] text-gray-500 tracking-wide uppercase mt-0.5">{flight.origin}</p>
          </div>

          {/* TIMELINE */}
          <div className="flex flex-col items-center flex-1 mx-3 min-w-[64px]">

            <p className="text-[11px] text-gray-400 mb-1.5 font-medium tracking-wide whitespace-nowrap">
              {flight.duration || "--"}
            </p>

            <div className="relative w-full h-px bg-white/10 rounded-full">
              <div className="absolute left-0 top-0 h-px w-full bg-gradient-to-r from-amber-300/70 via-cyan-300/70 to-amber-300/70 rounded-full"></div>

              <div className="absolute -top-[3.5px] left-0 w-2 h-2 bg-amber-300 rounded-full shadow-[0_0_8px_rgba(252,211,77,0.7)]"></div>
              <div className="absolute -top-[3px] left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-white/50 rounded-full"></div>
              <div className="absolute -top-[3.5px] right-0 w-2 h-2 bg-amber-300 rounded-full shadow-[0_0_8px_rgba(252,211,77,0.7)]"></div>
            </div>

            <p className="text-[11px] text-gray-500 mt-2 tracking-wide whitespace-nowrap">
              {getStopsText(flight.stops)}
            </p>
          </div>

          {/* ARRIVAL */}
          <div className="shrink-0">
            <p className="font-display text-xl font-extrabold tabular-nums text-white whitespace-nowrap">
              {formatTime(flight.arrival_time)}
            </p>
            <p className="text-[11px] text-gray-500 tracking-wide uppercase mt-0.5">{flight.destination}</p>
          </div>

        </div>

        {/* TICKET PERFORATION — signature element separating the fare */}
        <div className="relative self-stretch w-px hidden md:block">
          <div className="absolute inset-y-1 left-0 border-l border-dashed border-white/15" />
          <div className="absolute -top-[7px] -left-[4px] w-2.5 h-2.5 rounded-full bg-[#070b16] border border-white/10" />
          <div className="absolute -bottom-[7px] -left-[4px] w-2.5 h-2.5 rounded-full bg-[#070b16] border border-white/10" />
        </div>

        {/* RIGHT PRICE */}
        <div className="flex flex-col items-end pl-6 min-w-0">

          <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-1 whitespace-nowrap">Total fare</p>

          <p className="font-display text-[2rem] leading-none font-extrabold text-transparent bg-clip-text bg-gradient-to-b from-amber-200 to-amber-400 drop-shadow-[0_0_18px_rgba(251,191,36,0.25)] tabular-nums whitespace-nowrap">
            ₹{totalPrice.toLocaleString()}
          </p>

          <p className="text-xs text-gray-500 whitespace-nowrap mt-1">
            ₹{safePrice.toLocaleString()} × {pax} passenger{pax > 1 ? "s" : ""}
          </p>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect?.();
            }}
            className={`select-btn relative overflow-hidden mt-4 px-6 py-2.5 rounded-full font-semibold text-sm tracking-wide whitespace-nowrap transition-all duration-200
            ${isSelected
              ? "bg-white/[0.06] text-amber-300 border border-amber-300/40"
              : "pill-cta hover:scale-[1.03]"
            }`}
          >
            {!isSelected && <span className="select-shine absolute inset-0" aria-hidden />}
            <span className="relative">{isSelected ? "Selected ✓" : "Select flight"}</span>
          </button>
        </div>

      </div>

      {/* ICON ROW */}
      <div className="flex items-center gap-3 mt-5 pt-4 border-t border-white/[0.06] text-gray-500 text-[11px] tracking-wide">
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.03]">📶 Wifi</span>
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.03]">🧳 Baggage</span>
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.03]">💺 Seat</span>
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.03]">🍽️ Meal</span>
      </div>

      <style jsx>{`
        .select-shine::after {
          content: "";
          position: absolute;
          top: 0; bottom: 0; left: -60%;
          width: 40%;
          background: linear-gradient(100deg, transparent, rgba(255,255,255,0.35), transparent);
          transform: skewX(-20deg);
          animation: selectShineSweep 3.2s ease-in-out infinite;
        }
        @keyframes selectShineSweep {
          0% { left: -60%; }
          55%, 100% { left: 130%; }
        }
        @media (prefers-reduced-motion: reduce) {
          .select-shine::after { animation: none !important; }
        }
      `}</style>
    </div>
  );
}