import { NextRequest, NextResponse } from "next/server"
import { ConvexHttpClient } from "convex/browser"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { getUserByToken } from "@/lib/auth"

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

// GET /api/user/profile - Get current user profile
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("auth_token")?.value
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = getUserByToken(token)
    if (!user) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    }

    const dbUser = await convex.query(api.users.getById, {
      id: user.id as Id<"users">,
    })

    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Convert to legacy format
    const profile = {
      id: dbUser._id,
      email: dbUser.email,
      name: dbUser.name,
      phone: dbUser.phone || null,
      avatar_url: dbUser.avatarUrl || null,
      company_id: dbUser.companyId,
    }

    return NextResponse.json({ profile })
  } catch (error) {
    console.error("Error fetching profile:", error)
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 })
  }
}

// PUT /api/user/profile - Update current user profile
export async function PUT(request: NextRequest) {
  try {
    const token = request.cookies.get("auth_token")?.value
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = getUserByToken(token)
    if (!user) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    }

    const body = await request.json()
    const { name, phone, avatar_url } = body

    // Validate name is provided and not empty
    if (name !== undefined && (!name || name.trim().length === 0)) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    // Validate phone format if provided (basic validation)
    if (phone !== undefined && phone !== null && phone.trim() !== '') {
      const phoneRegex = /^[\d\s\+\-\(\)]+$/
      if (!phoneRegex.test(phone)) {
        return NextResponse.json({ error: "Invalid phone number format" }, { status: 400 })
      }
    }

    // Build update object
    const updates: any = {}
    if (name !== undefined) updates.name = name.trim()
    if (phone !== undefined) updates.phone = phone?.trim() || undefined
    if (avatar_url !== undefined) updates.avatarUrl = avatar_url || undefined

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 })
    }

    // Update user
    await convex.mutation(api.users.update, {
      id: user.id as Id<"users">,
      ...updates,
    })

    // Log the action
    const details: Record<string, unknown> = { self_update: true }
    if (name !== undefined) details.name = name
    if (phone !== undefined) details.phone = phone
    if (avatar_url !== undefined) details.avatar_updated = true

    if (user.company_id) {
      await convex.mutation(api.auditLogs.create, {
        companyId: user.company_id as Id<"companies">,
        userId: user.id as Id<"users">,
        entityType: "user",
        entityId: user.id,
        action: "update",
        details,
      })
    }

    // Get updated profile
    const updatedUser = await convex.query(api.users.getById, {
      id: user.id as Id<"users">,
    })

    const updatedProfile = {
      id: updatedUser?._id,
      email: updatedUser?.email,
      name: updatedUser?.name,
      phone: updatedUser?.phone || null,
      avatar_url: updatedUser?.avatarUrl || null,
      company_id: updatedUser?.companyId,
    }

    return NextResponse.json({
      success: true,
      message: "Profile updated successfully",
      profile: updatedProfile,
    })
  } catch (error) {
    console.error("Error updating profile:", error)
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 })
  }
}
