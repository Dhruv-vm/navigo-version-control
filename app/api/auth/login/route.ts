import { supabase } from "@/lib/supabase"
import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import { verifyAdminCredentials } from "@/lib/admin-auth"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
    }

    // 🌟 1️⃣ CHECK ADMIN CREDENTIALS FIRST
    const adminUser = verifyAdminCredentials(email, password)
    if (adminUser) {
      const token = jwt.sign(
        {
          userId: adminUser.id,
          email: adminUser.email,
          role: adminUser.role,
          isAdmin: true,
        },
        process.env.JWT_SECRET || "navigo_jwt_secret_token_2026",
        { expiresIn: "7d" }
      )

      return NextResponse.json({
        message: "Admin authentication successful",
        isAdmin: true,
        role: adminUser.role,
        admin: adminUser,
        token,
        user: {
          id: adminUser.id,
          name: adminUser.name,
          email: adminUser.email,
          role: adminUser.role,
        },
      })
    }

    // 2️⃣ FIND STANDARD PASSENGER USER IN DATABASE
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