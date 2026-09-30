import { supabase } from "@/lib/supabase"
import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"

export async function POST(req: Request) {
  try {
    console.log("🔥 START SIGNUP")

    const body = await req.json()
    console.log("📦 BODY:", body)

    const { name, email, phone, password } = body

    if (!email || !password || !name) {
      return NextResponse.json({ error: "Name, email, and password are required" }, { status: 400 })
    }

    const cleanEmail = email.trim().toLowerCase()

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .ilike("email", cleanEmail)
      .maybeSingle()

    if (existingUser) {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    console.log("📡 INSERTING INTO SUPABASE...")

    const { error } = await supabase
      .from("users")
      .insert([
        {
          name: name.trim(),
          email: cleanEmail,
          phone: phone ? phone.trim() : null,
          password: hashedPassword,
        },
      ])

    if (error) {
      console.error("❌ SUPABASE ERROR:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log("✅ INSERT SUCCESS")

    return NextResponse.json({
      message: "User created successfully"
    })

  } catch (err: any) {
    console.error("🔥 SERVER ERROR:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}