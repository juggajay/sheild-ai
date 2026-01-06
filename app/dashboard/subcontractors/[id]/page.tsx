"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
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
  Eye
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

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

export default function SubcontractorDetailPage() {
  const params = useParams()
  const [subcontractor, setSubcontractor] = useState<Subcontractor | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [cocDocuments, setCocDocuments] = useState<COCDocument[]>([])
  const [currentCoc, setCurrentCoc] = useState<COCDocument | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

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

  return (
    <>
      {/* Top Bar */}
      <header className="bg-white border-b px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/subcontractors">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
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
        </div>
      </header>

      {/* Content */}
      <div className="p-6 space-y-6">
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
      </div>
    </>
  )
}
