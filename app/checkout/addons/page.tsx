"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Navbar from "@/components/navbar"

type StoredFlight = {
  id: string
  flight_instance_id: string
  airline: string
  origin: string
  destination: string
  departure_time: string
  arrival_time: string
  aircraft: string
  stops?: number
  final_price: number
  duration?: string
  travel_date?: string
}

type CheckoutSelection = {
  departFlight: StoredFlight
  returnFlight: StoredFlight | null
  passengers: number
  mode: string
  totalPrice: number
  origin: string | null
  destination: string | null
  savedAt: number
  bookingId?: string
  holdExpiresAt?: string
  seatSelectionPrice?: number
}

const STORAGE_KEY = "navigo:checkoutSelection"

// Rebuilds the original /flights search query from the stored selection —
// same field names the selection was already saved with (origin,
// destination, travel_date, passengers, mode). Param names below match
// what app/api/flights/route.ts actually reads (`depart`/`return`, per its
// own comment about matching that naming convention) — confirmed against
// that route directly, not guessed.
function buildFlightSearchUrl(selection: CheckoutSelection): string {
  const params = new URLSearchParams()
  if (selection.origin) params.set("origin", selection.origin)
  if (selection.destination) params.set("destination", selection.destination)
  if (selection.departFlight?.travel_date) params.set("depart", selection.departFlight.travel_date)
  if (selection.returnFlight?.travel_date) params.set("return", selection.returnFlight.travel_date)
  params.set("passengers", String(selection.passengers))
  if (selection.mode) params.set("mode", selection.mode)
  return `/flights?${params.toString()}`
}

const airlineLogos: Record<string, string> = {
  "IndiGo": "/airlines/indigo.png",
  "Air India": "/airlines/airindia.png",
  "Vistara": "/airlines/vistara.png",
  "Akasa Air": "/airlines/akasa.png",
  "Emirates": "/airlines/emirates.png",
  "Qatar Airways": "/airlines/qatar.png",
  "Japan Airlines": "/airlines/japanairlines.png",
}

type CategoryId = "recommended" | "baggage" | "comfort" | "meals" | "essentials" | "insurance" | "airport"

type AddonVariant = { label: string; price: number; originalPrice?: number }
type Addon = {
  id: string
  title: string
  desc: string
  icon: string
  category: Exclude<CategoryId, "recommended">
  // Local asset path, same convention as airlineLogos / the seat-pod PNGs
  // elsewhere in this app. Missing or 404-ing gracefully falls back to an
  // icon illustration (see AddonHero) — drop real photos into
  // /public/addons/ (baggage.svg, legroom.svg, meal.svg, lounge.svg,
  // priority.svg, insurance.svg, wifi.svg, fasttrack.svg) and they'll pick
  // up automatically, nothing else to wire up.
  image?: string
  discountPct?: number
  variants: AddonVariant[]
}

// ---------------------------------------------------------------------------
// Prices are real INR figures, proportionate to the rest of checkout (base
// fare ~₹38,642, seat prices ₹6,200–₹24,750) — not the old $18–$100
// placeholders. Each discountPct is preserved exactly.
// ---------------------------------------------------------------------------

const RECOMMENDED_ADDONS: Addon[] = [
  {
    id: "baggage",
    title: "Extra Baggage",
    desc: "Add more baggage allowance to your trip.",
    icon: "🧳",
    category: "baggage",
    image: "/addons/baggage.svg",
    discountPct: 20,
    variants: [
      { label: "10 kg", price: 600, originalPrice: 750 },
      { label: "15 kg", price: 900, originalPrice: 1125 },
      { label: "20 kg", price: 1200, originalPrice: 1500 },
    ],
  },
  {
    id: "legroom",
    title: "Extra Legroom Seat",
    desc: "More legroom for extra comfort.",
    icon: "💺",
    category: "comfort",
    image: "/addons/legroom.svg",
    discountPct: 15,
    variants: [{ label: "1 Seat", price: 1700, originalPrice: 2000 }],
  },
  {
    id: "meal",
    title: "Gourmet Meal",
    desc: "Enjoy a wide range of meal options.",
    icon: "🍽️",
    category: "meals",
    image: "/addons/meal.svg",
    discountPct: 10,
    variants: [{ label: "1 Meal", price: 360, originalPrice: 400 }],
  },
  {
    id: "lounge",
    title: "Lounge Access",
    desc: "Relax in premium airport lounges.",
    icon: "🛋️",
    category: "airport",
    image: "/addons/lounge.svg",
    discountPct: 20,
    variants: [{ label: "1 Lounge", price: 960, originalPrice: 1200 }],
  },
]

// ✅ UI FIX: gave each "More Add-ons" entry a discountPct-free hero treatment
// (image/icon field) so AddonMiniCard can reuse the same AddonHero component
// as the recommended cards above — previously this section was flat
// icon-in-a-box rows while RECOMMENDED_ADDONS got full illustrated cards,
// which read as two different design systems stacked on one page.
const MORE_ADDONS: Addon[] = [
  { id: "priority", title: "Priority Boarding", desc: "Be among the first to board.", icon: "🚶", category: "airport", image: "/addons/priority.svg", variants: [{ label: "Add", price: 500 }] },
  { id: "insurance", title: "Travel Insurance", desc: "Protect your trip from uncertainties.", icon: "🛡️", category: "insurance", image: "/addons/insurance.svg", variants: [{ label: "Add", price: 700 }] },
  { id: "wifi", title: "Wi-Fi Onboard", desc: "Stay connected in the sky.", icon: "📶", category: "essentials", image: "/addons/wifi.svg", variants: [{ label: "Add", price: 250 }] },
  { id: "baggage10", title: "Extra Baggage (10kg)", desc: "Add extra 10kg baggage.", icon: "🧳", category: "baggage", image: "/addons/baggage.svg", variants: [{ label: "Add", price: 600 }] },
  { id: "fasttrack", title: "Airport Fast Track", desc: "Skip the queues and save time.", icon: "🏃", category: "airport", image: "/addons/fasttrack.svg", variants: [{ label: "Add", price: 800 }] },
]

