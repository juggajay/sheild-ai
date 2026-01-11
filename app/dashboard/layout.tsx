"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { ErrorBoundary } from "@/components/error-boundary"
import {
  Shield,
  LogOut,
  Sun,
  FileCheck,
  AlertTriangle,
  FolderKanban,
  Users,
  Bell,
  Settings,
  UserCog,
  CreditCard,
  Menu,
  X,
  ClipboardCheck
} from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

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

// Define admin-only routes
const ADMIN_ONLY_ROUTES = [
  '/dashboard/settings/billing',
  '/dashboard/settings/users',
  '/dashboard/admin'
]

// Portal-only roles (cannot access main dashboard)
const PORTAL_ONLY_ROLES = ['subcontractor', 'broker']

// Define role hierarchy for access control
const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ['admin', 'risk_manager', 'project_manager', 'project_administrator', 'read_only'],
  risk_manager: ['risk_manager', 'project_manager', 'project_administrator', 'read_only'],
  project_manager: ['project_manager', 'project_administrator', 'read_only'],
  project_administrator: ['project_administrator', 'read_only'],
  read_only: ['read_only']
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const { toast } = useToast()
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [accessDenied, setAccessDenied] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    fetchUser()
  }, [])

  // Close sidebar when route changes (for mobile)
  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  useEffect(() => {
    if (user && pathname) {
      // Check role-based access for admin routes
      const isAdminRoute = ADMIN_ONLY_ROUTES.some(route => pathname.startsWith(route))
      if (isAdminRoute && user.role !== 'admin') {
        setAccessDenied(true)
        toast({
          title: "Access Denied",
          description: "You don't have permission to access this page",
          variant: "destructive"
        })
      } else {
        setAccessDenied(false)
      }
    }
  }, [user, pathname, toast])

  const fetchUser = async () => {
    try {
      const response = await fetch("/api/auth/me")
      if (!response.ok) {
        throw new Error("Not authenticated")
      }
      const data = await response.json()

      // Check if user is a portal-only role (subcontractor/broker)
      // These users should not access the main dashboard
      if (PORTAL_ONLY_ROLES.includes(data.user.role)) {
        toast({
          title: "Access Denied",
          description: "Portal users cannot access the main application. Redirecting to portal...",
          variant: "destructive"
        })
        // Redirect to appropriate portal based on role
        if (data.user.role === 'broker') {
          router.push("/broker/dashboard")
        } else {
          router.push("/portal/dashboard")
        }
        return
      }

      setUser(data.user)
    } catch (error) {
      router.push("/login")
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
      toast({
        title: "Logged out",
        description: "You have been logged out successfully",
      })
      router.push("/login")
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to log out",
        variant: "destructive"
      })
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex items-center gap-2">
          <Shield className="h-8 w-8 text-primary animate-pulse" />
          <span className="text-lg text-slate-600">Loading...</span>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  // Show access denied page for unauthorized access to admin routes
  if (accessDenied) {
    return (
      <div className="min-h-screen bg-slate-50 flex">
        <Sidebar user={user} pathname={pathname} onLogout={handleLogout} isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
        {/* Mobile menu button */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="lg:hidden fixed top-4 left-4 z-40 p-2 bg-slate-900 text-white rounded-md"
        >
          <Menu className="h-6 w-6" />
        </button>
        <main className="flex-1 lg:ml-64 flex items-center justify-center">
          <div className="text-center px-4">
            <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
              <Shield className="h-8 w-8 text-red-500" />
            </div>
            <h1 className="text-2xl font-semibold text-slate-900 mb-2">Access Denied</h1>
            <p className="text-slate-600 mb-4">
              You don&apos;t have permission to access this page.
            </p>
            <p className="text-sm text-slate-500 mb-6">
              This page requires admin privileges. Your current role is: <strong>{user.role}</strong>
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
            >
              Return to Dashboard
            </Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Skip to main content link for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:bg-primary focus:text-white focus:px-4 focus:py-2 focus:rounded-md focus:shadow-lg"
      >
        Skip to main content
      </a>
      <Sidebar user={user} pathname={pathname} onLogout={handleLogout} isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      {/* Mobile menu button */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-40 p-2 bg-slate-900 text-white rounded-md shadow-lg"
        aria-label="Open menu"
      >
        <Menu className="h-6 w-6" />
      </button>
      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
      <main id="main-content" className="flex-1 lg:ml-64 pt-16 lg:pt-0" role="main">
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </main>
    </div>
  )
}

function Sidebar({ user, pathname, onLogout, isOpen, onToggle }: { user: User; pathname: string; onLogout: () => void; isOpen: boolean; onToggle: () => void }) {
  const isAdmin = user.role === 'admin'

  return (
    <aside
      className={`w-64 bg-slate-900 text-white flex flex-col fixed h-screen z-50 transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
      aria-label="Sidebar"
    >
      <div className="p-4 border-b border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            <span className="text-lg font-semibold">RiskShield AI</span>
          </div>
          {/* Close button for mobile */}
          <button
            onClick={onToggle}
            className="lg:hidden p-1 hover:bg-slate-800 rounded"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto" aria-label="Main navigation">
        <NavItem
          icon={<Sun />}
          label="Morning Brief"
          href="/dashboard"
          active={pathname === '/dashboard'}
        />
        <NavItem
          icon={<FolderKanban />}
          label="Projects"
          href="/dashboard/projects"
          active={pathname.startsWith('/dashboard/projects')}
        />
        <NavItem
          icon={<Users />}
          label="Subcontractors"
          href="/dashboard/subcontractors"
          active={pathname.startsWith('/dashboard/subcontractors')}
        />
        <NavItem
          icon={<FileCheck />}
          label="Documents"
          href="/dashboard/documents"
          active={pathname.startsWith('/dashboard/documents')}
        />
        <NavItem
          icon={<ClipboardCheck />}
          label="Reviews"
          href="/dashboard/reviews"
          active={pathname.startsWith('/dashboard/reviews')}
        />
        <NavItem
          icon={<AlertTriangle />}
          label="Exceptions"
          href="/dashboard/exceptions"
          active={pathname.startsWith('/dashboard/exceptions')}
        />
        <NavItem
          icon={<Bell />}
          label="Communications"
          href="/dashboard/communications"
          active={pathname.startsWith('/dashboard/communications')}
        />
      </nav>

      <div className="p-4 border-t border-slate-800 space-y-1">
        <NavItem
          icon={<Settings />}
          label="Settings"
          href="/dashboard/settings"
          active={pathname === '/dashboard/settings'}
        />
        {isAdmin && (
          <>
            <NavItem
              icon={<UserCog />}
              label="User Management"
              href="/dashboard/settings/users"
              active={pathname === '/dashboard/settings/users'}
            />
            <NavItem
              icon={<CreditCard />}
              label="Billing"
              href="/dashboard/settings/billing"
              active={pathname === '/dashboard/settings/billing'}
            />
          </>
        )}
        <button
          onClick={onLogout}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <LogOut className="h-5 w-5" />
          <span>Logout</span>
        </button>
      </div>

      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-white font-medium">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user.name}</p>
            <p className="text-xs text-slate-400 truncate">{user.company?.name || "No company"}</p>
          </div>
        </div>
      </div>
    </aside>
  )
}

function NavItem({
  icon,
  label,
  href,
  active = false
}: {
  icon: React.ReactNode
  label: string
  href: string
  active?: boolean
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
        active
          ? "bg-primary text-white"
          : "text-slate-400 hover:text-white hover:bg-slate-800"
      }`}
    >
      <span className="h-5 w-5">{icon}</span>
      <span>{label}</span>
    </Link>
  )
}
