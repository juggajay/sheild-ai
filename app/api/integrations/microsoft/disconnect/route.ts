import { NextResponse } from "next/server"
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { getUserByToken } from "@/lib/auth"
import { cookies } from "next/headers"

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

export async function POST() {
  try {
    const cookieStore = cookies()
    const token = (await cookieStore).get("auth_token")?.value

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
    const result = await convex.mutation(api.integrations.deleteConnection, {
      companyId: user.company_id as Id<"companies">,
      provider: 'microsoft',
    })

    if (!result.deleted) {
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
