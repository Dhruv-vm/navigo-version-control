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

const tagStyles: Record<string, string> = {
  best: "from-yellow-400 to-amber-500 text-black",
  cheapest: "from-emerald-400 to-green-500 text-black",
  fastest: "from-cyan-400 to-blue-500 text-black",
  value: "from-fuchsia-400 to-purple-500 text-black",
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
    (tagKey && tagStyles[tagKey]) || "from-blue-400 to-cyan-400 text-black";

  return (
    <div
      onClick={onSelect}
      className={`
        relative overflow-hidden
        bg-gradient-to-br from-[#0c1525] via-[#0b1220] to-[#0a1424]
        border rounded-2xl px-6 py-5
        transition-all duration-300 ease-out
        cursor-pointer group

        ${
          isSelected
            ? "border-blue-400 ring-2 ring-blue-400/50 scale-[1.015] shadow-[0_0_40px_rgba(59,130,246,0.4)]"
            : "border-white/10 shadow-[0_0_20px_rgba(0,0,0,0.25)] hover:border-blue-400/50 hover:-translate-y-[3px] hover:shadow-[0_8px_30px_rgba(59,130,246,0.15)]"
        }
      `}
    >
      {/* soft ambient glow on hover */}
      <div className="pointer-events-none absolute -top-20 -right-20 w-56 h-56 bg-blue-500/0 group-hover:bg-blue-500/10 blur-3xl rounded-full transition-all duration-500" />

      {/* SELECTED CHECK */}
      {isSelected && (
        <div className="absolute top-0 right-0 bg-blue-500 text-white text-[11px] font-semibold px-3 py-1 rounded-bl-xl rounded-tr-2xl flex items-center gap-1">
          ✓ Selected
        </div>
      )}

      {/* TOP ROW */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs px-3 py-1 bg-white/10 rounded-md text-gray-300 font-medium">
            {flight.aircraft}
          </span>

          {flight.tag && (
            <span
              className={`text-[10px] uppercase tracking-wide font-bold px-2.5 py-1 rounded-md bg-gradient-to-r ${tagGradient}`}
            >
              {flight.tag}
            </span>
          )}
        </div>

        <span className="text-[11px] text-blue-400 cursor-pointer hover:text-cyan-300 hover:underline transition-colors">
          Details
        </span>
      </div>

      {/* MAIN GRID */}
      <div className="grid grid-cols-[1.5fr_3fr_1.5fr] items-center gap-6">

        {/* LEFT */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center shadow-md ring-1 ring-black/5 overflow-hidden">
            <img src={logo} className="w-8 h-8 object-contain" />
          </div>

          <div>
            <p className="font-semibold text-lg whitespace-nowrap">
              {flight.airline}
            </p>
            <p className="text-xs text-gray-400">
              {flight.origin} → {flight.destination}
            </p>
          </div>
        </div>

        {/* CENTER TIMELINE */}
        <div className="flex items-center justify-between">

          {/* DEPART */}
          <div className="text-right">
            <p className="text-lg font-semibold tabular-nums">
              {formatTime(flight.departure_time)}
            </p>
            <p className="text-xs text-gray-400">{flight.origin}</p>
          </div>

          {/* TIMELINE */}
          <div className="flex flex-col items-center flex-1 mx-4">

            <p className="text-xs text-gray-300 mb-1 font-medium">
              {flight.duration || "--"}
            </p>

            <div className="relative w-full h-[3px] bg-white/10 rounded-full">
              <div className="absolute left-0 top-0 h-[3px] w-full bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-400 rounded-full"></div>

              <div className="absolute -top-[5px] left-0 w-2.5 h-2.5 bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.6)]"></div>
              <div className="absolute -top-[5px] left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-white/70 rounded-full"></div>
              <div className="absolute -top-[5px] right-0 w-2.5 h-2.5 bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.6)]"></div>
            </div>

            <p className="text-xs text-gray-400 mt-1.5">
              {getStopsText(flight.stops)}
            </p>
          </div>

          {/* ARRIVAL */}
          <div>
            <p className="text-lg font-semibold tabular-nums">
              {formatTime(flight.arrival_time)}
            </p>
            <p className="text-xs text-gray-400">{flight.destination}</p>
          </div>

        </div>

        {/* RIGHT PRICE */}
        <div className="flex flex-col items-end">

          <p className="text-3xl font-bold text-yellow-400 drop-shadow-[0_0_10px_rgba(255,215,0,0.45)] tabular-nums">
            ₹{totalPrice.toLocaleString()}
          </p>

          <p className="text-xs text-gray-400 whitespace-nowrap">
            ₹{safePrice.toLocaleString()} × {pax} passenger{pax > 1 ? "s" : ""}
          </p>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect?.();
            }}
            className={`mt-3 px-5 py-2 rounded-lg font-semibold transition-all
            ${isSelected
              ? "bg-white/10 text-blue-300 border border-blue-400/50"
              : "bg-gradient-to-r from-blue-500 via-cyan-400 to-yellow-400 text-black hover:scale-105 hover:shadow-[0_0_20px_rgba(56,189,248,0.6)]"
            }`}
          >
            {isSelected ? "Selected ✓" : "Select →"}
          </button>
        </div>

      </div>

      {/* ICON ROW */}
      <div className="flex items-center gap-4 mt-4 pt-3 border-t border-white/5 text-gray-400 text-xs">
        <span className="flex items-center gap-1">📶 Wifi</span>
        <span className="flex items-center gap-1">🧳 Baggage</span>
        <span className="flex items-center gap-1">💺 Seat</span>
        <span className="flex items-center gap-1">🍽️ Meal</span>
      </div>
    </div>
  );
}