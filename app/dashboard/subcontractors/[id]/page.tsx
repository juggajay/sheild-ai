"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  Building2,
  MapPin,
  Phone,
  Mail,
  Users,
  Briefcase,
  FileCheck,
  CheckCircle,
  AlertTriangle,
  Clock,
  FileText,
  Calendar,
  Shield,
  ExternalLink,
  Download,
  Eye,
  MessageSquare,
  Send,
  CheckCheck,
  MailOpen,
  X,
  ChevronRight,
  Home,
  AlertCircle,
  ShieldAlert,
  ShieldCheck,
  XCircle,
  Trash2,
  Loader2
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"

interface Subcontractor {
  id: string
  name: string
  abn: string
  acn: string | null
  tradingName: string | null
  address: string | null
  trade: string | null
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
  brokerName: string | null
  brokerEmail: string | null
  brokerPhone: string | null
  workersCompState: string | null
  portalAccess: boolean
  projectCount: number
  createdAt: string
  updatedAt: string
}

interface Project {
  id: string
  name: string
  project_status: string
  compliance_status: string
  on_site_date: string | null
}

interface ExtractedData {
  insurer?: string
  policyNumber?: string
  publicLiability?: number
  workersComp?: number
  professionalIndemnity?: number
  expiryDate?: string
  effectiveDate?: string
  [key: string]: string | number | undefined
}

interface Check {
  name: string
  status: 'pass' | 'fail' | 'review'
  message: string
}

interface Deficiency {
  check_name: string
  message: string
}

interface Verification {
  id: string
  status: string
  confidenceScore: number | null
  extractedData: ExtractedData
  checks: Check[]
  deficiencies: Deficiency[]
  verifiedAt: string | null
}

interface COCDocument {
  id: string
  projectId: string
  projectName: string | null
  fileUrl: string
  fileName: string | null
  fileSize: number | null
  source: string
  sourceEmail: string | null
  receivedAt: string | null
  processedAt: string | null
  processingStatus: string
  createdAt: string
  verification: Verification | null
}

interface Communication {
  id: string
  projectId: string
  projectName: string | null
  verificationId: string | null
  type: string
  channel: string
  recipientEmail: string | null
  ccEmails: string[]
  subject: string | null
  body: string | null
  status: string
  sentAt: string | null
  deliveredAt: string | null
  openedAt: string | null
  createdAt: string
}

interface Exception {
  id: string
  projectSubcontractorId: string
  verificationId: string | null
  issueSummary: string
  reason: string
  riskLevel: string
  createdByUserId: string
  createdByName: string
  approvedByUserId: string | null
  approvedByName: string | null
  approvedAt: string | null
  expiresAt: string | null
  expirationType: string
  status: string
  resolvedAt: string | null
  resolutionType: string | null
  resolutionNotes: string | null
  supportingDocumentUrl: string | null
  projectId: string
  projectName: string
  createdAt: string
  updatedAt: string
}

const COMMUNICATION_TYPE_LABELS: Record<string, string> = {
  deficiency: 'Deficiency Notice',
  follow_up: 'Follow-up',
  confirmation: 'Confirmation',
  expiration_reminder: 'Expiration Reminder',
  critical_alert: 'Critical Alert'
}

const COMMUNICATION_STATUS_STYLES: Record<string, { bg: string; text: string; label: string; icon: typeof Send }> = {
  pending: { bg: 'bg-slate-100', text: 'text-slate-700', label: 'Pending', icon: Clock },
  sent: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Sent', icon: Send },
  delivered: { bg: 'bg-green-100', text: 'text-green-700', label: 'Delivered', icon: CheckCheck },
  opened: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Opened', icon: MailOpen },
  failed: { bg: 'bg-red-100', text: 'text-red-700', label: 'Failed', icon: AlertTriangle }
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  compliant: { bg: 'bg-green-100', text: 'text-green-700', label: 'Compliant' },
  non_compliant: { bg: 'bg-red-100', text: 'text-red-700', label: 'Non-Compliant' },
  pending: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Pending' },
  exception: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Exception' }
}

