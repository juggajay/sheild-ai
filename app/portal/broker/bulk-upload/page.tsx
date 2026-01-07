"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  Shield, Loader2, Upload, Users, Building2, CheckCircle, XCircle, Clock, LogOut,
  AlertTriangle, ChevronLeft, FileUp, Trash2, AlertCircle, FileCheck, X
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import { Select } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"

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
  projects: ClientProject[]
}

interface FileMapping {
  file: File
  subcontractorId: string
  projectId: string
}

interface UploadResult {
  fileIndex: number
  fileName: string
  subcontractorId: string
  subcontractorName: string
  projectId: string
  projectName: string
  status: 'success' | 'error'
  verificationStatus?: string
  documentId?: string
  error?: string
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  pass: { bg: 'bg-green-100', text: 'text-green-700', label: 'Compliant' },
  fail: { bg: 'bg-red-100', text: 'text-red-700', label: 'Non-Compliant' },
  review: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Needs Review' },
  success: { bg: 'bg-green-100', text: 'text-green-700', label: 'Uploaded' },
  error: { bg: 'bg-red-100', text: 'text-red-700', label: 'Error' }
}

export default function BrokerBulkUploadPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [user, setUser] = useState<UserData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [clients, setClients] = useState<Client[]>([])
  const [fileMappings, setFileMappings] = useState<FileMapping[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadResults, setUploadResults] = useState<UploadResult[] | null>(null)
  const [dragActive, setDragActive] = useState(false)

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
        }
      } catch (error) {
        router.push("/portal/login")
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [router])

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files))
    }
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(Array.from(e.target.files))
    }
    // Reset input
    e.target.value = ''
  }

  const addFiles = (newFiles: File[]) => {
    // Filter for valid file types
    const validFiles = newFiles.filter(file => {
      const ext = file.name.toLowerCase()
      return ext.endsWith('.pdf') || ext.endsWith('.png') || ext.endsWith('.jpg') || ext.endsWith('.jpeg')
    })

    const newMappings: FileMapping[] = validFiles.map(file => ({
      file,
      subcontractorId: '',
      projectId: ''
    }))

    setFileMappings(prev => [...prev, ...newMappings])
  }

  const removeFile = (index: number) => {
    setFileMappings(prev => prev.filter((_, i) => i !== index))
  }

  const updateMapping = (index: number, field: 'subcontractorId' | 'projectId', value: string) => {
    setFileMappings(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      // Reset projectId when subcontractor changes
      if (field === 'subcontractorId') {
        updated[index].projectId = ''
      }
      return updated
    })
  }

  const getClientProjects = (subcontractorId: string): ClientProject[] => {
    const client = clients.find(c => c.id === subcontractorId)
    return client?.projects || []
  }

  const isReadyToUpload = fileMappings.length > 0 && fileMappings.every(m => m.subcontractorId && m.projectId)

  const handleUpload = async () => {
    if (!isReadyToUpload) return

    setIsUploading(true)
    setUploadProgress(10)
    setUploadResults(null)

    try {
      const formData = new FormData()

      // Add files
      fileMappings.forEach((mapping, index) => {
        formData.append(`file_${index}`, mapping.file)
      })

      // Add mappings
      const mappings = fileMappings.map((mapping, index) => ({
        fileIndex: index,
        subcontractorId: mapping.subcontractorId,
        projectId: mapping.projectId
      }))
      formData.append('mappings', JSON.stringify(mappings))

      setUploadProgress(30)

      const response = await fetch('/api/portal/broker/bulk-upload', {
        method: 'POST',
        body: formData
      })

      setUploadProgress(70)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Upload failed')
      }

      const data = await response.json()
      setUploadProgress(100)
      setUploadResults(data.results)

      toast({
        title: "Upload Complete",
        description: `${data.summary.processed} of ${data.summary.totalFiles} files processed successfully.`,
      })

    } catch (error) {
      console.error('Upload error:', error)
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload files",
        variant: "destructive"
      })
    } finally {
      setIsUploading(false)
    }
  }

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

  const resetUpload = () => {
    setFileMappings([])
    setUploadResults(null)
    setUploadProgress(0)
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
        {/* Back Link */}
        <Link href="/portal/broker" className="inline-flex items-center text-sm text-slate-600 hover:text-slate-900 mb-6">
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back to Dashboard
        </Link>

        {/* Title */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FileUp className="h-6 w-6" />
            Bulk COC Upload
          </h1>
          <p className="text-slate-600">Upload multiple certificates of currency for your clients at once.</p>
        </div>

        {uploadResults ? (
          // Results View
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileCheck className="h-5 w-5" />
                Upload Results
              </CardTitle>
              <CardDescription>
                {uploadResults.filter(r => r.status === 'success').length} of {uploadResults.length} files uploaded successfully
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {uploadResults.map((result, index) => {
                  const statusStyle = STATUS_STYLES[result.status] || STATUS_STYLES.error
                  const verifyStyle = result.verificationStatus ? STATUS_STYLES[result.verificationStatus] : null

                  return (
                    <div key={index} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        {result.status === 'success' ? (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-500" />
                        )}
                        <div>
                          <p className="font-medium">{result.fileName}</p>
                          <p className="text-sm text-slate-500">
                            {result.subcontractorName} • {result.projectName}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {verifyStyle && (
                          <span className={`px-2 py-1 rounded text-xs font-medium ${verifyStyle.bg} ${verifyStyle.text}`}>
                            {verifyStyle.label}
                          </span>
                        )}
                        {result.error && (
                          <span className="text-sm text-red-600">{result.error}</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="mt-6 flex gap-4">
                <Button onClick={resetUpload} variant="outline">
                  Upload More Files
                </Button>
                <Link href="/portal/broker">
                  <Button>
                    Back to Dashboard
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          // Upload Form
          <div className="space-y-6">
            {/* Drop Zone */}
            <Card>
              <CardHeader>
                <CardTitle>Select Files</CardTitle>
                <CardDescription>
                  Drag and drop COC documents or click to browse. Supported formats: PDF, PNG, JPG
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    dragActive
                      ? 'border-primary bg-primary/5'
                      : 'border-slate-300 hover:border-slate-400'
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <Upload className="h-12 w-12 mx-auto mb-4 text-slate-400" />
                  <p className="text-slate-600 mb-2">
                    Drag and drop files here, or{' '}
                    <label className="text-primary hover:underline cursor-pointer">
                      browse
                      <input
                        type="file"
                        className="hidden"
                        multiple
                        accept=".pdf,.png,.jpg,.jpeg"
                        onChange={handleFileSelect}
                      />
                    </label>
                  </p>
                  <p className="text-sm text-slate-500">PDF, PNG, or JPEG up to 10MB each</p>
                </div>
              </CardContent>
            </Card>

            {/* File Mappings */}
            {fileMappings.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Map Files to Clients ({fileMappings.length})</span>
                    {fileMappings.length > 0 && (
                      <Button variant="ghost" size="sm" onClick={() => setFileMappings([])}>
                        <Trash2 className="h-4 w-4 mr-1" />
                        Clear All
                      </Button>
                    )}
                  </CardTitle>
                  <CardDescription>
                    Assign each file to a client and project
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {fileMappings.map((mapping, index) => (
                      <div key={index} className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg">
                        {/* File Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-3">
                            <FileUp className="h-4 w-4 text-slate-500 flex-shrink-0" />
                            <span className="font-medium truncate">{mapping.file.name}</span>
                            <span className="text-xs text-slate-500">
                              ({(mapping.file.size / 1024).toFixed(0)} KB)
                            </span>
                          </div>

                          <div className="grid md:grid-cols-2 gap-4">
                            {/* Client Select */}
                            <div>
                              <label className="text-sm text-slate-600 mb-1 block">Client</label>
                              <Select
                                value={mapping.subcontractorId}
                                onChange={(e) => updateMapping(index, 'subcontractorId', e.target.value)}
                              >
                                <option value="">Select client...</option>
                                {clients.map(client => (
                                  <option key={client.id} value={client.id}>
                                    {client.name}
                                  </option>
                                ))}
                              </Select>
                            </div>

                            {/* Project Select */}
                            <div>
                              <label className="text-sm text-slate-600 mb-1 block">Project</label>
                              <Select
                                value={mapping.projectId}
                                onChange={(e) => updateMapping(index, 'projectId', e.target.value)}
                                disabled={!mapping.subcontractorId}
                              >
                                <option value="">{mapping.subcontractorId ? "Select project..." : "Select client first"}</option>
                                {getClientProjects(mapping.subcontractorId).map(project => (
                                  <option key={project.id} value={project.id}>
                                    {project.name}
                                  </option>
                                ))}
                              </Select>
                            </div>
                          </div>
                        </div>

                        {/* Remove Button */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="flex-shrink-0"
                          onClick={() => removeFile(index)}
                          aria-label={`Remove file ${mapping.file.name}`}
                        >
                          <X className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  {/* Validation Warning */}
                  {fileMappings.some(m => !m.subcontractorId || !m.projectId) && (
                    <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                      <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-amber-800">
                        Please assign a client and project to each file before uploading.
                      </p>
                    </div>
                  )}

                  {/* Upload Progress */}
                  {isUploading && (
                    <div className="mt-6">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Uploading...</span>
                        <span className="text-sm text-slate-500">{uploadProgress}%</span>
                      </div>
                      <Progress value={uploadProgress} className="h-2" />
                    </div>
                  )}

                  {/* Upload Button */}
                  <div className="mt-6 flex justify-end gap-4">
                    <Link href="/portal/broker">
                      <Button variant="outline">
                        Cancel
                      </Button>
                    </Link>
                    <Button
                      onClick={handleUpload}
                      disabled={!isReadyToUpload || isUploading}
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Upload All ({fileMappings.length} files)
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* No Clients Warning */}
            {clients.length === 0 && (
              <Card className="border-amber-200 bg-amber-50">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
                    <div>
                      <h3 className="font-medium text-amber-800">No Clients Available</h3>
                      <p className="text-sm text-amber-700 mt-1">
                        You don't have any client subcontractors assigned to you. Clients will appear here when builders assign you as their broker.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
