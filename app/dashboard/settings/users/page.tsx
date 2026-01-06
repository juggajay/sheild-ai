"use client"

import { useState, useEffect } from "react"
import {
  UserCog,
  Plus,
  Search,
  MoreHorizontal,
  Mail,
  Shield,
  Clock,
  Loader2,
  X,
  Send,
  AlertCircle,
  Trash2
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"

interface User {
  id: string
  name: string
  email: string
  role: string
  phone: string | null
  avatar_url: string | null
  last_login_at: string | null
  created_at: string
  invitation_status: string | null
}

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  admin: { label: 'Admin', color: 'bg-purple-100 text-purple-700' },
  risk_manager: { label: 'Risk Manager', color: 'bg-blue-100 text-blue-700' },
  project_manager: { label: 'Project Manager', color: 'bg-green-100 text-green-700' },
  project_administrator: { label: 'Project Admin', color: 'bg-amber-100 text-amber-700' },
  read_only: { label: 'Read Only', color: 'bg-slate-100 text-slate-700' }
}

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'risk_manager', label: 'Risk Manager' },
  { value: 'project_manager', label: 'Project Manager' },
  { value: 'project_administrator', label: 'Project Administrator' },
  { value: 'read_only', label: 'Read Only' }
]

export default function UserManagementPage() {
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = useState('')
  const [users, setUsers] = useState<User[]>([])
  const [pendingInvitations, setPendingInvitations] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isInviting, setIsInviting] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState('project_administrator')

  // Edit form state
  const [editName, setEditName] = useState('')
  const [editRole, setEditRole] = useState('')

  // Delete confirmation state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [userToDelete, setUserToDelete] = useState<User | null>(null)

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users')
      if (response.ok) {
        const data = await response.json()
        setUsers(data.users || [])
        setPendingInvitations(data.pendingInvitations || [])
      } else {
        toast({
          title: "Error",
          description: "Failed to load users",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error('Failed to fetch users:', error)
      toast({
        title: "Error",
        description: "Failed to load users",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleInvite = async () => {
    // Validation
    if (!inviteEmail || !inviteName || !inviteRole) {
      toast({
        title: "Validation Error",
        description: "Please fill in all fields",
        variant: "destructive"
      })
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail)) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid email address",
        variant: "destructive"
      })
      return
    }

    setIsInviting(true)

    try {
      const response = await fetch('/api/users/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: inviteEmail,
          name: inviteName,
          role: inviteRole
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send invitation')
      }

      toast({
        title: "Success",
        description: `Invitation sent to ${inviteEmail}`
      })

      // Reset form and close modal
      setInviteEmail('')
      setInviteName('')
      setInviteRole('project_administrator')
      setIsModalOpen(false)

      // Refresh user list
      fetchUsers()

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send invitation'
      toast({
        title: "Error",
        description: message,
        variant: "destructive"
      })
    } finally {
      setIsInviting(false)
    }
  }

  const openEditModal = (user: User) => {
    setEditingUser(user)
    setEditName(user.name)
    setEditRole(user.role)
    setIsEditModalOpen(true)
  }

  const handleUpdateUser = async () => {
    if (!editingUser) return

    if (!editName.trim()) {
      toast({
        title: "Validation Error",
        description: "Name is required",
        variant: "destructive"
      })
      return
    }

    setIsUpdating(true)

    try {
      const response = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: editName,
          role: editRole
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update user')
      }

      toast({
        title: "Success",
        description: `User ${editName} updated successfully`
      })

      // Reset and close modal
      setEditingUser(null)
      setEditName('')
      setEditRole('')
      setIsEditModalOpen(false)

      // Refresh user list
      fetchUsers()

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update user'
      toast({
        title: "Error",
        description: message,
        variant: "destructive"
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const openDeleteModal = (user: User) => {
    setUserToDelete(user)
    setIsDeleteModalOpen(true)
    // Close the edit modal if it's open
    setIsEditModalOpen(false)
  }

  const handleDeleteUser = async () => {
    if (!userToDelete) return

    setIsDeleting(true)

    try {
      const response = await fetch(`/api/users/${userToDelete.id}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete user')
      }

      toast({
        title: "Success",
        description: `User ${userToDelete.name} has been deactivated`
      })

      // Reset and close modal
      setUserToDelete(null)
      setIsDeleteModalOpen(false)

      // Refresh user list
      fetchUsers()

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete user'
      toast({
        title: "Error",
        description: message,
        variant: "destructive"
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never'
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMins < 60) return `${diffMins} min ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
    return date.toLocaleDateString()
  }

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <>
      {/* Top Bar */}
      <header className="bg-white border-b px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">User Management</h1>
            <p className="text-slate-500">Invite users and manage access permissions</p>
          </div>
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Invite User
          </Button>
        </div>
      </header>

      {/* User Management Content */}
      <div className="p-6 space-y-6">
        {/* Search and Filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5 text-primary" />
              Team Members
            </CardTitle>
            <CardDescription>{users.length} user{users.length !== 1 ? 's' : ''} in your organization</CardDescription>
          </CardHeader>
          <CardContent>
            {filteredUsers.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <UserCog className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                <p>No users found</p>
                <p className="text-sm">Click "Invite User" to add team members</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">User</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Role</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Status</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Last Active</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-slate-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className="border-b hover:bg-slate-50">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                              {user.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-slate-900">{user.name}</p>
                              <p className="text-sm text-slate-500">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${ROLE_LABELS[user.role]?.color || 'bg-slate-100 text-slate-700'}`}>
                            {ROLE_LABELS[user.role]?.label || user.role}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-green-500" />
                            <span className="text-sm text-slate-600">Active</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2 text-sm text-slate-500">
                            <Clock className="h-4 w-4" />
                            {formatDate(user.last_login_at)}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditModal(user)}
                            title="Edit user"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Invitations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-amber-500" />
              Pending Invitations
            </CardTitle>
            <CardDescription>Users who haven&apos;t accepted their invitation yet</CardDescription>
          </CardHeader>
          <CardContent>
            {pendingInvitations.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Mail className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                <p>No pending invitations</p>
                <p className="text-sm">Invited users will appear here until they accept</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingInvitations.map((invitation) => (
                  <div key={invitation.id} className="flex items-center justify-between p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-medium">
                        {invitation.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{invitation.name}</p>
                        <p className="text-sm text-slate-500">{invitation.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${ROLE_LABELS[invitation.role]?.color || 'bg-slate-100 text-slate-700'}`}>
                        {ROLE_LABELS[invitation.role]?.label || invitation.role}
                      </span>
                      <span className="text-sm text-amber-600">Pending</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Role Permissions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-green-500" />
              Role Permissions
            </CardTitle>
            <CardDescription>Overview of what each role can access</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <RolePermission
                role="Admin"
                color="purple"
                permissions={['Full access to all features', 'User management', 'Billing & subscription', 'Company settings']}
              />
              <RolePermission
                role="Risk Manager"
                color="blue"
                permissions={['View all projects', 'Portfolio-wide reporting', 'Exception approval', 'Cannot manage users or billing']}
              />
              <RolePermission
                role="Project Manager"
                color="green"
                permissions={['Full access to assigned projects', 'Add/remove subcontractors', 'Create exceptions', 'Cannot access other projects']}
              />
              <RolePermission
                role="Project Administrator"
                color="amber"
                permissions={['View assigned projects', 'Upload and review COCs', 'Send communications', 'Cannot modify project settings']}
              />
              <RolePermission
                role="Read Only"
                color="slate"
                permissions={['View projects and compliance status', 'View reports', 'Cannot modify any data']}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Invite User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold text-slate-900">Invite New User</h2>
              <Button variant="ghost" size="sm" onClick={() => setIsModalOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="inviteName">Full Name *</Label>
                <Input
                  id="inviteName"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="John Smith"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inviteEmail">Email Address *</Label>
                <Input
                  id="inviteEmail"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="john@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inviteRole">Role *</Label>
                <select
                  id="inviteRole"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  {ROLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg">
                <AlertCircle className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                <p className="text-sm text-blue-700">
                  An invitation email will be sent to this address. The user will need to click the link to set up their account.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-4 border-t bg-slate-50">
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleInvite} disabled={isInviting}>
                {isInviting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Invitation
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {isEditModalOpen && editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold text-slate-900">Edit User</h2>
              <Button variant="ghost" size="sm" onClick={() => setIsEditModalOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="editName">Full Name</Label>
                <Input
                  id="editName"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="John Smith"
                />
              </div>
              <div className="space-y-2">
                <Label>Email Address</Label>
                <Input
                  value={editingUser.email}
                  disabled
                  className="bg-slate-50"
                />
                <p className="text-xs text-slate-500">Email cannot be changed</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="editRole">Role</Label>
                <select
                  id="editRole"
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  {ROLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              {editRole !== editingUser.role && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-amber-700">
                    Changing role from <strong>{ROLE_LABELS[editingUser.role]?.label}</strong> to <strong>{ROLE_LABELS[editRole]?.label}</strong> will update this user&apos;s permissions immediately.
                  </p>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between p-4 border-t bg-slate-50">
              <Button
                variant="ghost"
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => openDeleteModal(editingUser)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Deactivate User
              </Button>
              <div className="flex items-center gap-3">
                <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleUpdateUser} disabled={isUpdating}>
                  {isUpdating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && userToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold text-slate-900">Deactivate User</h2>
              <Button variant="ghost" size="sm" onClick={() => setIsDeleteModalOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-4 p-4 bg-red-50 rounded-lg">
                <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                  <Trash2 className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <p className="font-medium text-slate-900">{userToDelete.name}</p>
                  <p className="text-sm text-slate-500">{userToDelete.email}</p>
                </div>
              </div>
              <p className="text-sm text-slate-600">
                Are you sure you want to deactivate this user? They will no longer be able to log in to the system. This action can be undone by re-inviting them.
              </p>
              <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg">
                <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                <p className="text-sm text-amber-700">
                  This will immediately revoke the user&apos;s access to all projects and data.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-4 border-t bg-slate-50">
              <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteUser}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deactivating...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Deactivate User
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function RolePermission({
  role,
  color,
  permissions
}: {
  role: string
  color: string
  permissions: string[]
}) {
  const colorClasses: Record<string, string> = {
    purple: 'bg-purple-100 text-purple-700 border-purple-200',
    blue: 'bg-blue-100 text-blue-700 border-blue-200',
    green: 'bg-green-100 text-green-700 border-green-200',
    amber: 'bg-amber-100 text-amber-700 border-amber-200',
    slate: 'bg-slate-100 text-slate-700 border-slate-200'
  }

  return (
    <div className={`p-4 rounded-lg border ${colorClasses[color]}`}>
      <h4 className="font-medium mb-2">{role}</h4>
      <ul className="text-sm space-y-1 opacity-80">
        {permissions.map((permission, index) => (
          <li key={index}>• {permission}</li>
        ))}
      </ul>
    </div>
  )
}
