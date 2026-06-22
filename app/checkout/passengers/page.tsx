"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Navbar from "@/components/navbar"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type StoredFlight = {
  id: string | number
  airline: string
  origin: string
  destination: string
  departure_time: string
  arrival_time: string
  aircraft: string
  stops?: number
  final_price: number
  duration?: string
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
}

type PassengerType = "adult" | "child" | "infant"

type Passenger = {
  localId: string
  type: PassengerType
  age?: number
  title: string
  firstName: string
  middleName: string
  lastName: string
  dob: string
  gender: string
  nationality: string
  frequentFlyer: string
  email: string
  countryCode: string
  mobile: string
  isPrimaryContact: boolean
}

type FieldErrors = Partial<Record<keyof Passenger, string>>

const STORAGE_KEY = "navigo:checkoutSelection"
const PAX_DRAFT_KEY = "navigo:passengerDraft"
const BOOKING_ID_KEY = "navigo:bookingId"
const MAX_PASSENGERS = 9

const airlineLogos: Record<string, string> = {
  "IndiGo": "/airlines/indigo.png",
  "Air India": "/airlines/airindia.png",
  "Vistara": "/airlines/vistara.png",
  "Akasa Air": "/airlines/akasa.png",
  "Emirates": "/airlines/emirates.png",
  "Qatar Airways": "/airlines/qatar.png",
}

function makeId() {
  return Math.random().toString(36).slice(2, 10)
}

function emptyPassenger(type: PassengerType = "adult", isPrimaryContact = false): Passenger {
  return {
    localId: makeId(),
    type,
    title: "",
    firstName: "",
    middleName: "",
    lastName: "",
    dob: "",
    gender: "",
    nationality: "India",
    frequentFlyer: "",
    email: "",
    countryCode: "+91",
    mobile: "",
    isPrimaryContact,
  }
}

function formatTime(timeStr?: string) {
  if (!timeStr) return "--:--"
  const d = new Date(timeStr)
  if (isNaN(d.getTime())) return "--:--"
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })
}

function formatDateLabel(timeStr?: string) {
  if (!timeStr) return ""
  const d = new Date(timeStr)
  if (isNaN(d.getTime())) return ""
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })
}

const steps = [
  { id: 1, label: "Search" },
  { id: 2, label: "Select" },
  { id: 3, label: "Passengers" },
  { id: 4, label: "Seats" },
  { id: 5, label: "Add-ons" },
  { id: 6, label: "Payment" },
  { id: 7, label: "Confirmed" },
]

const requiredFields: (keyof Passenger)[] = ["title", "firstName", "lastName", "dob", "gender", "nationality"]

