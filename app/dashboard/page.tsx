"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  FileCheck,
  AlertTriangle,
  Clock,
  CheckCircle,
  Building2,
  FolderKanban,
  Bell,
  ChevronRight,
  ExternalLink,
  FileWarning,
  ShieldAlert,
  Mail,
  RefreshCw
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

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

interface StopWorkRisk {
  id: string
  status: string
  on_site_date: string
  project_id: string
  project_name: string
  subcontractor_id: string
  subcontractor_name: string
  subcontractor_abn: string
  active_exceptions: number
}

interface NewCoc {
  id: string
  file_name: string
  received_at: string
  processing_status: string
  subcontractor_name: string
  project_name: string
  verification_status: string | null
}

interface CocStats {
  total: number
  autoApproved: number
  needsReview: number
}

interface PendingResponse {
  verification_id: string
  verification_status: string
  verification_date: string
  document_id: string
  file_name: string
  subcontractor_id: string
  subcontractor_name: string
  broker_email: string | null
  project_id: string
  project_name: string
  communication_id: string
  last_communication_date: string
  communication_type: string
  days_waiting: number
}

interface MorningBriefData {
  stopWorkRisks: StopWorkRisk[]
  stats: {
    complianceRate: number | null
    activeProjects: number
    pendingReviews: number
    stopWorkCount: number
    pendingResponsesCount: number
    total: number
    compliant: number
    non_compliant: number
    pending: number
    exception: number
  }
  newCocs: NewCoc[]
  cocStats: CocStats
  pendingResponses: PendingResponse[]
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null)
  const [morningBrief, setMorningBrief] = useState<MorningBriefData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [userRes, briefRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch("/api/morning-brief")
      ])

      if (userRes.ok) {
        const userData = await userRes.json()
        setUser(userData.user)
      }

      if (briefRes.ok) {
        const briefData = await briefRes.json()
        setMorningBrief(briefData)
      }
    } catch (error) {
      console.error("Failed to fetch data:", error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading || !user) {
    return null // Layout handles loading state
  }

  const stats = morningBrief?.stats

  return (
    <>
      {/* Top Bar */}
      <header className="bg-white border-b px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Good {getTimeOfDay()}, {user.name.split(" ")[0]}!</h1>
            <p className="text-slate-500">Here&apos;s your compliance overview for today.</p>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm">
              <Bell className="h-4 w-4 mr-2" />
              Notifications
            </Button>
          </div>
        </div>
      </header>

      {/* Dashboard Content */}
      <div className="p-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Compliance Rate"
            value={stats?.complianceRate !== null ? `${stats?.complianceRate}%` : "--"}
            description="Overall portfolio"
            icon={<CheckCircle className="h-5 w-5 text-green-500" />}
            trend={stats?.total ? `${stats.compliant + stats.exception} of ${stats.total} compliant` : "No data yet"}
          />
          <StatCard
            title="Active Projects"
            value={stats?.activeProjects?.toString() || "0"}
            description="With subcontractors"
            icon={<FolderKanban className="h-5 w-5 text-blue-500" />}
          />
          <StatCard
            title="Pending Reviews"
            value={stats?.pendingReviews?.toString() || "0"}
            description="COCs awaiting review"
            icon={<Clock className="h-5 w-5 text-amber-500" />}
          />
          <StatCard
            title="Stop Work Risks"
            value={stats?.stopWorkCount?.toString() || "0"}
            description="Critical issues"
            icon={<AlertTriangle className="h-5 w-5 text-red-500" />}
            highlight={stats?.stopWorkCount ? stats.stopWorkCount > 0 : false}
          />
        </div>

        {/* Quick Start Guide - only show if no projects */}
        {(!stats || stats.activeProjects === 0) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Get Started with RiskShield AI
              </CardTitle>
              <CardDescription>
                Complete these steps to set up your insurance compliance system
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <QuickStartItem
                  step={1}
                  title="Create your first project"
                  description="Add a construction project and configure insurance requirements"
                  completed={false}
                  href="/dashboard/projects/new"
                />
                <QuickStartItem
                  step={2}
                  title="Add subcontractors"
                  description="Import or manually add your subcontractors"
                  completed={false}
                  href="/dashboard/subcontractors"
                />
                <QuickStartItem
                  step={3}
                  title="Upload a Certificate of Currency"
                  description="Upload your first COC and watch AI verification in action"
                  completed={false}
                  href="/dashboard/documents/upload"
                />
                <QuickStartItem
                  step={4}
                  title="Configure notifications"
                  description="Set up automated communications for deficiencies and reminders"
                  completed={false}
                  href="/dashboard/settings/notifications"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Morning Brief Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className={morningBrief?.stopWorkRisks?.length ? "border-red-200 bg-red-50/30" : ""}>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ShieldAlert className={`h-5 w-5 ${morningBrief?.stopWorkRisks?.length ? "text-red-500" : "text-slate-400"}`} />
                Stop Work Risks
              </CardTitle>
              <CardDescription>Subcontractors on-site today with compliance issues</CardDescription>
            </CardHeader>
            <CardContent>
              {morningBrief?.stopWorkRisks?.length ? (
                <div className="space-y-3">
                  {morningBrief.stopWorkRisks.map((risk) => (
                    <StopWorkRiskItem key={risk.id} risk={risk} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <AlertTriangle className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                  <p>No stop work risks</p>
                  <p className="text-sm">All subcontractors are compliant</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">New COCs Received</CardTitle>
                  <CardDescription>Certificates received in the last 24 hours</CardDescription>
                </div>
                {morningBrief?.cocStats && morningBrief.cocStats.total > 0 && (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-slate-100 text-slate-700">
                      {morningBrief.cocStats.total} Total
                    </Badge>
                  </div>
                )}
              </div>
              {/* COC Stats Summary */}
              {morningBrief?.cocStats && morningBrief.cocStats.total > 0 && (
                <div className="flex gap-4 mt-3 pt-3 border-t">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                    <span className="text-sm text-slate-600">
                      <span className="font-medium">{morningBrief.cocStats.autoApproved}</span> Auto-approved
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-amber-500" />
                    <span className="text-sm text-slate-600">
                      <span className="font-medium">{morningBrief.cocStats.needsReview}</span> Needs review
                    </span>
                  </div>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {morningBrief?.newCocs?.length ? (
                <div className="space-y-3">
                  {morningBrief.newCocs.map((coc) => (
                    <NewCocItem key={coc.id} coc={coc} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <FileCheck className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                  <p>No new certificates</p>
                  <p className="text-sm">Upload a COC to get started</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Pending Responses Section */}
        <Card className={morningBrief?.pendingResponses?.length ? "border-amber-200 bg-amber-50/30" : ""}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Mail className={`h-5 w-5 ${morningBrief?.pendingResponses?.length ? "text-amber-500" : "text-slate-400"}`} />
                  Pending Responses
                </CardTitle>
                <CardDescription>Brokers who haven&apos;t responded to deficiency notices</CardDescription>
              </div>
              {morningBrief?.pendingResponses && morningBrief.pendingResponses.length > 0 && (
                <Badge variant="outline" className="bg-amber-100 text-amber-700">
                  {morningBrief.pendingResponses.length} Waiting
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {morningBrief?.pendingResponses?.length ? (
              <div className="space-y-3">
                {morningBrief.pendingResponses.map((response) => (
                  <PendingResponseItem key={response.verification_id} response={response} />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <Mail className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                <p>No pending responses</p>
                <p className="text-sm">All communications have been addressed</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}

function StopWorkRiskItem({ risk }: { risk: StopWorkRisk }) {
  const severityColor = risk.status === 'non_compliant' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
  const severityLabel = risk.status === 'non_compliant' ? 'Non-Compliant' : 'Pending'

  return (
    <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-red-200 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-red-100 rounded-lg">
          <FileWarning className="h-4 w-4 text-red-600" />
        </div>
        <div>
          <p className="font-medium text-slate-900">{risk.subcontractor_name}</p>
          <p className="text-sm text-slate-500">{risk.project_name}</p>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className={severityColor}>
              {severityLabel}
            </Badge>
            {risk.active_exceptions > 0 && (
              <Badge variant="outline" className="bg-amber-100 text-amber-700">
                {risk.active_exceptions} Exception{risk.active_exceptions > 1 ? 's' : ''}
              </Badge>
            )}
            <span className="text-xs text-slate-400">
              On-site: {new Date(risk.on_site_date).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Link href={`/dashboard/subcontractors?id=${risk.subcontractor_id}`}>
          <Button variant="outline" size="sm">
            <ExternalLink className="h-4 w-4 mr-1" />
            View
          </Button>
        </Link>
        <Link href={`/dashboard/exceptions?new=true&ps=${risk.id}`}>
          <Button variant="destructive" size="sm">
            Create Exception
          </Button>
        </Link>
      </div>
    </div>
  )
}

function NewCocItem({ coc }: { coc: NewCoc }) {
  const statusColor = coc.verification_status === 'pass'
    ? 'bg-green-100 text-green-700'
    : coc.verification_status === 'fail'
    ? 'bg-red-100 text-red-700'
    : 'bg-amber-100 text-amber-700'

  const statusLabel = coc.verification_status === 'pass'
    ? 'Passed'
    : coc.verification_status === 'fail'
    ? 'Failed'
    : 'Pending'

  return (
    <Link
      href={`/dashboard/documents/${coc.id}`}
      className="flex items-center justify-between p-3 rounded-lg border hover:border-primary hover:bg-slate-50 transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className="p-2 bg-slate-100 rounded-lg">
          <FileCheck className="h-4 w-4 text-slate-600" />
        </div>
        <div>
          <p className="font-medium text-slate-900 truncate max-w-[200px]">{coc.file_name}</p>
          <p className="text-sm text-slate-500">{coc.subcontractor_name} • {coc.project_name}</p>
        </div>
      </div>
      <Badge variant="outline" className={statusColor}>
        {statusLabel}
      </Badge>
    </Link>
  )
}

function PendingResponseItem({ response }: { response: PendingResponse }) {
  const urgencyColor = response.days_waiting >= 7
    ? 'bg-red-100 text-red-700'
    : response.days_waiting >= 3
    ? 'bg-amber-100 text-amber-700'
    : 'bg-slate-100 text-slate-700'

  const handleResend = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    try {
      const res = await fetch('/api/communications/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verificationId: response.verification_id,
          subcontractorId: response.subcontractor_id,
          projectId: response.project_id
        })
      })

      if (res.ok) {
        alert('Follow-up notification sent successfully')
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to send notification')
      }
    } catch {
      alert('Failed to send notification')
    }
  }

  return (
    <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-amber-200 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-amber-100 rounded-lg">
          <Clock className="h-4 w-4 text-amber-600" />
        </div>
        <div>
          <p className="font-medium text-slate-900">{response.subcontractor_name}</p>
          <p className="text-sm text-slate-500">{response.project_name}</p>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className={urgencyColor}>
              {response.days_waiting} day{response.days_waiting !== 1 ? 's' : ''} waiting
            </Badge>
            {response.broker_email && (
              <span className="text-xs text-slate-400">{response.broker_email}</span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Link href={`/dashboard/documents/${response.document_id}`}>
          <Button variant="outline" size="sm">
            <ExternalLink className="h-4 w-4 mr-1" />
            View
          </Button>
        </Link>
        <Button variant="default" size="sm" onClick={handleResend}>
          <RefreshCw className="h-4 w-4 mr-1" />
          Resend
        </Button>
      </div>
    </div>
  )
}

function StatCard({
  title,
  value,
  description,
  icon,
  trend,
  highlight
}: {
  title: string
  value: string
  description: string
  icon: React.ReactNode
  trend?: string
  highlight?: boolean
}) {
  return (
    <Card className={highlight ? "border-red-200 bg-red-50" : ""}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">{title}</p>
            <p className={`text-3xl font-bold mt-1 ${highlight ? "text-red-600" : ""}`}>{value}</p>
            <p className="text-sm text-slate-500 mt-1">{description}</p>
            {trend && (
              <p className="text-xs text-slate-400 mt-2">{trend}</p>
            )}
          </div>
          <div className={`p-2 rounded-lg ${highlight ? "bg-red-100" : "bg-slate-100"}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function QuickStartItem({
  step,
  title,
  description,
  completed,
  href
}: {
  step: number
  title: string
  description: string
  completed: boolean
  href: string
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 p-4 rounded-lg border hover:border-primary hover:bg-slate-50 transition-colors group"
    >
      <div className={`
        h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium
        ${completed
          ? "bg-green-100 text-green-600"
          : "bg-slate-100 text-slate-600 group-hover:bg-primary group-hover:text-white"
        }
      `}>
        {completed ? <CheckCircle className="h-5 w-5" /> : step}
      </div>
      <div className="flex-1">
        <p className="font-medium text-slate-900">{title}</p>
        <p className="text-sm text-slate-500">{description}</p>
      </div>
      <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-primary" />
    </Link>
  )
}

function getTimeOfDay() {
  const hour = new Date().getHours()
  if (hour < 12) return "morning"
  if (hour < 17) return "afternoon"
  return "evening"
}
