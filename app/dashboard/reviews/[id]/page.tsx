"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  useReviewDetail,
  useApproveVerification,
  useRejectVerification,
  useRequestClearerCopy,
  useUser,
} from "@/lib/hooks/use-api"
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  RefreshCw,
  FileText,
  Building2,
  FolderOpen,
  Calendar,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Shield,
  DollarSign,
  Percent,
  User,
  Mail,
  Phone,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { useToast } from "@/components/ui/use-toast"

interface Deficiency {
  type: string
  severity: 'critical' | 'major' | 'minor'
  description: string
  required_value: string | null
  actual_value: string | null
}

interface Check {
  check_type: string
  description: string
  status: 'pass' | 'fail' | 'warning'
  details: string
}

interface Coverage {
  type: string
  limit: number
  excess?: number
  principal_indemnity?: boolean
  cross_liability?: boolean
}

interface ExtractedData {
  insured_party_name?: string
  insured_party_abn?: string
  insurer_name?: string
  policy_number?: string
  period_of_insurance_start?: string
  period_of_insurance_end?: string
  coverages?: Coverage[]
  extraction_confidence?: number
  field_confidences?: Record<string, number>
  fraud_analysis?: {
    risk_score: number
    risk_level: string
    is_blocked: boolean
    recommendation: string
  }
}

interface Requirement {
  coverageType: string
  minimumLimit: number | null
  maximumExcess: number | null
  principalIndemnityRequired: boolean
  crossLiabilityRequired: boolean
}

const formatCurrency = (value: number | null | undefined) => {
  if (!value) return '-'
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(value)
}

