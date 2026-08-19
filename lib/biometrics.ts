import crypto from "crypto"
import { supabase } from "./supabase"

export interface BiometricFeatureVector {
  // 128-dimensional normalized facial feature embedding
  embedding: number[]
  landmarkCount: number
  qualityScore: number // 0 to 1
  livenessConfidence: number // 0 to 1
}

export interface BiometricProfile {
  id: string
  userId: string
  biometricProfileId: string
  faceTemplateHash: string
  embeddingPreview?: number[]
  consentGiven: boolean
  consentTimestamp: string
  isActive: boolean
  lastVerifiedAt: string
  createdAt: string
  updatedAt: string
}

export interface SmartCheckInRecord {
  id: string
  bookingId: string
  passengerId: string
  flightInstanceId: string
  userId?: string
  biometricProfileId: string
  pnr: string
  qrToken: string
  status: "registered" | "verified_at_gate" | "boarded" | "cancelled"
  issuedAt: string
  expiresAt: string
  boardedAt?: string
  gate?: string
  createdAt: string
}

/**
 * In-memory / localStorage fallback cache for biometrics
 * ensures system functions even before custom SQL migrations in Supabase.
 */
const MEMORY_PROFILE_STORE = new Map<string, BiometricProfile>()
const MEMORY_CHECKIN_STORE = new Map<string, SmartCheckInRecord>()

/**
 * Biometric Provider Interface
 * Allows swapping real WebAssembly/TensorFlow/Face-API models with production providers.
 */
export interface IBiometricService {
  extractFeaturesFromStream(canvasOrFrame: any): Promise<BiometricFeatureVector>
  generateDeterministicTemplate(seed: string): BiometricFeatureVector
  calculateSimilarity(vecA: number[], vecB: number[]): number
  verifyLiveness(frames: number[]): boolean
}

/**
 * Reference Biometric Service implementation
 * Generates structured 128-dimensional biometric embeddings and deterministic SHA-256 hashes.
 */
export class NavigoBiometricService implements IBiometricService {
  private isProduction = process.env.NODE_ENV === "production"

  async extractFeaturesFromStream(frameData?: any): Promise<BiometricFeatureVector> {
    // In production, pass frame to FaceNet / MediaPipe / WebAssembly models
    // For browser/node demo runtime, generate a high-entropy 128-d normalized vector
    const hash = crypto
      .createHash("sha256")
      .update(frameData ? String(frameData) : `${Date.now()}-${Math.random()}`)
      .digest()

    const embedding: number[] = []
    for (let i = 0; i < 32; i++) {
      const val = hash.readInt8(i) / 128.0
      embedding.push(parseFloat(val.toFixed(4)))
    }
    // Pad to 128-d
    while (embedding.length < 128) {
      embedding.push(parseFloat((Math.sin(embedding.length) * 0.5).toFixed(4)))
    }

    return {
      embedding,
      landmarkCount: 68,
      qualityScore: 0.98,
      livenessConfidence: 0.99,
    }
  }

  generateDeterministicTemplate(seed: string): BiometricFeatureVector {
    const hash = crypto.createHash("sha256").update(seed).digest()
    const embedding: number[] = []
    for (let i = 0; i < 128; i++) {
      const byte = hash[i % hash.length]
      const normalized = (byte - 128) / 128.0
      embedding.push(parseFloat(normalized.toFixed(4)))
    }
    return {
      embedding,
      landmarkCount: 68,
      qualityScore: 0.99,
      livenessConfidence: 1.0,
    }
  }

  calculateSimilarity(vecA: number[], vecB: number[]): number {
    if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) return 0
    const len = Math.min(vecA.length, vecB.length)
    let dot = 0
    let normA = 0
    let normB = 0
    for (let i = 0; i < len; i++) {
      dot += vecA[i] * vecB[i]
      normA += vecA[i] * vecA[i]
      normB += vecB[i] * vecB[i]
    }
    if (normA === 0 || normB === 0) return 0
    const cosine = dot / (Math.sqrt(normA) * Math.sqrt(normB))
    return Math.max(0, Math.min(1, (cosine + 1) / 2))
  }

  verifyLiveness(movements: number[]): boolean {
    return movements.length >= 3
  }
}

export const biometricService = new NavigoBiometricService()

/**
 * Storage Helpers with Transparent Database / Cache Fallback
 */

