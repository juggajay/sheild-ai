"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  FileText,
  Search,
  RefreshCw,
  User,
  Building2,
  FolderOpen,
  Users,
  FileCheck,
  AlertTriangle,
  Plus,
  Pencil,
  Trash2,
  Check,
  Upload,
  Send,
  LogIn,
  LogOut
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"

interface AuditLog {
  id: string
  company_id: string
  user_id: string | null
  entity_type: string
  entity_id: string
  action: string
  details: Record<string, unknown> | null
  created_at: string
  user_name: string | null
  user_email: string | null
}

interface CurrentUser {
  id: string
  role: string
}

export default function AuditLogsPage() {
  const router = useRouter()
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>("")
  const [actionFilter, setActionFilter] = useState<string>("")
  const [searchQuery, setSearchQuery] = useState("")
  const limit = 25

  useEffect(() => {
    fetchUser()
  }, [])

  useEffect(() => {
    if (user) {
      fetchLogs()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, page, entityTypeFilter, actionFilter])

  const fetchUser = async () => {
    try {
      const response = await fetch("/api/auth/me")
      if (response.ok) {
        const data = await response.json()
        setUser(data.user)
        // Only admin and risk_manager can view audit logs
        if (!['admin', 'risk_manager'].includes(data.user.role)) {
          router.push('/dashboard/settings')
        }
      } else {
        router.push('/login')
      }
    } catch (error) {
      console.error("Failed to fetch user:", error)
      router.push('/login')
    }
  }

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: (page * limit).toString(),
      })

      if (entityTypeFilter && entityTypeFilter !== "all") {
        params.append('entity_type', entityTypeFilter)
      }
      if (actionFilter && actionFilter !== "all") {
        params.append('action', actionFilter)
      }

      const response = await fetch(`/api/audit-logs?${params}`)
      if (response.ok) {
        const data = await response.json()
        setLogs(data.logs)
        setTotal(data.total)
      }
    } catch (error) {
      console.error("Failed to fetch audit logs:", error)
    } finally {
      setLoading(false)
    }
  }

  const getEntityIcon = (entityType: string) => {
    switch (entityType) {
      case 'project':
        return <FolderOpen className="h-4 w-4 text-blue-500" />
      case 'subcontractor':
        return <Users className="h-4 w-4 text-purple-500" />
      case 'coc_document':
        return <FileCheck className="h-4 w-4 text-green-500" />
      case 'exception':
        return <AlertTriangle className="h-4 w-4 text-amber-500" />
      case 'user':
        return <User className="h-4 w-4 text-pink-500" />
      case 'company':
        return <Building2 className="h-4 w-4 text-slate-500" />
      case 'project_subcontractor':
        return <Users className="h-4 w-4 text-indigo-500" />
      case 'communication':
        return <Send className="h-4 w-4 text-cyan-500" />
      default:
        return <FileText className="h-4 w-4 text-slate-400" />
    }
  }

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'create':
        return <Plus className="h-3 w-3" />
      case 'update':
        return <Pencil className="h-3 w-3" />
      case 'delete':
        return <Trash2 className="h-3 w-3" />
      case 'archive':
        return <Trash2 className="h-3 w-3" />
      case 'approve':
        return <Check className="h-3 w-3" />
      case 'auto_approve':
        return <Check className="h-3 w-3" />
      case 'upload':
        return <Upload className="h-3 w-3" />
      case 'login':
        return <LogIn className="h-3 w-3" />
      case 'logout':
        return <LogOut className="h-3 w-3" />
      default:
        return null
    }
  }

  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case 'create':
        return 'bg-green-100 text-green-700 border-green-200'
      case 'update':
        return 'bg-blue-100 text-blue-700 border-blue-200'
      case 'delete':
      case 'archive':
        return 'bg-red-100 text-red-700 border-red-200'
      case 'approve':
      case 'auto_approve':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200'
      case 'upload':
        return 'bg-purple-100 text-purple-700 border-purple-200'
      case 'login':
        return 'bg-cyan-100 text-cyan-700 border-cyan-200'
      case 'logout':
        return 'bg-orange-100 text-orange-700 border-orange-200'
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200'
    }
  }

  const formatEntityType = (type: string) => {
    return type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  const formatAction = (action: string) => {
    return action
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`

    return date.toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getDetailsDescription = (log: AuditLog) => {
    const details = log.details
    if (!details) return null

    const parts: string[] = []

    if (details.name) {
      parts.push(`"${details.name}"`)
    }
    if (details.fileName) {
      parts.push(`file: ${details.fileName}`)
    }
    if (details.updatedFields && Array.isArray(details.updatedFields)) {
      parts.push(`fields: ${(details.updatedFields as string[]).join(', ')}`)
    }
    if (details.autoApproved) {
      parts.push('(auto-approved)')
    }

    return parts.length > 0 ? parts.join(' - ') : null
  }

  // Filter logs by search query
  const filteredLogs = logs.filter(log => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      log.user_name?.toLowerCase().includes(query) ||
      log.user_email?.toLowerCase().includes(query) ||
      log.entity_type.toLowerCase().includes(query) ||
      log.action.toLowerCase().includes(query) ||
      JSON.stringify(log.details).toLowerCase().includes(query)
    )
  })

  const totalPages = Math.ceil(total / limit)

  return (
    <>
      {/* Top Bar */}
      <header className="bg-white border-b px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/dashboard/settings')}
              aria-label="Back to settings"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            </Button>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Audit Logs</h1>
              <p className="text-slate-500">Track all user actions and system events</p>
            </div>
          </div>
          <Button variant="outline" onClick={fetchLogs} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className="p-6 md:p-8 space-y-6">
        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search logs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select
                value={entityTypeFilter}
                onChange={(e) => {
                  setEntityTypeFilter(e.target.value)
                  setPage(0) // Reset to page 1 when filter changes
                }}
                className="w-full sm:w-[180px]"
              >
                <option value="">All Entities</option>
                <option value="project">Projects</option>
                <option value="subcontractor">Subcontractors</option>
                <option value="coc_document">Documents</option>
                <option value="exception">Exceptions</option>
                <option value="user">Users</option>
                <option value="project_subcontractor">Project Assignments</option>
                <option value="communication">Communications</option>
              </Select>
              <Select
                value={actionFilter}
                onChange={(e) => {
                  setActionFilter(e.target.value)
                  setPage(0) // Reset to page 1 when filter changes
                }}
                className="w-full sm:w-[180px]"
              >
                <option value="">All Actions</option>
                <option value="create">Create</option>
                <option value="update">Update</option>
                <option value="delete">Delete</option>
                <option value="archive">Archive</option>
                <option value="approve">Approve</option>
                <option value="upload">Upload</option>
                <option value="login">Login</option>
                <option value="logout">Logout</option>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Logs Table */}
        <Card>
          <CardHeader>
            <CardTitle>Activity Log</CardTitle>
            <CardDescription>
              Showing {filteredLogs.length} of {total} entries
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                    <Skeleton className="h-6 w-20" />
                  </div>
                ))}
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">No audit logs found</p>
                <p className="text-sm text-slate-400">
                  {searchQuery || entityTypeFilter || actionFilter
                    ? "Try adjusting your filters"
                    : "Activity will appear here as users take actions"}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-4 p-4 border rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    {/* Entity Icon */}
                    <div className="p-2 bg-slate-100 rounded-lg">
                      {getEntityIcon(log.entity_type)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-slate-900">
                          {log.user_name || 'System'}
                        </span>
                        <Badge
                          variant="outline"
                          className={`${getActionBadgeColor(log.action)} flex items-center gap-1`}
                        >
                          {getActionIcon(log.action)}
                          {formatAction(log.action)}
                        </Badge>
                        <span className="text-slate-600">
                          {formatEntityType(log.entity_type)}
                        </span>
                      </div>

                      {/* Details */}
                      {getDetailsDescription(log) && (
                        <p className="text-sm text-slate-500 mt-1 truncate">
                          {getDetailsDescription(log)}
                        </p>
                      )}

                      {/* User email */}
                      {log.user_email && (
                        <p className="text-xs text-slate-400 mt-1">
                          {log.user_email}
                        </p>
                      )}
                    </div>

                    {/* Timestamp */}
                    <div className="text-right shrink-0">
                      <p className="text-sm text-slate-500">{formatDate(log.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t">
                <p className="text-sm text-slate-500">
                  Page {page + 1} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
