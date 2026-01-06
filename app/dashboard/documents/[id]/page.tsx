'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  FileText,
  Building2,
  User,
  Calendar,
  DollarSign,
  Shield,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Download,
  RefreshCw,
  ExternalLink,
  ThumbsUp,
  ThumbsDown
} from 'lucide-react'

interface FieldConfidences {
  insured_party_name: number
  insured_party_abn: number
  insured_party_address: number
  insurer_name: number
  insurer_abn: number
  policy_number: number
  period_of_insurance_start: number
  period_of_insurance_end: number
  public_liability_limit: number
  products_liability_limit: number
  workers_comp_limit: number
  professional_indemnity_limit: number
  broker_name?: number
  broker_contact?: number
  broker_phone?: number
  broker_email?: number
}

interface ExtractedData {
  insured_party_name: string
  insured_party_abn: string
  insured_party_address: string
  insurer_name: string
  insurer_abn: string
  policy_number: string
  period_of_insurance_start: string
  period_of_insurance_end: string
  coverages: Array<{
    type: string
    limit: number
    limit_type: string
    excess: number
    principal_indemnity?: boolean
    cross_liability?: boolean
    state?: string
    employer_indemnity?: boolean
    retroactive_date?: string
  }>
  broker_name?: string
  broker_contact?: string
  broker_phone?: string
  broker_email?: string
  currency: string
  territory: string
  extraction_timestamp: string
  extraction_model: string
  extraction_confidence: number
  field_confidences?: FieldConfidences
}

interface Check {
  check_type: string
  description: string
  status: 'pass' | 'fail' | 'warning'
  details: string
}

interface Deficiency {
  type: string
  severity: 'critical' | 'major' | 'minor'
  description: string
  required_value: string | null
  actual_value: string | null
}

interface DocumentData {
  id: string
  file_url: string
  file_name: string
  file_size: number
  source: string
  processing_status: string
  created_at: string
  subcontractor_name: string
  subcontractor_abn: string
  project_name: string
  verification_id: string | null
  verification_status: string | null
  confidence_score: number | null
  extracted_data: string | null
  checks: string | null
  deficiencies: string | null
}

