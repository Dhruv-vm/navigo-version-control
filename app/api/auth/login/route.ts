import { supabase } from "@/lib/supabase"
import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"

export async function POST(req: Request) {
  try {
    console.log("🔥 LOGIN START")

    const body = await req.json()
    const { email, password } = body

    console.log("📦 INPUT:", email)

    // 1️⃣ FIND USER
    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single()

    if (error || !user) {
      console.log("❌ USER NOT FOUND")
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      )
    }

    console.log("✅ USER FOUND")

    // 2️⃣ CHECK PASSWORD
    const isMatch = await bcrypt.compare(password, user.password)

    if (!isMatch) {
      console.log("❌ WRONG PASSWORD")
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      )
    }

    console.log("✅ PASSWORD MATCH")

    // 3️⃣ CREATE TOKEN
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
      },
      process.env.JWT_SECRET!,
      { expiresIn: "7d" }
    )

    console.log("🔐 TOKEN GENERATED")

    // 4️⃣ RETURN RESPONSE
    return NextResponse.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    })

  } catch (err: any) {
    console.error("🔥 LOGIN ERROR:", err)
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    )
  }
}