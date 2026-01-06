"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Shield, Loader2, Upload, FileCheck, Building2, CheckCircle, XCircle, Clock, LogOut, AlertTriangle, ChevronRight, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"

interface User {
  id: string
  email: string
  name: string
  role: string
}

interface BuilderProject {
  id: string
  name: string
  status: string
  complianceStatus: string
  onSiteDate: string | null
  deficiencyCount: number
}

interface OutstandingRequest {
  id: string
  type: string
  subject: string | null
  sentAt: string | null
  projectName: string | null
}

interface Builder {
  id: string
  name: string
  subcontractorId: string
  projects: BuilderProject[]
  summary: {
    totalProjects: number
    compliant: number
    nonCompliant: number
    pending: number
    deficiencies: number
    expiringSoon: number
  }
  outstandingRequests: OutstandingRequest[]
  overallStatus: 'compliant' | 'action_required' | 'pending' | 'no_projects'
}

interface BuildersSummary {
  totalBuilders: number
  compliant: number
  actionRequired: number
  expiringSoon: number
}

const STATUS_STYLES = {
  compliant: { bg: 'bg-green-100', text: 'text-green-700', label: 'Compliant' },
  action_required: { bg: 'bg-red-100', text: 'text-red-700', label: 'Action Required' },
  pending: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Pending' },
  no_projects: { bg: 'bg-slate-100', text: 'text-slate-700', label: 'No Projects' }
}

const COMPLIANCE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  compliant: { bg: 'bg-green-100', text: 'text-green-700', label: 'Compliant' },
  non_compliant: { bg: 'bg-red-100', text: 'text-red-700', label: 'Non-Compliant' },
  pending: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Pending' },
  exception: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Exception' }
}

