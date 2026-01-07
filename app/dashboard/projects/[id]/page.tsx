"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  MapPin,
  Calendar,
  DollarSign,
  Users,
  CheckCircle,
  AlertTriangle,
  Clock,
  FileCheck,
  Settings,
  Shield,
  Plus,
  Trash2,
  Mail,
  Copy,
  Check,
  Loader2,
  X,
  Filter,
  FileDown,
  FileText,
  Upload,
  Sparkles
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog"
import { useToast } from "@/components/ui/use-toast"

interface Project {
  id: string
  name: string
  address: string | null
  state: string | null
  status: string
  start_date: string | null
  end_date: string | null
  estimated_value: number | null
  forwarding_email: string | null
  updated_at: string | null
  project_manager: {
    id: string
    name: string
    email: string
  } | null
  counts: {
    total: number
    compliant: number
    non_compliant: number
    pending: number
    exception: number
  }
  requirements: Array<{
    id: string
    coverage_type: string
    minimum_limit: number | null
    maximum_excess: number | null
  }>
}

interface Subcontractor {
  id: string
  name: string
  abn: string
  trade: string | null
}

interface ProjectSubcontractor {
  project_subcontractor_id: string
  id: string
  name: string
  abn: string
  trade: string | null
  status: string
  on_site_date: string | null
  assigned_at: string
}

interface InsuranceRequirement {
  id?: string
  coverage_type: string
  minimum_limit: number | null
  limit_type: string
  maximum_excess: number | null
  principal_indemnity_required: boolean
  cross_liability_required: boolean
  other_requirements: string | null
}

