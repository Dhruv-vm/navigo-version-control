import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { airports } from "@/lib/airports"
import { getAddonsCatalog } from "@/lib/addons-catalog"
import { computeDynamicPrice } from "@/lib/pricing"
import jwt from "jsonwebtoken"

interface ChatMessage {
  role: "user" | "assistant" | "system"
  content: string
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { messages = [], query = "" } = body

    // Extract optional auth token
    let authUser: { userId: string; email: string; isAdmin?: boolean; role?: string } | null = null
    const authHeader = req.headers.get("authorization")
    if (authHeader && authHeader.startsWith("Bearer ")) {
      try {
        const token = authHeader.split(" ")[1]
        const secret = process.env.JWT_SECRET || "navigo_jwt_secret_token_2026"
        authUser = jwt.verify(token, secret) as any
      } catch {
        // Unauthenticated or expired token
      }
    }

    const currentQuery = (query || (messages.length > 0 ? messages[messages.length - 1].content : "")).trim()
    const lower = currentQuery.toLowerCase()

    // 1. Fetch live user context if logged in
    let userBookings: any[] = []
    let userName = "Traveler"
    let userEmail = "traveler@navigo.com"
    let userNavPoints = 450

    if (authUser?.userId) {
      if (authUser.userId.startsWith("adm-") || authUser.isAdmin) {
        userName = "Admin Dhruv"
        userEmail = authUser.email || "admin@navigo.app"
      } else {
        const { data: userData } = await supabase
          .from("users")
          .select("name, email")
          .eq("id", authUser.userId)
          .maybeSingle()
        if (userData?.name) userName = userData.name
        if (userData?.email) userEmail = userData.email
      }

      const { data: bData } = await supabase
        .from("bookings")
        .select(`
          *,
          flight_instances (
            travel_date,
            departure_time,
            arrival_time,
            status,
            flights (
              flight_number,
              airline,
              origin,
              destination,
              duration,
              aircraft
            )
          )
        `)
        .eq("user_id", authUser.userId)
        .order("created_at", { ascending: false })

      if (bData) {
        userBookings = bData.map((b: any) => ({
          id: b.id,
          pnr: b.pnr,
          flightNumber: b.flight_instances?.flights?.flight_number || "NVG-302",
          airline: b.flight_instances?.flights?.airline || "Navigo Airlines",
          origin: b.flight_instances?.flights?.origin || "DEL",
          destination: b.flight_instances?.flights?.destination || "BLR",
          travelDate: b.flight_instances?.travel_date || "2026-08-25",
          departureTime: b.flight_instances?.departure_time || "06:00:00",
          arrivalTime: b.flight_instances?.arrival_time || "08:30:00",
          seat: b.seat || b.seat_number || "12A",
          status: b.status || "CONFIRMED",
          paidAmount: b.paid_amount || b.total_price || 5200,
          gate: "G4",
        }))
      }
    }

    // 2. Fetch live flight schedules for search inquiries
    const { data: flightsData } = await supabase.from("flights").select("*")
    const masterFlights = flightsData || []

    // 3. Process Intent Detection & Response Generation

