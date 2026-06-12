import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const origin = searchParams.get("origin");
    const destination = searchParams.get("destination");
    const depart = searchParams.get("depart");

    if (!origin || !destination || !depart) {
      return NextResponse.json(
        { error: "Missing params" },
        { status: 400 }
      );
    }

    // ✅ DATE RANGE (FULL DAY)
    const start = new Date(depart);
    start.setHours(0, 0, 0, 0);

    const end = new Date(depart);
    end.setHours(23, 59, 59, 999);

    // ✅ FETCH FROM flight_instances + JOIN flights
    const { data, error } = await supabase
      .from("flight_instances")
      .select(`
        departure_time,
        arrival_time,
        flights (
          id,
          airline,
          origin,
          destination,
          aircraft,
          base_price
        )
      `)
      .eq("flights.origin", origin)
      .eq("flights.destination", destination)
      .gte("departure_time", start.toISOString())
      .lte("departure_time", end.toISOString());

    if (error) {
      console.error("SUPABASE ERROR:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // ✅ TRANSFORM DATA FOR FRONTEND
    const flights = data.map((item: any) => {
      const f = item.flights;

      // 🔥 SAFETY CHECK
      if (!f) return null;

      return {
        id: f.id,
        airline: f.airline,
        origin: f.origin,
        destination: f.destination,

        departure_time: item.departure_time,
        arrival_time: item.arrival_time,

        aircraft: f.aircraft,

        // ✅ FIXED PRICE (MAIN ISSUE)
        price: f.base_price ?? 0,

        // ✅ TEMP (you can improve later)
        duration: "4h",

        // ✅ TEMP (until you add stops in DB)
        stops: 0,
      };
    }).filter(Boolean); // remove nulls

    return NextResponse.json({ flights });

  } catch (err: any) {
    console.error("SERVER ERROR:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}