const ALL_ADDONS = [...RECOMMENDED_ADDONS, ...MORE_ADDONS]

const CATEGORIES: { id: CategoryId; label: string; sub: string; icon: React.ReactNode }[] = [
  { id: "recommended", label: "Recommended", sub: "Best for your trip", icon: <SparkleIcon /> },
  { id: "baggage", label: "Baggage", sub: "Extra baggage allowance", icon: <SuitcaseIcon /> },
  { id: "comfort", label: "Seats & Comfort", sub: "Choose your comfort", icon: <SeatGlyphIcon /> },
  { id: "meals", label: "Meals", sub: "Delicious in-flight meals", icon: <UtensilsIcon /> },
  { id: "essentials", label: "Travel Essentials", sub: "Stay prepared", icon: <BriefcaseIcon /> },
  { id: "insurance", label: "Insurance", sub: "Secure your journey", icon: <ShieldIcon /> },
  { id: "airport", label: "Airport Services", sub: "Skip the lines", icon: <PlaneIcon /> },
]

const HOLD_MINUTES = 15

const steps = [
  { id: 1, label: "Search" },
  { id: 2, label: "Select" },
  { id: 3, label: "Passengers" },
  { id: 4, label: "Seats" },
  { id: 5, label: "Add-ons" },
  { id: 6, label: "Payment" },
]