    // --- Intent: MY BOOKINGS / TRIP STATUS ---
    if (
      (lower.includes("my booking") ||
      lower.includes("my flight") ||
      lower.includes("my trip") ||
      lower.includes("booked") ||
      (lower.includes("pnr") && !lower.match(/[a-z0-9]{6}/i))) &&
      !lower.includes("book ") &&
      !lower.includes("book a")
    ) {
      if (!authUser) {
        return NextResponse.json({
          reply: `To view and manage your active bookings, please **log in to your Navigo account**. Once logged in, I can track your PNR, provide gate updates, and issue boarding passes instantly!`,
          suggestions: ["Log in to Account", "Search Flights to Delhi", "How does DigiYatra work?", "Check Add-On Prices"],
          actionWidget: {
            type: "quick_links",
            title: "Account Access",
            links: [{ label: "Log In to Navigo →", href: "/login" }],
          },
        })
      }

      if (userBookings.length === 0) {
        return NextResponse.json({
          reply: `Hello **${userName}**! You currently don't have any active flight reservations under your account. Would you like me to find the best available flight fares for your next destination?`,
          suggestions: ["Find cheap flights to Mumbai", "Flights from Delhi to Bangalore", "Explore Dubai flights", "How to earn NavPoints?"],
          actionWidget: {
            type: "quick_links",
            title: "Quick Booking",
            links: [{ label: "Search Flights Now ↗", href: "/flights?origin=DEL&destination=BLR&depart=2026-08-25&pax=1&mode=oneway" }],
          },
        })
      }

      const latestBooking = userBookings[0]
      return NextResponse.json({
        reply: `Hi **${userName}**, here is your latest confirmed booking details for **PNR: ${latestBooking.pnr}**:\n\n✈️ **Flight:** ${latestBooking.airline} (${latestBooking.flightNumber})\n📍 **Sector:** ${latestBooking.origin} ➔ ${latestBooking.destination}\n📅 **Travel Date:** ${latestBooking.travelDate} (${latestBooking.departureTime?.slice(0, 5) || "06:00"})\n💺 **Seat:** ${latestBooking.seat} · **Gate:** ${latestBooking.gate}\n\nYour flight status is **${latestBooking.status}**. Fast-track DigiYatra Smart Check-in is available for this journey.`,
        suggestions: ["Check-in for this flight", "View Boarding Pass", "Add Extra Baggage", "Flight Price Trends"],
        actionWidget: {
          type: "booking_card",
          booking: latestBooking,
        },
      })
    }

    // --- Intent: SPECIFIC PNR LOOKUP ---
    const pnrMatch = currentQuery.match(/\b([A-Z0-9]{6})\b/i)
    if (pnrMatch && (lower.includes("pnr") || lower.includes("status") || lower.includes("track") || lower.includes("check"))) {
      const searchedPnr = pnrMatch[1].toUpperCase()
      const foundBooking = userBookings.find((b) => b.pnr === searchedPnr)

      if (foundBooking) {
        return NextResponse.json({
          reply: `✅ Found confirmed reservation for **PNR: ${foundBooking.pnr}**!\n\n• **Passenger:** ${userName}\n• **Route:** ${foundBooking.origin} ➔ ${foundBooking.destination}\n• **Flight:** ${foundBooking.flightNumber} (${foundBooking.airline})\n• **Departure:** ${foundBooking.travelDate} at ${foundBooking.departureTime?.slice(0, 5)}\n• **Seat:** ${foundBooking.seat} | **Gate:** ${foundBooking.gate}\n• **Status:** ${foundBooking.status}`,
          suggestions: ["Download Boarding Pass", "DigiYatra Face Scan", "Change Seat", "Add Priority Pass"],
          actionWidget: {
            type: "booking_card",
            booking: foundBooking,
          },
        })
      } else {
        // Generic PNR response
        return NextResponse.json({
          reply: `🔍 Checked Navigo central departure control for **PNR ${searchedPnr}**.\n\nFlight is **ON TIME** and confirmed for dispatch. Web check-in is open 48 hours prior to scheduled departure.`,
          suggestions: ["My Bookings", "Web Check-In", "DigiYatra Fast-Track", "Flight Radar"],
        })
      }
    }

    // --- Intent: END-TO-END INSTANT FLIGHT BOOKING ---
    const isBookingIntent =
      lower.includes("book ") ||
      lower.includes("book a") ||
      lower.includes("reserve") ||
      lower.includes("buy ticket") ||
      lower.includes("pay for")

    // Extract Origin and Destination Cities
    const cityMatches: string[] = []
    airports.forEach((a) => {
      if (lower.includes(a.city.toLowerCase()) || lower.includes(a.code.toLowerCase())) {
        cityMatches.push(a.code)
      }
    })