const formatCoverageType = (type: string) => {
  const names: Record<string, string> = {
    public_liability: 'Public Liability',
    products_liability: 'Products Liability',
    workers_comp: "Workers' Compensation",
    professional_indemnity: 'Professional Indemnity',
    motor_vehicle: 'Motor Vehicle',
    contract_works: 'Contract Works',
  }
  return names[type] || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

const getConfidenceColor = (score: number) => {
  if (score >= 80) return 'text-green-600 bg-green-100'
  if (score >= 60) return 'text-amber-600 bg-amber-100'
  return 'text-red-600 bg-red-100'
}

const getCheckStatusStyle = (status: string) => {
  switch (status) {
    case 'pass':
      return { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle }
    case 'fail':
      return { bg: 'bg-red-100', text: 'text-red-700', icon: XCircle }
    case 'warning':
      return { bg: 'bg-amber-100', text: 'text-amber-700', icon: AlertTriangle }
    default:
      return { bg: 'bg-slate-100', text: 'text-slate-700', icon: AlertTriangle }
  }
}

const getSeverityStyle = (severity: string) => {
  switch (severity) {
    case 'critical':
      return 'bg-red-100 text-red-700 border-red-200'
    case 'major':
      return 'bg-amber-100 text-amber-700 border-amber-200'
    case 'minor':
      return 'bg-yellow-100 text-yellow-700 border-yellow-200'
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200'
  }
}

export default function ReviewDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const id = params.id as string

  const { data: reviewData, isLoading, refetch } = useReviewDetail(id)
  const { data: user } = useUser()
  const approveMutation = useApproveVerification()
  const rejectMutation = useRejectVerification()
  const requestCopyMutation = useRequestClearerCopy()

  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [showRequestCopyDialog, setShowRequestCopyDialog] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [requestMessage, setRequestMessage] = useState('')

  const canAction = user?.role && ['admin', 'risk_manager', 'project_manager'].includes(user.role)

  const handleApprove = async () => {
    try {
      await approveMutation.mutateAsync(id)
      toast({
        title: "Verification Approved",
        description: "The certificate has been approved and the subcontractor marked as compliant.",
      })
      router.push('/dashboard/reviews')
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to approve verification. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleReject = async () => {
    try {
      await rejectMutation.mutateAsync({
        id,
        reason: rejectReason,
        deficiencies: rejectReason ? [{
          type: 'manual_rejection',
          severity: 'major',
          description: rejectReason,
          required_value: null,
          actual_value: null,
        }] : undefined,
      })
      toast({
        title: "Verification Rejected",
        description: "The certificate has been rejected and a deficiency email will be sent.",
      })
      setShowRejectDialog(false)
      router.push('/dashboard/reviews')
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to reject verification. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleRequestCopy = async () => {
    try {
      await requestCopyMutation.mutateAsync({
        id,
        message: requestMessage,
      })
      toast({
        title: "Request Sent",
        description: "An email has been sent requesting a clearer copy of the document.",
      })
      setShowRequestCopyDialog(false)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send request. Please try again.",
        variant: "destructive",
      })
    }
  }

  if (isLoading) {
    return (
      <>
        <header className="bg-white border-b px-6 py-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-6 w-48" />
          </div>
        </header>
        <div className="p-6 md:p-8 lg:p-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-[600px]" />
            <div className="space-y-6">
              <Skeleton className="h-48" />
              <Skeleton className="h-48" />
              <Skeleton className="h-48" />
            </div>
          </div>
        </div>
      </>
    )
  }

  if (!reviewData) {
    return (
      <div className="p-6 text-center">
        <p className="text-slate-500">Review not found</p>
        <Button onClick={() => router.push('/dashboard/reviews')} className="mt-4">
          Back to Reviews
        </Button>
      </div>
    )
  }

  const { verification, document, project, subcontractor, requirements } = reviewData
  const extractedData = (verification.extractedData || {}) as ExtractedData
  const checks = (verification.checks || []) as Check[]
  const deficiencies = (verification.deficiencies || []) as Deficiency[]
  const fieldConfidences = extractedData.field_confidences || {}

  return (
    <>
      {/* Page Header */}
      <header className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/reviews')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">
                Review: {subcontractor.name}
              </h1>
              <p className="text-sm text-slate-500">
                {project.name} • {document.fileName || 'Certificate of Currency'}
              </p>
            </div>
          </div>
          {canAction && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setShowRequestCopyDialog(true)}
                disabled={requestCopyMutation.isPending}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Request Clearer Copy
              </Button>
              <Button
                variant="destructive"
                onClick={() => setShowRejectDialog(true)}
                disabled={rejectMutation.isPending}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </Button>
              <Button
                onClick={handleApprove}
                disabled={approveMutation.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                {approveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                Approve
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="p-6 md:p-8 lg:p-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* PDF Viewer */}
          <Card className="h-fit">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Document Preview</CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <a href={document.fileUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Open
                  </a>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden bg-slate-100" style={{ height: '600px' }}>
                <iframe
                  src={document.fileUrl}
                  className="w-full h-full"
                  title="Document Preview"
                />
              </div>
            </CardContent>
          </Card>

          {/* Review Panel */}
          <div className="space-y-6">
            {/* Confidence Score */}
            {extractedData.extraction_confidence !== undefined && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Percent className="h-4 w-4" />
                    AI Extraction Confidence
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <div className={`text-3xl font-bold px-4 py-2 rounded-lg ${getConfidenceColor(extractedData.extraction_confidence * 100)}`}>
                      {(extractedData.extraction_confidence * 100).toFixed(0)}%
                    </div>
                    <div className="text-sm text-slate-600">
                      {extractedData.extraction_confidence >= 0.8
                        ? 'High confidence - data likely accurate'
                        : extractedData.extraction_confidence >= 0.6
                        ? 'Medium confidence - verify key fields'
                        : 'Low confidence - manual verification recommended'}
                    </div>
                  </div>
                  {Object.entries(fieldConfidences).filter(([_, conf]) => conf < 80).length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-slate-700 mb-2">Low Confidence Fields:</p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(fieldConfidences)
                          .filter(([_, conf]) => conf < 80)
                          .sort((a, b) => a[1] - b[1])
                          .map(([field, conf]) => (
                            <span
                              key={field}
                              className={`px-2 py-1 text-xs rounded ${getConfidenceColor(conf)}`}
                            >
                              {field.replace(/_/g, ' ')}: {conf}%
                            </span>
                          ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Fraud Analysis */}
            {extractedData.fraud_analysis && (
              <Card className={extractedData.fraud_analysis.is_blocked ? 'border-red-300 bg-red-50' : ''}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Fraud Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 mb-2">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      extractedData.fraud_analysis.risk_level === 'low' ? 'bg-green-100 text-green-700' :
                      extractedData.fraud_analysis.risk_level === 'medium' ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {extractedData.fraud_analysis.risk_level.toUpperCase()} RISK
                    </span>
                    <span className="text-sm text-slate-600">
                      Score: {extractedData.fraud_analysis.risk_score}/100
                    </span>
                  </div>
                  <p className="text-sm text-slate-600">{extractedData.fraud_analysis.recommendation}</p>
                </CardContent>
              </Card>
            )}

            {/* Extracted Data */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Extracted Data</CardTitle>
                <CardDescription>Information extracted from the document</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label className="text-slate-500">Insured Party</Label>
                    <p className="font-medium">{extractedData.insured_party_name || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-slate-500">ABN</Label>
                    <p className="font-medium">{extractedData.insured_party_abn || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-slate-500">Insurer</Label>
                    <p className="font-medium">{extractedData.insurer_name || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-slate-500">Policy Number</Label>
                    <p className="font-medium">{extractedData.policy_number || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-slate-500">Policy Start</Label>
                    <p className="font-medium">{extractedData.period_of_insurance_start || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-slate-500">Policy End</Label>
                    <p className="font-medium">{extractedData.period_of_insurance_end || '-'}</p>
                  </div>
                </div>

                {/* Coverages */}
                {extractedData.coverages && extractedData.coverages.length > 0 && (
                  <div className="mt-4">
                    <Label className="text-slate-500 mb-2 block">Coverages</Label>
                    <div className="space-y-2">
                      {extractedData.coverages.map((cov, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                          <span className="font-medium">{formatCoverageType(cov.type)}</span>
                          <span className="text-slate-600">{formatCurrency(cov.limit)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Requirements Comparison */}
            {requirements && requirements.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Project Requirements</CardTitle>
                  <CardDescription>Required insurance coverage for this project</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {requirements.map((req: Requirement, idx: number) => {
                      const coverage = extractedData.coverages?.find(c => c.type === req.coverageType)
                      const meetsLimit = !req.minimumLimit || (coverage && coverage.limit >= req.minimumLimit)

                      return (
                        <div key={idx} className="p-3 border rounded-lg">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium">{formatCoverageType(req.coverageType)}</span>
                            {coverage ? (
                              meetsLimit ? (
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-600" />
                              )
                            ) : (
                              <AlertTriangle className="h-4 w-4 text-amber-600" />
                            )}
                          </div>
                          <div className="text-sm text-slate-600">
                            <span>Required: {formatCurrency(req.minimumLimit)}</span>
                            {coverage && (
                              <span className={`ml-3 ${meetsLimit ? 'text-green-600' : 'text-red-600'}`}>
                                Actual: {formatCurrency(coverage.limit)}
                              </span>
                            )}
                            {!coverage && (
                              <span className="ml-3 text-amber-600">Not found</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Verification Checks */}
            {checks.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Verification Checks</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {checks.map((check, idx) => {
                      const style = getCheckStatusStyle(check.status)
                      const StatusIcon = style.icon
                      return (
                        <div key={idx} className={`p-3 rounded-lg ${style.bg}`}>
                          <div className="flex items-center gap-2 mb-1">
                            <StatusIcon className={`h-4 w-4 ${style.text}`} />
                            <span className={`font-medium ${style.text}`}>{check.description}</span>
                          </div>
                          <p className="text-sm text-slate-600 ml-6">{check.details}</p>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Deficiencies */}
            {deficiencies.length > 0 && (
              <Card className="border-red-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-red-700 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Deficiencies Found
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {deficiencies.map((def, idx) => (
                      <div key={idx} className={`p-3 border rounded-lg ${getSeverityStyle(def.severity)}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold uppercase">{def.severity}</span>
                          <span className="font-medium">{def.type.replace(/_/g, ' ')}</span>
                        </div>
                        <p className="text-sm">{def.description}</p>
                        {(def.required_value || def.actual_value) && (
                          <div className="mt-2 text-sm">
                            {def.required_value && <p>Required: {def.required_value}</p>}
                            {def.actual_value && <p>Actual: {def.actual_value}</p>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Subcontractor Contact */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Subcontractor Contact
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-slate-400" />
                    <span>{subcontractor.contactName || 'No contact name'}</span>
                  </div>
                  {subcontractor.contactEmail && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-slate-400" />
                      <a href={`mailto:${subcontractor.contactEmail}`} className="text-blue-600 hover:underline">
                        {subcontractor.contactEmail}
                      </a>
                    </div>
                  )}
                  {subcontractor.brokerEmail && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-slate-400" />
                      <span className="text-slate-500 mr-1">Broker:</span>
                      <a href={`mailto:${subcontractor.brokerEmail}`} className="text-blue-600 hover:underline">
                        {subcontractor.brokerEmail}
                      </a>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent onClose={() => setShowRejectDialog(false)}>
          <DialogHeader>
            <DialogTitle>Reject Verification</DialogTitle>
            <DialogDescription>
              The certificate will be marked as non-compliant and a deficiency notification will be sent to the subcontractor.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="rejectReason">Reason for rejection (optional)</Label>
            <textarea
              id="rejectReason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full mt-2 p-3 border rounded-lg resize-none"
              rows={3}
              placeholder="Describe why this certificate is being rejected..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              Reject & Notify
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request Copy Dialog */}
      <Dialog open={showRequestCopyDialog} onOpenChange={setShowRequestCopyDialog}>
        <DialogContent onClose={() => setShowRequestCopyDialog(false)}>
          <DialogHeader>
            <DialogTitle>Request Clearer Copy</DialogTitle>
            <DialogDescription>
              An email will be sent to the subcontractor requesting a clearer copy of the document.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="requestMessage">Additional message (optional)</Label>
            <textarea
              id="requestMessage"
              value={requestMessage}
              onChange={(e) => setRequestMessage(e.target.value)}
              className="w-full mt-2 p-3 border rounded-lg resize-none"
              rows={3}
              placeholder="Add any specific instructions or details..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRequestCopyDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleRequestCopy}
              disabled={requestCopyMutation.isPending}
            >
              {requestCopyMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Send Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
