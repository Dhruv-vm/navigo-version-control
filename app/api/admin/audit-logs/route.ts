import { NextResponse } from "next/server"
import { getAdminAuditLogs, recordAdminAuditLog, AdminRole } from "@/lib/admin-auth"

export async function GET() {
  try {
    const logs = getAdminAuditLogs(100)
    return NextResponse.json({ logs })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch audit trail" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { admin, action, target, details } = body

    const log = recordAdminAuditLog(
      admin || { id: "adm-action", name: "Operations User", role: "SUPER_ADMIN" as AdminRole },
      action || "MANUAL_OVERRIDE",
      target || "System",
      details
    )

    return NextResponse.json({ success: true, log })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to record audit log" }, { status: 500 })
  }
}
