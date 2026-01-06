"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  FileText,
  Upload,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Trash2,
  Loader2,
  AlertTriangle,
  Download
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog"
import { useToast } from "@/components/ui/use-toast"

interface Document {
  id: string
  file_url: string
  file_name: string | null
  file_size: number | null
  source: string
  processing_status: string
  created_at: string
  subcontractor_name: string
  subcontractor_abn: string
  project_name: string
  verification_status: string | null
  confidence_score: number | null
}

interface Project {
  id: string
  name: string
}

interface Subcontractor {
  id: string
  name: string
  abn: string
}

interface ProjectSubcontractor {
  project_subcontractor_id: string
  id: string
  name: string
  abn: string
  status: string
}

const STATUS_STYLES: Record<string, { bg: string; text: string; icon: typeof CheckCircle }> = {
  pass: { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle },
  fail: { bg: 'bg-red-100', text: 'text-red-700', icon: XCircle },
  review: { bg: 'bg-amber-100', text: 'text-amber-700', icon: Clock }
}

const PROCESSING_STYLES: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'bg-slate-100', text: 'text-slate-600' },
  processing: { bg: 'bg-blue-100', text: 'text-blue-700' },
  completed: { bg: 'bg-green-100', text: 'text-green-700' },
  failed: { bg: 'bg-red-100', text: 'text-red-700' }
}

