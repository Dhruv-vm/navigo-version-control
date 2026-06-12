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
};

const airlineLogos: Record<string, string> = {
  "IndiGo": "/airlines/indigo.png",
  "Air India": "/airlines/airindia.png",
  "Vistara": "/airlines/vistara.png",
  "Akasa Air": "/airlines/akasa.png",
  "Emirates": "/airlines/emirates.png",
  "Qatar Airways": "/airlines/qatar.png",
};

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStopsText(stops?: number) {
  if (!stops || stops === 0) return "Non-stop";
  if (stops === 1) return "1 Stop • BOM";
  return `${stops} Stops`;
}

export default function FlightCard({ flight }: { flight: Flight }) {
  const logo = airlineLogos[flight.airline] || "/airlines/default.png";

  return (
    <div className="bg-[#0B1220] border border-white/10 rounded-2xl px-6 py-6 hover:border-blue-400/40 transition">

      {/* TOP */}
      <div className="flex justify-between mb-4">
        <span className="text-xs px-2 py-1 bg-white/10 rounded-md text-gray-300">
          {flight.aircraft}
        </span>

        {flight.tag && (
          <span className="text-[10px] px-2 py-1 rounded-md bg-blue-500/20 text-blue-400">
            {flight.tag}
          </span>
        )}
      </div>

      {/* MAIN GRID */}
      <div className="grid grid-cols-[1.2fr_2fr_1fr] items-center gap-4">

        {/* LEFT */}
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-white flex items-center justify-center">
            <img src={logo} className="w-10 h-10 object-contain" />
          </div>

          <div>
            <p className="font-semibold text-lg">{flight.airline}</p>
            <p className="text-xs text-gray-400">
              {flight.origin} → {flight.destination}
            </p>
          </div>
        </div>

        {/* CENTER TIMELINE */}
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4 w-full">

          {/* LEFT TIME */}
          <div className="flex flex-col items-end">
            <span className="text-lg font-semibold">
              {formatTime(flight.departure_time)}
            </span>
            <span className="text-xs text-gray-400">{flight.origin}</span>
          </div>

          {/* TIMELINE */}
          <div className="flex flex-col items-center w-full">

            <span className="text-xs text-gray-400 mb-1">
              {flight.duration}
            </span>

            <div className="relative w-full h-[2px] bg-white/20">

              <div className="absolute left-0 top-0 h-[2px] w-1/2 bg-blue-400"></div>

              <div className="absolute -top-[3px] left-0 w-2 h-2 bg-white rounded-full"></div>
              <div className="absolute -top-[3px] left-1/2 -translate-x-1/2 w-2 h-2 bg-white/70 rounded-full"></div>
              <div className="absolute -top-[3px] right-0 w-2 h-2 bg-white rounded-full"></div>
            </div>

            <span className="text-xs text-gray-400 mt-1">
              {getStopsText(flight.stops)}
            </span>
          </div>

          {/* RIGHT TIME */}
          <div className="flex flex-col items-start">
            <span className="text-lg font-semibold">
              {formatTime(flight.arrival_time)}
            </span>
            <span className="text-xs text-gray-400">{flight.destination}</span>
          </div>

        </div>

        {/* RIGHT */}
        <div className="flex flex-col items-end">
          <p className="text-2xl font-bold text-yellow-400">
            ₹{flight.price}
          </p>
          <p className="text-xs text-gray-400">Round trip</p>

          <button className="mt-2 px-5 py-2 rounded-lg font-semibold bg-gradient-to-r from-blue-500 via-cyan-400 to-yellow-400 text-black">
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

        <button className="ml-auto text-blue-400 text-xs">
          Details
        </button>
      </div>

    </div>
  );
}