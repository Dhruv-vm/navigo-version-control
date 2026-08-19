import { NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/auth"
import {
  getBiometricProfile,
  saveBiometricProfile,
  deleteBiometricProfile,
} from "@/lib/biometrics"

export async function GET(req: Request) {
  try {
    const user = getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const profile = await getBiometricProfile(user.userId)

    return NextResponse.json({
      hasProfile: !!profile && profile.isActive,
      profile: profile
        ? {
            biometricProfileId: profile.biometricProfileId,
            faceTemplateHash: profile.faceTemplateHash.slice(0, 16) + "...",
            consentGiven: profile.consentGiven,
            consentTimestamp: profile.consentTimestamp,
            isActive: profile.isActive,
            lastVerifiedAt: profile.lastVerifiedAt,
            createdAt: profile.createdAt,
          }
        : null,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to load biometric profile" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const body = await req.json()
    const consentGiven = body?.consentGiven !== false
    const faceEmbedding = Array.isArray(body?.faceEmbedding) ? body.faceEmbedding : undefined
    const seedName = body?.seedName || user.email

    const profile = await saveBiometricProfile({
      userId: user.userId,
      consentGiven,
      faceEmbedding,
      seedName,
    })

    return NextResponse.json({
      success: true,
      message: "Smart Boarding face profile created successfully",
      profile: {
        biometricProfileId: profile.biometricProfileId,
        faceTemplateHash: profile.faceTemplateHash.slice(0, 16) + "...",
        consentGiven: profile.consentGiven,
        consentTimestamp: profile.consentTimestamp,
        isActive: profile.isActive,
        lastVerifiedAt: profile.lastVerifiedAt,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to save face profile" }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const user = getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const success = await deleteBiometricProfile(user.userId)

    return NextResponse.json({
      success,
      message: "Biometric face profile has been permanently removed.",
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to delete face profile" }, { status: 500 })
  }
}
