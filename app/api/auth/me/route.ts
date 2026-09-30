import { NextResponse } from "next/server"
import jwt from "jsonwebtoken"
import { supabase } from "@/lib/supabase"

export async function GET(req: Request) {
  try {
    console.log("🔍 CHECKING AUTH")

    const authHeader = req.headers.get("authorization")

    if (!authHeader) {
      return NextResponse.json(
        { error: "No token" },
        { status: 401 }
      )
    }

    const token = authHeader.split(" ")[1]

    // VERIFY TOKEN
    const secret = process.env.JWT_SECRET || "navigo_jwt_secret_token_2026"
    const decoded: any = jwt.verify(token, secret)

    console.log("✅ TOKEN VALID")

    // CHECK IF ADMIN USER
    if (decoded.isAdmin || decoded.role || (typeof decoded.userId === "string" && decoded.userId.startsWith("adm-"))) {
      const { DEMO_ADMIN_ACCOUNTS } = await import("@/lib/admin-auth")
      const admin = DEMO_ADMIN_ACCOUNTS.find(
        (a) => a.id === decoded.userId || a.email.toLowerCase() === (decoded.email || "").toLowerCase()
      )
      if (admin) {
        return NextResponse.json({
          user: {
            id: admin.id,
            name: admin.name,
            email: admin.email,
            role: admin.role,
            isAdmin: true,
          },
        })
      }
    }

    // GET USER FROM DB
    const { data: user, error } = await supabase
      .from("users")
      .select("id, name, email")
      .eq("id", decoded.userId)
      .maybeSingle()

    if (error || !user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      user,
    })

  } catch (err: any) {
    console.error("❌ AUTH ERROR:", err)
    return NextResponse.json(
      { error: "Invalid token" },
      { status: 401 }
    )
  }
}