const VERIFICATION_STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  pass: { bg: 'bg-green-100', text: 'text-green-700', label: 'Passed' },
  fail: { bg: 'bg-red-100', text: 'text-red-700', label: 'Failed' },
  review: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Needs Review' }
}

const EXCEPTION_STATUS_STYLES: Record<string, { bg: string; text: string; label: string; icon: typeof AlertCircle }> = {
  pending_approval: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Pending Approval', icon: Clock },
  active: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Active', icon: ShieldAlert },
  expired: { bg: 'bg-slate-100', text: 'text-slate-700', label: 'Expired', icon: XCircle },
  resolved: { bg: 'bg-green-100', text: 'text-green-700', label: 'Resolved', icon: ShieldCheck },
  closed: { bg: 'bg-slate-100', text: 'text-slate-700', label: 'Closed', icon: XCircle },
  rejected: { bg: 'bg-red-100', text: 'text-red-700', label: 'Rejected', icon: XCircle }
}

const RISK_LEVEL_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  low: { bg: 'bg-green-100', text: 'text-green-700', label: 'Low' },
  medium: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Medium' },
  high: { bg: 'bg-red-100', text: 'text-red-700', label: 'High' }
}

const EXPIRATION_TYPE_LABELS: Record<string, string> = {
  until_resolved: 'Until Resolved',
  fixed_duration: 'Fixed Duration',
  specific_date: 'Specific Date',
  permanent: 'Permanent'
}

