import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { supabase } from "@/lib/supabase"

export async function POST(req: Request) {
  try {
    const { token, password } = await req.json()

    if (!token || !password) {
      return NextResponse.json(
        { error: "Token and password required" },
        { status: 400 }
      )
    }

    // 🔍 Find user with token
    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("reset_token", token)
      .single()

    if (error || !user) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 400 }
      )
    }

    // 🔐 Hash new password
    const hashedPassword = await bcrypt.hash(password, 10)

    // ✅ Update password + remove token
    const { error: updateError } = await supabase
      .from("users")
      .update({
        password: hashedPassword,
        reset_token: null,
      })
      .eq("id", user.id)

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to update password" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: "Password reset successful",
    })

  } catch (err) {
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    )
  }
}