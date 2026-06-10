import { supabase } from "@/lib/supabase"
import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"

export async function POST(req: Request) {
  try {
    console.log("🔥 START SIGNUP")

    const body = await req.json()
    console.log("📦 BODY:", body)

    const { name, email, phone, password } = body

    const hashedPassword = await bcrypt.hash(password, 10)

    console.log("📡 INSERTING INTO SUPABASE...")

    const { error } = await supabase
      .from("users")
      .insert([
        {
          name,
          email,
          phone,
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