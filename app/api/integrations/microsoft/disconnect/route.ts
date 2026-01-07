import { NextResponse } from "next/server"
import { getUserByToken } from "@/lib/auth"
import { cookies } from "next/headers"
import { getDb } from "@/lib/db"

export async function POST() {
  try {
    const cookieStore = cookies()
    const token = cookieStore.get("auth_token")?.value

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await getUserByToken(token)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admins can manage integrations
    if (user.role !== 'admin') {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    // Delete the OAuth connection
    const db = getDb()
    const result = db.prepare(`
      DELETE FROM oauth_connections
      WHERE company_id = ? AND provider = 'microsoft'
    `).run(user.company_id)

    if (result.changes === 0) {
      return NextResponse.json({ error: "No Microsoft 365 connection found" }, { status: 404 })
    }

    console.log(`Microsoft 365 disconnected for company ${user.company_id}`)

    return NextResponse.json({ success: true, message: "Microsoft 365 disconnected successfully" })
  } catch (error) {
    console.error("Microsoft disconnect error:", error)
    return NextResponse.json(
      { error: "Failed to disconnect Microsoft 365" },
      { status: 500 }
    )
  }
}