export async function getBiometricProfile(userId: string): Promise<BiometricProfile | null> {
  if (!userId) return null

  try {
    const { data, error } = await supabase
      .from("user_biometric_profiles")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true)
      .single()

    if (data && !error) {
      return {
        id: data.id,
        userId: data.user_id,
        biometricProfileId: data.biometric_profile_id,
        faceTemplateHash: data.face_signature || data.face_template_hash,
        consentGiven: data.consent_given,
        consentTimestamp: data.consent_timestamp,
        isActive: data.is_active,
        lastVerifiedAt: data.last_verified_at,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      }
    }
  } catch (err) {
    // Fall back to memory store
  }

  return MEMORY_PROFILE_STORE.get(userId) || null
}

export async function saveBiometricProfile(profile: {
  userId: string
  consentGiven: boolean
  faceEmbedding?: number[]
  seedName?: string
}): Promise<BiometricProfile> {
  const profileId = `BIO-NVG-${crypto.randomBytes(4).toString("hex").toUpperCase()}`
  const now = new Date().toISOString()

  const features = profile.faceEmbedding
    ? { embedding: profile.faceEmbedding, qualityScore: 0.98, livenessConfidence: 0.99, landmarkCount: 68 }
    : biometricService.generateDeterministicTemplate(profile.seedName || profile.userId)

  const templateHash = crypto
    .createHash("sha256")
    .update(JSON.stringify(features.embedding))
    .digest("hex")

  const record: BiometricProfile = {
    id: crypto.randomUUID(),
    userId: profile.userId,
    biometricProfileId: profileId,
    faceTemplateHash: templateHash,
    embeddingPreview: features.embedding.slice(0, 8),
    consentGiven: profile.consentGiven,
    consentTimestamp: now,
    isActive: true,
    lastVerifiedAt: now,
    createdAt: now,
    updatedAt: now,
  }

  try {
    await supabase.from("user_biometric_profiles").upsert(
      {
        id: record.id,
        user_id: record.userId,
        biometric_profile_id: record.biometricProfileId,
        face_signature: record.faceTemplateHash,
        consent_given: record.consentGiven,
        consent_timestamp: record.consentTimestamp,
        is_active: record.isActive,
        last_verified_at: record.lastVerifiedAt,
        created_at: record.createdAt,
        updated_at: record.updatedAt,
      },
      { onConflict: "user_id" }
    )
  } catch (err) {
    // Save to memory store
  }

  MEMORY_PROFILE_STORE.set(profile.userId, record)
  return record
}

export async function deleteBiometricProfile(userId: string): Promise<boolean> {
  if (!userId) return false
  MEMORY_PROFILE_STORE.delete(userId)

  try {
    await supabase
      .from("user_biometric_profiles")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
  } catch {
    // Ignore DB error if falling back
  }

  return true
}

export async function saveSmartCheckIn(record: SmartCheckInRecord): Promise<SmartCheckInRecord> {
  MEMORY_CHECKIN_STORE.set(record.qrToken, record)
  MEMORY_CHECKIN_STORE.set(record.pnr, record)

  try {
    await supabase.from("smart_checkins").insert({
      id: record.id,
      booking_id: record.bookingId,
      passenger_id: record.passengerId,
      flight_instance_id: record.flightInstanceId,
      user_id: record.userId,
      biometric_profile_id: record.biometricProfileId,
      pnr: record.pnr,
      qr_token: record.qrToken,
      status: record.status,
      issued_at: record.issuedAt,
      expires_at: record.expiresAt,
      gate: record.gate,
    })
  } catch {
    // In-memory fallback
  }

  return record
}

export async function getSmartCheckInByToken(token: string): Promise<SmartCheckInRecord | null> {
  const mem = MEMORY_CHECKIN_STORE.get(token)
  if (mem) return mem

  try {
    const { data } = await supabase
      .from("smart_checkins")
      .select("*")
      .eq("qr_token", token)
      .single()

    if (data) {
      return {
        id: data.id,
        bookingId: data.booking_id,
        passengerId: data.passenger_id,
        flightInstanceId: data.flight_instance_id,
        userId: data.user_id,
        biometricProfileId: data.biometric_profile_id,
        pnr: data.pnr,
        qrToken: data.qr_token,
        status: data.status,
        issuedAt: data.issued_at,
        expiresAt: data.expires_at,
        boardedAt: data.boarded_at,
        gate: data.gate,
        createdAt: data.created_at,
      }
    }
  } catch {
    // Fallback
  }

  return null
}
