// Shared helpers for the payment flow: currency formatting, PNR
// generation, and the sandbox success/decline simulation.

// ₹ + en-IN grouping (₹1,23,456) — matches the seats/add-ons pages.
export function formatINR(amount: number): string {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`
}

// 6 chars, no ambiguous glyphs (no 0/O, 1/I) — reads clean on a boarding pass.
export function generatePnr(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let out = ""
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

// Derives a flight number purely from data already in hand — no new DB
// column needed. First 3 letters of the airline name + 4 characters from
// the flight instance's own UUID, e.g. "Air India" + "77bd340a-93b4-..."
// -> "AIR77BD". Deterministic per flight instance (same instance always
// produces the same number), distinct per airline, no fetch required.
export function deriveFlightNumber(airline: string, flightInstanceId: string): string {
  const prefix = airline
    .replace(/[^a-zA-Z]/g, "")
    .toUpperCase()
    .slice(0, 3)
    .padEnd(3, "X")
  const suffix = flightInstanceId.replace(/-/g, "").toUpperCase().slice(0, 4)
  return `${prefix}${suffix}`
}


// ---------------------------------------------------------------------------
// Sandbox payment outcome — this is the "not every payment must succeed"
// simulation. Real Razorpay test-mode card numbers have documented
// success/failure behavior (e.g. their published test card list always
// declines a specific number); we don't have that here, so this is a
// weighted coin flip standing in for it. Tune SANDBOX_SUCCESS_RATE or wire
// real test-card logic later if you want deterministic pass/fail per number.
// ---------------------------------------------------------------------------

export const SANDBOX_SUCCESS_RATE = 0.82

const DECLINE_REASONS = [
  "Your bank declined this transaction.",
  "Insufficient funds.",
  "Card verification failed. Please check your details.",
  "Transaction timed out. Please try again.",
  "This card has exceeded its daily transaction limit.",
]

export function simulateSandboxOutcome(): { success: boolean; reason?: string } {
  const success = Math.random() < SANDBOX_SUCCESS_RATE
  if (success) return { success: true }
  const reason = DECLINE_REASONS[Math.floor(Math.random() * DECLINE_REASONS.length)]
  return { success: false, reason }
}