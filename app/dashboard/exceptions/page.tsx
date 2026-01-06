"use client"

import { useEffect, useState } from "react"
import {
  AlertTriangle,
  Plus,
  Search,
  Clock,
  CheckCircle,
  XCircle,
  Shield,
  Lock,
  FileDown,
  Loader2
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

interface Exception {
  id: string
  issue_summary: string
  reason: string
  risk_level: string
  status: string
  expiration_type: string
  expires_at: string | null
  created_at: string
  subcontractor_name: string
  project_name: string
  created_by_name: string
  approved_by_name: string | null
}

interface ProjectSubcontractor {
  id: string
  project_id: string
  project_name: string
  subcontractor_id: string
  subcontractor_name: string
  status: string
}

interface User {
  id: string
  role: string
}

const STATUS_STYLES: Record<string, { bg: string; text: string; icon: React.ReactNode; label: string }> = {
  pending_approval: { bg: 'bg-amber-100', text: 'text-amber-700', icon: <Clock className="h-4 w-4" />, label: 'Pending Approval' },
  active: { bg: 'bg-green-100', text: 'text-green-700', icon: <CheckCircle className="h-4 w-4" />, label: 'Active' },
  rejected: { bg: 'bg-red-100', text: 'text-red-700', icon: <XCircle className="h-4 w-4" />, label: 'Rejected' },
  expired: { bg: 'bg-red-100', text: 'text-red-700', icon: <XCircle className="h-4 w-4" />, label: 'Expired' },
  resolved: { bg: 'bg-slate-100', text: 'text-slate-700', icon: <CheckCircle className="h-4 w-4" />, label: 'Resolved' },
  closed: { bg: 'bg-slate-100', text: 'text-slate-700', icon: <XCircle className="h-4 w-4" />, label: 'Closed' }
}

const RISK_STYLES: Record<string, { bg: string; text: string }> = {
  low: { bg: 'bg-green-100', text: 'text-green-700' },
  medium: { bg: 'bg-amber-100', text: 'text-amber-700' },
  high: { bg: 'bg-red-100', text: 'text-red-700' }
}

export default function ExceptionsPage() {
  const { toast } = useToast()
  const [exceptions, setExceptions] = useState<Exception[]>([])
  const [projectSubcontractors, setProjectSubcontractors] = useState<ProjectSubcontractor[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [user, setUser] = useState<User | null>(null)

  // Create exception modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState({
    projectSubcontractorId: '',
    issueSummary: '',
    reason: '',
    riskLevel: 'medium',
    expirationType: 'until_resolved',
    expiresAt: ''
  })
  const [isCreating, setIsCreating] = useState(false)

  // Password confirmation modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [exceptionsRes, userRes, psRes] = await Promise.all([
        fetch('/api/exceptions'),
        fetch('/api/auth/me'),
        fetch('/api/project-subcontractors')
      ])

      if (exceptionsRes.ok) {
        const data = await exceptionsRes.json()
        setExceptions(data.exceptions || [])
      }

      if (userRes.ok) {
        const data = await userRes.json()
        setUser(data.user)
      }

      if (psRes.ok) {
        const data = await psRes.json()
        setProjectSubcontractors(data.projectSubcontractors || [])
      }
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const canCreateException = user && ['admin', 'risk_manager', 'project_manager'].includes(user.role)

  const filteredExceptions = exceptions.filter(exception =>
    exception.issue_summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
    exception.subcontractor_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    exception.project_name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleCreateException = async (passwordValue?: string) => {
    // If permanent expiration, require password
    if (createForm.expirationType === 'permanent' && !passwordValue) {
      setShowPasswordModal(true)
      return
    }

    setIsCreating(true)
    try {
      const response = await fetch('/api/exceptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectSubcontractorId: createForm.projectSubcontractorId,
          issueSummary: createForm.issueSummary,
          reason: createForm.reason,
          riskLevel: createForm.riskLevel,
          expirationType: createForm.expirationType,
          expiresAt: createForm.expiresAt || null,
          password: passwordValue
        })
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.requiresPassword) {
          setShowPasswordModal(true)
          return
        }
        // If password was provided and error is "Incorrect password", show it in the modal
        if (passwordValue && data.error === 'Incorrect password') {
          setPasswordError('Incorrect password')
          setIsVerifyingPassword(false)
          return
        }
        throw new Error(data.error || 'Failed to create exception')
      }

      toast({
        title: "Exception Created",
        description: data.message
      })

      // Reset form and close modals
      setCreateForm({
        projectSubcontractorId: '',
        issueSummary: '',
        reason: '',
        riskLevel: 'medium',
        expirationType: 'until_resolved',
        expiresAt: ''
      })
      setShowCreateModal(false)
      setShowPasswordModal(false)
      setPassword('')
      setPasswordError('')

      // Refresh exceptions list
      fetchData()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to create exception',
        variant: "destructive"
      })
    } finally {
      setIsCreating(false)
    }
  }

  const handlePasswordSubmit = async () => {
    if (!password) {
      setPasswordError('Password is required')
      return
    }

    setIsVerifyingPassword(true)
    setPasswordError('')

    try {
      await handleCreateException(password)
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : 'Incorrect password')
    } finally {
      setIsVerifyingPassword(false)
    }
  }

  const handlePasswordModalClose = () => {
    setShowPasswordModal(false)
    setPassword('')
    setPasswordError('')
  }

  const handleApprovalAction = async (exceptionId: string, action: 'approve' | 'reject') => {
    try {
      const response = await fetch('/api/exceptions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exceptionId, action })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || `Failed to ${action} exception`)
      }

      toast({
        title: action === 'approve' ? 'Exception Approved' : 'Exception Rejected',
        description: data.message
      })

      // Refresh exceptions list
      fetchData()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : `Failed to ${action} exception`,
        variant: "destructive"
      })
    }
  }

  const handleExportAuditTrail = async (exceptionId: string, issueSummary: string) => {
    try {
      const response = await fetch(`/api/exceptions/${exceptionId}/audit-trail`)
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to export audit trail')
      }

      // Get the blob and create download link
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const safeName = issueSummary.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30)
      a.download = `Exception_Audit_Trail_${safeName}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast({
        title: "Audit Trail Exported",
        description: "The exception audit trail has been downloaded"
      })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to export audit trail',
        variant: "destructive"
      })
    }
  }

  return (
    <>
      {/* Top Bar */}
      <header className="bg-white border-b px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Exceptions</h1>
            <p className="text-slate-500">Manage compliance exceptions and waivers</p>
          </div>
          {canCreateException && (
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Exception
            </Button>
          )}
        </div>
      </header>

      {/* Exceptions Content */}
      <div className="p-6 space-y-6">
        {/* Search */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search exceptions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Exceptions List */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-6 bg-slate-200 rounded w-3/4"></div>
                  <div className="h-4 bg-slate-200 rounded w-1/2 mt-2"></div>
                </CardHeader>
                <CardContent>
                  <div className="h-16 bg-slate-200 rounded"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredExceptions.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">
                  {searchQuery ? 'No exceptions found' : 'No exceptions yet'}
                </h3>
                <p className="text-slate-500 mb-4">
                  {searchQuery
                    ? 'Try adjusting your search terms'
                    : 'Exceptions are created when subcontractors have compliance issues'
                  }
                </p>
                {canCreateException && !searchQuery && (
                  <Button onClick={() => setShowCreateModal(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Exception
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredExceptions.map(exception => (
              <ExceptionCard
                key={exception.id}
                exception={exception}
                user={user}
                onApprovalAction={handleApprovalAction}
                onExportAuditTrail={handleExportAuditTrail}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Exception Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent onClose={() => setShowCreateModal(false)}>
          <DialogHeader>
            <DialogTitle>Create Exception</DialogTitle>
            <DialogDescription>
              Create a compliance exception for a subcontractor
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={(e) => { e.preventDefault(); handleCreateException(); }} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="projectSubcontractor">Project / Subcontractor</Label>
              <Select
                id="projectSubcontractor"
                value={createForm.projectSubcontractorId}
                onChange={(e) => setCreateForm(prev => ({ ...prev, projectSubcontractorId: e.target.value }))}
                required
              >
                <option value="">Select a project subcontractor...</option>
                {projectSubcontractors.map(ps => (
                  <option key={ps.id} value={ps.id}>
                    {ps.project_name} - {ps.subcontractor_name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="issueSummary">Issue Summary</Label>
              <Input
                id="issueSummary"
                value={createForm.issueSummary}
                onChange={(e) => setCreateForm(prev => ({ ...prev, issueSummary: e.target.value }))}
                placeholder="Brief description of the compliance issue"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Reason / Justification</Label>
              <textarea
                id="reason"
                value={createForm.reason}
                onChange={(e) => setCreateForm(prev => ({ ...prev, reason: e.target.value }))}
                placeholder="Why is this exception being granted?"
                className="flex min-h-[80px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="riskLevel">Risk Level</Label>
                <Select
                  id="riskLevel"
                  value={createForm.riskLevel}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, riskLevel: e.target.value }))}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="expirationType">Expiration Type</Label>
                <Select
                  id="expirationType"
                  value={createForm.expirationType}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, expirationType: e.target.value }))}
                >
                  <option value="until_resolved">Until Resolved</option>
                  <option value="fixed_duration">Fixed Duration</option>
                  <option value="specific_date">Specific Date</option>
                  <option value="permanent">Permanent (requires password)</option>
                </Select>
              </div>
            </div>

            {(createForm.expirationType === 'fixed_duration' || createForm.expirationType === 'specific_date') && (
              <div className="space-y-2">
                <Label htmlFor="expiresAt">Expiration Date</Label>
                <Input
                  id="expiresAt"
                  type="date"
                  value={createForm.expiresAt}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, expiresAt: e.target.value }))}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
            )}

            {createForm.expirationType === 'permanent' && (
              <div className="bg-amber-50 border border-amber-200 rounded-md p-4">
                <div className="flex items-start gap-3">
                  <Lock className="h-5 w-5 text-amber-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-800">Permanent Exception</p>
                    <p className="text-sm text-amber-700 mt-1">
                      Creating a permanent exception is a sensitive operation. You will be asked to confirm your password before proceeding.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isCreating}>
                {isCreating ? 'Creating...' : 'Create Exception'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Password Confirmation Modal */}
      <Dialog open={showPasswordModal} onOpenChange={handlePasswordModalClose}>
        <DialogContent onClose={handlePasswordModalClose}>
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <Shield className="h-5 w-5 text-amber-600" />
              </div>
              <DialogTitle>Confirm Your Identity</DialogTitle>
            </div>
            <DialogDescription>
              Creating a permanent exception is a sensitive operation. Please enter your password to confirm.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={(e) => { e.preventDefault(); handlePasswordSubmit(); }} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setPasswordError('')
                }}
                placeholder="Enter your password"
                autoFocus
              />
              {passwordError && (
                <p className="text-sm text-red-600">{passwordError}</p>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handlePasswordModalClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isVerifyingPassword}>
                {isVerifyingPassword ? 'Verifying...' : 'Confirm & Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

interface ExceptionCardProps {
  exception: Exception
  user: User | null
  onApprovalAction: (exceptionId: string, action: 'approve' | 'reject') => void
  onExportAuditTrail: (exceptionId: string, issueSummary: string) => Promise<void>
}

function ExceptionCard({ exception, user, onApprovalAction, onExportAuditTrail }: ExceptionCardProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const statusStyle = STATUS_STYLES[exception.status] || STATUS_STYLES.active
  const riskStyle = RISK_STYLES[exception.risk_level] || RISK_STYLES.medium

  const canApprove = user && ['admin', 'risk_manager'].includes(user.role) && exception.status === 'pending_approval'
  const canExport = user && ['admin', 'risk_manager'].includes(user.role)

  const handleAction = async (action: 'approve' | 'reject') => {
    setIsProcessing(true)
    await onApprovalAction(exception.id, action)
    setIsProcessing(false)
  }

  const handleExportAuditTrail = async () => {
    setIsExporting(true)
    try {
      await onExportAuditTrail(exception.id, exception.issue_summary)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg">
              {exception.issue_summary}
            </CardTitle>
            <CardDescription className="mt-1">
              {exception.project_name} — {exception.subcontractor_name}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${riskStyle.bg} ${riskStyle.text} capitalize`}>
              {exception.risk_level}
            </span>
            <span className={`px-2 py-1 text-xs font-medium rounded-full flex items-center gap-1 ${statusStyle.bg} ${statusStyle.text}`}>
              {statusStyle.icon}
              {statusStyle.label}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div>
            <p className="text-sm text-slate-600">{exception.reason}</p>
          </div>
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-6 text-sm text-slate-500">
              <span>
                Created by {exception.created_by_name} on {new Date(exception.created_at).toLocaleDateString()}
              </span>
              {exception.approved_by_name && (
                <span>
                  Approved by {exception.approved_by_name}
                </span>
              )}
              {exception.expires_at && (
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Expires: {new Date(exception.expires_at).toLocaleDateString()}
                </span>
              )}
              {exception.expiration_type === 'permanent' && (
                <span className="flex items-center gap-1 text-amber-600">
                  <Lock className="h-4 w-4" />
                  Permanent
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {canExport && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportAuditTrail}
                  disabled={isExporting}
                >
                  {isExporting ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <FileDown className="h-4 w-4 mr-1" />
                  )}
                  {isExporting ? 'Exporting...' : 'Export Audit Trail'}
                </Button>
              )}
              {canApprove && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAction('reject')}
                    disabled={isProcessing}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleAction('approve')}
                    disabled={isProcessing}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Approve
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