export default function DocumentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const documentId = params.id as string

  const [document, setDocument] = useState<DocumentData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchDocument()
  }, [documentId])

  async function fetchDocument() {
    try {
      const res = await fetch(`/api/documents/${documentId}`)
      if (!res.ok) {
        if (res.status === 404) {
          setError('Document not found')
        } else {
          throw new Error('Failed to fetch document')
        }
        return
      }
      const data = await res.json()
      setDocument(data.document)
    } catch (err) {
      setError('Failed to load document')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleReprocess() {
    if (!document) return

    setIsProcessing(true)
    try {
      const res = await fetch(`/api/documents/${documentId}/process`, {
        method: 'POST'
      })
      if (!res.ok) throw new Error('Failed to process document')

      // Refresh document data
      await fetchDocument()
    } catch (err) {
      setError('Failed to reprocess document')
    } finally {
      setIsProcessing(false)
    }
  }

  async function handleManualVerification(action: 'approve' | 'reject') {
    if (!document) return

    setIsVerifying(true)
    try {
      const res = await fetch(`/api/documents/${documentId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || `Failed to ${action} document`)
      }

      // Refresh document data
      await fetchDocument()
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} document`)
    } finally {
      setIsVerifying(false)
    }
  }

  function formatCoverageType(type: string): string {
    const names: Record<string, string> = {
      public_liability: 'Public Liability',
      products_liability: 'Products Liability',
      workers_comp: "Workers' Compensation",
      professional_indemnity: 'Professional Indemnity',
      motor_vehicle: 'Motor Vehicle',
      contract_works: 'Contract Works'
    }
    return names[type] || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  function getStatusIcon(status: 'pass' | 'fail' | 'warning' | 'review') {
    switch (status) {
      case 'pass':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'fail':
        return <XCircle className="w-5 h-5 text-red-500" />
      case 'warning':
      case 'review':
        return <AlertTriangle className="w-5 h-5 text-amber-500" />
    }
  }

  function getStatusBadge(status: string | null) {
    switch (status) {
      case 'pass':
        return <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">Passed</span>
      case 'fail':
        return <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">Failed</span>
      case 'review':
        return <span className="px-2 py-1 text-xs font-medium bg-amber-100 text-amber-800 rounded-full">Review Required</span>
      default:
        return <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">Pending</span>
    }
  }

  function getSeverityBadge(severity: 'critical' | 'major' | 'minor') {
    switch (severity) {
      case 'critical':
        return <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">Critical</span>
      case 'major':
        return <span className="px-2 py-1 text-xs font-medium bg-orange-100 text-orange-800 rounded-full">Major</span>
      case 'minor':
        return <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">Minor</span>
    }
  }

  // Low confidence threshold (below this value, fields are highlighted)
  const LOW_CONFIDENCE_THRESHOLD = 0.70

  function getConfidenceColor(confidence: number): string {
    if (confidence >= 0.90) return 'text-green-600'
    if (confidence >= 0.70) return 'text-amber-600'
    return 'text-red-600'
  }

  function getConfidenceBgColor(confidence: number): string {
    if (confidence >= 0.90) return 'bg-green-50'
    if (confidence >= 0.70) return 'bg-amber-50'
    return 'bg-red-50 border border-red-200'
  }

  function getConfidenceBarColor(confidence: number): string {
    if (confidence >= 0.90) return 'bg-green-500'
    if (confidence >= 0.70) return 'bg-amber-500'
    return 'bg-red-500'
  }

  function ConfidenceIndicator({ confidence, showLabel = true }: { confidence: number; showLabel?: boolean }) {
    const percentage = Math.round(confidence * 100)
    const isLow = confidence < LOW_CONFIDENCE_THRESHOLD
    return (
      <div className="flex items-center gap-1.5">
        {showLabel && (
          <span className={`text-xs font-medium ${getConfidenceColor(confidence)}`}>
            {percentage}%
          </span>
        )}
        <div className="w-12 bg-gray-200 rounded-full h-1.5">
          <div
            className={`h-1.5 rounded-full ${getConfidenceBarColor(confidence)}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        {isLow && (
          <AlertTriangle className="w-3 h-3 text-red-500" />
        )}
      </div>
    )
  }

  function FieldWithConfidence({
    label,
    value,
    confidence,
    mono = false
  }: {
    label: string
    value: string
    confidence?: number
    mono?: boolean
  }) {
    const isLow = confidence !== undefined && confidence < LOW_CONFIDENCE_THRESHOLD
    return (
      <div className={`flex justify-between items-start py-1.5 ${isLow ? getConfidenceBgColor(confidence) + ' px-2 rounded -mx-2' : ''}`}>
        <div className="flex flex-col">
          <span className="text-gray-600">{label}</span>
          {confidence !== undefined && (
            <ConfidenceIndicator confidence={confidence} />
          )}
        </div>
        <span className={`font-medium text-right max-w-[60%] ${mono ? 'font-mono' : ''} ${isLow ? 'text-red-700' : ''}`}>
          {value}
        </span>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error || !document) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error || 'Document not found'}</p>
          <Link href="/dashboard/documents" className="text-blue-600 hover:text-blue-800 mt-2 inline-block">
            &larr; Back to Documents
          </Link>
        </div>
      </div>
    )
  }

  const extractedData: ExtractedData | null = document.extracted_data ? JSON.parse(document.extracted_data) : null
  const checks: Check[] = document.checks ? JSON.parse(document.checks) : []
  const deficiencies: Deficiency[] = document.deficiencies ? JSON.parse(document.deficiencies) : []

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/dashboard/documents"
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Documents
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <FileText className="w-8 h-8 text-blue-600" />
              {document.file_name}
            </h1>
            <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
              <span>{formatFileSize(document.file_size)}</span>
              <span>Uploaded {formatDate(document.created_at)}</span>
              {getStatusBadge(document.verification_status)}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleReprocess}
              disabled={isProcessing}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isProcessing ? 'animate-spin' : ''}`} />
              {isProcessing ? 'Processing...' : 'Reprocess'}
            </button>
            <a
              href={document.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              View Document
            </a>
            <a
              href={document.file_url}
              download
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              <Download className="w-4 h-4 mr-2" />
              Download
            </a>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Document info and extracted data */}
        <div className="lg:col-span-2 space-y-6">
          {/* Document Context */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Document Context</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Project</p>
                <p className="font-medium text-gray-900">{document.project_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Subcontractor</p>
                <p className="font-medium text-gray-900">{document.subcontractor_name}</p>
                <p className="text-sm text-gray-500">ABN: {document.subcontractor_abn}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Source</p>
                <p className="font-medium text-gray-900 capitalize">{document.source}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Processing Status</p>
                <p className="font-medium text-gray-900 capitalize">{document.processing_status}</p>
              </div>
            </div>
          </div>

          {/* Extracted Policy Details */}
          {extractedData && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Extracted Policy Details</h2>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500">Confidence:</span>
                  <span className="font-medium text-gray-900">
                    {(extractedData.extraction_confidence * 100).toFixed(0)}%
                  </span>
                </div>
              </div>

              {/* Insured Party */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-3">
                  <User className="w-4 h-4" />
                  Insured Party
                </h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <FieldWithConfidence
                    label="Name"
                    value={extractedData.insured_party_name}
                    confidence={extractedData.field_confidences?.insured_party_name}
                  />
                  <FieldWithConfidence
                    label="ABN"
                    value={extractedData.insured_party_abn}
                    confidence={extractedData.field_confidences?.insured_party_abn}
                    mono
                  />
                  <FieldWithConfidence
                    label="Address"
                    value={extractedData.insured_party_address}
                    confidence={extractedData.field_confidences?.insured_party_address}
                  />
                </div>
              </div>

              {/* Insurer */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-3">
                  <Building2 className="w-4 h-4" />
                  Insurer
                </h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <FieldWithConfidence
                    label="Name"
                    value={extractedData.insurer_name}
                    confidence={extractedData.field_confidences?.insurer_name}
                  />
                  <FieldWithConfidence
                    label="ABN"
                    value={extractedData.insurer_abn}
                    confidence={extractedData.field_confidences?.insurer_abn}
                    mono
                  />
                </div>
              </div>

              {/* Policy Details */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-3">
                  <FileText className="w-4 h-4" />
                  Policy Details
                </h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <FieldWithConfidence
                    label="Policy Number"
                    value={extractedData.policy_number}
                    confidence={extractedData.field_confidences?.policy_number}
                    mono
                  />
                  <FieldWithConfidence
                    label="Start Date"
                    value={formatDate(extractedData.period_of_insurance_start)}
                    confidence={extractedData.field_confidences?.period_of_insurance_start}
                  />
                  <FieldWithConfidence
                    label="End Date"
                    value={formatDate(extractedData.period_of_insurance_end)}
                    confidence={extractedData.field_confidences?.period_of_insurance_end}
                  />
                  <div className="flex justify-between">
                    <span className="text-gray-600">Currency</span>
                    <span className="font-medium">{extractedData.currency}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Territory</span>
                    <span className="font-medium">{extractedData.territory}</span>
                  </div>
                </div>
              </div>

              {/* Coverages */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-3">
                  <Shield className="w-4 h-4" />
                  Coverage Details
                </h3>
                <div className="space-y-3">
                  {extractedData.coverages.map((coverage, index) => {
                    // Get confidence for this coverage type
                    const confidenceKey = `${coverage.type}_limit` as keyof FieldConfidences
                    const coverageConfidence = extractedData.field_confidences?.[confidenceKey]
                    const isLowConfidence = coverageConfidence !== undefined && coverageConfidence < LOW_CONFIDENCE_THRESHOLD

                    return (
                      <div
                        key={index}
                        className={`rounded-lg p-4 ${isLowConfidence ? 'bg-red-50 border border-red-200' : 'bg-gray-50'}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className={`font-medium ${isLowConfidence ? 'text-red-900' : 'text-gray-900'}`}>
                              {formatCoverageType(coverage.type)}
                            </span>
                            {coverageConfidence !== undefined && (
                              <ConfidenceIndicator confidence={coverageConfidence} />
                            )}
                          </div>
                          <span className={`text-lg font-semibold ${isLowConfidence ? 'text-red-700' : 'text-blue-600'}`}>
                            {formatCurrency(coverage.limit)}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-500">Limit Type</span>
                            <span className="capitalize">{coverage.limit_type.replace(/_/g, ' ')}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Excess</span>
                            <span>{formatCurrency(coverage.excess)}</span>
                          </div>
                          {coverage.principal_indemnity !== undefined && (
                            <div className="flex justify-between">
                              <span className="text-gray-500">Principal Indemnity</span>
                              <span>{coverage.principal_indemnity ? 'Yes' : 'No'}</span>
                            </div>
                          )}
                          {coverage.cross_liability !== undefined && (
                            <div className="flex justify-between">
                              <span className="text-gray-500">Cross Liability</span>
                              <span>{coverage.cross_liability ? 'Yes' : 'No'}</span>
                            </div>
                          )}
                          {coverage.state && (
                            <div className="flex justify-between">
                              <span className="text-gray-500">State</span>
                              <span>{coverage.state}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Broker Details */}
              {extractedData.broker_name && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-3">
                    <User className="w-4 h-4" />
                    Broker Details
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <FieldWithConfidence
                      label="Company"
                      value={extractedData.broker_name}
                      confidence={extractedData.field_confidences?.broker_name}
                    />
                    {extractedData.broker_contact && (
                      <FieldWithConfidence
                        label="Contact"
                        value={extractedData.broker_contact}
                        confidence={extractedData.field_confidences?.broker_contact}
                      />
                    )}
                    {extractedData.broker_email && (
                      <FieldWithConfidence
                        label="Email"
                        value={extractedData.broker_email}
                        confidence={extractedData.field_confidences?.broker_email}
                      />
                    )}
                    {extractedData.broker_phone && (
                      <FieldWithConfidence
                        label="Phone"
                        value={extractedData.broker_phone}
                        confidence={extractedData.field_confidences?.broker_phone}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Extraction Metadata */}
              <div className="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-500">
                <p>Extracted using {extractedData.extraction_model} at {formatDate(extractedData.extraction_timestamp)}</p>
              </div>
            </div>
          )}
        </div>

        {/* Right column - Verification results */}
        <div className="space-y-6">
          {/* Verification Summary */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Verification Summary</h2>

            {document.confidence_score !== null && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-600">AI Confidence</span>
                  <span className="text-sm font-medium">{(document.confidence_score * 100).toFixed(0)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${document.confidence_score * 100}%` }}
                  ></div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Overall Status</span>
                {getStatusBadge(document.verification_status)}
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Checks Performed</span>
                <span className="font-medium">{checks.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Deficiencies Found</span>
                <span className="font-medium text-red-600">{deficiencies.length}</span>
              </div>
            </div>

            {/* Manual Verification Actions - Show only for review status */}
            {document.verification_status === 'review' && (
              <div className="mt-6 pt-4 border-t border-gray-200">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Manual Review Required</h3>
                <p className="text-sm text-gray-500 mb-4">
                  This document requires manual review. Please verify the extracted data and approve or reject.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleManualVerification('approve')}
                    disabled={isVerifying}
                    className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ThumbsUp className="w-4 h-4 mr-2" />
                    {isVerifying ? 'Processing...' : 'Approve'}
                  </button>
                  <button
                    onClick={() => handleManualVerification('reject')}
                    disabled={isVerifying}
                    className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ThumbsDown className="w-4 h-4 mr-2" />
                    {isVerifying ? 'Processing...' : 'Reject'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Verification Checks */}
          {checks.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Verification Checks</h2>
              <div className="space-y-3">
                {checks.map((check, index) => (
                  <div key={index} className="flex items-start gap-3">
                    {getStatusIcon(check.status)}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900">{check.description}</p>
                      <p className="text-sm text-gray-500">{check.details}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Deficiencies */}
          {deficiencies.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                Deficiencies
              </h2>
              <div className="space-y-4">
                {deficiencies.map((deficiency, index) => (
                  <div key={index} className="border border-red-100 bg-red-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900">{deficiency.description}</span>
                      {getSeverityBadge(deficiency.severity)}
                    </div>
                    {(deficiency.required_value || deficiency.actual_value) && (
                      <div className="text-sm space-y-1">
                        {deficiency.required_value && (
                          <p className="text-gray-600">
                            <span className="text-gray-500">Required:</span> {deficiency.required_value}
                          </p>
                        )}
                        {deficiency.actual_value && (
                          <p className="text-gray-600">
                            <span className="text-gray-500">Actual:</span> {deficiency.actual_value}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No Extraction Data */}
          {!extractedData && document.processing_status === 'pending' && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-2">
                <Clock className="w-5 h-5 text-amber-600" />
                <h3 className="font-medium text-amber-800">Awaiting Processing</h3>
              </div>
              <p className="text-sm text-amber-700">
                This document has not been processed yet. Click "Reprocess" to extract policy details using AI.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
