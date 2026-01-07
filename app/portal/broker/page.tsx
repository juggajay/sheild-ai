"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  Shield, Loader2, Upload, Users, Building2, CheckCircle, XCircle, Clock, LogOut,
  AlertTriangle, ChevronRight, FileCheck, Phone, Mail, User, FileUp
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"

interface UserData {
  id: string
  email: string
  name: string
  role: string
}

interface ClientProject {
  id: string
  name: string
  status: string
  complianceStatus: string
}

interface Client {
  id: string
  name: string
  abn: string
  tradingName: string | null
  trade: string | null
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
  builderId: string
  builderName: string
  projects: ClientProject[]
  summary: {
    totalProjects: number
    compliant: number
    nonCompliant: number
    pending: number
    exception: number
  }
  latestCoc: {
    id: string
    fileName: string | null
    createdAt: string
    status: string | null
  } | null
  overallStatus: string
}

interface ClientsSummary {
  totalClients: number
  compliant: number
  nonCompliant: number
  pending: number
  actionRequired: number
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  compliant: { bg: 'bg-green-100', text: 'text-green-700', label: 'Compliant' },
  non_compliant: { bg: 'bg-red-100', text: 'text-red-700', label: 'Non-Compliant' },
  pending: { bg: 'bg-slate-100', text: 'text-slate-700', label: 'Pending' },
  exception: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Exception' },
  no_projects: { bg: 'bg-slate-100', text: 'text-slate-700', label: 'No Projects' }
}

