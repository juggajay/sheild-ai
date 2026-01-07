'use client'

import { useState, useEffect } from 'react'
import {
  Mail,
  Send,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Search
} from 'lucide-react'

interface Communication {
  id: string
  subcontractor_id: string
  project_id: string
  verification_id: string | null
  type: 'deficiency' | 'follow_up' | 'confirmation' | 'expiration_reminder' | 'critical_alert'
  channel: 'email' | 'sms'
  recipient_email: string | null
  cc_emails: string | null
  subject: string | null
  body: string | null
  status: 'pending' | 'sent' | 'delivered' | 'opened' | 'failed'
  sent_at: string | null
  delivered_at: string | null
  opened_at: string | null
  created_at: string
  subcontractor_name: string
  project_name: string
}

export default function CommunicationsPage() {
  const [communications, setCommunications] = useState<Communication[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  useEffect(() => {
    fetchCommunications()
  }, [])

  async function fetchCommunications() {
    try {
      const res = await fetch('/api/communications')
      if (!res.ok) throw new Error('Failed to fetch communications')
      const data = await res.json()
      setCommunications(data.communications)
    } catch (error) {
      console.error('Error fetching communications:', error)
    } finally {
      setIsLoading(false)
    }
  }

  function getTypeIcon(type: string) {
    switch (type) {
      case 'deficiency':
        return <AlertTriangle className="w-4 h-4 text-red-500" />
      case 'follow_up':
        return <Clock className="w-4 h-4 text-amber-500" />
      case 'confirmation':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'expiration_reminder':
        return <Clock className="w-4 h-4 text-orange-500" />
      case 'critical_alert':
        return <AlertTriangle className="w-4 h-4 text-red-600" />
      default:
        return <Mail className="w-4 h-4 text-gray-500" />
    }
  }

  function getTypeBadge(type: string) {
    const colors: Record<string, string> = {
      deficiency: 'bg-red-100 text-red-800',
      follow_up: 'bg-amber-100 text-amber-800',
      confirmation: 'bg-green-100 text-green-800',
      expiration_reminder: 'bg-orange-100 text-orange-800',
      critical_alert: 'bg-red-200 text-red-900'
    }
    const labels: Record<string, string> = {
      deficiency: 'Deficiency Notice',
      follow_up: 'Follow Up',
      confirmation: 'Confirmation',
      expiration_reminder: 'Expiration Reminder',
      critical_alert: 'Critical Alert'
    }
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[type] || 'bg-gray-100 text-gray-800'}`}>
        {labels[type] || type}
      </span>
    )
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-gray-400" />
      case 'sent':
        return <Send className="w-4 h-4 text-blue-500" />
      case 'delivered':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'opened':
        return <Eye className="w-4 h-4 text-purple-500" />
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />
      default:
        return <Clock className="w-4 h-4 text-gray-400" />
    }
  }

  function getStatusBadge(status: string) {
    const colors: Record<string, string> = {
      pending: 'bg-gray-100 text-gray-700',
      sent: 'bg-blue-100 text-blue-800',
      delivered: 'bg-green-100 text-green-800',
      opened: 'bg-purple-100 text-purple-800',
      failed: 'bg-red-100 text-red-800'
    }
    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded ${colors[status] || 'bg-gray-100 text-gray-700'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    )
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Filter communications
  const filteredCommunications = communications.filter(comm => {
    const matchesSearch =
      comm.subcontractor_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      comm.project_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      comm.recipient_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      comm.subject?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesType = filterType === 'all' || comm.type === filterType
    const matchesStatus = filterStatus === 'all' || comm.status === filterStatus

    return matchesSearch && matchesType && matchesStatus
  })

  // Statistics
  const stats = {
    total: communications.length,
    sent: communications.filter(c => c.status === 'sent').length,
    delivered: communications.filter(c => c.status === 'delivered').length,
    opened: communications.filter(c => c.status === 'opened').length,
    pending: communications.filter(c => c.status === 'pending').length,
    failed: communications.filter(c => c.status === 'failed').length
  }

  if (isLoading) {
    return (
      <div className="p-6 md:p-8 lg:p-12 flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="p-6 md:p-8 lg:p-12 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Communications</h1>
        <p className="text-gray-500 mt-1">View and manage email notifications</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <Mail className="w-8 h-8 text-gray-400" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Sent</p>
              <p className="text-2xl font-bold text-blue-600">{stats.sent}</p>
            </div>
            <Send className="w-8 h-8 text-blue-400" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Delivered</p>
              <p className="text-2xl font-bold text-green-600">{stats.delivered}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Opened</p>
              <p className="text-2xl font-bold text-purple-600">{stats.opened}</p>
            </div>
            <Eye className="w-8 h-8 text-purple-400" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Pending</p>
              <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
            </div>
            <Clock className="w-8 h-8 text-amber-400" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Failed</p>
              <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
            </div>
            <XCircle className="w-8 h-8 text-red-400" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by recipient, subject, or project..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Types</option>
            <option value="deficiency">Deficiency Notice</option>
            <option value="follow_up">Follow Up</option>
            <option value="confirmation">Confirmation</option>
            <option value="expiration_reminder">Expiration Reminder</option>
            <option value="critical_alert">Critical Alert</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="sent">Sent</option>
            <option value="delivered">Delivered</option>
            <option value="opened">Opened</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      {/* Communications List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Email History</h3>
          <p className="text-sm text-gray-500">{filteredCommunications.length} communications</p>
        </div>

        {filteredCommunications.length === 0 ? (
          <div className="p-8 text-center">
            <Mail className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No communications found</p>
            <p className="text-sm text-gray-400 mt-1">
              Emails will appear here when documents are processed
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredCommunications.map((comm) => (
              <div key={comm.id} className="hover:bg-gray-50">
                <div
                  className="p-4 cursor-pointer"
                  onClick={() => setExpandedId(expandedId === comm.id ? null : comm.id)}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 mt-1">
                      {getTypeIcon(comm.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {getTypeBadge(comm.type)}
                        {getStatusBadge(comm.status)}
                      </div>
                      <p className="font-medium text-gray-900 truncate">
                        {comm.subject || 'No subject'}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-gray-500">
                        <span>To: {comm.recipient_email || 'N/A'}</span>
                        <span>{comm.subcontractor_name}</span>
                        <span>{comm.project_name}</span>
                      </div>
                    </div>
                    <div className="flex-shrink-0 flex items-center gap-3">
                      <div className="text-right text-sm">
                        <p className="text-gray-900">{formatDate(comm.sent_at || comm.created_at)}</p>
                        {comm.opened_at && (
                          <p className="text-xs text-purple-600">Opened {formatDate(comm.opened_at)}</p>
                        )}
                      </div>
                      {expandedId === comm.id ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Content */}
                {expandedId === comm.id && (
                  <div className="px-4 pb-4 pt-0 ml-8 border-t border-gray-100 mt-2">
                    <div className="bg-gray-50 rounded-lg p-4 mt-3">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Email Content</h4>
                      <pre className="text-sm text-gray-600 whitespace-pre-wrap font-sans">
                        {comm.body || 'No content'}
                      </pre>
                    </div>
                    <div className="flex items-center gap-4 mt-4 text-sm">
                      <div className="flex items-center gap-1.5">
                        {getStatusIcon(comm.status)}
                        <span className="text-gray-600">Status: {comm.status}</span>
                      </div>
                      {comm.verification_id && (
                        <a
                          href={`/dashboard/documents?verification=${comm.verification_id}`}
                          className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          View Document
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
