"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ArrowLeft,
  Mail,
  CheckCircle2,
  XCircle,
  ExternalLink,
  RefreshCw,
  Settings2,
  AlertCircle,
  Loader2,
  Building2,
  Users
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"

interface IntegrationStatus {
  email: {
    microsoft365: { connected: boolean; configured?: boolean; email?: string; lastSync?: string; devMode?: boolean }
    google: { connected: boolean; configured?: boolean; email?: string; lastSync?: string; devMode?: boolean }
  }
  construction?: {
    procore: {
      connected: boolean
      devMode?: boolean
      companyName?: string
      companyId?: number
      pendingCompanySelection?: boolean
      lastSync?: string
      projectCount?: number
      vendorCount?: number
    }
  }
}

export default function IntegrationsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [connectingService, setConnectingService] = useState<string | null>(null)
  const [status, setStatus] = useState<IntegrationStatus>({
    email: {
      microsoft365: { connected: false },
      google: { connected: false }
    },
    construction: {
      procore: { connected: false }
    }
  })

  // Handle OAuth callback query params
  useEffect(() => {
    const success = searchParams.get('success')
    const error = searchParams.get('error')

    if (success === 'microsoft_connected') {
      toast({
        title: "Microsoft 365 Connected",
        description: "Your Microsoft 365 inbox is now connected. Emails with COC attachments will be automatically processed."
      })
      // Clear query params
      router.replace('/dashboard/settings/integrations')
    } else if (success === 'google_connected') {
      toast({
        title: "Google Workspace Connected",
        description: "Your Gmail inbox is now connected. Emails with COC attachments will be automatically processed."
      })
      router.replace('/dashboard/settings/integrations')
    } else if (success === 'procore_connected') {
      toast({
        title: "Procore Connected",
        description: "Your Procore account is now connected. You can sync projects and vendors."
      })
      router.replace('/dashboard/settings/integrations')
    } else if (success === 'procore_company_selected') {
      toast({
        title: "Procore Company Selected",
        description: "Your Procore company has been selected. You can now sync projects and vendors."
      })
      router.replace('/dashboard/settings/integrations')
    } else if (error) {
      const errorMessages: Record<string, string> = {
        oauth_denied: "OAuth authorization was denied. Please try again.",
        invalid_callback: "Invalid OAuth callback. Please try again.",
        invalid_state: "OAuth state validation failed. Please try again.",
        token_exchange_failed: "Failed to exchange OAuth code for tokens. Please try again.",
        profile_failed: "Failed to get user profile. Please try again.",
        callback_failed: "OAuth callback failed. Please try again."
      }
      toast({
        title: "Connection Failed",
        description: errorMessages[error] || "An error occurred during connection. Please try again.",
        variant: "destructive"
      })
      router.replace('/dashboard/settings/integrations')
    }
  }, [searchParams, toast, router])

  useEffect(() => {
    fetchIntegrationStatus()
  }, [])

  const fetchIntegrationStatus = async () => {
    try {
      const response = await fetch("/api/integrations/status")
      if (response.ok) {
        const data = await response.json()
        setStatus(data)
      }
    } catch (error) {
      console.error("Failed to fetch integration status:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleConnectM365 = async () => {
    setConnectingService('microsoft365')
    // Navigate to Microsoft OAuth connect endpoint
    window.location.href = '/api/integrations/microsoft/connect'
  }

  const handleDisconnectM365 = async () => {
    try {
      const response = await fetch('/api/integrations/microsoft/disconnect', { method: 'POST' })
      if (response.ok) {
        toast({
          title: "Microsoft 365 Disconnected",
          description: "Your Microsoft 365 inbox has been disconnected."
        })
        fetchIntegrationStatus()
      } else {
        toast({
          title: "Disconnect Failed",
          description: "Failed to disconnect Microsoft 365. Please try again.",
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Disconnect Failed",
        description: "An error occurred. Please try again.",
        variant: "destructive"
      })
    }
  }

  const handleConnectGoogle = async () => {
    setConnectingService('google')
    // Navigate to Google OAuth connect endpoint
    window.location.href = '/api/integrations/google/connect'
  }

  const handleDisconnectGoogle = async () => {
    try {
      const response = await fetch('/api/integrations/google/disconnect', { method: 'POST' })
      if (response.ok) {
        toast({
          title: "Google Workspace Disconnected",
          description: "Your Gmail inbox has been disconnected."
        })
        fetchIntegrationStatus()
      } else {
        toast({
          title: "Disconnect Failed",
          description: "Failed to disconnect Google Workspace. Please try again.",
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Disconnect Failed",
        description: "An error occurred. Please try again.",
        variant: "destructive"
      })
    }
  }

  const handleConnectProcore = async () => {
    setConnectingService('procore')
    // Navigate to Procore OAuth connect endpoint
    window.location.href = '/api/integrations/procore/connect'
  }

  const handleDisconnectProcore = async () => {
    try {
      const response = await fetch('/api/integrations/procore/disconnect', { method: 'POST' })
      if (response.ok) {
        toast({
          title: "Procore Disconnected",
          description: "Your Procore account has been disconnected."
        })
        fetchIntegrationStatus()
      } else {
        toast({
          title: "Disconnect Failed",
          description: "Failed to disconnect Procore. Please try again.",
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Disconnect Failed",
        description: "An error occurred. Please try again.",
        variant: "destructive"
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <>
      {/* Top Bar */}
      <header className="bg-white border-b px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/dashboard/settings")}
            aria-label="Back to settings"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Integrations</h1>
            <p className="text-slate-500">Connect external services for email and communication</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="p-6 md:p-8 lg:p-12 space-y-8 max-w-4xl">
        {/* Email Integrations */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Mail className="h-5 w-5 text-blue-500" />
            <h2 className="text-lg font-semibold text-slate-900">Email Integration</h2>
          </div>
          <p className="text-sm text-slate-500 mb-4">
            Connect your email inbox to automatically receive and process Certificates of Currency.
          </p>

          <div className="space-y-4">
            {/* Microsoft 365 */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#0078d4] rounded-lg flex items-center justify-center">
                      <svg viewBox="0 0 23 23" className="w-6 h-6" fill="white">
                        <path d="M0 0h11v11H0V0zm12 0h11v11H12V0zM0 12h11v11H0V12zm12 0h11v11H12V12z"/>
                      </svg>
                    </div>
                    <div>
                      <CardTitle className="text-base">Microsoft 365</CardTitle>
                      <CardDescription>Connect Outlook inbox for COC intake</CardDescription>
                    </div>
                  </div>
                  <StatusBadge connected={status.email.microsoft365.connected} />
                </div>
              </CardHeader>
              <CardContent>
                {status.email.microsoft365.connected ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Connected as:</span>
                      <span className="font-medium">{status.email.microsoft365.email}</span>
                    </div>
                    {status.email.microsoft365.devMode && (
                      <div className="flex items-center gap-2 text-sm text-amber-600">
                        <AlertCircle className="h-4 w-4" />
                        Dev mode - inbox scanning simulated
                      </div>
                    )}
                    {status.email.microsoft365.lastSync && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">Last synced:</span>
                        <span>{new Date(status.email.microsoft365.lastSync).toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex gap-2 pt-2">
                      <Button variant="outline" size="sm">
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Sync Now
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        onClick={handleDisconnectM365}
                      >
                        Disconnect
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-slate-500">
                      Allow RiskShield to scan your inbox for Certificate of Currency attachments.
                    </p>
                    {status.email.microsoft365.devMode && (
                      <p className="text-xs text-amber-600">
                        Dev mode: Connection will be simulated without real Microsoft API credentials.
                      </p>
                    )}
                    <Button
                      onClick={handleConnectM365}
                      disabled={connectingService === 'microsoft365'}
                    >
                      {connectingService === 'microsoft365' ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <ExternalLink className="h-4 w-4 mr-2" />
                      )}
                      Connect Microsoft 365
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Google Workspace */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white border rounded-lg flex items-center justify-center">
                      <svg viewBox="0 0 24 24" className="w-6 h-6">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                    </div>
                    <div>
                      <CardTitle className="text-base">Google Workspace</CardTitle>
                      <CardDescription>Connect Gmail inbox for COC intake</CardDescription>
                    </div>
                  </div>
                  <StatusBadge connected={status.email.google.connected} />
                </div>
              </CardHeader>
              <CardContent>
                {status.email.google.connected ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Connected as:</span>
                      <span className="font-medium">{status.email.google.email}</span>
                    </div>
                    {status.email.google.devMode && (
                      <div className="flex items-center gap-2 text-sm text-amber-600">
                        <AlertCircle className="h-4 w-4" />
                        Dev mode - inbox scanning simulated
                      </div>
                    )}
                    {status.email.google.lastSync && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">Last synced:</span>
                        <span>{new Date(status.email.google.lastSync).toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex gap-2 pt-2">
                      <Button variant="outline" size="sm">
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Sync Now
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        onClick={handleDisconnectGoogle}
                      >
                        Disconnect
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-slate-500">
                      Allow RiskShield to scan your Gmail inbox for Certificate of Currency attachments.
                    </p>
                    {status.email.google.devMode && (
                      <p className="text-xs text-amber-600">
                        Dev mode: Connection will be simulated without real Google API credentials.
                      </p>
                    )}
                    <Button
                      onClick={handleConnectGoogle}
                      disabled={connectingService === 'google'}
                    >
                      {connectingService === 'google' ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <ExternalLink className="h-4 w-4 mr-2" />
                      )}
                      Connect Google
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Construction Management */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="h-5 w-5 text-orange-500" />
            <h2 className="text-lg font-semibold text-slate-900">Construction Management</h2>
          </div>
          <p className="text-sm text-slate-500 mb-4">
            Connect construction management platforms to sync projects, vendors, and compliance status.
          </p>

          <div className="space-y-4">
            {/* Procore */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#F47920] rounded-lg flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-base">Procore</CardTitle>
                      <CardDescription>Sync projects and vendors from Procore</CardDescription>
                    </div>
                  </div>
                  <StatusBadge
                    connected={status.construction?.procore.connected || false}
                    pendingSelection={status.construction?.procore.pendingCompanySelection}
                  />
                </div>
              </CardHeader>
              <CardContent>
                {status.construction?.procore.connected ? (
                  <div className="space-y-3">
                    {status.construction.procore.companyName && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">Connected company:</span>
                        <span className="font-medium">{status.construction.procore.companyName}</span>
                      </div>
                    )}
                    {status.construction.procore.devMode && (
                      <div className="flex items-center gap-2 text-sm text-amber-600">
                        <AlertCircle className="h-4 w-4" />
                        Dev mode - using mock data
                      </div>
                    )}
                    {(status.construction.procore.projectCount !== undefined || status.construction.procore.vendorCount !== undefined) && (
                      <div className="flex items-center gap-4 text-sm text-slate-600">
                        {status.construction.procore.projectCount !== undefined && (
                          <span className="flex items-center gap-1">
                            <Building2 className="h-4 w-4" />
                            {status.construction.procore.projectCount} projects synced
                          </span>
                        )}
                        {status.construction.procore.vendorCount !== undefined && (
                          <span className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            {status.construction.procore.vendorCount} vendors synced
                          </span>
                        )}
                      </div>
                    )}
                    {status.construction.procore.lastSync && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">Last synced:</span>
                        <span>{new Date(status.construction.procore.lastSync).toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push('/dashboard/settings/integrations/procore')}
                      >
                        <Settings2 className="h-4 w-4 mr-2" />
                        Manage Sync
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        onClick={handleDisconnectProcore}
                      >
                        Disconnect
                      </Button>
                    </div>
                  </div>
                ) : status.construction?.procore.pendingCompanySelection ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-amber-600">
                      <AlertCircle className="h-4 w-4" />
                      Company selection required
                    </div>
                    <p className="text-sm text-slate-500">
                      Your Procore account has multiple companies. Please select which company to use.
                    </p>
                    <Button
                      onClick={() => router.push('/dashboard/settings/integrations/procore/select-company')}
                    >
                      Select Company
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-slate-500">
                      Connect Procore to automatically sync projects and subcontractors.
                      Compliance status will be pushed back to Procore after verification.
                    </p>
                    {status.construction?.procore.devMode && (
                      <p className="text-xs text-amber-600">
                        Dev mode: Connection will be simulated without real Procore API credentials.
                      </p>
                    )}
                    <Button
                      onClick={handleConnectProcore}
                      disabled={connectingService === 'procore'}
                    >
                      {connectingService === 'procore' ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <ExternalLink className="h-4 w-4 mr-2" />
                      )}
                      Connect Procore
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Help Section */}
        <Card className="bg-slate-50 border-slate-200">
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <div className="shrink-0">
                <Settings2 className="h-5 w-5 text-slate-400" />
              </div>
              <div className="space-y-2">
                <h3 className="font-medium text-slate-900">Need help with integrations?</h3>
                <p className="text-sm text-slate-500">
                  Email integrations use OAuth to securely connect your inbox. Construction management integrations
                  sync your projects and vendors automatically.
                </p>
                <p className="text-sm text-slate-500">
                  For development, connections are simulated without real API credentials.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

function StatusBadge({ connected, verified, pendingSelection }: { connected: boolean; verified?: boolean; pendingSelection?: boolean }) {
  if (pendingSelection) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
        <AlertCircle className="h-3 w-3" />
        Select Company
      </span>
    )
  }

  if (connected && verified === false) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
        <AlertCircle className="h-3 w-3" />
        Needs Verification
      </span>
    )
  }

  if (connected) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
        <CheckCircle2 className="h-3 w-3" />
        Connected
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
      <XCircle className="h-3 w-3" />
      Not Connected
    </span>
  )
}