export default function BrokerPortalPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [user, setUser] = useState<UserData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [clients, setClients] = useState<Client[]>([])
  const [summary, setSummary] = useState<ClientsSummary>({
    totalClients: 0,
    compliant: 0,
    nonCompliant: 0,
    pending: 0,
    actionRequired: 0
  })
  const [expandedClient, setExpandedClient] = useState<string | null>(null)
  const [selectedClientForUpload, setSelectedClientForUpload] = useState<Client | null>(null)

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

        // Fetch broker clients
        const clientsResponse = await fetch("/api/portal/broker/clients")
        if (clientsResponse.ok) {
          const clientsData = await clientsResponse.json()
          setClients(clientsData.clients)
          setSummary(clientsData.summary)
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
              <span className="text-sm text-slate-500 ml-2">Broker Portal</span>
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
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Broker Dashboard</h1>
            <p className="text-slate-600">Manage insurance compliance for all your client subcontractors.</p>
          </div>
          {clients.length > 0 && (
            <Link href="/portal/broker/bulk-upload">
              <Button>
                <FileUp className="h-4 w-4 mr-2" />
                Bulk Upload
              </Button>
            </Link>
          )}
        </div>

        {/* Status Overview */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
              <Users className="h-5 w-5 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalClients}</div>
              <p className="text-xs text-slate-500">Subcontractor clients</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Compliant</CardTitle>
              <CheckCircle className="h-5 w-5 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.compliant}</div>
              <p className="text-xs text-slate-500">Fully compliant clients</p>
            </CardContent>
          </Card>

          <Card className={summary.actionRequired > 0 ? 'border-red-200 bg-red-50' : ''}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Action Required</CardTitle>
              <XCircle className="h-5 w-5 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.actionRequired}</div>
              <p className="text-xs text-slate-500">Need attention</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-5 w-5 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.pending}</div>
              <p className="text-xs text-slate-500">Awaiting verification</p>
            </CardContent>
          </Card>
        </div>

        {/* Client List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Client Subcontractors
              {clients.length > 0 && (
                <span className="text-sm font-normal text-slate-500">({clients.length})</span>
              )}
            </CardTitle>
            <CardDescription>
              Manage certificates for your client subcontractors
            </CardDescription>
          </CardHeader>
          <CardContent>
            {clients.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No client subcontractors found</p>
                <p className="text-sm">Clients will appear here when builders assign you as their broker.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {clients.map(client => {
                  const statusStyle = STATUS_STYLES[client.overallStatus] || STATUS_STYLES.pending
                  const isExpanded = expandedClient === client.id

                  return (
                    <div key={client.id} className="border rounded-lg overflow-hidden">
                      {/* Client Header */}
                      <div
                        className="p-4 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors flex items-center justify-between"
                        onClick={() => setExpandedClient(isExpanded ? null : client.id)}
                      >
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center">
                            <Building2 className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-slate-900">{client.name}</h3>
                            <p className="text-sm text-slate-500">
                              {client.builderName} • {client.summary.totalProjects} project{client.summary.totalProjects !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {client.overallStatus === 'non_compliant' && (
                            <div className="flex items-center gap-1 text-red-600 bg-red-100 px-2 py-1 rounded-full text-xs font-medium">
                              <AlertTriangle className="h-3 w-3" />
                              Action Required
                            </div>
                          )}
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                            {statusStyle.label}
                          </span>
                          <ChevronRight className={`h-5 w-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                        </div>
                      </div>

                      {/* Expanded Content */}
                      {isExpanded && (
                        <div className="border-t">
                          {/* Client Details */}
                          <div className="p-4 bg-white border-b">
                            <div className="grid md:grid-cols-3 gap-4">
                              <div>
                                <span className="text-sm text-slate-500">ABN</span>
                                <p className="font-medium">{client.abn}</p>
                              </div>
                              {client.trade && (
                                <div>
                                  <span className="text-sm text-slate-500">Trade</span>
                                  <p className="font-medium">{client.trade}</p>
                                </div>
                              )}
                              {client.contactName && (
                                <div>
                                  <span className="text-sm text-slate-500">Contact</span>
                                  <p className="font-medium flex items-center gap-2">
                                    <User className="h-4 w-4 text-slate-400" />
                                    {client.contactName}
                                  </p>
                                </div>
                              )}
                              {client.contactEmail && (
                                <div>
                                  <span className="text-sm text-slate-500">Email</span>
                                  <p className="font-medium flex items-center gap-2">
                                    <Mail className="h-4 w-4 text-slate-400" />
                                    {client.contactEmail}
                                  </p>
                                </div>
                              )}
                              {client.contactPhone && (
                                <div>
                                  <span className="text-sm text-slate-500">Phone</span>
                                  <p className="font-medium flex items-center gap-2">
                                    <Phone className="h-4 w-4 text-slate-400" />
                                    {client.contactPhone}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Summary Stats */}
                          <div className="grid grid-cols-4 gap-4 p-4 bg-white border-b">
                            <div className="text-center">
                              <div className="text-lg font-bold text-green-600">{client.summary.compliant}</div>
                              <div className="text-xs text-slate-500">Compliant</div>
                            </div>
                            <div className="text-center">
                              <div className="text-lg font-bold text-red-600">{client.summary.nonCompliant}</div>
                              <div className="text-xs text-slate-500">Non-Compliant</div>
                            </div>
                            <div className="text-center">
                              <div className="text-lg font-bold text-amber-600">{client.summary.pending}</div>
                              <div className="text-xs text-slate-500">Pending</div>
                            </div>
                            <div className="text-center">
                              <div className="text-lg font-bold text-purple-600">{client.summary.exception}</div>
                              <div className="text-xs text-slate-500">Exception</div>
                            </div>
                          </div>

                          {/* Projects List */}
                          <div className="p-4">
                            <h4 className="text-sm font-semibold text-slate-700 mb-3">Projects</h4>
                            {client.projects.length === 0 ? (
                              <p className="text-sm text-slate-500">No projects assigned yet</p>
                            ) : (
                              <div className="space-y-2">
                                {client.projects.map(project => {
                                  const projectStatusStyle = STATUS_STYLES[project.complianceStatus] || STATUS_STYLES.pending
                                  return (
                                    <div key={project.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                                      <div className="font-medium text-slate-900">{project.name}</div>
                                      <div className="flex items-center gap-2">
                                        <span className={`px-2 py-1 rounded text-xs font-medium ${projectStatusStyle.bg} ${projectStatusStyle.text}`}>
                                          {projectStatusStyle.label}
                                        </span>
                                        <Link href={`/portal/upload?subcontractor=${client.id}&project=${project.id}`}>
                                          <Button size="sm" variant="outline">
                                            <Upload className="h-3 w-3 mr-1" />
                                            Upload COC
                                          </Button>
                                        </Link>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>

                          {/* Latest COC */}
                          {client.latestCoc && (
                            <div className="p-4 border-t bg-slate-50">
                              <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                                <FileCheck className="h-4 w-4" />
                                Latest Certificate
                              </h4>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-600">{client.latestCoc.fileName || 'Certificate'}</span>
                                <span className="text-slate-500">
                                  {new Date(client.latestCoc.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          )}
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
