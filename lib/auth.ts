import jwt from "jsonwebtoken"

export type AuthUser = {
  userId: string
  email: string
}

/**
 * Reads the "Authorization: Bearer <token>" header from an incoming
 * request and verifies it against JWT_SECRET.
 *
 * Returns null if there's no token, it's malformed, or it's expired/invalid —
 * callers should treat null as "not logged in" and respond 401.
 */
export function getUserFromRequest(req: Request): AuthUser | null {
  const authHeader = req.headers.get("authorization")
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null

  const token = authHeader.slice("Bearer ".length).trim()
  if (!token) return null

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as AuthUser
    return decoded
  } catch (err) {
    return null
  }
}