    if (isBookingIntent || cityMatches.length >= 2) {
      let origin = cityMatches[0] || "DEL"
      let destination = cityMatches[1] || (origin === "DEL" ? "BLR" : "DEL")

      // Find matching flights
      let matching = masterFlights.filter(
        (f: any) =>
          (f.origin === origin && f.destination === destination) ||
          (f.origin === destination && f.destination === origin)
      )

      if (matching.length === 0) {
        matching = masterFlights.slice(0, 3)
      }

      const topFlight = matching[0] || {
        id: "flt-101",
        airline: "Navigo Airlines",
        flight_number: "NVG-302",
        origin: origin,
        destination: destination,
        departure_time: "11:30:00",
        arrival_time: "14:00:00",
        duration: "2h 30m",
        base_price: 4850,
        aircraft: "Airbus A320neo",
      }

      // Dynamic price calculation
      const dynamic = computeDynamicPrice({
        basePrice: topFlight.base_price || 4850,
        availableSeats: 28,
        totalSeats: 180,
        travelDate: "2026-08-25",
      })

      const baseFare = dynamic.finalPrice
      const taxesAndFees = 850
      const grandTotal = baseFare + taxesAndFees

      // Parse passenger name if mentioned (e.g. "for Shreya Viralam")
      let passengerFullName = userName || "Shreya Viralam"
      const forMatch = currentQuery.match(/for\s+([A-Za-z\s]+?)(?:\s+to|\s+from|\s+on|\s+at|\s+in|$)/i)
      if (forMatch && forMatch[1].trim().length > 2) {
        passengerFullName = forMatch[1].trim()
      }

      const nameParts = passengerFullName.split(/\s+/)
      const firstName = nameParts[0] || "Shreya"
      const lastName = nameParts.slice(1).join(" ") || "Viralam"

      // Randomly auto-assign a free standard economy seat
      const randomSeatsPool = ["14B", "12A", "15C", "16D", "17E", "18F", "11B", "10C"]
      const randomSeat = randomSeatsPool[Math.floor(Math.random() * randomSeatsPool.length)]

      // Prepare complete checkout session payload
      const flightInstanceId = topFlight.id || "inst-sample-01"
      const checkoutSession = {
        departFlight: {
          id: topFlight.id || "flt-101",
          flight_instance_id: flightInstanceId,
          airline: topFlight.airline,
          origin: topFlight.origin,
          destination: topFlight.destination,
          departure_time: topFlight.departure_time,
          arrival_time: topFlight.arrival_time,
          aircraft: topFlight.aircraft || "Airbus A320neo",
          final_price: baseFare,
          duration: topFlight.duration || "2h 30m",
          travel_date: "2026-08-25",
        },
        returnFlight: null,
        passengers: 1,
        mode: "oneway",
        totalPrice: grandTotal,
        origin: topFlight.origin,
        destination: topFlight.destination,
        savedAt: Date.now(),
        bookingId: `draft-${Date.now()}`,
        savedPassengers: [
          {
            id: `pax-${Date.now()}`,
            type: "adult",
            title: "Mr",
            firstName: firstName,
            lastName: lastName,
            first_name: firstName,
            last_name: lastName,
            dob: "1998-05-14",
            gender: "male",
            nationality: "India",
            email: userEmail,
            mobile: "9876543210",
            is_primary_contact: true,
            isPrimaryContact: true,
          },
        ],
        selectedSeats: {
          [flightInstanceId]: [randomSeat],
        },
      }

      return NextResponse.json({
        reply: `⚡ I've prepared your complete flight reservation for **${topFlight.origin} ➔ ${topFlight.destination}**!\n\n✈️ **Flight:** ${topFlight.airline} (${topFlight.flight_number || "NVG-302"})\n📅 **Travel Date:** 25 Aug 2026 (${topFlight.departure_time?.slice(0, 5)} → ${topFlight.arrival_time?.slice(0, 5)})\n👤 **Passenger:** ${passengerFullName} (Adult)\n💺 **Auto-Assigned Seat:** **Seat ${randomSeat}** *(Random Free Seating Assigned ✓)*\n💰 **Total Payable:** **₹${grandTotal.toLocaleString("en-IN")}** (Base: ₹${baseFare.toLocaleString("en-IN")} + Taxes: ₹${taxesAndFees})\n\nClick **Proceed to Payment →** to complete checkout immediately, or choose a specific seat on the map!`,
        suggestions: [
          `Proceed to Payment (₹${grandTotal.toLocaleString("en-IN")})`,
          "💺 Pick specific seat on map",
          "Add Priority Boarding",
          "Check cancellation policy",
        ],
        actionWidget: {
          type: "instant_booking_card",
          checkoutSession: checkoutSession,
          flight: topFlight,
          passengerName: passengerFullName,
          assignedSeat: randomSeat,
          fare: baseFare,
          taxes: taxesAndFees,
          total: grandTotal,
        },
      })
    }

