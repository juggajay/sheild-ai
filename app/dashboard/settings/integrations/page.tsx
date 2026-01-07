"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  Mail,
  MessageSquare,
  Phone,
  CheckCircle2,
  XCircle,
  ExternalLink,
  RefreshCw,
  Settings2,
  AlertCircle,
  Loader2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"

interface IntegrationStatus {
  email: {
    microsoft365: { connected: boolean; email?: string; lastSync?: string }
    google: { connected: boolean; email?: string; lastSync?: string }
  }
  communication: {
    sendgrid: { configured: boolean; verified?: boolean }
    twilio: { configured: boolean; verified?: boolean }
  }
}

export default function IntegrationsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<IntegrationStatus>({
    email: {
      microsoft365: { connected: false },
      google: { connected: false }
    },
    communication: {
      sendgrid: { configured: false },
      twilio: { configured: false }
    }
  })
  const [testingService, setTestingService] = useState<string | null>(null)

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
    toast({
      title: "Microsoft 365 Integration",
      description: "OAuth integration requires Microsoft Azure app configuration. Please set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET in environment variables.",
      variant: "destructive"
    })
  }

  const handleConnectGoogle = async () => {
    toast({
      title: "Google Integration",
      description: "OAuth integration requires Google Cloud project configuration. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in environment variables.",
      variant: "destructive"
    })
  }

  const handleTestSendGrid = async () => {
    setTestingService("sendgrid")
    try {
      const response = await fetch("/api/integrations/test/sendgrid", { method: "POST" })
      const data = await response.json()

      if (response.ok) {
        toast({
          title: "SendGrid Test Successful",
          description: "A test email was sent successfully."
        })
        fetchIntegrationStatus()
      } else {
        toast({
          title: "SendGrid Test Failed",
          description: data.error || "Please check your SendGrid API key configuration.",
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "SendGrid Test Failed",
        description: "Unable to connect to SendGrid. Please check your API key.",
        variant: "destructive"
      })
    } finally {
      setTestingService(null)
    }
  }

  const handleTestTwilio = async () => {
    setTestingService("twilio")
    try {
      const response = await fetch("/api/integrations/test/twilio", { method: "POST" })
      const data = await response.json()

      if (response.ok) {
        toast({
          title: "Twilio Test Successful",
          description: "A test SMS was sent successfully."
        })
        fetchIntegrationStatus()
      } else {
        toast({
          title: "Twilio Test Failed",
          description: data.error || "Please check your Twilio credentials configuration.",
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Twilio Test Failed",
        description: "Unable to connect to Twilio. Please check your credentials.",
        variant: "destructive"
      })
    } finally {
      setTestingService(null)
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
                      <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                        Disconnect
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-slate-500">
                      Allow RiskShield to scan your inbox for Certificate of Currency attachments.
                    </p>
                    <Button onClick={handleConnectM365}>
                      <ExternalLink className="h-4 w-4 mr-2" />
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
                      <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                        Disconnect
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-slate-500">
                      Allow RiskShield to scan your Gmail inbox for Certificate of Currency attachments.
                    </p>
                    <Button onClick={handleConnectGoogle}>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Connect Google
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Communication Services */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="h-5 w-5 text-green-500" />
            <h2 className="text-lg font-semibold text-slate-900">Communication Services</h2>
          </div>
          <p className="text-sm text-slate-500 mb-4">
            Configure email and SMS services for automated notifications.
          </p>

          <div className="space-y-4">
            {/* SendGrid */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#1A82E2] rounded-lg flex items-center justify-center">
                      <Mail className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-base">SendGrid</CardTitle>
                      <CardDescription>Transactional email delivery</CardDescription>
                    </div>
                  </div>
                  <StatusBadge
                    connected={status.communication.sendgrid.configured}
                    verified={status.communication.sendgrid.verified}
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {status.communication.sendgrid.configured ? (
                    <>
                      <div className="flex items-center gap-2 text-sm text-green-600">
                        <CheckCircle2 className="h-4 w-4" />
                        API key configured
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleTestSendGrid}
                          disabled={testingService === "sendgrid"}
                        >
                          {testingService === "sendgrid" ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Settings2 className="h-4 w-4 mr-2" />
                          )}
                          Test Connection
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 text-sm text-amber-600">
                        <AlertCircle className="h-4 w-4" />
                        Not configured
                      </div>
                      <p className="text-sm text-slate-500">
                        Set <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">SENDGRID_API_KEY</code> in your environment variables.
                      </p>
                      <a
                        href="https://sendgrid.com/docs/for-developers/sending-email/api-getting-started/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-sm text-primary hover:underline"
                      >
                        View SendGrid documentation
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </a>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Twilio */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#F22F46] rounded-lg flex items-center justify-center">
                      <Phone className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-base">Twilio</CardTitle>
                      <CardDescription>SMS alerts and notifications</CardDescription>
                    </div>
                  </div>
                  <StatusBadge
                    connected={status.communication.twilio.configured}
                    verified={status.communication.twilio.verified}
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {status.communication.twilio.configured ? (
                    <>
                      <div className="flex items-center gap-2 text-sm text-green-600">
                        <CheckCircle2 className="h-4 w-4" />
                        Credentials configured
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleTestTwilio}
                          disabled={testingService === "twilio"}
                        >
                          {testingService === "twilio" ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Settings2 className="h-4 w-4 mr-2" />
                          )}
                          Test Connection
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 text-sm text-amber-600">
                        <AlertCircle className="h-4 w-4" />
                        Not configured
                      </div>
                      <p className="text-sm text-slate-500">
                        Set <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">TWILIO_ACCOUNT_SID</code>,
                        <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs ml-1">TWILIO_AUTH_TOKEN</code>, and
                        <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs ml-1">TWILIO_PHONE_NUMBER</code> in your environment variables.
                      </p>
                      <a
                        href="https://www.twilio.com/docs/sms/quickstart"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-sm text-primary hover:underline"
                      >
                        View Twilio documentation
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </a>
                    </>
                  )}
                </div>
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
                  Integrations require API keys and credentials from third-party services.
                  Configure these in your <code className="bg-white px-1.5 py-0.5 rounded text-xs border">.env.local</code> file
                  or your hosting provider's environment variables.
                </p>
                <p className="text-sm text-slate-500">
                  For development, emails are logged to the console instead of being sent via SendGrid.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

function StatusBadge({ connected, verified }: { connected: boolean; verified?: boolean }) {
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