function validatePassenger(p: Passenger): FieldErrors {
  const errors: FieldErrors = {}
  for (const field of requiredFields) {
    if (!String(p[field] ?? "").trim()) {
      errors[field] = "Required"
    }
  }
  if (p.isPrimaryContact) {
    if (!p.email.trim()) errors.email = "Required"
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) errors.email = "Invalid email"
    if (!p.mobile.trim()) errors.mobile = "Required"
    else if (!/^\d{6,12}$/.test(p.mobile)) errors.mobile = "Invalid number"
  }
  return errors
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PassengerDetailsPage() {
  const router = useRouter()

  const [selection, setSelection] = useState<CheckoutSelection | null>(null)
  const [loadState, setLoadState] = useState<"loading" | "found" | "missing">("loading")
  const [passengers, setPassengers] = useState<Passenger[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [errorsByPassenger, setErrorsByPassenger] = useState<Record<string, FieldErrors>>({})
  const [mounted, setMounted] = useState(false)
  const [pulseSavings, setPulseSavings] = useState(false)

  // page-load entrance
  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(t)
  }, [])

  // hydrate selection + passenger draft (so a reload doesn't lose progress)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      if (!raw) {
        setLoadState("missing")
        return
      }
      const parsed = JSON.parse(raw) as CheckoutSelection
      setSelection(parsed)
      setLoadState("found")

      const draftRaw = sessionStorage.getItem(PAX_DRAFT_KEY)
      if (draftRaw) {
        const draft = JSON.parse(draftRaw) as Passenger[]
        if (Array.isArray(draft) && draft.length > 0) {
          setPassengers(draft)
          setExpandedId(draft[0].localId)
        }
      } else {
        const initialCount = Math.max(1, parsed.passengers || 1)
        const initial = Array.from({ length: initialCount }, (_, i) =>
          emptyPassenger("adult", i === 0)
        )
        setPassengers(initial)
        setExpandedId(initial[0].localId)
      }

      const savedBookingId = sessionStorage.getItem(BOOKING_ID_KEY)
      if (savedBookingId) setBookingId(savedBookingId)
    } catch (err) {
      console.error("Failed to read checkout selection:", err)
      setLoadState("missing")
    }
  }, [])

  // persist passenger draft as it changes
  useEffect(() => {
    if (passengers.length === 0) return
    try {
      sessionStorage.setItem(PAX_DRAFT_KEY, JSON.stringify(passengers))
    } catch (err) {
      console.error("Failed to persist passenger draft:", err)
    }
  }, [passengers])

  useEffect(() => {
    const t = setTimeout(() => setPulseSavings(true), 700)
    return () => clearTimeout(t)
  }, [])

  const [bookingId, setBookingId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const updatePassenger = (localId: string, patch: Partial<Passenger>) => {
    setPassengers((prev) =>
      prev.map((p) => (p.localId === localId ? { ...p, ...patch } : p))
    )
  }

  const validateAndCollapse = (localId: string) => {
    const passenger = passengers.find((p) => p.localId === localId)
    if (!passenger) return
    const errors = validatePassenger(passenger)
    setErrorsByPassenger((prev) => ({ ...prev, [localId]: errors }))
    if (Object.keys(errors).length === 0) {
      setExpandedId((current) => (current === localId ? null : current))
    }
  }

  const addPassenger = () => {
    if (passengers.length >= MAX_PASSENGERS) return
    const next = emptyPassenger("adult", false)
    setPassengers((prev) => [...prev, next])
    setExpandedId(next.localId)
  }

  const removePassenger = (localId: string) => {
    setPassengers((prev) => prev.filter((p) => p.localId !== localId))
    setErrorsByPassenger((prev) => {
      const { [localId]: _, ...rest } = prev
      return rest
    })
  }

  const handleSetPrimaryContact = (localId: string) => {
    setPassengers((prev) =>
      prev.map((p) => ({ ...p, isPrimaryContact: p.localId === localId }))
    )
  }

  const allValid = useMemo(() => {
    return passengers.every((p) => Object.keys(validatePassenger(p)).length === 0)
  }, [passengers])

  const handleContinue = async () => {
    const allErrors: Record<string, FieldErrors> = {}
    let hasErrors = false
    for (const p of passengers) {
      const errors = validatePassenger(p)
      allErrors[p.localId] = errors
      if (Object.keys(errors).length > 0) hasErrors = true
    }
    setErrorsByPassenger(allErrors)

    if (hasErrors) {
      const firstInvalid = passengers.find((p) => Object.keys(allErrors[p.localId] || {}).length > 0)
      if (firstInvalid) setExpandedId(firstInvalid.localId)
      return
    }

    if (!selection) return

    setIsSaving(true)
    setSaveError(null)

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: bookingId || undefined,
          departFlightInstanceId: selection.departFlight.id,
          returnFlightInstanceId: selection.returnFlight?.id || null,
          passengers: passengers.map((p) => ({
            type: p.type,
            age: p.age,
            title: p.title,
            firstName: p.firstName,
            middleName: p.middleName,
            lastName: p.lastName,
            dob: p.dob,
            gender: p.gender,
            nationality: p.nationality,
            frequentFlyer: p.frequentFlyer,
            email: p.email,
            countryCode: p.countryCode,
            mobile: p.mobile,
            isPrimaryContact: p.isPrimaryContact,
          })),
          baseFare,
          taxesAndFees,
          seatSelectionPrice: 0,
          mealsPrice: 0,
          totalPrice: total,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to save passenger details")
      }

      setBookingId(data.bookingId)
      sessionStorage.setItem(BOOKING_ID_KEY, data.bookingId)

      router.push("/checkout/seats")
    } catch (err) {
      console.error("Failed to save booking:", err)
      setSaveError(
        err instanceof Error ? err.message : "Something went wrong saving your details. Please try again."
      )
    } finally {
      setIsSaving(false)
    }
  }

  if (loadState === "loading") {
    return (
      <div className="min-h-screen bg-[#060B14] text-white flex items-center justify-center">
        <p className="text-slate-500 text-sm tracking-wide">Preparing your details…</p>
      </div>
    )
  }

  if (loadState === "missing" || !selection) {
    return (
      <div className="min-h-screen bg-[#060B14] text-white flex flex-col items-center justify-center gap-4">
        <p className="text-slate-300">We couldn't find an active booking.</p>
        <button
          onClick={() => router.push("/")}
          className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 text-[#060B14] font-semibold"
        >
          Search Flights
        </button>
      </div>
    )
  }

  const { departFlight } = selection
  const baseFare = departFlight.final_price + (selection.returnFlight?.final_price || 0)
  const taxesAndFees = Math.round(baseFare * 0.19)
  const total = baseFare + taxesAndFees

  return (
    <div className="min-h-screen bg-[#060B14] text-white relative overflow-x-hidden">

      <PageStyles />

      <div className="pointer-events-none fixed top-[-200px] left-[15%] w-[600px] h-[600px] bg-amber-500/[0.04] blur-[160px] rounded-full" />
      <div className="pointer-events-none fixed bottom-[-200px] right-[10%] w-[500px] h-[500px] bg-cyan-400/[0.04] blur-[160px] rounded-full" />

      <Navbar />

      <div
        className={`relative max-w-7xl mx-auto px-6 pt-24 pb-32 transition-all duration-700 ease-out ${
          mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
        }`}
      >
        <Stepper activeId={3} />

        <div
          className="transition-all duration-500 ease-out"
          style={{ transitionDelay: mounted ? "80ms" : "0ms" }}
        >
          <BoardingPassMini flight={departFlight} />
        </div>

        <div className="grid grid-cols-12 gap-6 mt-6">

          {/* LEFT — passenger form */}
          <div className="col-span-12 lg:col-span-8 space-y-5">

            <div
              className="bg-gradient-to-br from-[#0D1A2C] via-[#0B1729] to-[#0A1424] border border-white/[0.08] rounded-2xl p-6 flex items-center justify-between flex-wrap gap-3 transition-all duration-500 ease-out"
              style={{ transitionDelay: mounted ? "140ms" : "0ms", opacity: mounted ? 1 : 0, transform: mounted ? "translateY(0)" : "translateY(12px)" }}
            >
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-full bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center text-cyan-300">
                  👤
                </span>
                <div>
                  <p className="font-semibold">Passenger Details</p>
                  <p className="text-xs text-slate-500">Enter details as per your government ID</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-right">
                <div>
                  <p className="text-xs text-slate-400">Book faster next time!</p>
                  <p className="text-[11px] text-slate-500">Sign in to save passenger details</p>
                </div>
                <button className="text-sm text-cyan-300 border border-cyan-400/30 rounded-lg px-4 py-2 hover:bg-cyan-400/10 transition-colors">
                  Sign In
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {passengers.map((passenger, index) => (
                <PassengerCard
                  key={passenger.localId}
                  index={index}
                  passenger={passenger}
                  isExpanded={expandedId === passenger.localId}
                  errors={errorsByPassenger[passenger.localId] || {}}
                  canRemove={passengers.length > 1}
                  entranceDelay={180 + index * 90}
                  mounted={mounted}
                  onToggle={() =>
                    setExpandedId((cur) => (cur === passenger.localId ? null : passenger.localId))
                  }
                  onCollapseWithValidation={() => validateAndCollapse(passenger.localId)}
                  onChange={(patch) => updatePassenger(passenger.localId, patch)}
                  onRemove={() => removePassenger(passenger.localId)}
                  onSetPrimaryContact={() => handleSetPrimaryContact(passenger.localId)}
                />
              ))}
            </div>

            <button
              onClick={addPassenger}
              disabled={passengers.length >= MAX_PASSENGERS}
              className="w-full rounded-2xl border border-dashed border-white/[0.14] py-5 text-sm text-cyan-300 hover:text-cyan-200 hover:border-cyan-400/30 hover:bg-cyan-400/[0.03] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex flex-col items-center gap-1 add-passenger-btn"
            >
              <span className="flex items-center gap-2 font-medium">
                <span aria-hidden>+</span> Add Another Passenger
              </span>
              <span className="text-[11px] text-slate-500">Maximum {MAX_PASSENGERS} passengers per booking</span>
            </button>

            <div className="flex items-center justify-between flex-wrap gap-4 pt-2 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center">🛡️</span>
                <div>
                  <p className="text-slate-300 font-medium">Your data is safe with us</p>
                  <p>We never share your personal details with anyone.</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center">💬</span>
                <div>
                  <p className="text-slate-300 font-medium">Need help?</p>
                  <p>Chat with NavBot or call us 24/7</p>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT — trip summary */}
          <div className="col-span-12 lg:col-span-4">
            <TripSummary
              flight={departFlight}
              passengerCount={passengers.length}
              baseFare={baseFare}
              taxesAndFees={taxesAndFees}
              total={total}
              pulseSavings={pulseSavings}
              canContinue={allValid}
              isSaving={isSaving}
              saveError={saveError}
              onContinue={handleContinue}
            />
          </div>
        </div>
      </div>

      <NavBot />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Stepper
// ---------------------------------------------------------------------------

function Stepper({ activeId }: { activeId: number }) {
  return (
    <div className="flex items-center justify-between mb-8 flex-wrap gap-y-3">
      <button
        onClick={() => history.back()}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 transition-colors shrink-0"
      >
        <span aria-hidden>←</span> Back
      </button>

      <div className="flex items-center gap-1 overflow-x-auto">
        {steps.map((step, i) => (
          <div key={step.id} className="flex items-center shrink-0">
            <div className="flex items-center gap-2">
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold border transition-colors duration-300
                ${
                  step.id === activeId
                    ? "border-amber-400 bg-amber-400/15 text-amber-300 step-pulse"
                    : step.id < activeId
                    ? "border-emerald-400/60 bg-emerald-400/10 text-emerald-300"
                    : "border-white/10 text-slate-600"
                }`}
              >
                {step.id < activeId ? <span className="tick-pop inline-block">✓</span> : step.id}
              </span>
              <span
                className={`text-xs hidden sm:inline ${
                  step.id === activeId ? "text-amber-300 font-medium" : step.id < activeId ? "text-emerald-300/80" : "text-slate-600"
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <span className="relative w-6 sm:w-8 h-px mx-2 bg-white/10 overflow-hidden">
                {step.id < activeId && (
                  <span className="absolute inset-0 bg-emerald-400/40 step-line-fill" />
                )}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Boarding pass (mini, reused identity from /checkout)
// ---------------------------------------------------------------------------

function BoardingPassMini({ flight }: { flight: StoredFlight }) {
  return (
    <div className="relative bg-gradient-to-br from-[#0D1A2C] via-[#0B1729] to-[#0A1424] border border-white/[0.08] rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center overflow-hidden shadow-sm ring-1 ring-black/5 shrink-0">
            <img
              src={airlineLogos[flight.airline] || "/airlines/default.png"}
              alt={flight.airline}
              className="w-7 h-7 object-contain"
            />
          </div>
          <div>
            <p className="font-semibold text-[15px]">{flight.airline}</p>
            <p className="text-xs text-slate-500">{flight.aircraft} · Economy</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-xl font-semibold tabular-nums">{formatTime(flight.departure_time)}</p>
            <p className="text-[11px] text-slate-500">{formatDateLabel(flight.departure_time)}</p>
          </div>
          <div className="flex flex-col items-center w-28">
            <p className="text-[10px] text-slate-400 mb-1">{flight.duration || "--"}</p>
            <div className="w-full flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-amber-300 shrink-0" />
              <div className="flex-1 h-px bg-gradient-to-r from-amber-300/60 via-slate-600/40 to-cyan-300/60" />
              <span className="w-1 h-1 rounded-full bg-cyan-300 shrink-0" />
            </div>
            <p className="text-[10px] text-slate-500 mt-1">{flight.stops ? `${flight.stops} stop` : "Non-stop"}</p>
          </div>
          <div>
            <p className="text-xl font-semibold tabular-nums">{formatTime(flight.arrival_time)}</p>
            <p className="text-[11px] text-slate-500">{formatDateLabel(flight.arrival_time)}</p>
          </div>
          <button className="text-xs text-cyan-300 hover:text-cyan-200 transition-colors flex items-center gap-1 shrink-0">
            <span aria-hidden>✎</span> Edit Flight
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Passenger card
// ---------------------------------------------------------------------------

function PassengerCard({
  index,
  passenger,
  isExpanded,
  errors,
  canRemove,
  entranceDelay,
  mounted,
  onToggle,
  onCollapseWithValidation,
  onChange,
  onRemove,
  onSetPrimaryContact,
}: {
  index: number
  passenger: Passenger
  isExpanded: boolean
  errors: FieldErrors
  canRemove: boolean
  entranceDelay: number
  mounted: boolean
  onToggle: () => void
  onCollapseWithValidation: () => void
  onChange: (patch: Partial<Passenger>) => void
  onRemove: () => void
  onSetPrimaryContact: () => void
}) {
  const isComplete = Object.keys(errors).length === 0 && passenger.firstName && passenger.lastName

  const label =
    passenger.type === "adult"
      ? `Adult ${index + 1}`
      : passenger.type === "child"
      ? `Child ${index + 1}${passenger.age ? ` (Age ${passenger.age})` : ""}`
      : `Infant ${index + 1}`

  return (
    <div
      className="relative bg-gradient-to-br from-[#0D1A2C] via-[#0B1729] to-[#0A1424] border border-white/[0.08] rounded-2xl overflow-hidden transition-all duration-500 ease-out card-enter"
      style={{
        transitionDelay: mounted ? `${entranceDelay}ms` : "0ms",
        opacity: mounted ? 1 : 0,
        transform: mounted ? "translateY(0) scale(1)" : "translateY(16px) scale(0.97)",
      }}
    >
      {/* header row — always visible */}
      <button
        type="button"
        onClick={isExpanded ? onCollapseWithValidation : onToggle}
        className="w-full flex items-center justify-between px-6 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          <span className="w-7 h-7 rounded-full bg-cyan-400/15 border border-cyan-400/30 flex items-center justify-center text-xs font-semibold text-cyan-300">
            {index + 1}
          </span>
          <span className="font-medium">{label}</span>
          {passenger.isPrimaryContact && (
            <span className="text-[10px] uppercase tracking-wide text-amber-300 bg-amber-400/10 border border-amber-400/20 rounded px-1.5 py-0.5">
              Primary Contact
            </span>
          )}
          {isComplete && !isExpanded && (
            <span className="check-pop text-emerald-400 text-sm" aria-hidden>✓</span>
          )}
        </div>

        <div className="flex items-center gap-4">
          {canRemove && (
            <span
              role="button"
              onClick={(e) => {
                e.stopPropagation()
                onRemove()
              }}
              className="text-xs text-rose-400 hover:text-rose-300 transition-colors flex items-center gap-1"
            >
              <span aria-hidden>🗑</span> Remove
            </span>
          )}
          {!isExpanded && (
            <span className="text-xs text-cyan-300 hover:text-cyan-200 transition-colors">Edit</span>
          )}
          <span
            className="text-slate-400 transition-transform duration-300 ease-out"
            style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}
            aria-hidden
          >
            ▾
          </span>
        </div>
      </button>

      {/* accordion body */}
      <div
        className="grid transition-all duration-400 ease-out"
        style={{
          gridTemplateRows: isExpanded ? "1fr" : "0fr",
        }}
      >
        <div className="overflow-hidden">
          <div
            className={`px-6 pb-6 space-y-5 transition-opacity duration-300 ${
              isExpanded ? "opacity-100 delay-100" : "opacity-0"
            }`}
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Field label="Title">
                <Select
                  value={passenger.title}
                  error={!!errors.title}
                  onChange={(v) => onChange({ title: v })}
                  options={["Mr", "Mrs", "Ms", "Dr"]}
                  placeholder="Select"
                />
              </Field>
              <Field label="First Name" className="col-span-1">
                <TextInput
                  value={passenger.firstName}
                  error={!!errors.firstName}
                  onChange={(v) => onChange({ firstName: v })}
                  placeholder="Arjun"
                />
              </Field>
              <Field label="Middle Name (Optional)">
                <TextInput
                  value={passenger.middleName}
                  onChange={(v) => onChange({ middleName: v })}
                  placeholder="Kumar"
                />
              </Field>
              <Field label="Last Name">
                <TextInput
                  value={passenger.lastName}
                  error={!!errors.lastName}
                  onChange={(v) => onChange({ lastName: v })}
                  placeholder="Sharma"
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Field label="Date of Birth">
                <TextInput
                  type="date"
                  value={passenger.dob}
                  error={!!errors.dob}
                  onChange={(v) => onChange({ dob: v })}
                />
              </Field>
              <Field label="Gender">
                <Select
                  value={passenger.gender}
                  error={!!errors.gender}
                  onChange={(v) => onChange({ gender: v })}
                  options={["Male", "Female", "Other"]}
                  placeholder="Select"
                />
              </Field>
              <Field label="Nationality">
                <Select
                  value={passenger.nationality}
                  error={!!errors.nationality}
                  onChange={(v) => onChange({ nationality: v })}
                  options={["India", "United States", "United Kingdom", "UAE", "Singapore"]}
                  placeholder="Select"
                />
              </Field>
              <Field label="Frequent Flyer (Optional)">
                <TextInput
                  value={passenger.frequentFlyer}
                  onChange={(v) => onChange({ frequentFlyer: v })}
                  placeholder="AI12345678"
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Email">
                <TextInput
                  type="email"
                  value={passenger.email}
                  error={!!errors.email}
                  errorText={errors.email}
                  onChange={(v) => onChange({ email: v })}
                  placeholder="arjun.sharma@email.com"
                />
              </Field>
              <Field label="Mobile Number">
                <PhoneInput
                  countryCode={passenger.countryCode}
                  mobile={passenger.mobile}
                  error={!!errors.mobile}
                  errorText={errors.mobile}
                  onCountryChange={(v) => onChange({ countryCode: v })}
                  onMobileChange={(v) => onChange({ mobile: v })}
                />
              </Field>
            </div>

            <label className="flex items-center gap-2.5 cursor-pointer select-none group">
              <Checkbox checked={passenger.isPrimaryContact} onChange={onSetPrimaryContact} />
              <span
                className={`text-sm transition-colors ${
                  passenger.isPrimaryContact ? "text-cyan-300" : "text-slate-400 group-hover:text-slate-300"
                }`}
              >
                Use this passenger as primary contact for this booking
              </span>
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Form primitives
// ---------------------------------------------------------------------------

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-xs text-slate-500 mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function TextInput({
  value,
  onChange,
  type = "text",
  placeholder,
  error,
  errorText,
}: {
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  error?: boolean
  errorText?: string
}) {
  const [shake, setShake] = useState(false)
  const prevError = useRef(error)

  useEffect(() => {
    if (error && !prevError.current) {
      setShake(true)
      const t = setTimeout(() => setShake(false), 350)
      return () => clearTimeout(t)
    }
    prevError.current = error
  }, [error])

  return (
    <div>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`field-input w-full rounded-lg bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none transition-all duration-200 border
        ${error ? "border-rose-400/50" : "border-white/[0.08] focus:border-amber-300/60"}
        ${shake ? "field-shake" : ""}`}
      />
      {error && errorText && <p className="text-[11px] text-rose-400 mt-1">{errorText}</p>}
    </div>
  )
}

function Select({
  value,
  onChange,
  options,
  placeholder,
  error,
}: {
  value: string
  onChange: (v: string) => void
  options: string[]
  placeholder?: string
  error?: boolean
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`field-input w-full rounded-lg bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none transition-all duration-200 border appearance-none
      ${error ? "border-rose-400/50" : "border-white/[0.08] focus:border-amber-300/60"}`}
    >
      <option value="" disabled className="text-slate-500">
        {placeholder || "Select"}
      </option>
      {options.map((opt) => (
        <option key={opt} value={opt} className="bg-[#0D1A2C]">
          {opt}
        </option>
      ))}
    </select>
  )
}

function PhoneInput({
  countryCode,
  mobile,
  onCountryChange,
  onMobileChange,
  error,
  errorText,
}: {
  countryCode: string
  mobile: string
  onCountryChange: (v: string) => void
  onMobileChange: (v: string) => void
  error?: boolean
  errorText?: string
}) {
  return (
    <div>
      <div className="flex gap-2">
        <select
          value={countryCode}
          onChange={(e) => onCountryChange(e.target.value)}
          className="field-input rounded-lg bg-white/[0.03] px-2.5 py-2.5 text-sm text-white outline-none border border-white/[0.08] focus:border-amber-300/60 transition-all duration-200 w-[88px]"
        >
          <option value="+91" className="bg-[#0D1A2C]">🇮🇳 +91</option>
          <option value="+1" className="bg-[#0D1A2C]">🇺🇸 +1</option>
          <option value="+44" className="bg-[#0D1A2C]">🇬🇧 +44</option>
          <option value="+971" className="bg-[#0D1A2C]">🇦🇪 +971</option>
        </select>
        <input
          type="tel"
          value={mobile}
          placeholder="98765 43210"
          onChange={(e) => onMobileChange(e.target.value.replace(/[^\d]/g, ""))}
          className={`field-input flex-1 rounded-lg bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none transition-all duration-200 border tracking-wide
          ${error ? "border-rose-400/50" : "border-white/[0.08] focus:border-amber-300/60"}`}
        />
      </div>
      {error && errorText && <p className="text-[11px] text-rose-400 mt-1">{errorText}</p>}
    </div>
  )
}

function Checkbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all duration-200 shrink-0
      ${checked ? "bg-cyan-400 border-cyan-400" : "bg-white/[0.03] border-white/20"}`}
    >
      {checked && <span className="tick-pop text-[#060B14] text-[11px] leading-none">✓</span>}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Trip summary (right panel)
// ---------------------------------------------------------------------------

function TripSummary({
  flight,
  passengerCount,
  baseFare,
  taxesAndFees,
  total,
  pulseSavings,
  canContinue,
  isSaving,
  saveError,
  onContinue,
}: {
  flight: StoredFlight
  passengerCount: number
  baseFare: number
  taxesAndFees: number
  total: number
  pulseSavings: boolean
  canContinue: boolean
  isSaving: boolean
  saveError: string | null
  onContinue: () => void
}) {
  const displayedTotal = useCountUp(total, 900)

  return (
    <div className="sticky top-24 space-y-4">
      <div className="bg-gradient-to-b from-[#0D1A2C] to-[#0A1424] border border-white/[0.08] rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Trip Summary</p>
          <span className="text-xs text-cyan-300">{passengerCount} Passenger{passengerCount > 1 ? "s" : ""}</span>
        </div>

        <div className="px-6 pb-5 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-white flex items-center justify-center overflow-hidden">
              <img
                src={airlineLogos[flight.airline] || "/airlines/default.png"}
                alt={flight.airline}
                className="w-5 h-5 object-contain"
              />
            </div>
            <p className="text-sm font-medium">{flight.airline}</p>
          </div>
          <span className="text-[11px] text-cyan-300 bg-cyan-400/10 border border-cyan-400/20 rounded px-2 py-0.5">
            Economy
          </span>
        </div>

        <div className="px-6 pb-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-semibold tabular-nums">{formatTime(flight.departure_time)}</p>
              <p className="text-[11px] text-slate-500">{flight.origin}</p>
            </div>
            <div className="flex flex-col items-center flex-1 px-3">
              <p className="text-[10px] text-slate-400">{flight.duration || "--"}</p>
              <div className="w-full h-px bg-gradient-to-r from-amber-300/50 to-cyan-300/50 my-1" />
              <p className="text-[10px] text-slate-500">{flight.stops ? `${flight.stops} stop` : "Non-stop"}</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-semibold tabular-nums">{formatTime(flight.arrival_time)}</p>
              <p className="text-[11px] text-slate-500">{flight.destination}</p>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">{formatDateLabel(flight.departure_time)}</p>
        </div>

        <div className="relative px-6">
          <div className="border-t border-dashed border-white/[0.14]" />
          <span className="absolute -left-3 -top-3 w-6 h-6 rounded-full bg-[#060B14]" />
          <span className="absolute -right-3 -top-3 w-6 h-6 rounded-full bg-[#060B14]" />
        </div>

        <div className="px-6 py-5 space-y-2.5 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-400">{passengerCount} x Adult</span>
            <span className="text-slate-200">₹{baseFare.toLocaleString("en-IN")}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Taxes & Fees</span>
            <span className="text-slate-200">₹{taxesAndFees.toLocaleString("en-IN")}</span>
          </div>
        </div>

        <div className="px-6 flex items-end justify-between mb-5">
          <span className="text-sm text-slate-400">Total Price</span>
          <span className="text-[26px] leading-none font-semibold tabular-nums text-amber-300">
            ₹{displayedTotal.toLocaleString("en-IN")}
          </span>
        </div>

        <div className="px-6 space-y-2.5 mb-2">
          <div className={`rounded-xl border px-3.5 py-3 flex items-start gap-3 bg-emerald-400/[0.08] border-emerald-400/20 ${pulseSavings ? "savings-pulse" : ""}`}>
            <span className="text-base mt-0.5" aria-hidden>✓</span>
            <div>
              <p className="text-[13px] font-medium text-emerald-300">You're getting a good fare</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Great choice — one of our best fares</p>
            </div>
          </div>

          <div className="rounded-xl border px-3.5 py-3 flex items-start gap-3 bg-violet-400/[0.06] border-violet-400/15 relative overflow-hidden shimmer-card">
            <span className="text-base mt-0.5" aria-hidden>✨</span>
            <div className="flex-1">
              <p className="text-[13px] font-medium text-violet-300">Unlock AI Deals</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Book now and save up to $120 more</p>
            </div>
            <span className="text-violet-300 self-center">→</span>
          </div>
        </div>

        <div className="px-6 pb-6 pt-2">
          <button
            onClick={onContinue}
            disabled={isSaving}
            className={`continue-btn w-full px-6 py-3.5 rounded-xl font-semibold bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 text-[#060B14] transition-all flex items-center justify-center gap-2 shadow-[0_8px_30px_rgba(251,191,36,0.15)] ${
              !canContinue ? "opacity-90" : ""
            } ${isSaving ? "opacity-70 cursor-not-allowed" : ""}`}
          >
            {isSaving ? (
              <>
                <span className="w-4 h-4 border-2 border-[#060B14]/30 border-t-[#060B14] rounded-full spin-loader" />
                Saving your details…
              </>
            ) : (
              <>
                Continue to Seat Selection
                <span className="continue-arrow" aria-hidden>→</span>
              </>
            )}
          </button>

          {saveError && (
            <p className="text-[11px] text-rose-400 text-center mt-3">{saveError}</p>
          )}

          <p className="text-[11px] text-slate-500 text-center mt-3">
            Next: choose seats for all passengers
          </p>
        </div>
      </div>

      <NavBotTip />
    </div>
  )
}

function useCountUp(target: number, durationMs: number) {
  const [value, setValue] = useState(0)
  const startRef = useRef<number | null>(null)
  const fromRef = useRef(0)

  useEffect(() => {
    fromRef.current = value
    startRef.current = null
    let raf: number

    const tick = (timestamp: number) => {
      if (startRef.current === null) startRef.current = timestamp
      const elapsed = timestamp - startRef.current
      const progress = Math.min(1, elapsed / durationMs)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(fromRef.current + (target - fromRef.current) * eased))
      if (progress < 1) raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target])

  return value
}

// ---------------------------------------------------------------------------
// NavBot tip card (inline, next to summary) + floating bot (fixed corner)
// ---------------------------------------------------------------------------

function NavBotTip() {
  return (
    <div className="bg-gradient-to-br from-cyan-400/[0.06] to-transparent border border-cyan-400/15 rounded-2xl p-5 flex items-start gap-3">
      <span className="text-2xl shrink-0" aria-hidden>🤖</span>
      <div>
        <p className="text-xs font-semibold text-cyan-300">NavBot Tip</p>
        <p className="text-sm text-slate-300 mt-1">Want a window seat?</p>
        <p className="text-xs text-slate-500 mt-0.5">Select your preferred seats in the next step.</p>
      </div>
    </div>
  )
}

function NavBot() {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className="fixed bottom-6 right-6 z-40 hidden md:block"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {hovered && (
        <div className="absolute bottom-full right-0 mb-3 bg-[#0D1A2C] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-slate-300 whitespace-nowrap shadow-lg navbot-tooltip">
          Need help with your booking?
        </div>
      )}
      <button
        className={`w-14 h-14 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-2xl shadow-[0_8px_24px_rgba(34,211,238,0.25)] navbot-float ${
          hovered ? "navbot-bounce" : ""
        }`}
        aria-label="Open NavBot assistant"
      >
        🤖
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Scoped animation styles
// ---------------------------------------------------------------------------

function PageStyles() {
  return (
    <style jsx global>{`
      @keyframes stepPulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(251, 191, 36, 0.35); }
        50% { box-shadow: 0 0 0 6px rgba(251, 191, 36, 0); }
      }
      .step-pulse { animation: stepPulse 2s ease-out infinite; }

      @keyframes tickPop {
        0% { transform: scale(0); opacity: 0; }
        60% { transform: scale(1.3); opacity: 1; }
        100% { transform: scale(1); opacity: 1; }
      }
      .tick-pop { animation: tickPop 320ms cubic-bezier(0.34, 1.56, 0.64, 1); }
      .check-pop { animation: tickPop 320ms cubic-bezier(0.34, 1.56, 0.64, 1); display: inline-block; }

      @keyframes stepLineFill {
        from { transform: scaleX(0); }
        to { transform: scaleX(1); }
      }
      .step-line-fill { transform-origin: left; animation: stepLineFill 500ms ease-out forwards; }

      .field-input:focus {
        transform: scale(1.01);
        box-shadow: 0 0 0 3px rgba(251, 191, 36, 0.08);
      }

      @keyframes fieldShake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-3px); }
        75% { transform: translateX(3px); }
      }
      .field-shake { animation: fieldShake 280ms ease-in-out; }

      .add-passenger-btn:hover {
        box-shadow: 0 0 0 1px rgba(34, 211, 238, 0.15), 0 8px 24px rgba(34, 211, 238, 0.08);
      }

      .card-enter:hover {
        transform: translateY(-2px) !important;
      }

      @keyframes savingsPulse {
        0% { box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.25); }
        70% { box-shadow: 0 0 0 8px rgba(52, 211, 153, 0); }
        100% { box-shadow: 0 0 0 0 rgba(52, 211, 153, 0); }
      }
      .savings-pulse { animation: savingsPulse 1.6s ease-out 1; }

      .shimmer-card::after {
        content: "";
        position: absolute;
        top: 0; left: -100%;
        width: 60%; height: 100%;
        background: linear-gradient(100deg, transparent, rgba(167, 139, 250, 0.08), transparent);
        animation: shimmerSweep 3.5s ease-in-out infinite;
      }
      @keyframes shimmerSweep {
        0% { left: -60%; }
        100% { left: 130%; }
      }

      .continue-btn:hover {
        transform: scale(1.03);
        box-shadow: 0 12px 36px rgba(251, 191, 36, 0.25);
      }
      .continue-btn:active {
        transform: scale(0.98);
        filter: brightness(1.05);
      }
      .continue-btn:hover .continue-arrow {
        transform: translateX(3px);
      }
      .continue-arrow {
        display: inline-block;
        transition: transform 200ms ease-out;
      }

      @keyframes spin {
        to { transform: rotate(360deg); }
      }
      .spin-loader { animation: spin 700ms linear infinite; }

      @keyframes navbotFloat {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-6px); }
      }
      .navbot-float { animation: navbotFloat 4s ease-in-out infinite; }
      .navbot-bounce { animation: navbotFloat 0.6s ease-in-out infinite; transform: scale(1.05); }

      @keyframes tooltipIn {
        from { opacity: 0; transform: translateY(4px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .navbot-tooltip { animation: tooltipIn 180ms ease-out; }

      select.field-input option {
        color: white;
      }

      @media (prefers-reduced-motion: reduce) {
        .step-pulse, .tick-pop, .check-pop, .step-line-fill, .field-shake,
        .savings-pulse, .shimmer-card::after, .navbot-float, .navbot-bounce,
        .navbot-tooltip { animation: none !important; }
      }
    `}</style>
  )
}