export default function DocumentsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [documents, setDocuments] = useState<Document[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [userRole, setUserRole] = useState<string | null>(null)

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [uploadedCount, setUploadedCount] = useState(0)
  const [totalToUpload, setTotalToUpload] = useState(0)

  // Project/Subcontractor selection for upload
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [projectSubcontractors, setProjectSubcontractors] = useState<ProjectSubcontractor[]>([])
  const [selectedSubcontractorId, setSelectedSubcontractorId] = useState('')

  useEffect(() => {
    fetchUserRole()
    fetchDocuments()
    fetchProjects()
  }, [])

  useEffect(() => {
    if (selectedProjectId) {
      fetchProjectSubcontractors(selectedProjectId)
    } else {
      setProjectSubcontractors([])
      setSelectedSubcontractorId('')
    }
  }, [selectedProjectId])

  const fetchUserRole = async () => {
    try {
      const response = await fetch('/api/auth/me')
      if (response.ok) {
        const data = await response.json()
        setUserRole(data.user.role)
      }
    } catch (error) {
      console.error('Failed to fetch user role:', error)
    }
  }

  const fetchDocuments = async () => {
    try {
      const response = await fetch('/api/documents')
      if (response.ok) {
        const data = await response.json()
        setDocuments(data.documents || [])
      }
    } catch (error) {
      console.error('Failed to fetch documents:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects')
      if (response.ok) {
        const data = await response.json()
        setProjects(data.projects || [])
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error)
    }
  }

  const fetchProjectSubcontractors = async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/subcontractors`)
      if (response.ok) {
        const data = await response.json()
        setProjectSubcontractors(data.subcontractors || [])
      }
    } catch (error) {
      console.error('Failed to fetch project subcontractors:', error)
    }
  }

  const canModify = userRole && userRole !== 'read_only'

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
      validateAndAddFiles(Array.from(files))
    }
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      validateAndAddFiles(Array.from(files))
    }
  }

  const validateAndAddFiles = (files: File[]) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif']
    const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.gif']
    const maxSize = 10 * 1024 * 1024 // 10MB
    const validFiles: File[] = []
    const errors: string[] = []

    for (const file of files) {
      // Check file extension as well as MIME type
      const extension = '.' + file.name.split('.').pop()?.toLowerCase()
      const isValidType = allowedTypes.includes(file.type) ||
        (file.type === '' && allowedExtensions.includes(extension))

      if (!isValidType) {
        errors.push(`${file.name}: Invalid file type. Only PDF and image files (${allowedExtensions.join(', ')}) are accepted.`)
        continue
      }
      if (file.size > maxSize) {
        errors.push(`${file.name}: File too large (max 10MB)`)
        continue
      }
      validFiles.push(file)
    }

    if (errors.length > 0) {
      toast({
        title: "File type not accepted",
        description: errors.slice(0, 3).join(' ') + (errors.length > 3 ? ` And ${errors.length - 3} more.` : ''),
        variant: "destructive"
      })
    }

    if (validFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...validFiles])
    }
  }

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleClearFiles = () => {
    setSelectedFiles([])
  }

  const handleOpenUploadModal = () => {
    setSelectedFiles([])
    setSelectedProjectId('')
    setSelectedSubcontractorId('')
    setUploadProgress(0)
    setUploadedCount(0)
    setTotalToUpload(0)
    setShowUploadModal(true)
  }

  const handleUpload = async () => {
    if (selectedFiles.length === 0 || !selectedProjectId || !selectedSubcontractorId) {
      toast({
        title: "Missing information",
        description: "Please select at least one file, a project, and a subcontractor",
        variant: "destructive"
      })
      return
    }

    setIsUploading(true)
    setTotalToUpload(selectedFiles.length)
    setUploadedCount(0)
    setUploadProgress(0)

    let successCount = 0
    let failCount = 0

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i]
      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('projectId', selectedProjectId)
        formData.append('subcontractorId', selectedSubcontractorId)

        const progress = Math.round(((i + 0.5) / selectedFiles.length) * 100)
        setUploadProgress(progress)

        const response = await fetch('/api/documents', {
          method: 'POST',
          body: formData
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Upload failed')
        }

        successCount++
        setUploadedCount(successCount)
        setUploadProgress(Math.round(((i + 1) / selectedFiles.length) * 100))
      } catch (error) {
        failCount++
        console.error(`Failed to upload ${file.name}:`, error)
      }
    }

    // Show summary toast
    if (successCount > 0 && failCount === 0) {
      toast({
        title: "Success",
        description: `${successCount} document${successCount > 1 ? 's' : ''} uploaded successfully`
      })
    } else if (successCount > 0 && failCount > 0) {
      toast({
        title: "Partial success",
        description: `${successCount} uploaded, ${failCount} failed`,
        variant: "destructive"
      })
    } else {
      toast({
        title: "Upload failed",
        description: "Failed to upload documents",
        variant: "destructive"
      })
    }

    setShowUploadModal(false)
    fetchDocuments() // Refresh the list
    setIsUploading(false)
    setUploadProgress(0)
  }

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown size'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const filteredDocuments = documents.filter(doc => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      (doc.file_name && doc.file_name.toLowerCase().includes(query)) ||
      doc.subcontractor_name.toLowerCase().includes(query) ||
      doc.project_name.toLowerCase().includes(query) ||
      doc.subcontractor_abn.includes(query)
    )
  })

  return (
    <>
      {/* Page Header */}
      <header className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Documents</h1>
            <p className="text-slate-500">Manage Certificates of Currency</p>
          </div>
          {canModify && (
            <Button onClick={handleOpenUploadModal}>
              <Upload className="h-4 w-4 mr-2" />
              Upload COC
            </Button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="p-6 space-y-6">
        {/* Search and Stats */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Search by filename, subcontractor, or project..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Total Documents</p>
                  <p className="text-3xl font-bold mt-1">{documents.length}</p>
                </div>
                <div className="p-2 bg-slate-100 rounded-lg">
                  <FileText className="h-5 w-5 text-slate-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Passed</p>
                  <p className="text-3xl font-bold mt-1 text-green-600">
                    {documents.filter(d => d.verification_status === 'pass').length}
                  </p>
                </div>
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Failed</p>
                  <p className="text-3xl font-bold mt-1 text-red-600">
                    {documents.filter(d => d.verification_status === 'fail').length}
                  </p>
                </div>
                <div className="p-2 bg-red-100 rounded-lg">
                  <XCircle className="h-5 w-5 text-red-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Pending Review</p>
                  <p className="text-3xl font-bold mt-1 text-amber-600">
                    {documents.filter(d => d.verification_status === 'review').length}
                  </p>
                </div>
                <div className="p-2 bg-amber-100 rounded-lg">
                  <Clock className="h-5 w-5 text-amber-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Documents List */}
        <Card>
          <CardHeader>
            <CardTitle>All Documents</CardTitle>
            <CardDescription>View and manage uploaded certificates</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-12">
                <Loader2 className="h-8 w-8 mx-auto animate-spin text-slate-400" />
                <p className="text-sm text-slate-500 mt-2">Loading documents...</p>
              </div>
            ) : filteredDocuments.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <FileText className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                <p className="font-medium">No documents found</p>
                <p className="text-sm mt-1">
                  {documents.length === 0
                    ? "Upload a Certificate of Currency to get started"
                    : "No documents match your search"
                  }
                </p>
                {canModify && documents.length === 0 && (
                  <Button className="mt-4" onClick={handleOpenUploadModal}>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload First COC
                  </Button>
                )}
              </div>
            ) : (
              <div className="divide-y">
                {filteredDocuments.map((doc) => {
                  const verificationStyle = STATUS_STYLES[doc.verification_status || 'review'] || STATUS_STYLES.review
                  const processingStyle = PROCESSING_STYLES[doc.processing_status] || PROCESSING_STYLES.pending
                  const StatusIcon = verificationStyle.icon

                  return (
                    <div key={doc.id} className="py-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div
                          className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center cursor-pointer hover:bg-slate-200 transition-colors"
                          onClick={() => router.push(`/dashboard/documents/${doc.id}`)}
                        >
                          <FileText className="h-5 w-5 text-slate-500" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className="font-medium text-slate-900 hover:text-blue-600 cursor-pointer transition-colors"
                              onClick={() => router.push(`/dashboard/documents/${doc.id}`)}
                            >
                              {doc.file_name || 'Untitled Document'}
                            </span>
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${verificationStyle.bg} ${verificationStyle.text}`}>
                              <StatusIcon className="h-3 w-3 inline mr-1" />
                              {doc.verification_status ? doc.verification_status.charAt(0).toUpperCase() + doc.verification_status.slice(1) : 'Review'}
                            </span>
                            {doc.processing_status !== 'completed' && (
                              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${processingStyle.bg} ${processingStyle.text}`}>
                                {doc.processing_status === 'processing' && <Loader2 className="h-3 w-3 inline mr-1 animate-spin" />}
                                {doc.processing_status.charAt(0).toUpperCase() + doc.processing_status.slice(1)}
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-slate-500 mt-0.5">
                            <span>{doc.subcontractor_name}</span>
                            <span className="mx-2">•</span>
                            <span>{doc.project_name}</span>
                            <span className="mx-2">•</span>
                            <span>{formatFileSize(doc.file_size)}</span>
                            <span className="mx-2">•</span>
                            <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" asChild>
                          <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                            <Eye className="h-4 w-4" />
                          </a>
                        </Button>
                        <Button variant="ghost" size="sm" asChild>
                          <a href={doc.file_url} download={doc.file_name}>
                            <Download className="h-4 w-4" />
                          </a>
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upload Modal */}
      <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
        <DialogContent onClose={() => setShowUploadModal(false)} className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" />
              Upload Certificate of Currency
            </DialogTitle>
            <DialogDescription>
              Upload one or more COC documents for verification
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* Drag and Drop Zone */}
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                isDragging
                  ? 'border-primary bg-primary/5'
                  : selectedFiles.length > 0
                    ? 'border-green-500 bg-green-50'
                    : 'border-slate-300 hover:border-slate-400'
              }`}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <div className="space-y-2">
                <Upload className={`h-10 w-10 mx-auto ${isDragging ? 'text-primary' : 'text-slate-400'}`} />
                <p className="font-medium text-slate-900">
                  {isDragging ? 'Drop files here' : 'Drag and drop files here'}
                </p>
                <p className="text-sm text-slate-500">or</p>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,image/*"
                    multiple
                    onChange={handleFileSelect}
                  />
                  <Button variant="outline" size="sm" asChild>
                    <span>Browse Files</span>
                  </Button>
                </label>
                <p className="text-xs text-slate-400 mt-2">
                  PDF or images up to 10MB each. Select multiple files at once.
                </p>
              </div>
            </div>

            {/* Selected Files List */}
            {selectedFiles.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} selected</Label>
                  <Button variant="ghost" size="sm" onClick={handleClearFiles}>
                    Clear all
                  </Button>
                </div>
                <div className="max-h-32 overflow-y-auto border rounded-lg divide-y">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 hover:bg-slate-50">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-slate-400" />
                        <span className="text-sm truncate max-w-[200px]">{file.name}</span>
                        <span className="text-xs text-slate-400">{formatFileSize(file.size)}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => handleRemoveFile(index)}
                      >
                        <Trash2 className="h-3 w-3 text-slate-400 hover:text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Project Selection */}
            <div className="space-y-2">
              <Label htmlFor="projectSelect">Project *</Label>
              <Select
                id="projectSelect"
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
              >
                <option value="">Select a project...</option>
                {projects.map(project => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </Select>
            </div>

            {/* Subcontractor Selection */}
            <div className="space-y-2">
              <Label htmlFor="subcontractorSelect">Subcontractor *</Label>
              <Select
                id="subcontractorSelect"
                value={selectedSubcontractorId}
                onChange={(e) => setSelectedSubcontractorId(e.target.value)}
                disabled={!selectedProjectId}
              >
                <option value="">
                  {selectedProjectId
                    ? projectSubcontractors.length === 0
                      ? 'No subcontractors assigned to this project'
                      : 'Select a subcontractor...'
                    : 'Select a project first...'
                  }
                </option>
                {projectSubcontractors.map(sub => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name} (ABN: {sub.abn})
                  </option>
                ))}
              </Select>
              {selectedProjectId && projectSubcontractors.length === 0 && (
                <p className="text-sm text-amber-600">
                  <AlertTriangle className="h-4 w-4 inline mr-1" />
                  No subcontractors are assigned to this project. Please add a subcontractor first.
                </p>
              )}
            </div>

            {/* Upload Progress */}
            {isUploading && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">
                    Uploading {uploadedCount + 1} of {totalToUpload}...
                  </span>
                  <span className="text-slate-600">{uploadProgress}%</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowUploadModal(false)}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleUpload}
              disabled={isUploading || selectedFiles.length === 0 || !selectedProjectId || !selectedSubcontractorId}
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload {selectedFiles.length > 1 ? `${selectedFiles.length} Files` : 'File'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
