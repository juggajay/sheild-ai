"use client"

import { useState, useEffect, useCallback, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import {
  Shield, Loader2, Upload, FileCheck, CheckCircle, XCircle, AlertTriangle,
  ArrowLeft, File, X, PartyPopper, ChevronDown, ChevronUp
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"

interface User {
  id: string
  email: string
  name: string
  role: string
}

interface Builder {
  id: string
  name: string
  subcontractorId: string
  projects: Array<{
    id: string
    name: string
    complianceStatus: string
  }>
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

interface VerificationResult {
  status: 'pass' | 'fail' | 'review'
  confidence_score: number
  checks: Check[]
  deficiencies: Deficiency[]
  extracted_data: {
    insurer_name: string
    policy_number: string
    period_start: string
    period_end: string
    coverages: Array<{
      type: string
      limit: string
    }>
  }
}

const SEVERITY_STYLES = {
  critical: { bg: 'bg-red-100', text: 'text-red-700', label: 'Critical' },
  major: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Major' },
  minor: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Minor' }
}

function UploadContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [builders, setBuilders] = useState<Builder[]>([])

  // Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  // Selection state
  const [selectedBuilderId, setSelectedBuilderId] = useState<string>("")
  const [selectedProjectId, setSelectedProjectId] = useState<string>("")

  // Result state
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null)
  const [showAllChecks, setShowAllChecks] = useState(false)

  // Pre-select from URL params
  useEffect(() => {
    const subcontractor = searchParams.get('subcontractor')
    const project = searchParams.get('project')
    if (subcontractor && project) {
      // Will be auto-selected once builders load
      setSelectedProjectId(project)
    }
  }, [searchParams])

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

          // Auto-select first builder if only one
          if (buildersData.builders.length === 1) {
            setSelectedBuilderId(buildersData.builders[0].id)
          }

          // Check for pre-selected project from URL
          const projectParam = searchParams.get('project')
          if (projectParam) {
            for (const builder of buildersData.builders) {
              const project = builder.projects.find((p: { id: string }) => p.id === projectParam)
              if (project) {
                setSelectedBuilderId(builder.id)
                setSelectedProjectId(projectParam)
                break
              }
            }
          }
        }
      } catch (error) {
        router.push("/portal/login")
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [router, searchParams])

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      validateAndSetFile(files[0])
    }
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      validateAndSetFile(files[0])
    }
  }

  const validateAndSetFile = (file: File) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png']
    const maxSize = 10 * 1024 * 1024 // 10MB

    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF, JPG, or PNG file",
        variant: "destructive"
      })
      return
    }

    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: "Maximum file size is 10MB",
        variant: "destructive"
      })
      return
    }

    setSelectedFile(file)
    setVerificationResult(null)
  }

  const handleUpload = async () => {
    if (!selectedFile || !selectedProjectId || !selectedBuilderId) {
      toast({
        title: "Missing information",
        description: "Please select a builder, project, and file",
        variant: "destructive"
      })
      return
    }

    const selectedBuilder = builders.find(b => b.id === selectedBuilderId)
    if (!selectedBuilder) return

    setIsUploading(true)
    setUploadProgress(0)

    // Simulate upload progress
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => Math.min(prev + 10, 90))
    }, 200)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('projectId', selectedProjectId)
      formData.append('subcontractorId', selectedBuilder.subcontractorId)

      const response = await fetch('/api/portal/upload', {
        method: 'POST',
        body: formData
      })

      clearInterval(progressInterval)
      setUploadProgress(100)

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Upload failed')
      }

      const data = await response.json()
      setVerificationResult(data.verification)

      if (data.verification.status === 'pass') {
        toast({
          title: "Certificate Approved!",
          description: "Your certificate meets all requirements",
        })
      } else {
        toast({
          title: "Issues Found",
          description: "Please review the verification results below",
          variant: "destructive"
        })
      }

    } catch (error) {
      clearInterval(progressInterval)
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive"
      })
    } finally {
      setIsUploading(false)
    }
  }

  const resetUpload = () => {
    setSelectedFile(null)
    setVerificationResult(null)
    setUploadProgress(0)
  }

  const selectedBuilder = builders.find(b => b.id === selectedBuilderId)
  const selectedProject = selectedBuilder?.projects.find(p => p.id === selectedProjectId)

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
          <div className="flex items-center gap-4">
            <Link href="/portal/dashboard" className="text-slate-600 hover:text-slate-900">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex items-center gap-2">
              <Shield className="h-8 w-8 text-primary" />
              <div>
                <span className="text-lg font-semibold">RiskShield AI</span>
                <span className="text-sm text-slate-500 ml-2">Upload Certificate</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Success Celebration */}
        {verificationResult?.status === 'pass' && (
          <Card className="mb-8 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
            <CardContent className="py-12 text-center">
              <div className="mb-6 relative inline-block">
                <div className="h-24 w-24 bg-green-100 rounded-full flex items-center justify-center mx-auto animate-bounce">
                  <CheckCircle className="h-14 w-14 text-green-600" />
                </div>
                <PartyPopper className="h-8 w-8 text-amber-500 absolute -top-2 -right-2 animate-pulse" />
                <PartyPopper className="h-8 w-8 text-purple-500 absolute -bottom-2 -left-2 animate-pulse" style={{ transform: 'scaleX(-1)' }} />
              </div>
              <h2 className="text-3xl font-bold text-green-700 mb-2">Certificate Approved!</h2>
              <p className="text-green-600 text-lg mb-6">
                Your insurance certificate meets all requirements for {selectedProject?.name}
              </p>
              <div className="flex justify-center gap-4">
                <Button variant="outline" onClick={resetUpload}>
                  Upload Another
                </Button>
                <Link href="/portal/dashboard">
                  <Button>
                    Back to Dashboard
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Failure Result */}
        {verificationResult?.status === 'fail' && (
          <Card className="mb-8 border-red-200 bg-red-50">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center">
                  <XCircle className="h-7 w-7 text-red-600" />
                </div>
                <div>
                  <CardTitle className="text-red-700">Issues Found</CardTitle>
                  <CardDescription className="text-red-600">
                    Your certificate does not meet all requirements
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Deficiencies */}
              <div className="mb-6">
                <h4 className="font-semibold text-red-700 mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Deficiencies ({verificationResult.deficiencies.length})
                </h4>
                <div className="space-y-3">
                  {verificationResult.deficiencies.map((deficiency, index) => {
                    const style = SEVERITY_STYLES[deficiency.severity]
                    return (
                      <div key={index} className="bg-white border border-red-200 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                          <span className="font-medium text-slate-900">{deficiency.description}</span>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${style.bg} ${style.text}`}>
                            {style.label}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-slate-500">Required:</span>{' '}
                            <span className="font-medium text-slate-700">{deficiency.required_value}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Actual:</span>{' '}
                            <span className="font-medium text-red-600">{deficiency.actual_value}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4">
                <Button variant="outline" onClick={resetUpload} className="flex-1">
                  Upload Different Certificate
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Extracted Data Summary (for both pass and fail) */}
        {verificationResult && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileCheck className="h-5 w-5" />
                Extracted Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div>
                  <span className="text-sm text-slate-500">Insurer</span>
                  <p className="font-medium">{verificationResult.extracted_data.insurer_name}</p>
                </div>
                <div>
                  <span className="text-sm text-slate-500">Policy Number</span>
                  <p className="font-medium">{verificationResult.extracted_data.policy_number}</p>
                </div>
                <div>
                  <span className="text-sm text-slate-500">Period Start</span>
                  <p className="font-medium">{new Date(verificationResult.extracted_data.period_start).toLocaleDateString()}</p>
                </div>
                <div>
                  <span className="text-sm text-slate-500">Period End</span>
                  <p className="font-medium">{new Date(verificationResult.extracted_data.period_end).toLocaleDateString()}</p>
                </div>
              </div>
              <div>
                <span className="text-sm text-slate-500">Coverages</span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {verificationResult.extracted_data.coverages.map((cov, i) => (
                    <span key={i} className="px-2 py-1 bg-slate-100 rounded text-sm">
                      {cov.type}: {cov.limit}
                    </span>
                  ))}
                </div>
              </div>

              {/* All Checks Expandable */}
              <div className="mt-4 pt-4 border-t">
                <button
                  onClick={() => setShowAllChecks(!showAllChecks)}
                  className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
                >
                  {showAllChecks ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  {showAllChecks ? 'Hide' : 'Show'} All Verification Checks ({verificationResult.checks.length})
                </button>
                {showAllChecks && (
                  <div className="mt-3 space-y-2">
                    {verificationResult.checks.map((check, index) => (
                      <div key={index} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                        <span className="text-sm text-slate-700">{check.description}</span>
                        <span className={`flex items-center gap-1 text-sm font-medium ${
                          check.status === 'pass' ? 'text-green-600' :
                          check.status === 'fail' ? 'text-red-600' : 'text-amber-600'
                        }`}>
                          {check.status === 'pass' && <CheckCircle className="h-4 w-4" />}
                          {check.status === 'fail' && <XCircle className="h-4 w-4" />}
                          {check.status === 'warning' && <AlertTriangle className="h-4 w-4" />}
                          {check.status.charAt(0).toUpperCase() + check.status.slice(1)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Upload Form (hidden when showing results) */}
        {!verificationResult && (
          <>
            {/* Builder & Project Selection */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Select Project</CardTitle>
                <CardDescription>Choose which project this certificate is for</CardDescription>
              </CardHeader>
              <CardContent>
                {builders.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <p>No builder relationships found.</p>
                    <p className="text-sm">You need to be assigned to a project before uploading certificates.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Builder Selection */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Builder</label>
                      <select
                        value={selectedBuilderId}
                        onChange={(e) => {
                          setSelectedBuilderId(e.target.value)
                          setSelectedProjectId("")
                        }}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                      >
                        <option value="">Select a builder...</option>
                        {builders.map(builder => (
                          <option key={builder.id} value={builder.id}>{builder.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Project Selection */}
                    {selectedBuilder && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Project</label>
                        <select
                          value={selectedProjectId}
                          onChange={(e) => setSelectedProjectId(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                        >
                          <option value="">Select a project...</option>
                          {selectedBuilder.projects.map(project => (
                            <option key={project.id} value={project.id}>
                              {project.name} ({project.complianceStatus})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* File Upload */}
            <Card>
              <CardHeader>
                <CardTitle>Upload Certificate</CardTitle>
                <CardDescription>Drag and drop your Certificate of Currency or click to browse</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Drag Drop Zone */}
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    isDragging ? 'border-primary bg-primary/5' :
                    selectedFile ? 'border-green-500 bg-green-50' : 'border-slate-300'
                  }`}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                >
                  {selectedFile ? (
                    <div className="flex items-center justify-center gap-4">
                      <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                        <File className="h-6 w-6 text-green-600" />
                      </div>
                      <div className="text-left">
                        <p className="font-medium text-slate-900">{selectedFile.name}</p>
                        <p className="text-sm text-slate-500">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedFile(null)} aria-label="Remove selected file">
                        <X className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Upload className={`h-10 w-10 mx-auto mb-4 ${isDragging ? 'text-primary' : 'text-slate-400'}`} />
                      <p className="text-lg font-medium text-slate-700 mb-1">
                        {isDragging ? 'Drop file here' : 'Drag and drop your file here'}
                      </p>
                      <p className="text-sm text-slate-500 mb-4">or</p>
                      <label>
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={handleFileSelect}
                          className="hidden"
                        />
                        <Button variant="outline" asChild>
                          <span className="cursor-pointer">Browse Files</span>
                        </Button>
                      </label>
                      <p className="text-xs text-slate-400 mt-4">Supported: PDF, JPG, PNG (max 10MB)</p>
                    </>
                  )}
                </div>

                {/* Upload Progress */}
                {isUploading && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-slate-600">Processing...</span>
                      <span className="text-sm font-medium text-primary">{uploadProgress}%</span>
                    </div>
                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-2 text-center">
                      Extracting policy details and verifying against requirements...
                    </p>
                  </div>
                )}

                {/* Upload Button */}
                {!isUploading && (
                  <Button
                    className="w-full mt-6"
                    size="lg"
                    onClick={handleUpload}
                    disabled={!selectedFile || !selectedProjectId || !selectedBuilderId}
                  >
                    <Upload className="h-5 w-5 mr-2" />
                    Upload & Verify Certificate
                  </Button>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  )
}

export default function PortalUploadPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <UploadContent />
    </Suspense>
  )
}