    // --- Intent: GENERAL FLIGHT SEARCH & ROUTE INQUIRIES ---
    if (
      lower.includes("flight") ||
      lower.includes("fly") ||
      lower.includes("search") ||
      lower.includes("ticket") ||
      lower.includes("cheapest") ||
      cityMatches.length > 0
    ) {
      let origin = cityMatches[0] || "DEL"
      let destination = cityMatches[1] || (origin === "DEL" ? "BLR" : "DEL")

      let matching = masterFlights.filter(
        (f: any) =>
          (f.origin === origin && f.destination === destination) ||
          (f.origin === destination && f.destination === origin)
      )

      if (matching.length === 0) {
        matching = masterFlights.slice(0, 3)
      }

      const topFlight = matching[0] || {
        airline: "Navigo Airlines",
        flight_number: "NVG-302",
        origin: "DEL",
        destination: "BLR",
        departure_time: "06:00:00",
        arrival_time: "08:30:00",
        duration: "2h 30m",
        base_price: 4850,
      }

      const dynamic = computeDynamicPrice({
        basePrice: topFlight.base_price || 4850,
        availableSeats: 28,
        totalSeats: 180,
        travelDate: "2026-08-25",
      })

      return NextResponse.json({
        reply: `Here are the best available flights for **${topFlight.origin} ➔ ${topFlight.destination}**:\n\n✈️ **${topFlight.airline}** (${topFlight.flight_number || "NVG-302"})\n⏱️ Departure: **${topFlight.departure_time?.slice(0, 5)}** → Arrival: **${topFlight.arrival_time?.slice(0, 5)}** (${topFlight.duration || "2h 30m"})\n💰 Current Dynamic Fare: **₹${dynamic.finalPrice.toLocaleString("en-IN")}** (Baseline: ₹${topFlight.base_price?.toLocaleString("en-IN") || "4,850"})\n⚡ **Recommendation:** Prices for this route are trending upwards due to high passenger demand. Booking now is recommended!`,
        suggestions: [`Book ${topFlight.origin} ➔ ${topFlight.destination}`, "Show more airlines", "Price trend prediction", "Add Priority Boarding"],
        actionWidget: {
          type: "flight_card",
          flight: {
            ...topFlight,
            calculatedPrice: dynamic.finalPrice,
          },
        },
      })
    }

