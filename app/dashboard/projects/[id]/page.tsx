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
  Check
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
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

  // Add subcontractor modal state
  const [showAddSubModal, setShowAddSubModal] = useState(false)
  const [availableSubcontractors, setAvailableSubcontractors] = useState<Subcontractor[]>([])
  const [selectedSubcontractorId, setSelectedSubcontractorId] = useState('')
  const [isAddingSub, setIsAddingSub] = useState(false)

  // Delete confirmation modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Copy email state
  const [emailCopied, setEmailCopied] = useState(false)

  useEffect(() => {
    fetchUserRole()
    fetchProject()
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
        body: JSON.stringify({ subcontractorId: selectedSubcontractorId })
      })

      const data = await response.json()

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

  const handleDeleteProject = async () => {
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/projects/${params.id}`, {
        method: 'DELETE'
      })

      const data = await response.json()

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
      <div className="p-6">
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

  return (
    <>
      {/* Top Bar */}
      <header className="bg-white border-b px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/projects">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4" />
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
          {canModify && (
            <div className="flex items-center gap-2">
              <Button variant="outline">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
              {canDelete && (
                <Button variant="destructive" onClick={() => setShowDeleteModal(true)}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Project Content */}
      <div className="p-6 space-y-6">
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
                  {canModify && (
                    <Button size="sm" onClick={handleOpenAddSubModal}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Subcontractor
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-slate-500">
                  <Users className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                  <p>No subcontractors yet</p>
                  <p className="text-sm">Add subcontractors to get started</p>
                </div>
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
                    >
                      {emailCopied ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
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
                      <Button variant="outline" size="sm" className="mt-2">
                        Configure Requirements
                      </Button>
                    )}
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
            <div className="space-y-2">
              <Label htmlFor="subcontractor">Subcontractor</Label>
              <Select
                id="subcontractor"
                value={selectedSubcontractorId}
                onChange={(e) => setSelectedSubcontractorId(e.target.value)}
                required
              >
                <option value="">Select a subcontractor...</option>
                {availableSubcontractors.map(sub => (
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
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
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
