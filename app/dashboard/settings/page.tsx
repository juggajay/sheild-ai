"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  Settings,
  Building2,
  Bell,
  Shield,
  UserCog,
  CreditCard,
  ChevronRight,
  FileText,
  User as UserIcon,
  Plug
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface User {
  id: string
  email: string
  name: string
  role: string
  company: {
    id: string
    name: string
    abn: string
  } | null
}

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    fetchUser()
  }, [])

  const fetchUser = async () => {
    try {
      const response = await fetch("/api/auth/me")
      if (response.ok) {
        const data = await response.json()
        setUser(data.user)
      }
    } catch (error) {
      console.error("Failed to fetch user:", error)
    }
  }

  const isAdmin = user?.role === 'admin'

  return (
    <>
      {/* Top Bar */}
      <header className="bg-white border-b px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
            <p className="text-slate-500">Manage your account and company settings</p>
          </div>
        </div>
      </header>

      {/* Settings Content */}
      <div className="p-6 md:p-8 lg:p-12 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Profile Settings */}
          <SettingsCard
            icon={<UserIcon className="h-5 w-5 text-cyan-500" />}
            title="My Profile"
            description="Update your name, phone number, and profile photo"
            href="/dashboard/settings/profile"
          />

          {/* Company Settings */}
          <SettingsCard
            icon={<Building2 className="h-5 w-5 text-blue-500" />}
            title="Company Profile"
            description="Update company name, ABN, logo, and contact information"
            href="/dashboard/settings/company"
          />

          {/* Notification Settings */}
          <SettingsCard
            icon={<Bell className="h-5 w-5 text-amber-500" />}
            title="Notifications"
            description="Configure email preferences and alert settings"
            href="/dashboard/settings/notifications"
          />

          {/* Security Settings */}
          <SettingsCard
            icon={<Shield className="h-5 w-5 text-green-500" />}
            title="Security"
            description="Password, two-factor authentication, and session management"
            href="/dashboard/settings/security"
          />

          {/* Integrations - available to all users to view, admin to configure */}
          <SettingsCard
            icon={<Plug className="h-5 w-5 text-indigo-500" />}
            title="Integrations"
            description="Connect email, SendGrid, Twilio, and other services"
            href="/dashboard/settings/integrations"
          />

          {/* Admin-only sections */}
          {isAdmin && (
            <>
              {/* User Management */}
              <SettingsCard
                icon={<UserCog className="h-5 w-5 text-purple-500" />}
                title="User Management"
                description="Invite users, manage roles, and control access"
                href="/dashboard/settings/users"
                badge="Admin"
              />

              {/* Billing */}
              <SettingsCard
                icon={<CreditCard className="h-5 w-5 text-pink-500" />}
                title="Billing & Subscription"
                description="Manage your subscription, view invoices, and update payment"
                href="/dashboard/settings/billing"
                badge="Admin"
              />

              {/* Audit Logs */}
              <SettingsCard
                icon={<FileText className="h-5 w-5 text-slate-500" />}
                title="Audit Logs"
                description="View activity logs and track user actions across the system"
                href="/dashboard/settings/audit-logs"
                badge="Admin"
              />
            </>
          )}
        </div>

        {!isAdmin && (
          <Card>
            <CardContent className="py-6">
              <div className="flex items-center gap-3 text-slate-500">
                <Settings className="h-5 w-5" />
                <p className="text-sm">
                  Some settings are only available to administrators. Contact your admin for access to user management and billing.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}

function SettingsCard({
  icon,
  title,
  description,
  href,
  badge
}: {
  icon: React.ReactNode
  title: string
  description: string
  href: string
  badge?: string
}) {
  return (
    <Link href={href}>
      <Card className="h-full hover:border-primary transition-colors cursor-pointer group">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="p-2 bg-slate-100 rounded-lg group-hover:bg-primary/10">
              {icon}
            </div>
            {badge && (
              <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">
                {badge}
              </span>
            )}
          </div>
          <CardTitle className="text-lg flex items-center gap-2 group-hover:text-primary">
            {title}
            <ChevronRight className="h-4 w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
      </Card>
    </Link>
  )
}