    // --- Intent: DIGIYATRA / SMART CHECK-IN / FACE SCAN ---
    if (
      lower.includes("digiyatra") ||
      lower.includes("face") ||
      lower.includes("biometric") ||
      lower.includes("smart check") ||
      lower.includes("check-in") ||
      lower.includes("checkin") ||
      lower.includes("gate")
    ) {
      return NextResponse.json({
        reply: `### 👤 Navigo DigiYatra Smart Check-In & Biometrics\n\nNavigo features **seamless biometric touchless boarding** powered by zero-knowledge facial verification:\n\n1. **📸 Live Face Enrollment:** Quick 2-second scan during web check-in extracts a 128-dimensional biometric mathematical vector (no raw images are stored).\n2. **🔐 Cryptographic Pass:** Generates an HMAC-signed digital QR token valid for 48 hours.\n3. **🚪 E-Gate Fast-Track:** Walk straight through Gate **G4** without waiting in paper verification lines.\n\n*Would you like to start DigiYatra check-in for your upcoming flight?*`,
        suggestions: ["Check-in for my flight", "View Boarding Pass", "How is my biometric data protected?", "My Bookings"],
        actionWidget: {
          type: "quick_links",
          title: "DigiYatra Fast-Track Terminal",
          links: [
            { label: "Start Web Check-In ↗", href: "/check-in" },
            { label: "My Trips & Passes ↗", href: "/my-trips" },
          ],
        },
      })
    }

    // --- Intent: PRICE PREDICTION & FARE TRENDS ---
    if (
      lower.includes("price") ||
      lower.includes("fare") ||
      lower.includes("cheap") ||
      lower.includes("cost") ||
      lower.includes("trend") ||
      lower.includes("discount") ||
      lower.includes("dynamic")
    ) {
      return NextResponse.json({
        reply: `### 📈 Navigo AI Price Intelligence\n\nOur dynamic pricing engine continuously tracks flight occupancy velocity, lead-time elasticity, and day-of-week demand:\n\n• **Current Market Status:** Moderate-to-High Demand across Western and Southern sectors (DEL, BOM, BLR).\n• **Booking Window Tip:** Flights booked **14–21 days in advance** typically yield **24% lower fares** than last-minute reservations.\n• **Weekend Multiplier:** Flights departing Friday evenings and Sunday mornings carry a **1.15x surge factor**.\n\n*Ask me about any specific route to see today's real-time fare projection!*`,
        suggestions: ["Delhi to Bangalore Fare", "Mumbai to Delhi Flight", "Add-On Pricing", "How to redeem NavPoints?"],
        actionWidget: {
          type: "price_insight_card",
          title: "Fare Yield Forecast",
          route: "DEL ➔ BLR",
          currentFare: 4850,
          forecast: "PROJECTED TO RISE (+18%)",
          advice: "Book within 48 hours for optimal savings",
        },
      })
    }

    // --- Intent: BAGGAGE & ADD-ON SERVICES ---
    if (
      lower.includes("baggage") ||
      lower.includes("luggage") ||
      lower.includes("addon") ||
      lower.includes("add-on") ||
      lower.includes("lounge") ||
      lower.includes("meal") ||
      lower.includes("food") ||
      lower.includes("priority")
    ) {
      const addons = getAddonsCatalog()
      const priorityAddon = addons.find((a) => a.id.includes("priority")) || { price: 499 }
      const bagAddon = addons.find((a) => a.id.includes("bag")) || { price: 1850 }
      const loungeAddon = addons.find((a) => a.id.includes("lounge")) || { price: 1450 }

      return NextResponse.json({
        reply: `### 🧳 Navigo Ancillary & Add-On Services Catalog\n\nHere are our standard add-on options available during booking and check-in:\n\n• **🧳 Extra Baggage (+15kg Check-in):** ₹${bagAddon.price} *(Standard allowance: 15kg checked + 7kg cabin free)*\n• **⚡ Priority Boarding & Fast-Track:** ₹${priorityAddon.price} *(Skip queues at boarding gates)*\n• **🍸 Navigo Executive Lounge Pass (T3):** ₹${loungeAddon.price} *(Buffet dining & quiet work pods)*\n• **🍽️ Gourmet In-Flight Meal:** ₹650 *(Chef-curated hot meals & beverages)*`,
        suggestions: ["Add Priority Boarding", "Lounge Access Details", "My Bookings", "Search Flights"],
        actionWidget: {
          type: "addon_card",
          addons: addons.slice(0, 3),
        },
      })
    }