export default function PortalDashboardPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [builders, setBuilders] = useState<Builder[]>([])
  const [summary, setSummary] = useState<BuildersSummary>({
    totalBuilders: 0,
    compliant: 0,
    actionRequired: 0,
    expiringSoon: 0
  })
  const [expandedBuilder, setExpandedBuilder] = useState<string | null>(null)

  useEffect(() => {
    async function checkAuth() {
      try {
        const response = await fetch("/api/auth/me")
        if (!response.ok) {
          router.push("/portal/login")
          return
        }

        const data = await response.json()
        setUser(data.user)

        // Fetch builder relationships
        const buildersResponse = await fetch("/api/portal/builders")
        if (buildersResponse.ok) {
          const buildersData = await buildersResponse.json()
          setBuilders(buildersData.builders)
          setSummary(buildersData.summary)
        }
      } catch (error) {
        router.push("/portal/login")
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [router])

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
      toast({
        title: "Logged out",
        description: "You have been logged out successfully.",
      })
      router.push("/portal/login")
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to log out. Please try again.",
        variant: "destructive"
      })
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            <div>
              <span className="text-lg font-semibold">RiskShield AI</span>
              <span className="text-sm text-slate-500 ml-2">Subcontractor Portal</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-600">{user?.email}</span>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Welcome, {user?.name || "Portal User"}!</h1>
          <p className="text-slate-600">Manage your insurance compliance across all your builder relationships.</p>
        </div>

        {/* Status Overview */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Compliant</CardTitle>
              <CheckCircle className="h-5 w-5 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.compliant}</div>
              <p className="text-xs text-slate-500">Builder relationships</p>
            </CardContent>
          </Card>

          <Card className={summary.actionRequired > 0 ? 'border-red-200 bg-red-50' : ''}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Action Required</CardTitle>
              <XCircle className="h-5 w-5 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.actionRequired}</div>
              <p className="text-xs text-slate-500">Deficiencies to address</p>
            </CardContent>
          </Card>

          <Card className={summary.expiringSoon > 0 ? 'border-amber-200 bg-amber-50' : ''}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
              <Clock className="h-5 w-5 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.expiringSoon}</div>
              <p className="text-xs text-slate-500">Certificates expiring in 30 days</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-primary" />
                Upload Certificate
              </CardTitle>
              <CardDescription>
                Upload a new Certificate of Currency for instant verification
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full">
                Upload COC
              </Button>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-primary" />
                View Certificates
              </CardTitle>
              <CardDescription>
                View all your uploaded certificates and their verification status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full">
                View History
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Builder Relationships */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Builder Relationships
              {builders.length > 0 && (
                <span className="text-sm font-normal text-slate-500">({builders.length})</span>
              )}
            </CardTitle>
            <CardDescription>
              Your compliance status with each head contractor
            </CardDescription>
          </CardHeader>
          <CardContent>
            {builders.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No builder relationships yet</p>
                <p className="text-sm">You&apos;ll see your compliance status here once a builder adds you to their system.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {builders.map(builder => {
                  const statusStyle = STATUS_STYLES[builder.overallStatus]
                  const isExpanded = expandedBuilder === builder.id

                  return (
                    <div key={builder.id} className="border rounded-lg overflow-hidden">
                      {/* Builder Header */}
                      <div
                        className="p-4 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors flex items-center justify-between"
                        onClick={() => setExpandedBuilder(isExpanded ? null : builder.id)}
                      >
                        <div className="flex items-center gap-4">
                          <Building2 className="h-6 w-6 text-slate-400" />
                          <div>
                            <h3 className="font-semibold text-slate-900">{builder.name}</h3>
                            <p className="text-sm text-slate-500">
                              {builder.summary.totalProjects} project{builder.summary.totalProjects !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {/* Outstanding Requests Indicator */}
                          {builder.outstandingRequests.length > 0 && (
                            <div className="flex items-center gap-1 text-red-600 bg-red-100 px-2 py-1 rounded-full text-xs font-medium">
                              <AlertTriangle className="h-3 w-3" />
                              {builder.outstandingRequests.length} Outstanding
                            </div>
                          )}
                          {/* Status Badge */}
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                            {statusStyle.label}
                          </span>
                          <ChevronRight className={`h-5 w-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                        </div>
                      </div>

                      {/* Expanded Content */}
                      {isExpanded && (
                        <div className="border-t">
                          {/* Summary Stats */}
                          <div className="grid grid-cols-4 gap-4 p-4 bg-white border-b">
                            <div className="text-center">
                              <div className="text-lg font-bold text-green-600">{builder.summary.compliant}</div>
                              <div className="text-xs text-slate-500">Compliant</div>
                            </div>
                            <div className="text-center">
                              <div className="text-lg font-bold text-red-600">{builder.summary.nonCompliant}</div>
                              <div className="text-xs text-slate-500">Non-Compliant</div>
                            </div>
                            <div className="text-center">
                              <div className="text-lg font-bold text-amber-600">{builder.summary.pending}</div>
                              <div className="text-xs text-slate-500">Pending</div>
                            </div>
                            <div className="text-center">
                              <div className="text-lg font-bold text-purple-600">{builder.summary.deficiencies}</div>
                              <div className="text-xs text-slate-500">Deficiencies</div>
                            </div>
                          </div>

                          {/* Outstanding Requests */}
                          {builder.outstandingRequests.length > 0 && (
                            <div className="p-4 bg-red-50 border-b">
                              <h4 className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4" />
                                Outstanding Requests
                              </h4>
                              <div className="space-y-2">
                                {builder.outstandingRequests.map(request => (
                                  <div key={request.id} className="flex items-center gap-2 text-sm bg-white p-2 rounded border border-red-200">
                                    <Mail className="h-4 w-4 text-red-500" />
                                    <div className="flex-1">
                                      <span className="font-medium">{request.projectName}</span>
                                      {request.subject && (
                                        <span className="text-slate-500"> - {request.subject}</span>
                                      )}
                                    </div>
                                    {request.sentAt && (
                                      <span className="text-xs text-slate-500">
                                        {new Date(request.sentAt).toLocaleDateString()}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Projects List */}
                          <div className="p-4">
                            <h4 className="text-sm font-semibold text-slate-700 mb-3">Projects</h4>
                            {builder.projects.length === 0 ? (
                              <p className="text-sm text-slate-500">No projects assigned yet</p>
                            ) : (
                              <div className="space-y-2">
                                {builder.projects.map(project => {
                                  const complianceStyle = COMPLIANCE_STYLES[project.complianceStatus] || COMPLIANCE_STYLES.pending
                                  return (
                                    <div key={project.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                                      <div className="flex items-center gap-3">
                                        <div>
                                          <div className="font-medium text-slate-900">{project.name}</div>
                                          {project.onSiteDate && (
                                            <div className="text-xs text-slate-500">
                                              On site: {new Date(project.onSiteDate).toLocaleDateString()}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        {project.deficiencyCount > 0 && (
                                          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">
                                            {project.deficiencyCount} issue{project.deficiencyCount !== 1 ? 's' : ''}
                                          </span>
                                        )}
                                        <span className={`px-2 py-1 rounded text-xs font-medium ${complianceStyle.bg} ${complianceStyle.text}`}>
                                          {complianceStyle.label}
                                        </span>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