export default function SubcontractorDetailPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { toast } = useToast()
  const fromProjectId = searchParams.get('fromProject')
  const projectName = searchParams.get('projectName')
  const tabFromUrl = searchParams.get('tab')
  const [subcontractor, setSubcontractor] = useState<Subcontractor | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [cocDocuments, setCocDocuments] = useState<COCDocument[]>([])
  const [currentCoc, setCurrentCoc] = useState<COCDocument | null>(null)
  const [communications, setCommunications] = useState<Communication[]>([])
  const [exceptions, setExceptions] = useState<Exception[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [activeTab, setActiveTab] = useState<'insurance' | 'communications' | 'exceptions'>(
    tabFromUrl === 'communications' ? 'communications' : tabFromUrl === 'exceptions' ? 'exceptions' : 'insurance'
  )
  const [selectedCommunication, setSelectedCommunication] = useState<Communication | null>(null)
  const [selectedException, setSelectedException] = useState<Exception | null>(null)

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Update URL when tab changes
  const handleTabChange = useCallback((tab: 'insurance' | 'communications' | 'exceptions') => {
    setActiveTab(tab)
    const newSearchParams = new URLSearchParams(searchParams.toString())
    if (tab === 'insurance') {
      newSearchParams.delete('tab')
    } else {
      newSearchParams.set('tab', tab)
    }
    const queryString = newSearchParams.toString()
    router.replace(`/dashboard/subcontractors/${params.id}${queryString ? `?${queryString}` : ''}`, { scroll: false })
  }, [searchParams, params.id, router])

  useEffect(() => {
    fetchSubcontractor()
  }, [params.id])

  const fetchSubcontractor = async () => {
    try {
      const response = await fetch(`/api/subcontractors/${params.id}`)

      if (response.status === 404) {
        setNotFound(true)
        return
      }

      if (response.ok) {
        const data = await response.json()
        setSubcontractor(data.subcontractor)
        setProjects(data.projects || [])
        setCocDocuments(data.cocDocuments || [])
        setCurrentCoc(data.currentCoc || null)
        setCommunications(data.communications || [])
        setExceptions(data.exceptions || [])
      }
    } catch (error) {
      console.error('Failed to fetch subcontractor:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const handleDeleteSubcontractor = async () => {
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/subcontractors/${params.id}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete subcontractor')
      }

      toast({
        title: "Subcontractor Deleted",
        description: "The subcontractor has been deleted successfully"
      })

      // Redirect to subcontractors list
      router.push('/dashboard/subcontractors')
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to delete subcontractor',
        variant: "destructive"
      })
    } finally {
      setIsDeleting(false)
      setShowDeleteModal(false)
    }
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-1/4"></div>
          <div className="h-40 bg-slate-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 rounded-full flex items-center justify-center">
            <Building2 className="h-8 w-8 text-slate-400" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-900 mb-2">Subcontractor Not Found</h1>
          <p className="text-slate-600 mb-6">
            The subcontractor you&apos;re looking for doesn&apos;t exist or has been removed.
          </p>
          <Link href="/dashboard/subcontractors">
            <Button>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Subcontractors
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  if (!subcontractor) {
    return null
  }

  // Determine back link - go to project if came from project, otherwise go to subcontractors list
  const backLink = fromProjectId
    ? `/dashboard/projects/${fromProjectId}`
    : '/dashboard/subcontractors'

  return (
    <>
      {/* Top Bar */}
      <header className="bg-white border-b px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href={backLink}>
              <Button variant="ghost" size="sm" aria-label="Go back">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              </Button>
            </Link>
            <div>
              {/* Breadcrumb Navigation */}
              {fromProjectId && projectName && (
                <nav className="flex items-center gap-1 text-sm text-slate-500 mb-1">
                  <Link href="/dashboard/projects" className="hover:text-primary transition-colors">
                    Projects
                  </Link>
                  <ChevronRight className="h-4 w-4" />
                  <Link href={`/dashboard/projects/${fromProjectId}`} className="hover:text-primary transition-colors">
                    {decodeURIComponent(projectName)}
                  </Link>
                  <ChevronRight className="h-4 w-4" />
                  <span className="text-slate-700 font-medium">Subcontractor</span>
                </nav>
              )}
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold text-slate-900">{subcontractor.name}</h1>
                {subcontractor.trade && (
                  <span className="px-2 py-1 text-xs font-medium bg-slate-100 text-slate-700 rounded-full">
                    {subcontractor.trade}
                  </span>
                )}
              </div>
              {subcontractor.tradingName && subcontractor.tradingName !== subcontractor.name && (
                <p className="text-slate-500">Trading as: {subcontractor.tradingName}</p>
              )}
            </div>
          </div>
          {/* Delete button - only show if not assigned to any projects */}
          {subcontractor.projectCount === 0 && (
            <Button
              variant="destructive"
              onClick={() => setShowDeleteModal(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          )}
        </div>
      </header>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Tabs */}
        <div className="border-b">
          <nav className="flex gap-4">
            <button
              onClick={() => handleTabChange('insurance')}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'insurance'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Shield className="h-4 w-4 inline-block mr-2" />
              Insurance & COCs
            </button>
            <button
              onClick={() => handleTabChange('communications')}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'communications'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <MessageSquare className="h-4 w-4 inline-block mr-2" />
              Communications
              {communications.length > 0 && (
                <span className="ml-2 bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs">
                  {communications.length}
                </span>
              )}
            </button>
            <button
              onClick={() => handleTabChange('exceptions')}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'exceptions'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <AlertCircle className="h-4 w-4 inline-block mr-2" />
              Exceptions
              {exceptions.length > 0 && (
                <span className="ml-2 bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs">
                  {exceptions.length}
                </span>
              )}
            </button>
          </nav>
        </div>

        {activeTab === 'insurance' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Current COC / Compliance Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  Current Insurance Status
                </CardTitle>
                <CardDescription>Latest Certificate of Currency verification</CardDescription>
              </CardHeader>
              <CardContent>
                {currentCoc && currentCoc.verification ? (
                  <div className="space-y-4">
                    {/* Verification Status */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-500">Verification Status</span>
                      <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                        VERIFICATION_STATUS_STYLES[currentCoc.verification.status]?.bg || 'bg-slate-100'
                      } ${VERIFICATION_STATUS_STYLES[currentCoc.verification.status]?.text || 'text-slate-700'}`}>
                        {VERIFICATION_STATUS_STYLES[currentCoc.verification.status]?.label || currentCoc.verification.status}
                      </span>
                    </div>

                    {/* Confidence Score */}
                    {currentCoc.verification.confidenceScore !== null && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-500">Confidence Score</span>
                        <span className="font-medium">{Math.round(currentCoc.verification.confidenceScore)}%</span>
                      </div>
                    )}

                    {/* Extracted Data Summary */}
                    {currentCoc.verification.extractedData && Object.keys(currentCoc.verification.extractedData).length > 0 && (
                      <div className="border-t pt-4 mt-4">
                        <h4 className="text-sm font-medium text-slate-900 mb-3">Extracted Data</h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          {currentCoc.verification.extractedData.insurer && (
                            <div>
                              <span className="text-slate-500">Insurer</span>
                              <p className="font-medium">{currentCoc.verification.extractedData.insurer}</p>
                            </div>
                          )}
                          {currentCoc.verification.extractedData.policyNumber && (
                            <div>
                              <span className="text-slate-500">Policy Number</span>
                              <p className="font-medium">{currentCoc.verification.extractedData.policyNumber}</p>
                            </div>
                          )}
                          {currentCoc.verification.extractedData.publicLiability && (
                            <div>
                              <span className="text-slate-500">Public Liability</span>
                              <p className="font-medium">{formatCurrency(currentCoc.verification.extractedData.publicLiability)}</p>
                            </div>
                          )}
                          {currentCoc.verification.extractedData.workersComp && (
                            <div>
                              <span className="text-slate-500">Workers Comp</span>
                              <p className="font-medium">{formatCurrency(currentCoc.verification.extractedData.workersComp)}</p>
                            </div>
                          )}
                          {currentCoc.verification.extractedData.expiryDate && (
                            <div>
                              <span className="text-slate-500">Expiry Date</span>
                              <p className="font-medium">{new Date(currentCoc.verification.extractedData.expiryDate).toLocaleDateString()}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Compliance Checklist */}
                    {currentCoc.verification.checks && currentCoc.verification.checks.length > 0 && (
                      <div className="border-t pt-4 mt-4">
                        <h4 className="text-sm font-medium text-slate-900 mb-3">Compliance Checklist</h4>
                        <div className="space-y-2">
                          {currentCoc.verification.checks.map((check, index) => (
                            <div key={index} className="flex items-start gap-3 p-2 rounded-lg bg-slate-50">
                              {check.status === 'pass' ? (
                                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                              ) : check.status === 'fail' ? (
                                <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                              ) : (
                                <Clock className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                              )}
                              <div className="flex-1">
                                <p className="text-sm font-medium">{check.name}</p>
                                <p className="text-xs text-slate-500">{check.message}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Deficiencies */}
                    {currentCoc.verification.deficiencies && currentCoc.verification.deficiencies.length > 0 && (
                      <div className="border-t pt-4 mt-4">
                        <h4 className="text-sm font-medium text-red-600 mb-3 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4" />
                          Deficiencies Found
                        </h4>
                        <div className="space-y-2">
                          {currentCoc.verification.deficiencies.map((def, index) => (
                            <div key={index} className="p-3 rounded-lg bg-red-50 border border-red-100">
                              <p className="text-sm font-medium text-red-800">{def.check_name}</p>
                              <p className="text-xs text-red-600 mt-1">{def.message}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <FileCheck className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                    <p>No verified certificate on file</p>
                    <p className="text-sm">Upload a Certificate of Currency to verify compliance</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* COC History */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Certificate History
                </CardTitle>
                <CardDescription>All Certificates of Currency submitted</CardDescription>
              </CardHeader>
              <CardContent>
                {cocDocuments.length > 0 ? (
                  <div className="space-y-3">
                    {cocDocuments.map((coc) => (
                      <div key={coc.id} className="border rounded-lg p-4 hover:border-primary transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-900">
                                {coc.fileName || 'Certificate of Currency'}
                              </span>
                              {coc.verification && (
                                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                  VERIFICATION_STATUS_STYLES[coc.verification.status]?.bg || 'bg-slate-100'
                                } ${VERIFICATION_STATUS_STYLES[coc.verification.status]?.text || 'text-slate-700'}`}>
                                  {VERIFICATION_STATUS_STYLES[coc.verification.status]?.label || coc.verification.status}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                              {coc.projectName && (
                                <span className="flex items-center gap-1">
                                  <Briefcase className="h-3 w-3" />
                                  {coc.projectName}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(coc.createdAt).toLocaleDateString()}
                              </span>
                              {coc.fileSize && (
                                <span>{formatFileSize(coc.fileSize)}</span>
                              )}
                              <span className="capitalize">{coc.source}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" asChild>
                              <a href={coc.fileUrl} target="_blank" rel="noopener noreferrer">
                                <Eye className="h-4 w-4" />
                              </a>
                            </Button>
                            <Button variant="ghost" size="sm" asChild>
                              <a href={coc.fileUrl} download>
                                <Download className="h-4 w-4" />
                              </a>
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <FileText className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                    <p>No certificates uploaded yet</p>
                    <p className="text-sm">Upload a Certificate of Currency to get started</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Company Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Company Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <span className="text-xs text-slate-500">ABN</span>
                  <p className="font-mono">{subcontractor.abn}</p>
                </div>
                {subcontractor.acn && (
                  <div>
                    <span className="text-xs text-slate-500">ACN</span>
                    <p className="font-mono">{subcontractor.acn}</p>
                  </div>
                )}
                {subcontractor.address && (
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-slate-400 mt-0.5" />
                    <p className="text-sm">{subcontractor.address}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Contact Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Contact Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {subcontractor.contactName && (
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-slate-400" />
                    <span className="text-sm">{subcontractor.contactName}</span>
                  </div>
                )}
                {subcontractor.contactEmail && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-slate-400" />
                    <a href={`mailto:${subcontractor.contactEmail}`} className="text-sm text-primary hover:underline">
                      {subcontractor.contactEmail}
                    </a>
                  </div>
                )}
                {subcontractor.contactPhone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-slate-400" />
                    <a href={`tel:${subcontractor.contactPhone}`} className="text-sm text-primary hover:underline">
                      {subcontractor.contactPhone}
                    </a>
                  </div>
                )}
                {!subcontractor.contactName && !subcontractor.contactEmail && !subcontractor.contactPhone && (
                  <p className="text-sm text-slate-400">No contact information</p>
                )}
              </CardContent>
            </Card>

            {/* Broker Info */}
            {(subcontractor.brokerName || subcontractor.brokerEmail || subcontractor.brokerPhone) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Insurance Broker</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {subcontractor.brokerName && (
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-slate-400" />
                      <span className="text-sm">{subcontractor.brokerName}</span>
                    </div>
                  )}
                  {subcontractor.brokerEmail && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-slate-400" />
                      <a href={`mailto:${subcontractor.brokerEmail}`} className="text-sm text-primary hover:underline">
                        {subcontractor.brokerEmail}
                      </a>
                    </div>
                  )}
                  {subcontractor.brokerPhone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-slate-400" />
                      <a href={`tel:${subcontractor.brokerPhone}`} className="text-sm text-primary hover:underline">
                        {subcontractor.brokerPhone}
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Assigned Projects */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Assigned Projects</CardTitle>
              </CardHeader>
              <CardContent>
                {projects.length > 0 ? (
                  <div className="space-y-3">
                    {projects.map((project) => (
                      <Link key={project.id} href={`/dashboard/projects/${project.id}`}>
                        <div className="p-3 border rounded-lg hover:border-primary transition-colors cursor-pointer">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm">{project.name}</span>
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                              STATUS_STYLES[project.compliance_status]?.bg || 'bg-slate-100'
                            } ${STATUS_STYLES[project.compliance_status]?.text || 'text-slate-700'}`}>
                              {STATUS_STYLES[project.compliance_status]?.label || project.compliance_status}
                            </span>
                          </div>
                          {project.on_site_date && (
                            <p className="text-xs text-slate-500 mt-1">
                              On-site: {new Date(project.on_site_date).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">Not assigned to any projects</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
        )}

        {/* Communications Tab */}
        {activeTab === 'communications' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                Communication History
              </CardTitle>
              <CardDescription>All emails sent to this subcontractor</CardDescription>
            </CardHeader>
            <CardContent>
              {communications.length > 0 ? (
                <div className="space-y-3">
                  {communications.map((comm) => {
                    const statusStyle = COMMUNICATION_STATUS_STYLES[comm.status] || COMMUNICATION_STATUS_STYLES.pending
                    const StatusIcon = statusStyle.icon
                    return (
                      <div
                        key={comm.id}
                        className="border rounded-lg p-4 hover:border-primary transition-colors cursor-pointer"
                        onClick={() => setSelectedCommunication(comm)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">
                                {COMMUNICATION_TYPE_LABELS[comm.type] || comm.type}
                              </span>
                              <span className={`px-2 py-0.5 text-xs font-medium rounded-full flex items-center gap-1 ${statusStyle.bg} ${statusStyle.text}`}>
                                <StatusIcon className="h-3 w-3" />
                                {statusStyle.label}
                              </span>
                            </div>
                            {comm.subject && (
                              <p className="text-sm text-slate-600 mt-1 line-clamp-1">{comm.subject}</p>
                            )}
                            <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                              {comm.projectName && (
                                <span className="flex items-center gap-1">
                                  <Briefcase className="h-3 w-3" />
                                  {comm.projectName}
                                </span>
                              )}
                              {comm.recipientEmail && (
                                <span className="flex items-center gap-1">
                                  <Mail className="h-3 w-3" />
                                  {comm.recipientEmail}
                                </span>
                              )}
                              {comm.sentAt && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {new Date(comm.sentAt).toLocaleString()}
                                </span>
                              )}
                            </div>
                          </div>
                          <Button variant="ghost" size="sm" aria-label="View communication details">
                            <Eye className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <MessageSquare className="h-12 w-12 mx-auto mb-3 text-slate-300" aria-hidden="true" />
                  <p>No communications sent yet</p>
                  <p className="text-sm">Emails will appear here when they are sent</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Exceptions Tab */}
        {activeTab === 'exceptions' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-primary" />
                Exception History
              </CardTitle>
              <CardDescription>Compliance exceptions for this subcontractor</CardDescription>
            </CardHeader>
            <CardContent>
              {exceptions.length > 0 ? (
                <div className="space-y-3">
                  {exceptions.map((exc) => {
                    const statusStyle = EXCEPTION_STATUS_STYLES[exc.status] || EXCEPTION_STATUS_STYLES.pending_approval
                    const StatusIcon = statusStyle.icon
                    const riskStyle = RISK_LEVEL_STYLES[exc.riskLevel] || RISK_LEVEL_STYLES.medium
                    return (
                      <div
                        key={exc.id}
                        className="border rounded-lg p-4 hover:border-primary transition-colors cursor-pointer"
                        onClick={() => setSelectedException(exc)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">
                                {exc.issueSummary}
                              </span>
                              <span className={`px-2 py-0.5 text-xs font-medium rounded-full flex items-center gap-1 ${statusStyle.bg} ${statusStyle.text}`}>
                                <StatusIcon className="h-3 w-3" />
                                {statusStyle.label}
                              </span>
                              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${riskStyle.bg} ${riskStyle.text}`}>
                                {riskStyle.label} Risk
                              </span>
                            </div>
                            <p className="text-sm text-slate-600 mt-1 line-clamp-2">{exc.reason}</p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                              {exc.projectName && (
                                <span className="flex items-center gap-1">
                                  <Briefcase className="h-3 w-3" />
                                  {exc.projectName}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {exc.createdByName}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(exc.createdAt).toLocaleDateString()}
                              </span>
                              {exc.expiresAt && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  Expires: {new Date(exc.expiresAt).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                          <Button variant="ghost" size="sm" aria-label="View exception details">
                            <Eye className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <AlertCircle className="h-12 w-12 mx-auto mb-3 text-slate-300" aria-hidden="true" />
                  <p>No exceptions recorded</p>
                  <p className="text-sm">Exceptions will appear here when they are created</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Communication Detail Modal */}
      <Dialog open={!!selectedCommunication} onOpenChange={() => setSelectedCommunication(null)}>
        <DialogContent onClose={() => setSelectedCommunication(null)} className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              {selectedCommunication && (COMMUNICATION_TYPE_LABELS[selectedCommunication.type] || selectedCommunication.type)}
            </DialogTitle>
            <DialogDescription>
              {selectedCommunication?.subject}
            </DialogDescription>
          </DialogHeader>

          {selectedCommunication && (
            <div className="space-y-4 mt-4">
              {/* Status and dates */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
                <div>
                  <span className="text-xs text-slate-500">Status</span>
                  <div className="mt-1">
                    {(() => {
                      const statusStyle = COMMUNICATION_STATUS_STYLES[selectedCommunication.status] || COMMUNICATION_STATUS_STYLES.pending
                      const StatusIcon = statusStyle.icon
                      return (
                        <span className={`px-2 py-1 text-xs font-medium rounded-full inline-flex items-center gap-1 ${statusStyle.bg} ${statusStyle.text}`}>
                          <StatusIcon className="h-3 w-3" />
                          {statusStyle.label}
                        </span>
                      )
                    })()}
                  </div>
                </div>
                <div>
                  <span className="text-xs text-slate-500">Channel</span>
                  <p className="font-medium text-sm capitalize mt-1">{selectedCommunication.channel}</p>
                </div>
                {selectedCommunication.sentAt && (
                  <div>
                    <span className="text-xs text-slate-500">Sent</span>
                    <p className="font-medium text-sm mt-1">{new Date(selectedCommunication.sentAt).toLocaleString()}</p>
                  </div>
                )}
                {selectedCommunication.deliveredAt && (
                  <div>
                    <span className="text-xs text-slate-500">Delivered</span>
                    <p className="font-medium text-sm mt-1">{new Date(selectedCommunication.deliveredAt).toLocaleString()}</p>
                  </div>
                )}
                {selectedCommunication.openedAt && (
                  <div>
                    <span className="text-xs text-slate-500">Opened</span>
                    <p className="font-medium text-sm mt-1">{new Date(selectedCommunication.openedAt).toLocaleString()}</p>
                  </div>
                )}
              </div>

              {/* Recipients */}
              <div>
                <span className="text-xs text-slate-500">To</span>
                <p className="font-medium text-sm mt-1">{selectedCommunication.recipientEmail || 'N/A'}</p>
              </div>
              {selectedCommunication.ccEmails && selectedCommunication.ccEmails.length > 0 && (
                <div>
                  <span className="text-xs text-slate-500">CC</span>
                  <p className="font-medium text-sm mt-1">{selectedCommunication.ccEmails.join(', ')}</p>
                </div>
              )}

              {/* Project */}
              {selectedCommunication.projectName && (
                <div>
                  <span className="text-xs text-slate-500">Project</span>
                  <p className="font-medium text-sm mt-1">{selectedCommunication.projectName}</p>
                </div>
              )}

              {/* Email Body */}
              {selectedCommunication.body && (
                <div>
                  <span className="text-xs text-slate-500">Message</span>
                  <div className="mt-2 p-4 bg-white border rounded-lg">
                    <pre className="whitespace-pre-wrap text-sm font-sans">{selectedCommunication.body}</pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Exception Detail Modal */}
      <Dialog open={!!selectedException} onOpenChange={() => setSelectedException(null)}>
        <DialogContent onClose={() => setSelectedException(null)} className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-primary" />
              Exception Details
            </DialogTitle>
            <DialogDescription>
              {selectedException?.issueSummary}
            </DialogDescription>
          </DialogHeader>

          {selectedException && (
            <div className="space-y-4 mt-4">
              {/* Status and Risk Level */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
                <div>
                  <span className="text-xs text-slate-500">Status</span>
                  <div className="mt-1">
                    {(() => {
                      const statusStyle = EXCEPTION_STATUS_STYLES[selectedException.status] || EXCEPTION_STATUS_STYLES.pending_approval
                      const StatusIcon = statusStyle.icon
                      return (
                        <span className={`px-2 py-1 text-xs font-medium rounded-full inline-flex items-center gap-1 ${statusStyle.bg} ${statusStyle.text}`}>
                          <StatusIcon className="h-3 w-3" />
                          {statusStyle.label}
                        </span>
                      )
                    })()}
                  </div>
                </div>
                <div>
                  <span className="text-xs text-slate-500">Risk Level</span>
                  <div className="mt-1">
                    {(() => {
                      const riskStyle = RISK_LEVEL_STYLES[selectedException.riskLevel] || RISK_LEVEL_STYLES.medium
                      return (
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${riskStyle.bg} ${riskStyle.text}`}>
                          {riskStyle.label}
                        </span>
                      )
                    })()}
                  </div>
                </div>
                <div>
                  <span className="text-xs text-slate-500">Expiration Type</span>
                  <p className="font-medium text-sm mt-1">
                    {EXPIRATION_TYPE_LABELS[selectedException.expirationType] || selectedException.expirationType}
                  </p>
                </div>
                {selectedException.expiresAt && (
                  <div>
                    <span className="text-xs text-slate-500">Expires</span>
                    <p className="font-medium text-sm mt-1">{new Date(selectedException.expiresAt).toLocaleString()}</p>
                  </div>
                )}
              </div>

              {/* Project */}
              {selectedException.projectName && (
                <div>
                  <span className="text-xs text-slate-500">Project</span>
                  <p className="font-medium text-sm mt-1">{selectedException.projectName}</p>
                </div>
              )}

              {/* Reason */}
              <div>
                <span className="text-xs text-slate-500">Reason</span>
                <div className="mt-2 p-4 bg-white border rounded-lg">
                  <p className="text-sm">{selectedException.reason}</p>
                </div>
              </div>

              {/* Created By and Approval Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-slate-500">Created By</span>
                  <p className="font-medium text-sm mt-1">{selectedException.createdByName}</p>
                  <p className="text-xs text-slate-500">{new Date(selectedException.createdAt).toLocaleString()}</p>
                </div>
                {selectedException.approvedByName && (
                  <div>
                    <span className="text-xs text-slate-500">Approved By</span>
                    <p className="font-medium text-sm mt-1">{selectedException.approvedByName}</p>
                    {selectedException.approvedAt && (
                      <p className="text-xs text-slate-500">{new Date(selectedException.approvedAt).toLocaleString()}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Resolution Info */}
              {selectedException.resolvedAt && (
                <div className="border-t pt-4">
                  <span className="text-xs text-slate-500">Resolution</span>
                  <div className="mt-2">
                    <p className="font-medium text-sm">
                      {selectedException.resolutionType?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </p>
                    {selectedException.resolutionNotes && (
                      <p className="text-sm text-slate-600 mt-1">{selectedException.resolutionNotes}</p>
                    )}
                    <p className="text-xs text-slate-500 mt-1">
                      Resolved on {new Date(selectedException.resolvedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}

              {/* Supporting Document */}
              {selectedException.supportingDocumentUrl && (
                <div>
                  <span className="text-xs text-slate-500">Supporting Document</span>
                  <div className="mt-2">
                    <Button variant="outline" size="sm" asChild>
                      <a href={selectedException.supportingDocumentUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        View Document
                      </a>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent onClose={() => setShowDeleteModal(false)}>
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center" aria-hidden="true">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <DialogTitle>Delete Subcontractor</DialogTitle>
            </div>
            <DialogDescription>
              Are you sure you want to delete &quot;{subcontractor?.name}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="bg-amber-50 border border-amber-200 rounded-md p-4 mt-4">
            <p className="text-sm text-amber-800">
              <strong>Warning:</strong> This will permanently delete the subcontractor and all associated data including certificates of currency and communications history.
            </p>
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteSubcontractor}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Subcontractor'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