function formatTime(timeStr?: string): string {
  if (!timeStr) return "--:--"
  const match = timeStr.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
  if (match) {
    const hours = Number(match[1])
    const minutes = match[2]
    const period = hours >= 12 ? "PM" : "AM"
    const displayHour = hours % 12 === 0 ? 12 : hours % 12
    return `${displayHour}:${minutes} ${period}`
  }
  const d = new Date(timeStr)
  if (isNaN(d.getTime())) return "--:--"
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

// ₹ + en-IN grouping (₹1,23,456) everywhere on this page, matching the
// seats page — replaces the old bare `.toLocaleString()` + "$".
function formatINR(amount: number): string {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`
}

export default function AddonsPage() {
  const router = useRouter()

  const [selection, setSelection] = useState<CheckoutSelection | null>(null)
  const [loadState, setLoadState] = useState<"loading" | "found" | "missing">("loading")
  const [mounted, setMounted] = useState(false)

  const [chosen, setChosen] = useState<Record<string, number>>({})
  const [activeCategory, setActiveCategory] = useState<CategoryId>("recommended")
  const [summaryOpen, setSummaryOpen] = useState(true)
  const [dynamicCatalog, setDynamicCatalog] = useState<any[]>([])

  useEffect(() => {
    fetch("/api/addons")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.addons) setDynamicCatalog(d.addons)
      })
      .catch(() => {})
  }, [])

  const activeAllAddons = useMemo(() => {
    if (!dynamicCatalog || dynamicCatalog.length === 0) return ALL_ADDONS
    const priceMap = new Map(dynamicCatalog.map((c) => [c.id, c.price]))
    return ALL_ADDONS.map((addon) => {
      const matchedPrice =
        priceMap.get(`addon-${addon.id}`) ||
        priceMap.get(addon.id) ||
        (addon.id === "baggage" && priceMap.get("addon-bag-15")) ||
        (addon.id === "baggage10" && (priceMap.get("addon-bag-15") ? Math.round(priceMap.get("addon-bag-15")! * 0.6) : undefined)) ||
        (addon.id === "meal" && priceMap.get("addon-meal-exec")) ||
        (addon.id === "lounge" && priceMap.get("addon-lounge-del")) ||
        (addon.id === "priority" && priceMap.get("addon-priority-board")) ||
        (addon.id === "wifi" && priceMap.get("addon-wifi-high")) ||
        (addon.id === "insurance" && priceMap.get("addon-insurance")) ||
        (addon.id === "fasttrack" && priceMap.get("addon-priority-board"))

      if (matchedPrice !== undefined) {
        return {
          ...addon,
          variants: addon.variants.map((v) => ({ ...v, price: matchedPrice })),
        }
      }
      return addon
    })
  }, [dynamicCatalog])

  const activeRecommendedAddons = useMemo(() => {
    return activeAllAddons.filter((a) =>
      ["baggage", "legroom", "meal", "lounge"].includes(a.id)
    )
  }, [activeAllAddons])

  const activeMoreAddons = useMemo(() => {
    return activeAllAddons.filter(
      (a) => !["baggage", "legroom", "meal", "lounge"].includes(a.id)
    )
  }, [activeAllAddons])

  // ── Hold countdown ──────────────────────────────────────────────────
  // Backed by the real bookings.hold_expires_at set when seats were saved
  // (see the seats route) — not a client-only timer, so refreshing this
  // page doesn't reset the clock.
  const [msLeft, setMsLeft] = useState<number | null>(null)

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(t)
  }, [])

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      if (!raw) { setLoadState("missing"); return }
      const parsed = JSON.parse(raw) as CheckoutSelection
      if (!parsed.bookingId) { setLoadState("missing"); return }
      setSelection(parsed)
      setLoadState("found")
    } catch (err) {
      console.error("Failed to read checkout selection:", err)
      setLoadState("missing")
    }
  }, [])

  useEffect(() => {
    if (!selection?.holdExpiresAt) return
    const expiresAt = new Date(selection.holdExpiresAt).getTime()

    const tick = () => {
      const remaining = expiresAt - Date.now()
      setMsLeft(remaining)
      if (remaining <= 0) {
        // Hold lapsed — the seats aren't guaranteed anymore, send the
        // traveler back to pick again rather than letting them pay for
        // seats someone else may have since taken.
        router.push("/checkout/seats")
      }
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [selection?.holdExpiresAt, router])

  const toggleAddon = (addon: Addon, variantIndex = 0) => {
    setChosen((prev) => {
      const next = { ...prev }
      if (addon.id in next) delete next[addon.id]
      else next[addon.id] = variantIndex
      return next
    })
  }

  const setVariant = (addonId: string, variantIndex: number) => {
    setChosen((prev) => (addonId in prev ? { ...prev, [addonId]: variantIndex } : prev))
  }

  const { addonsTotal, addonsSavings, selectedList } = useMemo(() => {
    let total = 0
    let savings = 0
    const list: { addon: Addon; variant: AddonVariant }[] = []
    for (const [id, variantIdx] of Object.entries(chosen)) {
      const addon = activeAllAddons.find((a) => a.id === id)
      if (!addon) continue
      const variant = addon.variants[variantIdx]
      if (!variant) continue
      total += variant.price
      if (variant.originalPrice) savings += variant.originalPrice - variant.price
      list.push({ addon, variant })
    }
    return { addonsTotal: total, addonsSavings: savings, selectedList: list }
  }, [chosen, activeAllAddons])

  const categoryAddons = useMemo(
    () => (activeCategory === "recommended" ? [] : activeAllAddons.filter((a) => a.category === activeCategory)),
    [activeCategory, activeAllAddons]
  )

  const handleContinue = () => {
    if (!selection) return
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          ...selection,
          addons: selectedList.map(({ addon, variant }) => ({ id: addon.id, title: addon.title, variant: variant.label, price: variant.price })),
          addonsTotal,
        })
      )
    } catch (err) {
      console.error("Failed to persist add-ons:", err)
    }
    router.push("/checkout/payment")
  }

  async function handleEditFlight() {
    if (!selection?.bookingId) {
      router.push(buildFlightSearchUrl(selection!))
      return
    }
    try {
      // Releases this booking's booking_seats rows for its flight
      // instances (and restores the seat-count columns those rows had
      // decremented) so the seats are actually free for other travelers
      // immediately, rather than sitting locked until the 15-minute hold
      // naturally expires.
      await fetch(`/api/bookings/${selection.bookingId}/seats`, { method: "DELETE" })

      // ✅ FIX: the release above only touches the DB — sessionStorage
      // still had the old holdExpiresAt / seatSelectionPrice, so hitting
      // Back after editing landed back on this page still counting down a
      // timer for seats that were already released. Strip both before
      // navigating so a Back-navigation reads a selection with no stale
      // hold info (HoldTimer only renders when holdExpiresAt is present).
      const { holdExpiresAt, seatSelectionPrice, ...rest } = selection
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(rest))
    } catch (err) {
      console.warn("Failed to release held seats before editing flight:", err)
      // Navigate anyway — worst case the hold expires on its own in the
      // usual 15 minutes; we don't want a failed release to trap the
      // traveler on this page.
    }
    router.push(buildFlightSearchUrl(selection))
  }

  if (loadState === "loading") {
    return <PageShell><CenteredMessage text="Preparing add-ons…" /></PageShell>
  }

  if (loadState === "missing" || !selection) {
    return (
      <PageShell>
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
          <p className="text-slate-400">We couldn't find an active booking with seats selected.</p>
          <button
            onClick={() => router.push("/checkout/seats")}
            className="px-6 py-3 rounded-full pill-cta font-semibold"
          >
            Go to Seat Selection
          </button>
        </div>
      </PageShell>
    )
  }

  const { departFlight, returnFlight } = selection
  const isRoundTrip = !!returnFlight
  const baseFare = (departFlight.final_price + (returnFlight?.final_price || 0)) * selection.passengers
  const taxesAndFees = Math.round(baseFare * 0.19)
  const seatSelectionPrice = selection.seatSelectionPrice || 0
  const tripTotal = baseFare + taxesAndFees + seatSelectionPrice + addonsTotal
  const activeCategoryMeta = CATEGORIES.find((c) => c.id === activeCategory)!

  return (
    <PageShell selection={selection} router={router}>
      {/* Mobile category chips — the vertical rail is desktop-only */}
      <CategoryChips active={activeCategory} onChange={setActiveCategory} />

      <div className={`flex items-center justify-between gap-4 mb-3 transition-all duration-500 ease-out ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
        <p className="text-[11px] uppercase tracking-widest text-slate-500">Your Itinerary</p>
        {msLeft !== null && <HoldTimer msLeft={msLeft} holdMinutes={HOLD_MINUTES} />}
      </div>

      <div className={`transition-all duration-500 ease-out ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
        <FlightSummaryCard flight={departFlight} tag={isRoundTrip ? "Departure" : undefined} onEditFlight={handleEditFlight} />
        {isRoundTrip && <div className="mt-3"><FlightSummaryCard flight={returnFlight} tag="Return" onEditFlight={handleEditFlight} /></div>}
      </div>

      <div className="grid grid-cols-12 gap-6 mt-6">
        {/* Desktop category rail */}
        <div className="hidden lg:block lg:col-span-2">
          <CategoryRail active={activeCategory} onChange={setActiveCategory} />
        </div>

        <div className="col-span-12 lg:col-span-7 space-y-6">
          <div className="relative bg-gradient-to-br from-[#0D1A2C] via-[#0B1729] to-[#0A1424] border border-[#D4AF37]/15 rounded-2xl p-6 flex items-center justify-between flex-wrap gap-4 ticket-edge overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-400 via-amber-400 to-amber-300" />
            <div className="pointer-events-none absolute -top-16 -right-10 w-56 h-56 bg-[#D4AF37]/[0.06] blur-[90px] rounded-full" aria-hidden />
            <div className="relative">
              <p className="font-display text-xl font-bold text-white">Make your journey more comfortable</p>
              <p className="text-sm text-slate-500 mt-1">Choose add-ons to enhance your travel experience.</p>
            </div>
            <div className="relative flex items-center gap-3 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.06] px-4 py-2.5">
              <span aria-hidden>🎁</span>
              <p className="text-xs text-cyan-200">Add more, save more — bundled add-ons come with a discount</p>
            </div>
          </div>

          {activeCategory === "recommended" ? (
            <>
              <div>
                <p className="font-display text-lg font-bold text-white mb-3">Recommended For You</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {activeRecommendedAddons.map((addon) => (
                    <AddonCard
                      key={addon.id}
                      addon={addon}
                      isSelected={addon.id in chosen}
                      variantIndex={chosen[addon.id] ?? 0}
                      onToggle={(vi) => toggleAddon(addon, vi)}
                      onVariantChange={(vi) => setVariant(addon.id, vi)}
                    />
                  ))}
                </div>
              </div>

              <div>
                <p className="font-display text-lg font-bold text-white mb-3">More Add-ons For You</p>
                <div className="relative -mx-6 px-6">
                  <div className="flex gap-3.5 overflow-x-auto pb-1 no-scrollbar snap-x snap-mandatory">
                    {activeMoreAddons.map((addon) => (
                      <div key={addon.id} className="w-[200px] sm:w-[212px] shrink-0 snap-start">
                        <AddonMiniCard
                          addon={addon}
                          isSelected={addon.id in chosen}
                          onToggle={() => toggleAddon(addon, 0)}
                        />
                      </div>
                    ))}
                  </div>
                  {/* fade hint that more cards continue off-screen */}
                  <div className="pointer-events-none absolute top-0 bottom-1 right-6 w-10 bg-gradient-to-l from-[#060B14] to-transparent" aria-hidden />
                </div>
              </div>
            </>
          ) : (
            <div>
              <p className="font-display text-lg font-bold text-white">{activeCategoryMeta.label}</p>
              <p className="text-sm text-slate-500 mb-3">{activeCategoryMeta.sub}</p>
              {categoryAddons.length === 0 ? (
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-10 text-center text-sm text-slate-500">
                  No add-ons in this category for your flight.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {categoryAddons.map((addon) => (
                    <AddonCard
                      key={addon.id}
                      addon={addon}
                      isSelected={addon.id in chosen}
                      variantIndex={chosen[addon.id] ?? 0}
                      onToggle={(vi) => toggleAddon(addon, vi)}
                      onVariantChange={(vi) => setVariant(addon.id, vi)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          <p className="text-xs text-slate-500 flex items-center gap-1.5">
            <span aria-hidden>ⓘ</span> Add-ons can be added up to 3 hours before departure.
          </p>

          <div className="flex items-center justify-between flex-wrap gap-4 pt-2 text-xs text-slate-500 border-t border-white/[0.06]">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center">🛡️</span>
              <div><p className="text-slate-300 font-medium">100% Safe Booking</p><p>Secure payments. Zero worries.</p></div>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center">↻</span>
              <div><p className="text-slate-300 font-medium">Flexible Changes</p><p>Modify or cancel with ease.</p></div>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-amber-400/10 border border-amber-400/20 flex items-center justify-center">💬</span>
              <div><p className="text-slate-300 font-medium">24/7 Support</p><p>We're here to help anytime.</p></div>
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-3">
          <TripSummary
            selection={selection}
            baseFare={baseFare}
            taxesAndFees={taxesAndFees}
            seatSelectionPrice={seatSelectionPrice}
            selectedList={selectedList}
            addonsTotal={addonsTotal}
            addonsSavings={addonsSavings}
            tripTotal={tripTotal}
            open={summaryOpen}
            onToggleOpen={() => setSummaryOpen((v) => !v)}
            onRemoveAddon={(id) => setChosen((prev) => { const next = { ...prev }; delete next[id]; return next })}
            onContinue={handleContinue}
          />
        </div>
      </div>
    </PageShell>
  )
}

// ---------------------------------------------------------------------------
// HoldTimer — compact radial-gauge pill instead of a full-width banner.
// Depletes gold → rose as the hold runs down; the ring itself carries the
// urgency instead of a big stretched block of color across the page.
// ---------------------------------------------------------------------------

function HoldTimer({ msLeft, holdMinutes }: { msLeft: number; holdMinutes: number }) {
  const totalSeconds = Math.max(0, Math.floor(msLeft / 1000))
  const mm = Math.floor(totalSeconds / 60)
  const ss = totalSeconds % 60
  const urgent = totalSeconds <= 120

  const radius = 14
  const circumference = 2 * Math.PI * radius
  const pct = Math.min(1, Math.max(0, totalSeconds / (holdMinutes * 60)))
  const dashOffset = circumference * (1 - pct)

  return (
    <div
      className={`inline-flex items-center gap-2.5 rounded-full border pl-2 pr-4 py-1.5 transition-colors ${
        urgent ? "border-rose-400/40 bg-rose-400/[0.08] hold-timer-urgent" : "border-amber-400/25 bg-amber-400/[0.06]"
      }`}
      role="timer"
      aria-live="polite"
    >
      <svg width="32" height="32" viewBox="0 0 32 32" className="shrink-0 -rotate-90" aria-hidden>
        <circle cx="16" cy="16" r={radius} fill="none" stroke="currentColor" strokeWidth="3" className="text-white/10" />
        <circle
          cx="16" cy="16" r={radius} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className={`transition-[stroke-dashoffset] duration-1000 ease-linear ${urgent ? "text-rose-300" : "text-amber-300"}`}
        />
      </svg>
      <div className="leading-tight">
        <p className={`font-display text-sm font-bold tabular-nums ${urgent ? "text-rose-200" : "text-amber-100"}`}>
          {mm}:{ss.toString().padStart(2, "0")}
        </p>
        <p className="text-[10px] text-slate-500 -mt-0.5">seats held</p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// CategoryRail (desktop) / CategoryChips (mobile) — left-nav browse by
// category, same data source so both stay in sync.
// ---------------------------------------------------------------------------

function CategoryRail({ active, onChange }: { active: CategoryId; onChange: (id: CategoryId) => void }) {
  return (
    <div className="sticky top-24 space-y-1.5">
      {CATEGORIES.map((cat) => {
        const isActive = active === cat.id
        return (
          <button
            key={cat.id}
            onClick={() => onChange(cat.id)}
            className={`w-full flex items-start gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all ${
              isActive
                ? "border-[#D4AF37]/50 bg-[#D4AF37]/[0.08] text-white"
                : "border-transparent text-slate-400 hover:bg-white/[0.03] hover:text-slate-200"
            }`}
          >
            <span className={`mt-0.5 shrink-0 ${isActive ? "text-[#E8C766]" : "text-slate-500"}`}>{cat.icon}</span>
            <span className="min-w-0">
              <span className={`block text-[13px] font-semibold truncate ${isActive ? "text-white" : "text-slate-300"}`}>{cat.label}</span>
              <span className="block text-[10.5px] text-slate-500 truncate">{cat.sub}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

function CategoryChips({ active, onChange }: { active: CategoryId; onChange: (id: CategoryId) => void }) {
  return (
    <div className="lg:hidden -mx-6 px-6 mb-4 overflow-x-auto">
      <div className="flex items-center gap-2 w-max">
        {CATEGORIES.map((cat) => {
          const isActive = active === cat.id
          return (
            <button
              key={cat.id}
              onClick={() => onChange(cat.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-full border text-xs font-medium whitespace-nowrap transition-colors ${
                isActive ? "border-[#D4AF37]/50 bg-[#D4AF37]/[0.1] text-[#E8C766]" : "border-white/[0.08] bg-white/[0.02] text-slate-400"
              }`}
            >
              <span className="shrink-0">{cat.icon}</span>
              {cat.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// AddonHero — real photo when available, graceful icon-illustration
// fallback when not (missing path or 404). Drop files into /public/addons/
// (baggage.jpg, legroom.jpg, meal.jpg, lounge.jpg, priority.jpg,
// insurance.jpg, wifi.jpg, fasttrack.jpg) and they appear automatically —
// nothing else to wire up. `compact` shrinks the hero for the smaller
// "More Add-ons" grid without duplicating the component.
// ---------------------------------------------------------------------------

function AddonHero({ addon, compact = false }: { addon: Addon; compact?: boolean }) {
  const [imgFailed, setImgFailed] = useState(false)
  const showImage = !!addon.image && !imgFailed

  return (
    <div className={`relative overflow-hidden bg-gradient-to-br from-[#0D1A2C] to-[#0A1424] ${compact ? "h-16" : "h-28"}`}>
      {showImage ? (
        <img
          src={addon.image}
          alt=""
          onError={() => setImgFailed(true)}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <>
          <div className="pointer-events-none absolute inset-0 opacity-70 bg-[radial-gradient(circle_at_50%_35%,rgba(212,175,55,0.16),transparent_65%)]" aria-hidden />
          <div className={`absolute inset-0 flex items-center justify-center ${compact ? "text-2xl" : "text-4xl"}`}>{addon.icon}</div>
        </>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0A1424] via-transparent to-transparent" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// AddonCard — recommended / category-browse row. Variant picker is a gold
// segmented control (matches the cabin-class rail on the seats page)
// instead of a bare native <select>.
// ---------------------------------------------------------------------------

function AddonCard({ addon, isSelected, variantIndex, onToggle, onVariantChange }: {
  addon: Addon; isSelected: boolean; variantIndex: number
  onToggle: (variantIndex: number) => void; onVariantChange: (variantIndex: number) => void
}) {
  const variant = addon.variants[variantIndex]
  return (
    <div className={`group relative rounded-2xl border overflow-hidden transition-all duration-200 ${
      isSelected ? "border-amber-400/50 bg-amber-400/[0.06] shadow-[0_0_0_1px_rgba(251,191,36,0.15)]" : "border-white/[0.08] bg-white/[0.02] hover:border-white/20"
    }`}>
      {addon.discountPct && (
        <span className="absolute top-3 left-3 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-emerald-400/15 text-emerald-300 border border-emerald-400/25 z-10">
          {addon.discountPct}% OFF
        </span>
      )}
      <AddonHero addon={addon} />
      <div className="p-4">
        <p className="font-semibold text-white text-sm">{addon.title}</p>
        <p className="text-xs text-slate-500 mt-0.5 mb-3">{addon.desc}</p>

        <div className="flex items-center justify-between gap-2">
          {addon.variants.length > 1 ? (
            <div className="flex items-center gap-0.5 rounded-lg bg-white/[0.04] border border-white/[0.08] p-0.5">
              {addon.variants.map((v, i) => (
                <button
                  key={v.label}
                  type="button"
                  onClick={() => onVariantChange(i)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                    i === variantIndex ? "bg-[#D4AF37]/20 text-[#E8C766]" : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          ) : (
            <span className="text-xs text-slate-400">{variant.label}</span>
          )}
          <div className="flex items-center gap-1.5 shrink-0">
            {variant.originalPrice && (
              <span className="text-xs text-slate-600 line-through tabular-nums">{formatINR(variant.originalPrice)}</span>
            )}
            <span className="font-display text-sm font-bold text-amber-300 tabular-nums">{formatINR(variant.price)}</span>
          </div>
        </div>

        <button
          onClick={() => onToggle(variantIndex)}
          className={`mt-3 w-full py-2 rounded-lg text-sm font-semibold transition-all ${
            isSelected ? "bg-white/[0.06] text-amber-300 border border-amber-300/40" : "pill-cta"
          }`}
        >
          {isSelected ? "Added ✓" : "+ Add"}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// AddonMiniCard — the smaller "More Add-ons" row. ✅ UI FIX: now reuses the
// same AddonHero illustration used by the recommended cards (compact size)
// instead of a flat icon-in-a-box, so this section reads as the same
// product as "Recommended For You" above it rather than a plain fallback
// list. Add button also switched to the shared `pill-cta` gradient so the
// call-to-action matches everywhere else on the page.
// ---------------------------------------------------------------------------

function AddonMiniCard({ addon, isSelected, onToggle }: { addon: Addon; isSelected: boolean; onToggle: () => void }) {
  const variant = addon.variants[0]
  return (
    <div className={`rounded-xl border overflow-hidden transition-all duration-200 ${
      isSelected ? "border-amber-400/50 bg-amber-400/[0.06]" : "border-white/[0.08] bg-white/[0.02] hover:border-white/20 hover:-translate-y-0.5"
    }`}>
      <AddonHero addon={addon} compact />
      <div className="p-3">
        <p className="text-xs font-semibold text-white truncate">{addon.title}</p>
        <p className="text-[11px] text-slate-500 mt-0.5 mb-2.5 leading-snug line-clamp-2">{addon.desc}</p>
        <div className="flex items-center justify-between gap-2">
          <span className="font-display text-xs font-bold text-amber-300 tabular-nums shrink-0">{formatINR(variant.price)}</span>
          <button
            onClick={onToggle}
            className={`text-[11px] px-2.5 py-1.5 rounded-full font-semibold transition-colors shrink-0 ${
              isSelected ? "bg-white/[0.06] text-amber-300 border border-amber-300/40" : "pill-cta"
            }`}
          >
            {isSelected ? "Added ✓" : "+ Add"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// FlightSummaryCard
// ---------------------------------------------------------------------------

function FlightSummaryCard({ flight, tag, onEditFlight }: { flight: StoredFlight; tag?: "Departure" | "Return"; onEditFlight?: () => void }) {
  return (
    <div className="relative bg-gradient-to-br from-[#0D1A2C] via-[#0B1729] to-[#0A1424] border border-white/[0.08] rounded-2xl overflow-hidden ticket-edge">
      <div className={`absolute top-0 left-0 right-0 h-[2px] ${tag === "Return" ? "bg-gradient-to-r from-cyan-400 to-blue-400" : "bg-gradient-to-r from-amber-300 to-amber-500"}`} />
      <div className="flex items-center justify-between px-6 py-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center overflow-hidden shadow-sm ring-1 ring-black/5 shrink-0">
            <img src={airlineLogos[flight.airline] || "/airlines/default.png"} alt={flight.airline} className="w-7 h-7 object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              {tag && (
                <span className={`text-[10px] uppercase tracking-wide font-semibold rounded px-1.5 py-0.5 border ${tag === "Departure" ? "text-amber-300 bg-amber-400/10 border-amber-400/20" : "text-cyan-300 bg-cyan-400/10 border-cyan-400/20"}`}>{tag}</span>
              )}
              <p className="font-semibold text-[15px]">{flight.airline}</p>
            </div>
            <p className="text-xs text-slate-500">{flight.aircraft} · Economy Class</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="font-display text-xl font-extrabold tabular-nums">{formatTime(flight.departure_time)}</p>
            <p className="text-[11px] text-slate-500">{flight.origin}</p>
          </div>
          <div className="flex flex-col items-center w-24">
            <p className="text-[10px] text-slate-400">{flight.duration || "--"}</p>
            <div className="w-full flex items-center gap-1 mt-1">
              <span className="w-1 h-1 rounded-full bg-amber-300 shrink-0" />
              <div className="flex-1 h-px bg-gradient-to-r from-amber-300/60 via-slate-600/40 to-cyan-300/60" />
              <span aria-hidden className="text-amber-300 text-xs -mx-1">✈</span>
              <div className="flex-1 h-px bg-gradient-to-r from-amber-300/60 via-slate-600/40 to-cyan-300/60" />
              <span className="w-1 h-1 rounded-full bg-cyan-300 shrink-0" />
            </div>
            <p className="text-[10px] text-slate-500 mt-1">{flight.stops ? `${flight.stops} stop` : "Non-stop"}</p>
          </div>
          <div>
            <p className="font-display text-xl font-extrabold tabular-nums">{formatTime(flight.arrival_time)}</p>
            <p className="text-[11px] text-slate-500">{flight.destination}</p>
          </div>
          <button
            onClick={onEditFlight}
            className="text-xs text-cyan-300 hover:text-cyan-200 transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
          >
            <span aria-hidden>✎</span> Edit Flight
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// PerforatedDivider — same punch-hole boarding-pass motif used on the seats
// and payment pages, dropped in here (in place of a plain dashed border) so
// this sidebar finally reads as the same object across all three checkout
// pages instead of using three slightly different card styles.
// ---------------------------------------------------------------------------

function PerforatedDivider() {
  return (
    <div className="relative px-5">
      <div className="border-t border-dashed border-[#D4AF37]/20" />
      <span className="absolute -left-3 -top-3 w-6 h-6 rounded-full bg-[#060B14]" />
      <span className="absolute -right-3 -top-3 w-6 h-6 rounded-full bg-[#060B14]" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// TripSummary — ✅ UI FIX: fare sub-lines demoted (smaller, muted) and
// "Trip Total" promoted into its own blue-tinted highlight panel, matching
// the "Amount to Pay" treatment on the payment page, instead of being just
// another row barely more prominent than "Base Fare" above it. Divider
// between sections switched to PerforatedDivider to match.
// ---------------------------------------------------------------------------

function TripSummary({ selection, baseFare, taxesAndFees, seatSelectionPrice, selectedList, addonsTotal, addonsSavings, tripTotal, open, onToggleOpen, onRemoveAddon, onContinue }: {
  selection: CheckoutSelection
  baseFare: number; taxesAndFees: number; seatSelectionPrice: number
  selectedList: { addon: Addon; variant: AddonVariant }[]
  addonsTotal: number; addonsSavings: number; tripTotal: number
  open: boolean; onToggleOpen: () => void
  onRemoveAddon: (id: string) => void
  onContinue: () => void
}) {
  return (
    <div className="sticky top-24 space-y-4">
      <div className="relative bg-gradient-to-b from-[#0D1A2C] to-[#0A1424] border border-[#D4AF37]/15 rounded-2xl overflow-hidden ticket-edge">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-400 via-amber-400 to-amber-300" />
        <button
          onClick={onToggleOpen}
          className="w-full px-5 py-4 flex items-center justify-between text-left"
        >
          <div>
            <p className="font-display text-sm font-semibold text-white">Your Trip Summary</p>
            <p className="text-xs text-slate-500 mt-1">{selection.origin} → {selection.destination} · {selection.passengers} Passenger{selection.passengers > 1 ? "s" : ""}</p>
          </div>
          <span className={`text-slate-500 transition-transform duration-200 shrink-0 ${open ? "" : "-rotate-180"}`} aria-hidden>
            <ChevronUpIcon />
          </span>
        </button>

        <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
          <div className="overflow-hidden">
            <PerforatedDivider />
            <div className="px-5 py-4 space-y-2.5">
              <p className="text-[10px] uppercase tracking-widest text-slate-500">Add-ons {selectedList.length > 0 && `(${selectedList.length})`}</p>
              {selectedList.length === 0 ? (
                <p className="text-xs text-slate-600 italic">No add-ons selected yet</p>
              ) : (
                selectedList.map(({ addon, variant }) => (
                  <div key={addon.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-2 text-slate-300 truncate min-w-0">
                      <span className="w-6 h-6 rounded-md bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-[11px] shrink-0" aria-hidden>{addon.icon}</span>
                      <span className="truncate">{addon.title} <span className="text-slate-600">· {variant.label}</span></span>
                    </span>
                    <span className="flex items-center gap-2 shrink-0">
                      <span className="w-4 h-4 rounded-full bg-emerald-400/15 text-emerald-300 flex items-center justify-center shrink-0" aria-hidden>
                        <CheckIcon />
                      </span>
                      <span className="text-slate-200 tabular-nums">{formatINR(variant.price)}</span>
                      <button onClick={() => onRemoveAddon(addon.id)} className="text-slate-600 hover:text-rose-400 transition-colors" aria-label={`Remove ${addon.title}`}>✕</button>
                    </span>
                  </div>
                ))
              )}
            </div>

            <PerforatedDivider />

            <div className="px-5 pt-4 pb-1">
              <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-2.5">Fare Breakdown</p>
              <div className="space-y-1.5 text-[12px]">
                <div className="flex justify-between"><span className="text-slate-500">Base Fare</span><span className="text-slate-400 tabular-nums">{formatINR(baseFare)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Taxes & Fees</span><span className="text-slate-400 tabular-nums">{formatINR(taxesAndFees)}</span></div>
                {seatSelectionPrice > 0 && (
                  <div className="flex justify-between"><span className="text-slate-500">Seat Selection</span><span className="text-slate-400 tabular-nums">{formatINR(seatSelectionPrice)}</span></div>
                )}
                <div className="flex justify-between"><span className="text-slate-500">Add-ons Total</span><span className="text-emerald-400/80 tabular-nums">{formatINR(addonsTotal)}</span></div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 pt-4 pb-4">
          <div className="border border-blue-400/25 bg-blue-500/[0.07] rounded-xl px-4 py-3.5 flex items-end justify-between">
            <span className="text-sm text-slate-300">Trip Total</span>
            <span className="font-display text-[28px] leading-none font-extrabold tabular-nums text-[#E8C766]">{formatINR(tripTotal)}</span>
          </div>
        </div>

        {addonsSavings > 0 && (
          <div className="mx-5 mb-4 flex items-center gap-2.5 px-3.5 py-3 rounded-xl bg-emerald-400/[0.08] border border-emerald-400/20">
            <span className="text-emerald-300 shrink-0">🏷</span>
            <p className="text-[12px] text-emerald-300">You're saving {formatINR(addonsSavings)} with add-on discounts!</p>
          </div>
        )}

        <div className="px-5 pb-5">
          <button onClick={onContinue} className="w-full px-6 py-3.5 rounded-full font-semibold pill-cta transition-all flex items-center justify-center gap-2">
            Continue to Payment <span aria-hidden>→</span>
          </button>
        </div>
      </div>

      <NavBotTip />
    </div>
  )
}

function NavBotTip() {
  return (
    <div className="relative bg-gradient-to-br from-cyan-400/[0.06] to-transparent border border-cyan-400/15 rounded-2xl p-5 flex items-start gap-3 overflow-hidden">
      <div className="pointer-events-none absolute -bottom-10 -right-10 w-32 h-32 bg-cyan-400/[0.08] blur-[60px] rounded-full" aria-hidden />
      <span className="w-10 h-10 rounded-full bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center text-xl shrink-0" aria-hidden>🤖</span>
      <div className="relative">
        <p className="text-xs font-semibold text-cyan-300">Need help with add-ons?</p>
        <p className="text-sm text-slate-300 mt-1">NavBot is here!</p>
        <button className="text-xs text-cyan-300 hover:text-cyan-200 transition-colors mt-2 border border-cyan-400/25 rounded-full px-3 py-1.5">Chat with NavBot</button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// PageShell — same stepper/style pattern as the seats & passengers pages
// ---------------------------------------------------------------------------

function PageShell({ children, selection, router }: { children: React.ReactNode; selection?: CheckoutSelection; router?: ReturnType<typeof useRouter> }) {
  return (
    <div className="min-h-screen bg-[#060B14] text-white relative overflow-x-hidden">
      <PageStyles />
      <div className="pointer-events-none fixed inset-0 opacity-[0.05] mix-blend-overlay grain-layer" />
      <div className="pointer-events-none fixed top-[-200px] left-[15%] w-[600px] h-[600px] bg-[#D4AF37]/[0.05] blur-[160px] rounded-full" />
      <div className="pointer-events-none fixed bottom-[-200px] right-[10%] w-[500px] h-[500px] bg-cyan-400/[0.05] blur-[160px] rounded-full" />

      <Navbar />

      <div className="relative max-w-[1400px] mx-auto px-6 pt-24 pb-16">
        <div className="flex items-center justify-between gap-6 mb-10">
          <button
            onClick={() => router?.push("/checkout/seats")}
            className="group flex items-center gap-2 pl-2 pr-3.5 py-1.5 rounded-full text-sm text-slate-400 hover:text-white border border-transparent hover:border-white/10 hover:bg-white/[0.04] transition-colors shrink-0"
          >
            <span className="w-6 h-6 rounded-full bg-white/[0.05] flex items-center justify-center group-hover:bg-white/10 transition-colors" aria-hidden>←</span>
            Back to seats
          </button>
          <Stepper currentStepId={5} />
        </div>
        {children}
      </div>
    </div>
  )
}

function Stepper({ currentStepId }: { currentStepId: number }) {
  const progressPct = ((currentStepId - 1) / (steps.length - 1)) * 100
  return (
    <div className="relative hidden md:flex items-center flex-1 max-w-2xl">
      <div className="absolute left-4 right-4 h-[2px] bg-white/[0.08] rounded-full" />
      <div
        className="absolute left-4 h-[2px] bg-gradient-to-r from-emerald-400 to-[#D4AF37] rounded-full transition-all duration-500"
        style={{ width: `calc(${progressPct}% - ${progressPct > 0 ? 32 : 0}px)` }}
      />
      <div className="relative flex items-center justify-between w-full">
        {steps.map((step) => {
          const isDone = step.id < currentStepId
          const isCurrent = step.id === currentStepId
          return (
            <div key={step.id} className="flex flex-col items-center gap-1.5 bg-[#060B14] px-1">
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold border-2 transition-all ${
                isCurrent ? "border-[#D4AF37] bg-[#D4AF37]/15 text-[#E8C766] shadow-[0_0_0_4px_rgba(212,175,55,0.12)] glow-pulse"
                : isDone ? "border-emerald-400/70 bg-emerald-400/15 text-emerald-300"
                : "border-white/15 bg-white/[0.03] text-slate-600"
              }`}>
                {isDone ? "✓" : step.id}
              </span>
              <span className={`text-[11px] whitespace-nowrap ${isCurrent ? "text-[#E8C766] font-semibold" : isDone ? "text-emerald-300/70" : "text-slate-600"}`}>{step.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CenteredMessage({ text }: { text: string }) {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <p className="text-slate-500 text-sm tracking-wide font-display">{text}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Inline icons — slim outline style for the category rail (deliberately
// distinct from the emoji used on the content cards, same way the
// reference separates a plain-glyph nav from photographic cards)
// ---------------------------------------------------------------------------

function SparkleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" />
    </svg>
  )
}
function SuitcaseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" />
      <path d="M3 12h18" />
    </svg>
  )
}
function SeatGlyphIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 4v9a2 2 0 002 2h8" />
      <path d="M6 13H5a2 2 0 00-2 2v1a2 2 0 002 2h13a1 1 0 001-1v-1" />
      <path d="M16 13V9a2 2 0 012-2h1" />
    </svg>
  )
}
function UtensilsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3v7a2 2 0 004 0V3" />
      <path d="M8 10v11" />
      <path d="M17 3c-1.5 0-2 2-2 4.5S15.5 11 17 11s2-2 2-4.5S18.5 3 17 3z" />
      <path d="M17 11v10" />
    </svg>
  )
}
function BriefcaseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" />
      <path d="M2 13h20" />
    </svg>
  )
}
function ShieldIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
    </svg>
  )
}
function PlaneIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 19l19-7-19-7 3 7-3 7z" />
      <path d="M5.5 12h9" />
    </svg>
  )
}
function ChevronUpIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 15l-6-6-6 6" />
    </svg>
  )
}
function CheckIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  )
}

function PageStyles() {
  return (
    <style jsx global>{`
      @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@700;800&display=swap');
      .font-display { font-family: 'Manrope', ui-sans-serif, system-ui, sans-serif; letter-spacing: -0.01em; }

      .no-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
      .no-scrollbar::-webkit-scrollbar { display: none; }

      .ticket-edge { position: relative; }
      .ticket-edge::before {
        content: "";
        position: absolute;
        inset: 3px;
        border: 1px solid rgba(212,175,55,0.10);
        border-radius: inherit;
        pointer-events: none;
      }

      .pill-cta {
        background: linear-gradient(90deg, #38BDF8 0%, #60A5FA 30%, #D4AF37 70%, #FBBF24 100%);
        color: #060B14;
      }
      .pill-cta:hover { filter: brightness(1.06); }

      .grain-layer {
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E");
      }

      @keyframes glowPulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
      .glow-pulse { animation: glowPulse 1.8s ease-in-out infinite; }

      @keyframes holdTimerPulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(251,113,133,0.25); } 50% { box-shadow: 0 0 0 6px rgba(251,113,133,0); } }
      .hold-timer-urgent { animation: holdTimerPulse 1.6s ease-in-out infinite; }

      @media (prefers-reduced-motion: reduce) {
        .glow-pulse, .hold-timer-urgent { animation: none !important; }
      }
    `}</style>
  )
}