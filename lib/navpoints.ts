// lib/navpoints.ts
//
// Centralized loyalty & rewards engine for Navigo Points (NavPoints).
//
// Conversion Rate:
//   2 NavPoints = ₹1 INR discount  (1 NavPoint = ₹0.50)
//
// Earning Rate:
//   Every flight booking earns 150 points (or ~5% of fare, min 100 pts)
//
// Persistence:
//   Stored in localStorage under `navigo:navpoints`. Defaults to a starting
//   explorer balance of 650 NavPoints (worth ₹325).

export const POINTS_PER_RUPEE = 2
export const DEFAULT_WELCOME_POINTS = 650
export const STORAGE_KEY_NAVPOINTS = "navigo:navpoints"

export function getActiveUserId(): string {
  if (typeof window === "undefined") return "guest"
  try {
    const token = localStorage.getItem("token")
    if (token) {
      const parts = token.split(".")
      if (parts.length === 3) {
        const payload = JSON.parse(
          decodeURIComponent(
            atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))
              .split("")
              .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
              .join("")
          )
        )
        if (payload?.userId) return payload.userId
        if (payload?.id) return payload.id
        if (payload?.email) return payload.email
      }
    }
  } catch {}
  return "guest"
}

export function getUserStorageKey(userId?: string): string {
  const targetId = userId || getActiveUserId()
  return `navigo:navpoints:${targetId}`
}

export function getNavPointsBalance(userId?: string): number {
  if (typeof window === "undefined") return DEFAULT_WELCOME_POINTS
  try {
    const key = getUserStorageKey(userId)
    const raw = localStorage.getItem(key)
    if (raw === null) {
      localStorage.setItem(key, String(DEFAULT_WELCOME_POINTS))
      return DEFAULT_WELCOME_POINTS
    }
    const val = Number(raw)
    return isNaN(val) ? DEFAULT_WELCOME_POINTS : val
  } catch {
    return DEFAULT_WELCOME_POINTS
  }
}

export function setNavPointsBalance(points: number, userId?: string): void {
  if (typeof window === "undefined") return
  try {
    const key = getUserStorageKey(userId)
    const safe = Math.max(0, Math.round(points))
    localStorage.setItem(key, String(safe))
    window.dispatchEvent(new Event("navpoints_updated"))
  } catch (err) {
    console.error("Failed to update NavPoints balance:", err)
  }
}

export function pointsToDiscount(points: number): number {
  return Math.floor(Math.max(0, points) / POINTS_PER_RUPEE)
}

export function discountToPoints(discountRupees: number): number {
  return Math.round(Math.max(0, discountRupees) * POINTS_PER_RUPEE)
}

export function calculateEarnedPoints(fareAmount: number): number {
  const earned = Math.round(fareAmount * 0.04)
  return Math.max(120, Math.min(600, earned))
}

export function deductNavPoints(pointsToRedeem: number, userId?: string): number {
  const current = getNavPointsBalance(userId)
  const toDeduct = Math.min(current, Math.max(0, pointsToRedeem))
  const remaining = Math.max(0, current - toDeduct)
  setNavPointsBalance(remaining, userId)
  return remaining
}

export function creditNavPoints(pointsToCredit: number, userId?: string): number {
  const current = getNavPointsBalance(userId)
  const updated = current + Math.max(0, pointsToCredit)
  setNavPointsBalance(updated, userId)
  return updated
}
