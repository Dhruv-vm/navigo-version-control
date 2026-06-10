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
    const decoded: any = jwt.verify(
      token,
      process.env.JWT_SECRET!
    )

    console.log("✅ TOKEN VALID")

    // GET USER FROM DB
    const { data: user, error } = await supabase
      .from("users")
      .select("id, name, email")
      .eq("id", decoded.userId)
      .single()

    if (error || !user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      user
    })

  } catch (err: any) {
    console.error("❌ AUTH ERROR:", err)
    return NextResponse.json(
      { error: "Invalid token" },
      { status: 401 }
    )
  }
}