const COVERAGE_TYPES = [
  { value: 'public_liability', label: 'Public Liability' },
  { value: 'products_liability', label: 'Products Liability' },
  { value: 'workers_comp', label: 'Workers Compensation' },
  { value: 'professional_indemnity', label: 'Professional Indemnity' },
  { value: 'motor_vehicle', label: 'Motor Vehicle' },
  { value: 'contract_works', label: 'Contract Works' }
]

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: 'bg-green-100', text: 'text-green-700', label: 'Active' },
  completed: { bg: 'bg-slate-100', text: 'text-slate-700', label: 'Completed' },
  on_hold: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'On Hold' }
}

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [project, setProject] = useState<Project | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [accessDenied, setAccessDenied] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)

  // Project subcontractors state
  const [projectSubcontractors, setProjectSubcontractors] = useState<ProjectSubcontractor[]>([])
  const [isLoadingSubcontractors, setIsLoadingSubcontractors] = useState(false)
  const [subStatusFilter, setSubStatusFilter] = useState<string>('all')

  // Add subcontractor modal state
  const [showAddSubModal, setShowAddSubModal] = useState(false)
  const [availableSubcontractors, setAvailableSubcontractors] = useState<Subcontractor[]>([])
  const [selectedSubcontractorId, setSelectedSubcontractorId] = useState('')
  const [onSiteDate, setOnSiteDate] = useState('')
  const [subSearchQuery, setSubSearchQuery] = useState('')
  const [isAddingSub, setIsAddingSub] = useState(false)

  // Remove subcontractor modal state
  const [showRemoveSubModal, setShowRemoveSubModal] = useState(false)
  const [subcontractorToRemove, setSubcontractorToRemove] = useState<ProjectSubcontractor | null>(null)
  const [isRemovingSub, setIsRemovingSub] = useState(false)

  // Delete confirmation modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Copy email state
  const [emailCopied, setEmailCopied] = useState(false)

  // Requirements modal state
  const [showRequirementsModal, setShowRequirementsModal] = useState(false)
  const [isSavingRequirements, setIsSavingRequirements] = useState(false)
  const [editingRequirements, setEditingRequirements] = useState<InsuranceRequirement[]>([])

  // Save as template modal state
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false)
  const [isSavingTemplate, setIsSavingTemplate] = useState(false)
  const [templateName, setTemplateName] = useState('')

  // Export report state
  const [isExporting, setIsExporting] = useState(false)

  // Edit project modal state
  const [showEditModal, setShowEditModal] = useState(false)
  const [isSavingProject, setIsSavingProject] = useState(false)
  const [editingProject, setEditingProject] = useState<{
    name: string
    address: string
    state: string
    status: string
  }>({ name: '', address: '', state: '', status: '' })

  // Contract parsing modal state
  const [showContractModal, setShowContractModal] = useState(false)
  const [isParsingContract, setIsParsingContract] = useState(false)
  const [contractFile, setContractFile] = useState<File | null>(null)
  const [contractResults, setContractResults] = useState<{
    requirements: Array<{
      coverage_type: string
      minimum_limit: number | null
      maximum_excess: number | null
      principal_indemnity_required: boolean
      cross_liability_required: boolean
      waiver_of_subrogation_required: boolean
      notes: string | null
    }>
    extracted_clauses: Array<{
      clause_number: string | null
      clause_title: string
      clause_text: string
      related_coverage: string | null
    }>
    confidence_score: number
    warnings: string[]
  } | null>(null)
  const [autoApplyContract, setAutoApplyContract] = useState(false)

  useEffect(() => {
    fetchUserRole()
    fetchProject()
    fetchProjectSubcontractors()
  }, [params.id])

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

  // Check if user can modify data (not read_only)
  const canModify = userRole && userRole !== 'read_only'

  // Only admins can delete projects
  const canDelete = userRole === 'admin'

  const copyEmailToClipboard = async () => {
    if (project?.forwarding_email) {
      try {
        await navigator.clipboard.writeText(project.forwarding_email)
        setEmailCopied(true)
        toast({
          title: "Copied!",
          description: "Email address copied to clipboard"
        })
        setTimeout(() => setEmailCopied(false), 2000)
      } catch (err) {
        toast({
          title: "Error",
          description: "Failed to copy email address",
          variant: "destructive"
        })
      }
    }
  }

  const handleOpenEditModal = () => {
    if (project) {
      setEditingProject({
        name: project.name,
        address: project.address || '',
        state: project.state || '',
        status: project.status
      })
      setShowEditModal(true)
    }
  }

  const handleSaveProject = async () => {
    if (!editingProject.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Project name is required",
        variant: "destructive"
      })
      return
    }

    setIsSavingProject(true)
    try {
      const response = await fetch(`/api/projects/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingProject.name.trim(),
          address: editingProject.address.trim() || null,
          state: editingProject.state || null,
          status: editingProject.status,
          updatedAt: project?.updated_at // Send for optimistic concurrency check
        })
      })

      const data = await response.json()

      // Handle the case where the record was deleted by another user
      if (response.status === 404) {
        toast({
          title: "Project Not Found",
          description: "This project has been deleted by another user. Redirecting to the list...",
          variant: "destructive"
        })
        setShowEditModal(false)
        router.push('/dashboard/projects')
        return
      }

      if (!response.ok) {
        // Handle concurrent modification error specifically
        if (response.status === 409 && data.code === 'CONCURRENT_MODIFICATION') {
          toast({
            title: "Concurrent Modification",
            description: "This project was modified by another user. The page will refresh with the latest data.",
            variant: "destructive"
          })
          setShowEditModal(false)
          fetchProject() // Refresh to get latest data
          return
        }
        throw new Error(data.error || 'Failed to update project')
      }

      toast({
        title: "Success",
        description: "Project updated successfully"
      })

      setShowEditModal(false)
      fetchProject() // Refresh project data
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to update project',
        variant: "destructive"
      })
    } finally {
      setIsSavingProject(false)
    }
  }

  const handleExportReport = async () => {
    setIsExporting(true)
    try {
      const response = await fetch(`/api/projects/${params.id}/report`)
      if (!response.ok) {
        throw new Error('Failed to generate report')
      }

      // Get the blob and create download link
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${project?.name.replace(/[^a-zA-Z0-9]/g, '_')}_Compliance_Report.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast({
        title: "Report Generated",
        description: "Your compliance report has been downloaded"
      })
    } catch (error) {
      console.error('Failed to export report:', error)
      toast({
        title: "Error",
        description: "Failed to generate report",
        variant: "destructive"
      })
    } finally {
      setIsExporting(false)
    }
  }

  const fetchProjectSubcontractors = async () => {
    setIsLoadingSubcontractors(true)
    try {
      const response = await fetch(`/api/projects/${params.id}/subcontractors`)
      if (response.ok) {
        const data = await response.json()
        setProjectSubcontractors(data.subcontractors || [])
      }
    } catch (error) {
      console.error('Failed to fetch project subcontractors:', error)
    } finally {
      setIsLoadingSubcontractors(false)
    }
  }

  const fetchAvailableSubcontractors = async () => {
    try {
      const response = await fetch('/api/subcontractors')
      if (response.ok) {
        const data = await response.json()
        setAvailableSubcontractors(data.subcontractors || [])
      }
    } catch (error) {
      console.error('Failed to fetch subcontractors:', error)
    }
  }

  const handleOpenAddSubModal = () => {
    fetchAvailableSubcontractors()
    setSelectedSubcontractorId('')
    setOnSiteDate('')
    setSubSearchQuery('')
    setShowAddSubModal(true)
  }

  const handleAddSubcontractor = async () => {
    if (!selectedSubcontractorId) {
      toast({
        title: "Error",
        description: "Please select a subcontractor",
        variant: "destructive"
      })
      return
    }

    setIsAddingSub(true)
    try {
      const response = await fetch(`/api/projects/${params.id}/subcontractors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subcontractorId: selectedSubcontractorId, onSiteDate: onSiteDate || null })
      })

      const data = await response.json()

      // Handle the case where the project was deleted by another user
      if (response.status === 404) {
        toast({
          title: "Project Not Found",
          description: "This project has been deleted. Redirecting to the list...",
          variant: "destructive"
        })
        router.push('/dashboard/projects')
        return
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add subcontractor')
      }

      toast({
        title: "Success",
        description: "Subcontractor added to project"
      })

      setShowAddSubModal(false)
      setSelectedSubcontractorId('')
      fetchProject() // Refresh project data
      fetchProjectSubcontractors() // Refresh subcontractors list
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to add subcontractor',
        variant: "destructive"
      })
    } finally {
      setIsAddingSub(false)
    }
  }

  const handleOpenRemoveSubModal = (sub: ProjectSubcontractor) => {
    setSubcontractorToRemove(sub)
    setShowRemoveSubModal(true)
  }

  const handleRemoveSubcontractor = async () => {
    if (!subcontractorToRemove) return

    setIsRemovingSub(true)
    try {
      const response = await fetch(`/api/projects/${params.id}/subcontractors`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subcontractorId: subcontractorToRemove.id })
      })

      const data = await response.json()

      // Handle the case where the project was deleted by another user
      if (response.status === 404) {
        toast({
          title: "Project Not Found",
          description: "This project has been deleted. Redirecting to the list...",
          variant: "destructive"
        })
        router.push('/dashboard/projects')
        return
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to remove subcontractor')
      }

      toast({
        title: "Success",
        description: `${subcontractorToRemove.name} removed from project`
      })

      setShowRemoveSubModal(false)
      setSubcontractorToRemove(null)
      fetchProject() // Refresh project data
      fetchProjectSubcontractors() // Refresh subcontractors list
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to remove subcontractor',
        variant: "destructive"
      })
    } finally {
      setIsRemovingSub(false)
    }
  }

  const handleOpenRequirementsModal = () => {
    // Map existing requirements to editing state
    const existingRequirements: InsuranceRequirement[] = (project?.requirements || []).map(req => ({
      id: req.id,
      coverage_type: req.coverage_type,
      minimum_limit: req.minimum_limit,
      limit_type: 'per_occurrence',
      maximum_excess: req.maximum_excess,
      principal_indemnity_required: false,
      cross_liability_required: false,
      other_requirements: null
    }))
    setEditingRequirements(existingRequirements)
    setShowRequirementsModal(true)
  }

  const handleAddRequirement = () => {
    setEditingRequirements([...editingRequirements, {
      coverage_type: '',
      minimum_limit: null,
      limit_type: 'per_occurrence',
      maximum_excess: null,
      principal_indemnity_required: false,
      cross_liability_required: false,
      other_requirements: null
    }])
  }

  const handleRemoveRequirement = (index: number) => {
    setEditingRequirements(editingRequirements.filter((_, i) => i !== index))
  }

  const handleUpdateRequirement = (index: number, field: keyof InsuranceRequirement, value: string | number | boolean | null) => {
    const updated = [...editingRequirements]
    updated[index] = { ...updated[index], [field]: value }
    setEditingRequirements(updated)
  }

  const handleOpenSaveTemplateModal = () => {
    setTemplateName('')
    setShowSaveTemplateModal(true)
  }

  const handleSaveAsTemplate = async () => {
    if (!templateName.trim()) {
      toast({
        title: "Validation Error",
        description: "Template name is required",
        variant: "destructive"
      })
      return
    }

    // Get current project requirements
    const requirements = project?.requirements || []
    if (requirements.length === 0) {
      toast({
        title: "Error",
        description: "No requirements to save. Configure requirements first.",
        variant: "destructive"
      })
      return
    }

    setIsSavingTemplate(true)
    try {
      const response = await fetch('/api/requirement-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: templateName.trim(),
          requirements: requirements.map(req => ({
            coverage_type: req.coverage_type,
            minimum_limit: req.minimum_limit,
            limit_type: 'per_occurrence',
            maximum_excess: req.maximum_excess,
            principal_indemnity_required: false,
            cross_liability_required: false
          }))
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save template')
      }

      toast({
        title: "Success",
        description: `Template "${templateName}" saved successfully`
      })

      setShowSaveTemplateModal(false)
      setTemplateName('')
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to save template',
        variant: "destructive"
      })
    } finally {
      setIsSavingTemplate(false)
    }
  }

  const handleOpenContractModal = () => {
    setContractFile(null)
    setContractResults(null)
    setAutoApplyContract(false)
    setShowContractModal(true)
  }

  const handleContractFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type
      const allowedExtensions = ['.pdf', '.doc', '.docx']
      const fileExt = '.' + file.name.split('.').pop()?.toLowerCase()
      if (!allowedExtensions.includes(fileExt)) {
        toast({
          title: "Invalid File Type",
          description: "Please upload a PDF or Word document (.pdf, .doc, .docx)",
          variant: "destructive"
        })
        return
      }
      setContractFile(file)
      setContractResults(null) // Reset previous results
    }
  }

  const handleParseContract = async () => {
    if (!contractFile) {
      toast({
        title: "No File Selected",
        description: "Please select a contract file to parse",
        variant: "destructive"
      })
      return
    }

    setIsParsingContract(true)
    try {
      const formData = new FormData()
      formData.append('file', contractFile)
      formData.append('autoApply', autoApplyContract.toString())

      const response = await fetch(`/api/projects/${params.id}/parse-contract`, {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to parse contract')
      }

      setContractResults(data.extraction)

      if (autoApplyContract && data.applied) {
        toast({
          title: "Contract Parsed & Applied",
          description: `${data.extraction.requirements.length} insurance requirements extracted and applied to the project`
        })
        setShowContractModal(false)
        fetchProject() // Refresh to show new requirements
      } else {
        toast({
          title: "Contract Parsed",
          description: `${data.extraction.requirements.length} insurance requirements extracted. Review and apply below.`
        })
      }
    } catch (error) {
      toast({
        title: "Parsing Error",
        description: error instanceof Error ? error.message : 'Failed to parse contract',
        variant: "destructive"
      })
    } finally {
      setIsParsingContract(false)
    }
  }

  const handleApplyContractRequirements = async () => {
    if (!contractResults || contractResults.requirements.length === 0) {
      toast({
        title: "No Requirements",
        description: "No requirements to apply",
        variant: "destructive"
      })
      return
    }

    setIsParsingContract(true)
    try {
      // Convert contract requirements to the format expected by the API
      const requirements = contractResults.requirements.map(req => ({
        coverage_type: req.coverage_type,
        minimum_limit: req.minimum_limit,
        limit_type: 'per_occurrence',
        maximum_excess: req.maximum_excess,
        principal_indemnity_required: req.principal_indemnity_required,
        cross_liability_required: req.cross_liability_required,
        other_requirements: req.notes
      }))

      const response = await fetch(`/api/projects/${params.id}/requirements`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requirements })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to apply requirements')
      }

      toast({
        title: "Requirements Applied",
        description: `${requirements.length} insurance requirements have been applied to the project`
      })

      setShowContractModal(false)
      setContractResults(null)
      fetchProject() // Refresh project data
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to apply requirements',
        variant: "destructive"
      })
    } finally {
      setIsParsingContract(false)
    }
  }

  const handleSaveRequirements = async () => {
    // Validate - all requirements need a coverage type
    const invalid = editingRequirements.some(req => !req.coverage_type)
    if (invalid) {
      toast({
        title: "Validation Error",
        description: "All requirements must have a coverage type selected",
        variant: "destructive"
      })
      return
    }

    // Check for duplicates
    const coverageTypes = editingRequirements.map(r => r.coverage_type)
    const uniqueTypes = new Set(coverageTypes)
    if (coverageTypes.length !== uniqueTypes.size) {
      toast({
        title: "Validation Error",
        description: "Each coverage type can only be added once",
        variant: "destructive"
      })
      return
    }

    setIsSavingRequirements(true)
    try {
      const response = await fetch(`/api/projects/${params.id}/requirements`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requirements: editingRequirements })
      })

      const data = await response.json()

      // Handle the case where the project was deleted by another user
      if (response.status === 404) {
        toast({
          title: "Project Not Found",
          description: "This project has been deleted. Redirecting to the list...",
          variant: "destructive"
        })
        router.push('/dashboard/projects')
        return
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save requirements')
      }

      toast({
        title: "Success",
        description: "Insurance requirements saved successfully"
      })

      setShowRequirementsModal(false)
      fetchProject() // Refresh project data
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to save requirements',
        variant: "destructive"
      })
    } finally {
      setIsSavingRequirements(false)
    }
  }

  const handleDeleteProject = async () => {
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/projects/${params.id}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      // Handle the case where the record was already deleted by another user
      if (response.status === 404) {
        toast({
          title: "Project Not Found",
          description: "This project has already been deleted. Redirecting to the list...",
          variant: "destructive"
        })
        setShowDeleteModal(false)
        router.push('/dashboard/projects')
        return
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete project')
      }

      toast({
        title: "Project Archived",
        description: "The project has been archived successfully"
      })

      // Redirect to projects list
      router.push('/dashboard/projects')
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to delete project',
        variant: "destructive"
      })
    } finally {
      setIsDeleting(false)
      setShowDeleteModal(false)
    }
  }

  const fetchProject = async () => {
    try {
      const response = await fetch(`/api/projects/${params.id}`)

      if (response.status === 403) {
        setAccessDenied(true)
        toast({
          title: "Access Denied",
          description: "You don't have permission to view this project",
          variant: "destructive"
        })
        return
      }

      if (response.status === 404) {
        setNotFound(true)
        return
      }

      if (response.ok) {
        const data = await response.json()
        setProject(data.project)
      }
    } catch (error) {
      console.error('Failed to fetch project:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="p-6 md:p-8 lg:p-12">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-1/4"></div>
          <div className="h-40 bg-slate-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (accessDenied) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
            <Shield className="h-8 w-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-900 mb-2">Access Denied</h1>
          <p className="text-slate-600 mb-4">
            You don&apos;t have permission to view this project.
          </p>
          <p className="text-sm text-slate-500 mb-6">
            This project is not assigned to you. Contact your administrator for access.
          </p>
          <Link href="/dashboard/projects">
            <Button>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Projects
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 rounded-full flex items-center justify-center">
            <FileCheck className="h-8 w-8 text-slate-400" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-900 mb-2">Project Not Found</h1>
          <p className="text-slate-600 mb-6">
            The project you&apos;re looking for doesn&apos;t exist or has been removed.
          </p>
          <Link href="/dashboard/projects">
            <Button>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Projects
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  if (!project) {
    return null
  }

  const statusStyle = STATUS_STYLES[project.status] || STATUS_STYLES.active
  const complianceRate = project.counts.total > 0
    ? Math.round((project.counts.compliant / project.counts.total) * 100)
    : null

  // Filter subcontractors by status
  const filteredSubcontractors = subStatusFilter === 'all'
    ? projectSubcontractors
    : projectSubcontractors.filter(sub => sub.status === subStatusFilter)

  return (
    <>
      {/* Top Bar */}
      <header className="bg-white border-b px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/projects">
              <Button variant="ghost" size="sm" aria-label="Back to projects">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold text-slate-900">{project.name}</h1>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusStyle.bg} ${statusStyle.text}`}>
                  {statusStyle.label}
                </span>
              </div>
              {project.address && (
                <p className="text-slate-500 flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {project.address}
                  {project.state && `, ${project.state}`}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleExportReport} disabled={isExporting}>
              {isExporting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileDown className="h-4 w-4 mr-2" />
              )}
              {isExporting ? 'Generating...' : 'Export Report'}
            </Button>
            {canModify && (
              <>
                <Button variant="outline" onClick={handleOpenEditModal}>
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </Button>
                {canDelete && (
                  <Button variant="destructive" onClick={() => setShowDeleteModal(true)}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </header>

      {/* Project Content */}
      <div className="p-6 md:p-8 lg:p-12 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Subcontractors"
            value={project.counts.total.toString()}
            icon={<Users className="h-5 w-5 text-blue-500" />}
          />
          <StatCard
            title="Compliant"
            value={project.counts.compliant.toString()}
            icon={<CheckCircle className="h-5 w-5 text-green-500" />}
            color="green"
          />
          <StatCard
            title="Non-Compliant"
            value={project.counts.non_compliant.toString()}
            icon={<AlertTriangle className="h-5 w-5 text-red-500" />}
            color="red"
          />
          <StatCard
            title="Pending Review"
            value={project.counts.pending.toString()}
            icon={<Clock className="h-5 w-5 text-amber-500" />}
            color="amber"
          />
        </div>

        {/* Project Info */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Compliance Overview */}
            <Card>
              <CardHeader>
                <CardTitle>Compliance Overview</CardTitle>
                <CardDescription>Insurance compliance status for this project</CardDescription>
              </CardHeader>
              <CardContent>
                {complianceRate !== null ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-4xl font-bold">{complianceRate}%</span>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        complianceRate === 100
                          ? 'bg-green-100 text-green-700'
                          : complianceRate < 50
                            ? 'bg-red-100 text-red-700'
                            : 'bg-amber-100 text-amber-700'
                      }`}>
                        {complianceRate === 100
                          ? 'Fully Compliant'
                          : complianceRate < 50
                            ? 'Critical'
                            : 'Needs Attention'
                        }
                      </span>
                    </div>
                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          complianceRate === 100
                            ? 'bg-green-500'
                            : complianceRate < 50
                              ? 'bg-red-500'
                              : 'bg-amber-500'
                        }`}
                        style={{ width: `${complianceRate}%` }}
                      />
                    </div>
                    <div className="grid grid-cols-4 gap-4 text-center text-sm">
                      <div>
                        <div className="font-semibold text-green-600">{project.counts.compliant}</div>
                        <div className="text-slate-500">Compliant</div>
                      </div>
                      <div>
                        <div className="font-semibold text-red-600">{project.counts.non_compliant}</div>
                        <div className="text-slate-500">Non-Compliant</div>
                      </div>
                      <div>
                        <div className="font-semibold text-amber-600">{project.counts.pending}</div>
                        <div className="text-slate-500">Pending</div>
                      </div>
                      <div>
                        <div className="font-semibold text-slate-600">{project.counts.exception}</div>
                        <div className="text-slate-500">Exception</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <Users className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                    <p>No subcontractors assigned</p>
                    <p className="text-sm">Add subcontractors to track compliance</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Subcontractors List */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Subcontractors</CardTitle>
                    <CardDescription>All subcontractors assigned to this project</CardDescription>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Status Filter */}
                    <div className="flex items-center gap-2">
                      <Filter className="h-4 w-4 text-slate-400" />
                      <Select
                        value={subStatusFilter}
                        onChange={(e) => setSubStatusFilter(e.target.value)}
                        className="w-40"
                      >
                        <option value="all">All Status</option>
                        <option value="compliant">Compliant</option>
                        <option value="non_compliant">Non-Compliant</option>
                        <option value="pending">Pending</option>
                        <option value="exception">Exception</option>
                      </Select>
                    </div>
                    {canModify && (
                      <Button size="sm" onClick={handleOpenAddSubModal}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Subcontractor
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingSubcontractors ? (
                  <div className="text-center py-8">
                    <Loader2 className="h-8 w-8 mx-auto animate-spin text-slate-400" />
                    <p className="text-sm text-slate-500 mt-2">Loading subcontractors...</p>
                  </div>
                ) : projectSubcontractors.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <Users className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                    <p>No subcontractors yet</p>
                    <p className="text-sm">Add subcontractors to get started</p>
                  </div>
                ) : filteredSubcontractors.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <Filter className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                    <p>No subcontractors match the filter</p>
                    <p className="text-sm">Try selecting a different status filter</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {filteredSubcontractors.map((sub) => (
                      <div key={sub.project_subcontractor_id} className="py-4 flex items-center justify-between group">
                        <Link
                          href={`/dashboard/subcontractors/${sub.id}?fromProject=${params.id}&projectName=${encodeURIComponent(project.name)}`}
                          className="flex-1 hover:bg-slate-50 -my-4 py-4 -ml-4 pl-4 rounded-l-lg transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-3">
                            <div className="font-medium text-slate-900 group-hover:text-primary transition-colors">{sub.name}</div>
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                              sub.status === 'compliant' ? 'bg-green-100 text-green-700' :
                              sub.status === 'non_compliant' ? 'bg-red-100 text-red-700' :
                              sub.status === 'exception' ? 'bg-amber-100 text-amber-700' :
                              'bg-slate-100 text-slate-700'
                            }`}>
                              {sub.status === 'non_compliant' ? 'Non-Compliant' :
                               sub.status.charAt(0).toUpperCase() + sub.status.slice(1)}
                            </span>
                          </div>
                          <div className="text-sm text-slate-500 mt-1">
                            <span>ABN: {sub.abn}</span>
                            {sub.trade && <span className="ml-3">• {sub.trade}</span>}
                            {sub.on_site_date && (
                              <span className="ml-3">• On-site: {new Date(sub.on_site_date).toLocaleDateString()}</span>
                            )}
                          </div>
                        </Link>
                        {canModify && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              handleOpenRemoveSubModal(sub)
                            }}
                            aria-label={`Remove ${sub.name} from project`}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Project Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Project Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {project.start_date && (
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-slate-400" />
                    <div>
                      <div className="text-xs text-slate-500">Start Date</div>
                      <div className="font-medium">{new Date(project.start_date).toLocaleDateString()}</div>
                    </div>
                  </div>
                )}
                {project.end_date && (
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-slate-400" />
                    <div>
                      <div className="text-xs text-slate-500">End Date</div>
                      <div className="font-medium">{new Date(project.end_date).toLocaleDateString()}</div>
                    </div>
                  </div>
                )}
                {project.estimated_value && (
                  <div className="flex items-center gap-3">
                    <DollarSign className="h-4 w-4 text-slate-400" />
                    <div>
                      <div className="text-xs text-slate-500">Estimated Value</div>
                      <div className="font-medium">
                        ${project.estimated_value.toLocaleString()}
                      </div>
                    </div>
                  </div>
                )}
                {project.project_manager && (
                  <div className="flex items-center gap-3">
                    <Users className="h-4 w-4 text-slate-400" />
                    <div>
                      <div className="text-xs text-slate-500">Project Manager</div>
                      <div className="font-medium">{project.project_manager.name}</div>
                      <div className="text-xs text-slate-400">{project.project_manager.email}</div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Email Forwarding */}
            {project.forwarding_email && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Mail className="h-4 w-4 text-primary" />
                    COC Email Forwarding
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-slate-500">
                    Forward Certificates of Currency to this email address for automatic processing:
                  </p>
                  <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border">
                    <code className="flex-1 text-sm font-mono text-slate-700 break-all">
                      {project.forwarding_email}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={copyEmailToClipboard}
                      className="shrink-0"
                      aria-label={emailCopied ? "Email copied" : "Copy email address"}
                    >
                      {emailCopied ? (
                        <Check className="h-4 w-4 text-green-500" aria-hidden="true" />
                      ) : (
                        <Copy className="h-4 w-4" aria-hidden="true" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-slate-400">
                    This is a unique email for this project. All COCs sent here will be automatically linked to this project.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Insurance Requirements */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Insurance Requirements</CardTitle>
              </CardHeader>
              <CardContent>
                {project.requirements.length > 0 ? (
                  <div className="space-y-3">
                    {project.requirements.map(req => (
                      <div key={req.id} className="p-3 bg-slate-50 rounded-lg">
                        <div className="font-medium text-sm capitalize">
                          {req.coverage_type.replace(/_/g, ' ')}
                        </div>
                        {req.minimum_limit && (
                          <div className="text-xs text-slate-500">
                            Min: ${req.minimum_limit.toLocaleString()}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-slate-500 text-sm">
                    <p>No requirements set</p>
                    {canModify && (
                      <Button variant="outline" size="sm" className="mt-2" onClick={handleOpenRequirementsModal}>
                        Configure Requirements
                      </Button>
                    )}
                  </div>
                )}
                {project.requirements.length > 0 && canModify && (
                  <div className="space-y-2 mt-3">
                    <Button variant="outline" size="sm" className="w-full" onClick={handleOpenRequirementsModal}>
                      <Settings className="h-4 w-4 mr-2" />
                      Edit Requirements
                    </Button>
                    <Button variant="ghost" size="sm" className="w-full text-slate-600" onClick={handleOpenSaveTemplateModal}>
                      <Shield className="h-4 w-4 mr-2" />
                      Save as Template
                    </Button>
                  </div>
                )}
                {canModify && (
                  <div className="mt-3 pt-3 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full bg-gradient-to-r from-primary/5 to-purple-500/5 border-primary/20 hover:border-primary/40"
                      onClick={handleOpenContractModal}
                    >
                      <Sparkles className="h-4 w-4 mr-2 text-primary" />
                      Parse Contract
                    </Button>
                    <p className="text-xs text-slate-400 mt-1 text-center">
                      AI extracts requirements from contracts
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Add Subcontractor Modal */}
      <Dialog open={showAddSubModal} onOpenChange={setShowAddSubModal}>
        <DialogContent onClose={() => setShowAddSubModal(false)}>
          <DialogHeader>
            <DialogTitle>Add Subcontractor to Project</DialogTitle>
            <DialogDescription>
              Select a subcontractor to assign to this project
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={(e) => { e.preventDefault(); handleAddSubcontractor(); }} className="space-y-4 mt-4">
            {/* Search Field */}
            <div className="space-y-2">
              <Label htmlFor="subSearch">Search Subcontractors</Label>
              <Input
                id="subSearch"
                type="text"
                placeholder="Search by name, ABN, or trade..."
                value={subSearchQuery}
                onChange={(e) => setSubSearchQuery(e.target.value)}
              />
            </div>

            {/* Subcontractor Selection */}
            <div className="space-y-2">
              <Label htmlFor="subcontractor">Subcontractor *</Label>
              <Select
                id="subcontractor"
                value={selectedSubcontractorId}
                onChange={(e) => setSelectedSubcontractorId(e.target.value)}
                required
              >
                <option value="">Select a subcontractor...</option>
                {availableSubcontractors
                  .filter(sub => {
                    if (!subSearchQuery) return true
                    const query = subSearchQuery.toLowerCase()
                    return (
                      sub.name.toLowerCase().includes(query) ||
                      sub.abn.includes(query) ||
                      (sub.trade && sub.trade.toLowerCase().includes(query))
                    )
                  })
                  .map(sub => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name} {sub.trade ? `(${sub.trade})` : ''} - ABN: {sub.abn}
                    </option>
                  ))}
              </Select>
              {availableSubcontractors.length === 0 && (
                <p className="text-sm text-slate-500">
                  No subcontractors available. Create one first in the Subcontractors section.
                </p>
              )}
            </div>

            {/* On-Site Date */}
            <div className="space-y-2">
              <Label htmlFor="onSiteDate">On-Site Date</Label>
              <Input
                id="onSiteDate"
                type="date"
                value={onSiteDate}
                onChange={(e) => setOnSiteDate(e.target.value)}
              />
              <p className="text-xs text-slate-500">
                The expected date when this subcontractor will be on-site (optional)
              </p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAddSubModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isAddingSub || !selectedSubcontractorId}>
                {isAddingSub ? 'Adding...' : 'Add Subcontractor'}
              </Button>
            </DialogFooter>
          </form>
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
              <DialogTitle>Delete Project</DialogTitle>
            </div>
            <DialogDescription>
              Are you sure you want to delete &quot;{project?.name}&quot;? This action will archive the project and it will no longer appear in your active projects list.
            </DialogDescription>
          </DialogHeader>

          <div className="bg-amber-50 border border-amber-200 rounded-md p-4 mt-4">
            <p className="text-sm text-amber-800">
              <strong>Note:</strong> This is a soft delete. The project data will be retained but marked as completed/archived.
            </p>
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteProject}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete Project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Subcontractor Confirmation Modal */}
      <Dialog open={showRemoveSubModal} onOpenChange={setShowRemoveSubModal}>
        <DialogContent onClose={() => setShowRemoveSubModal(false)}>
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center" aria-hidden="true">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <DialogTitle>Remove Subcontractor</DialogTitle>
            </div>
            <DialogDescription>
              Are you sure you want to remove <strong>{subcontractorToRemove?.name}</strong> from this project?
            </DialogDescription>
          </DialogHeader>

          <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mt-4">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> This will only remove the subcontractor from this project. The subcontractor record will still exist in your company&apos;s subcontractor list.
            </p>
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => setShowRemoveSubModal(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleRemoveSubcontractor}
              disabled={isRemovingSub}
            >
              {isRemovingSub ? 'Removing...' : 'Remove from Project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Insurance Requirements Modal */}
      <Dialog open={showRequirementsModal} onOpenChange={setShowRequirementsModal}>
        <DialogContent onClose={() => setShowRequirementsModal(false)} className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Configure Insurance Requirements
            </DialogTitle>
            <DialogDescription>
              Set the insurance requirements for subcontractors on this project
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {editingRequirements.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Shield className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                <p>No requirements configured</p>
                <p className="text-sm">Add requirements to specify insurance needs for this project</p>
              </div>
            ) : (
              editingRequirements.map((req, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-4 relative">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute top-2 right-2 h-8 w-8 p-0"
                    onClick={() => handleRemoveRequirement(index)}
                    aria-label={`Remove ${req.coverage_type || 'insurance'} requirement`}
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </Button>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Coverage Type */}
                    <div className="space-y-2">
                      <Label>Coverage Type *</Label>
                      <Select
                        value={req.coverage_type}
                        onChange={(e) => handleUpdateRequirement(index, 'coverage_type', e.target.value)}
                        required
                      >
                        <option value="">Select coverage type...</option>
                        {COVERAGE_TYPES.map(type => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </Select>
                    </div>

                    {/* Limit Type */}
                    <div className="space-y-2">
                      <Label>Limit Type</Label>
                      <Select
                        value={req.limit_type}
                        onChange={(e) => handleUpdateRequirement(index, 'limit_type', e.target.value)}
                      >
                        <option value="per_occurrence">Per Occurrence</option>
                        <option value="aggregate">Aggregate</option>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Minimum Limit */}
                    <div className="space-y-2">
                      <Label>Minimum Limit ($)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="1000"
                        placeholder="e.g., 20000000"
                        value={req.minimum_limit || ''}
                        onChange={(e) => handleUpdateRequirement(index, 'minimum_limit', e.target.value ? parseInt(e.target.value) : null)}
                      />
                    </div>

                    {/* Maximum Excess */}
                    <div className="space-y-2">
                      <Label>Maximum Excess ($)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="1000"
                        placeholder="e.g., 10000"
                        value={req.maximum_excess || ''}
                        onChange={(e) => handleUpdateRequirement(index, 'maximum_excess', e.target.value ? parseInt(e.target.value) : null)}
                      />
                    </div>
                  </div>

                  {/* Checkbox Options */}
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={req.principal_indemnity_required}
                        onChange={(e) => handleUpdateRequirement(index, 'principal_indemnity_required', e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                      />
                      <span className="text-sm">Principal Indemnity Required</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={req.cross_liability_required}
                        onChange={(e) => handleUpdateRequirement(index, 'cross_liability_required', e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                      />
                      <span className="text-sm">Cross Liability Required</span>
                    </label>
                  </div>
                </div>
              ))
            )}

            <Button type="button" variant="outline" className="w-full" onClick={handleAddRequirement}>
              <Plus className="h-4 w-4 mr-2" />
              Add Requirement
            </Button>
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => setShowRequirementsModal(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveRequirements}
              disabled={isSavingRequirements}
            >
              {isSavingRequirements ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Requirements'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save as Template Modal */}
      <Dialog open={showSaveTemplateModal} onOpenChange={setShowSaveTemplateModal}>
        <DialogContent onClose={() => setShowSaveTemplateModal(false)}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Save as Template
            </DialogTitle>
            <DialogDescription>
              Save the current insurance requirements as a reusable template
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="templateName">Template Name *</Label>
              <Input
                id="templateName"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g., High-Rise Construction"
              />
            </div>

            {project?.requirements && project.requirements.length > 0 && (
              <div className="p-3 bg-slate-50 rounded-lg border">
                <p className="text-sm font-medium text-slate-700 mb-2">Requirements to save:</p>
                <ul className="text-sm text-slate-600 space-y-1">
                  {project.requirements.map((req, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
                      <span className="capitalize">{req.coverage_type.replace(/_/g, ' ')}</span>
                      {req.minimum_limit && (
                        <span className="text-slate-500">
                          - ${req.minimum_limit.toLocaleString()} min
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => setShowSaveTemplateModal(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveAsTemplate}
              disabled={isSavingTemplate || !templateName.trim()}
            >
              {isSavingTemplate ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Template'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Project Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent onClose={() => setShowEditModal(false)}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              Edit Project
            </DialogTitle>
            <DialogDescription>
              Update project details
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={(e) => { e.preventDefault(); handleSaveProject(); }} className="space-y-4 mt-4">
            {/* Project Name */}
            <div className="space-y-2">
              <Label htmlFor="editProjectName">Project Name *</Label>
              <Input
                id="editProjectName"
                value={editingProject.name}
                onChange={(e) => setEditingProject({ ...editingProject, name: e.target.value })}
                placeholder="Enter project name"
                required
              />
            </div>

            {/* Address */}
            <div className="space-y-2">
              <Label htmlFor="editProjectAddress">Address</Label>
              <Input
                id="editProjectAddress"
                value={editingProject.address}
                onChange={(e) => setEditingProject({ ...editingProject, address: e.target.value })}
                placeholder="Enter project address"
              />
            </div>

            {/* State */}
            <div className="space-y-2">
              <Label htmlFor="editProjectState">State/Territory</Label>
              <Select
                id="editProjectState"
                value={editingProject.state}
                onChange={(e) => setEditingProject({ ...editingProject, state: e.target.value })}
              >
                <option value="">Select a state...</option>
                <option value="NSW">New South Wales (NSW)</option>
                <option value="VIC">Victoria (VIC)</option>
                <option value="QLD">Queensland (QLD)</option>
                <option value="WA">Western Australia (WA)</option>
                <option value="SA">South Australia (SA)</option>
                <option value="TAS">Tasmania (TAS)</option>
                <option value="NT">Northern Territory (NT)</option>
                <option value="ACT">Australian Capital Territory (ACT)</option>
              </Select>
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label htmlFor="editProjectStatus">Status</Label>
              <Select
                id="editProjectStatus"
                value={editingProject.status}
                onChange={(e) => setEditingProject({ ...editingProject, status: e.target.value })}
              >
                <option value="active">Active</option>
                <option value="on_hold">On Hold</option>
                <option value="completed">Completed</option>
              </Select>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowEditModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSavingProject || !editingProject.name.trim()}>
                {isSavingProject ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Contract Parsing Modal */}
      <Dialog open={showContractModal} onOpenChange={setShowContractModal}>
        <DialogContent onClose={() => setShowContractModal(false)} className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Parse Contract for Requirements
            </DialogTitle>
            <DialogDescription>
              Upload a contract (PDF or Word) and AI will extract insurance requirements automatically
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* File Upload Area */}
            <div className="space-y-2">
              <Label htmlFor="contractFile">Contract Document</Label>
              <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                {contractFile ? (
                  <div className="flex items-center justify-center gap-3">
                    <FileText className="h-10 w-10 text-primary" />
                    <div className="text-left">
                      <p className="font-medium text-slate-900">{contractFile.name}</p>
                      <p className="text-sm text-slate-500">{(contractFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setContractFile(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <Upload className="h-10 w-10 mx-auto text-slate-400 mb-2" />
                    <p className="text-sm text-slate-600 mb-2">
                      Drag and drop or click to upload
                    </p>
                    <p className="text-xs text-slate-400">
                      Supports PDF, DOC, DOCX (max 20MB)
                    </p>
                  </>
                )}
                <input
                  id="contractFile"
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleContractFileChange}
                  className={contractFile ? "hidden" : "absolute inset-0 w-full h-full opacity-0 cursor-pointer"}
                  style={contractFile ? {} : { position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                />
              </div>
            </div>

            {/* Auto-apply checkbox */}
            <label className="flex items-center gap-2 cursor-pointer p-3 bg-slate-50 rounded-lg border">
              <input
                type="checkbox"
                checked={autoApplyContract}
                onChange={(e) => setAutoApplyContract(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
              />
              <div>
                <span className="text-sm font-medium">Auto-apply requirements</span>
                <p className="text-xs text-slate-500">
                  Automatically save extracted requirements to the project
                </p>
              </div>
            </label>

            {/* Parse Button */}
            {!contractResults && (
              <Button
                onClick={handleParseContract}
                disabled={!contractFile || isParsingContract}
                className="w-full"
              >
                {isParsingContract ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Parsing Contract...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Parse Contract
                  </>
                )}
              </Button>
            )}

            {/* Results Section */}
            {contractResults && (
              <div className="space-y-4">
                {/* Confidence Score */}
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <span className="text-sm font-medium">AI Confidence</span>
                  <span className={`px-2 py-1 rounded text-sm font-medium ${
                    contractResults.confidence_score >= 0.8 ? 'bg-green-100 text-green-700' :
                    contractResults.confidence_score >= 0.6 ? 'bg-amber-100 text-amber-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {(contractResults.confidence_score * 100).toFixed(0)}%
                  </span>
                </div>

                {/* Warnings */}
                {contractResults.warnings.length > 0 && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-center gap-2 text-amber-700 font-medium mb-1">
                      <AlertTriangle className="h-4 w-4" />
                      Warnings
                    </div>
                    <ul className="text-sm text-amber-600 list-disc list-inside">
                      {contractResults.warnings.map((warning, idx) => (
                        <li key={idx}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Extracted Requirements */}
                <div>
                  <h4 className="font-medium text-slate-900 mb-2">
                    Extracted Requirements ({contractResults.requirements.length})
                  </h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {contractResults.requirements.map((req, idx) => (
                      <div key={idx} className="p-3 bg-white border rounded-lg">
                        <div className="flex items-center justify-between">
                          <span className="font-medium capitalize">
                            {req.coverage_type.replace(/_/g, ' ')}
                          </span>
                          {req.minimum_limit && (
                            <span className="text-sm text-slate-600">
                              ${req.minimum_limit.toLocaleString()}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {req.principal_indemnity_required && (
                            <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                              Principal Indemnity
                            </span>
                          )}
                          {req.cross_liability_required && (
                            <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                              Cross Liability
                            </span>
                          )}
                          {req.waiver_of_subrogation_required && (
                            <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded">
                              Waiver of Subrogation
                            </span>
                          )}
                          {req.maximum_excess && (
                            <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                              Max Excess: ${req.maximum_excess.toLocaleString()}
                            </span>
                          )}
                        </div>
                        {req.notes && (
                          <p className="text-xs text-slate-500 mt-1">{req.notes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Extracted Clauses */}
                {contractResults.extracted_clauses.length > 0 && (
                  <div>
                    <h4 className="font-medium text-slate-900 mb-2">
                      Relevant Contract Clauses ({contractResults.extracted_clauses.length})
                    </h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {contractResults.extracted_clauses.map((clause, idx) => (
                        <div key={idx} className="p-2 bg-slate-50 rounded border text-sm">
                          <div className="font-medium text-slate-700">
                            {clause.clause_number && `${clause.clause_number}. `}
                            {clause.clause_title}
                          </div>
                          <p className="text-slate-600 text-xs mt-1">{clause.clause_text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => setShowContractModal(false)}>
              Cancel
            </Button>
            {contractResults && !autoApplyContract && (
              <Button
                onClick={handleApplyContractRequirements}
                disabled={isParsingContract || contractResults.requirements.length === 0}
              >
                {isParsingContract ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Applying...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Apply {contractResults.requirements.length} Requirements
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function StatCard({
  title,
  value,
  icon,
  color = 'blue'
}: {
  title: string
  value: string
  icon: React.ReactNode
  color?: 'blue' | 'green' | 'red' | 'amber'
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">{title}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
          </div>
          <div className="p-2 bg-slate-100 rounded-lg">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