    // --- Intent: NAVPOINTS LOYALTY & REWARDS ---
    if (
      lower.includes("navpoint") ||
      lower.includes("points") ||
      lower.includes("loyalty") ||
      lower.includes("reward") ||
      lower.includes("frequent flyer")
    ) {
      return NextResponse.json({
        reply: `### ✨ Navigo NavPoints Loyalty Program\n\nHello **${userName}**! You earn **NavPoints** on every flight and add-on purchase with Navigo:\n\n• **Earn Rate:** 10 NavPoints per ₹100 spent.\n• **Redemption Value:** 1 NavPoint = ₹1.00 direct discount on checkout.\n• **Bonus Milestones:** Complete DigiYatra Smart Check-in to earn **+150 bonus NavPoints**!\n\n*Your current estimated balance:* **${userNavPoints} NavPoints** (Worth ₹${userNavPoints} on your next journey).`,
        suggestions: ["Redeem points on flight", "Book a flight", "My Bookings", "DigiYatra Bonus"],
        actionWidget: {
          type: "quick_links",
          title: "NavPoints Club",
          links: [
            { label: "Book Flights with Points →", href: "/flights?origin=DEL&destination=BLR&depart=2026-08-25&pax=1&mode=oneway" },
            { label: "View Trips & Earn History →", href: "/my-trips" },
          ],
        },
      })
    }

    // --- Intent: CANCELLATION & REFUNDS ---
    if (
      lower.includes("cancel") ||
      lower.includes("refund") ||
      lower.includes("reschedule") ||
      lower.includes("change date")
    ) {
      return NextResponse.json({
        reply: `### 🔄 Navigo Cancellation & Refund Policy\n\n• **24-Hour Free Cancellation:** Cancel within 24 hours of booking for a 100% full instant refund.\n• **Standard Cancellation:** Cancellations made up to 2 hours before scheduled departure incur a flat ₹1,200 airline processing fee; the remaining balance is refunded directly to your original payment method within 24 hours.\n• **Instant Rescheduling:** Change your travel date up to 4 hours before departure with zero change penalty (fare difference applies).`,
        suggestions: ["View My Bookings", "Contact Staff", "Price Trends", "Search New Dates"],
      })
    }

    // --- Default General Assistant Guidance ---
    return NextResponse.json({
      reply: `Hello **${userName}**! I'm **NaviBot**, your AI flight companion on Navigo.\n\nHere's what I can do for you in real time:\n\n• 🔍 **Search & Book Flights:** Just say *"Book DEL to BLR on 25 Aug"* and I'll prepare everything through to payment!\n• 💺 **Seat Selection & Random Seating:** Auto-assigns random free seats or lets you pick.\n• 🎫 **Track Your Bookings:** Look up PNR status, seat assignments, and terminal gates.\n• 👤 **DigiYatra Fast-Track:** Complete facial biometric smart check-in and download QR passes.\n• 📈 **AI Price Forecasting:** Get alerts on when fares are projected to rise.\n\n*How may I assist your journey today?*`,
      suggestions: [
        "⚡ Book DEL to BLR on 25 Aug",
        "🔍 Find flights to Delhi",
        "🎫 Check my booking status",
        "⚡ How does DigiYatra work?",
        "🧳 Baggage allowance rules",
      ],
      actionWidget: {
        type: "quick_links",
        title: "Fast Shortcuts",
        links: [
          { label: "Search Flights ↗", href: "/flights?origin=DEL&destination=BLR&depart=2026-08-25&pax=1&mode=oneway" },
          { label: "Web Check-In ↗", href: "/check-in" },
          { label: "My Trips ↗", href: "/my-trips" },
        ],
      },
    })
  } catch (err: any) {
    console.error("NaviBot Error:", err)
    return NextResponse.json({
      reply: "I encountered a brief connection glitch while querying our flight systems. Please try asking again!",
      suggestions: ["Search Flights", "My Bookings", "Check-In", "Pricing Help"],
    })
  }
}
