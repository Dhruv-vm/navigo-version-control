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

function formatTime(dateStr?: string) {
  if (!dateStr) return "--:--";
  const d = new Date(dateStr);
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

  return (
    <div
      onClick={onSelect}
      className={`
        bg-gradient-to-br from-[#0B1220] to-[#0a1628]
        border rounded-2xl px-6 py-5
        transition duration-200
        cursor-pointer

        ${
          isSelected
            ? "border-blue-400 ring-2 ring-blue-400/40 scale-[1.015] shadow-[0_0_35px_rgba(59,130,246,0.35)]"
            : "border-white/10 shadow-[0_0_25px_rgba(59,130,246,0.08)] hover:border-blue-400/40 hover:-translate-y-[2px]"
        }
      `}
    >

      {/* TOP ROW */}
      <div className="flex justify-between items-center mb-4">
        <span className="text-xs px-3 py-1 bg-white/10 rounded-md text-gray-300">
          {flight.aircraft}
        </span>

        <span className="text-[11px] text-blue-400 cursor-pointer hover:underline">
          Details
        </span>
      </div>

      {/* MAIN GRID */}
      <div className="grid grid-cols-[1.5fr_3fr_1.5fr] items-center gap-6">

        {/* LEFT */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-white flex items-center justify-center">
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
            <p className="text-lg font-semibold">
              {formatTime(flight.departure_time)}
            </p>
            <p className="text-xs text-gray-400">{flight.origin}</p>
          </div>

          {/* TIMELINE */}
          <div className="flex flex-col items-center flex-1 mx-4">

            <p className="text-xs text-gray-400 mb-1">
              {flight.duration || "--"}
            </p>

            <div className="relative w-full h-[3px] bg-white/20">
              <div className="absolute left-0 top-0 h-[3px] w-full bg-gradient-to-r from-blue-400 to-cyan-400"></div>

              <div className="absolute -top-[5px] left-0 w-2.5 h-2.5 bg-white rounded-full"></div>
              <div className="absolute -top-[5px] left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-white/70 rounded-full"></div>
              <div className="absolute -top-[5px] right-0 w-2.5 h-2.5 bg-white rounded-full"></div>
            </div>

            <p className="text-xs text-gray-400 mt-1">
              {getStopsText(flight.stops)}
            </p>
          </div>

          {/* ARRIVAL */}
          <div>
            <p className="text-lg font-semibold">
              {formatTime(flight.arrival_time)}
            </p>
            <p className="text-xs text-gray-400">{flight.destination}</p>
          </div>

        </div>

        {/* RIGHT PRICE */}
        <div className="flex flex-col items-end">

          <p className="text-3xl font-bold text-yellow-400 drop-shadow-[0_0_8px_rgba(255,215,0,0.5)]">
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
            className="mt-3 px-5 py-2 rounded-lg font-semibold bg-gradient-to-r from-blue-500 via-cyan-400 to-yellow-400 text-black hover:scale-105 hover:shadow-[0_0_20px_rgba(56,189,248,0.6)] transition"
          >
            Select →
          </button>
        </div>

      </div>

      {/* ICON ROW */}
      <div className="flex items-center gap-3 mt-4 text-gray-400 text-sm">
        <span>📶</span>
        <span>🧳</span>
        <span>💺</span>
        <span>🍽️</span>
      </div>
    </div>
  );
}