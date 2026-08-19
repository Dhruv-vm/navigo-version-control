import crypto from "crypto"

export interface SmartBoardingPayload {
  version: number
  pnr: string
  bookingId: string
  passengerId: string
  passengerName: string
  flightInstanceId: string
  flightNumber: string
  airline: string
  origin: string
  destination: string
  travelDate: string
  departureTime?: string
  seatNumber?: string
  gate?: string
  biometricVerified: boolean
  biometricProfileId?: string
  checkInId: string
  issuedAt: number // timestamp ms
  expiresAt: number // timestamp ms
}

export interface SignedQRToken {
  token: string
  payload: SmartBoardingPayload
  signature: string
}

const DEFAULT_SECRET = process.env.JWT_SECRET || "navigo-smart-boarding-secure-key-2026"

/**
 * Base64URL encoding helper
 */
function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

function base64UrlDecode(str: string): string {
  str = str.replace(/-/g, "+").replace(/_/g, "/")
  while (str.length % 4) {
    str += "="
  }
  return Buffer.from(str, "base64").toString("utf-8")
}

/**
 * Generates a tamper-proof cryptographically signed DigiYatra QR token
 */
export function generateSignedQRToken(
  payload: Omit<SmartBoardingPayload, "version" | "issuedAt" | "expiresAt"> & {
    validityHours?: number
  },
  secret: string = DEFAULT_SECRET
): string {
  const now = Date.now()
  const validityMs = (payload.validityHours || 72) * 60 * 60 * 1000 // default 72 hours

  const fullPayload: SmartBoardingPayload = {
    ...payload,
    version: 1,
    issuedAt: now,
    expiresAt: now + validityMs,
  }

  const encodedHeader = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "NAVIGO-SMART-PASS" }))
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload))

  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")

  return `NVG1.${encodedHeader}.${encodedPayload}.${signature}`
}

/**
 * Verifies and decodes a signed DigiYatra QR token
 */
export function verifySignedQRToken(
  tokenStr: string,
  secret: string = DEFAULT_SECRET
): {
  valid: boolean
  expired: boolean
  payload: SmartBoardingPayload | null
  error?: string
} {
  try {
    if (!tokenStr || typeof tokenStr !== "string") {
      return { valid: false, expired: false, payload: null, error: "Missing or invalid token format" }
    }

    let cleanToken = tokenStr.trim()
    // Extract from full URLs if scanner parsed a web URL
    if (cleanToken.includes("token=")) {
      try {
        const u = new URL(cleanToken, "http://localhost")
        const param = u.searchParams.get("token")
        if (param) cleanToken = param
      } catch {
        const match = cleanToken.match(/[?&]token=([^&#]+)/)
        if (match) cleanToken = decodeURIComponent(match[1])
      }
    }

    // Token format: NVG1.<header>.<payload>.<signature>
    const parts = cleanToken.split(".")
    if (parts.length === 4 && parts[0] === "NVG1") {
      const [, headerB64, payloadB64, sigB64] = parts

      // Verify HMAC signature
      const expectedSig = crypto
        .createHmac("sha256", secret)
        .update(`${headerB64}.${payloadB64}`)
        .digest("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "")

      if (sigB64 !== expectedSig) {
        return { valid: false, expired: false, payload: null, error: "Cryptographic signature mismatch. Token has been tampered with." }
      }

      const payload = JSON.parse(base64UrlDecode(payloadB64)) as SmartBoardingPayload

      const now = Date.now()
      if (payload.expiresAt && now > payload.expiresAt) {
        return { valid: false, expired: true, payload, error: `Token expired at ${new Date(payload.expiresAt).toISOString()}` }
      }

      return { valid: true, expired: false, payload }
    }

    // Handle legacy or non-prefixed tokens
    if (parts.length === 3) {
      const [headerB64, payloadB64, sigB64] = parts

      const expectedSig = crypto
        .createHmac("sha256", secret)
        .update(`${headerB64}.${payloadB64}`)
        .digest("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "")

      if (sigB64 !== expectedSig) {
        return { valid: false, expired: false, payload: null, error: "Cryptographic signature mismatch." }
      }

      const payload = JSON.parse(base64UrlDecode(payloadB64)) as SmartBoardingPayload

      if (payload.expiresAt && Date.now() > payload.expiresAt) {
        return { valid: false, expired: true, payload, error: "Token expired" }
      }

      return { valid: true, expired: false, payload }
    }

    return { valid: false, expired: false, payload: null, error: "Unrecognized QR token structure" }
  } catch (err: any) {
    return { valid: false, expired: false, payload: null, error: err.message || "Failed to decode QR token" }
  }
}
