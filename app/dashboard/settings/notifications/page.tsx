'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Mail,
  Save,
  RotateCcw,
  AlertTriangle,
  CheckCircle,
  Clock,
  Bell,
  Info
} from 'lucide-react'

interface EmailTemplate {
  id: string
  company_id: string | null
  type: string
  name: string | null
  subject: string | null
  body: string | null
  is_default: number
  created_at: string
  updated_at: string
}

const TEMPLATE_TYPES = [
  { type: 'deficiency', label: 'Deficiency Notice', icon: AlertTriangle, color: 'text-red-500' },
  { type: 'confirmation', label: 'Confirmation', icon: CheckCircle, color: 'text-green-500' },
  { type: 'expiration_reminder', label: 'Expiration Reminder', icon: Clock, color: 'text-amber-500' },
  { type: 'follow_up_1', label: 'First Follow-up', icon: Bell, color: 'text-blue-500' },
  { type: 'follow_up_2', label: 'Second Follow-up', icon: Bell, color: 'text-orange-500' },
  { type: 'follow_up_3', label: 'Final Notice', icon: Bell, color: 'text-red-600' }
]

const AVAILABLE_VARIABLES = [
  { variable: '{{subcontractor_name}}', description: 'Subcontractor company name' },
  { variable: '{{subcontractor_abn}}', description: 'Subcontractor ABN' },
  { variable: '{{project_name}}', description: 'Project name' },
  { variable: '{{recipient_name}}', description: 'Recipient name (broker or contact)' },
  { variable: '{{deficiency_list}}', description: 'List of deficiencies found' },
  { variable: '{{upload_link}}', description: 'Link to upload new certificate' },
  { variable: '{{due_date}}', description: 'Due date for compliance' },
  { variable: '{{expiry_date}}', description: 'Certificate expiry date' },
  { variable: '{{days_until_expiry}}', description: 'Number of days until expiry' }
]

export default function NotificationsSettingsPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [selectedType, setSelectedType] = useState<string>('deficiency')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [editedSubject, setEditedSubject] = useState('')
  const [editedBody, setEditedBody] = useState('')
  const [hasChanges, setHasChanges] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  useEffect(() => {
    fetchTemplates()
  }, [])

  useEffect(() => {
    const template = templates.find(t => t.type === selectedType)
    if (template) {
      setEditedSubject(template.subject || '')
      setEditedBody(template.body || '')
      setHasChanges(false)
    }
  }, [selectedType, templates])

  async function fetchTemplates() {
    try {
      const res = await fetch('/api/email-templates')
      if (!res.ok) throw new Error('Failed to fetch templates')
      const data = await res.json()
      setTemplates(data.templates)
    } catch (error) {
      console.error('Error fetching templates:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const currentTemplate = templates.find(t => t.type === selectedType)
  const currentTemplateInfo = TEMPLATE_TYPES.find(t => t.type === selectedType)

  function handleSubjectChange(value: string) {
    setEditedSubject(value)
    setHasChanges(value !== currentTemplate?.subject || editedBody !== currentTemplate?.body)
  }

  function handleBodyChange(value: string) {
    setEditedBody(value)
    setHasChanges(editedSubject !== currentTemplate?.subject || value !== currentTemplate?.body)
  }

  async function handleSave() {
    if (!currentTemplate) return

    setIsSaving(true)
    setSaveMessage(null)

    try {
      const res = await fetch('/api/email-templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: currentTemplate.id,
          subject: editedSubject,
          body: editedBody
        })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to save template')
      }

      await fetchTemplates()
      setHasChanges(false)
      setSaveMessage({ type: 'success', text: 'Template saved successfully' })
      setTimeout(() => setSaveMessage(null), 3000)
    } catch (error) {
      console.error('Error saving template:', error)
      setSaveMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to save template' })
    } finally {
      setIsSaving(false)
    }
  }

  async function handleReset() {
    if (!currentTemplate) return
    if (!confirm('Reset this template to the default? Your customizations will be lost.')) return

    setIsSaving(true)
    setSaveMessage(null)

    try {
      const res = await fetch('/api/email-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: currentTemplate.id,
          type: currentTemplate.type
        })
      })

      if (!res.ok) throw new Error('Failed to reset template')

      await fetchTemplates()
      setHasChanges(false)
      setSaveMessage({ type: 'success', text: 'Template reset to default' })
      setTimeout(() => setSaveMessage(null), 3000)
    } catch (error) {
      console.error('Error resetting template:', error)
      setSaveMessage({ type: 'error', text: 'Failed to reset template' })
    } finally {
      setIsSaving(false)
    }
  }

  function insertVariable(variable: string) {
    const textarea = document.getElementById('template-body') as HTMLTextAreaElement
    if (textarea) {
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const newBody = editedBody.substring(0, start) + variable + editedBody.substring(end)
      setEditedBody(newBody)
      setHasChanges(true)
      // Restore cursor position
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + variable.length
        textarea.focus()
      }, 0)
    }
  }

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/dashboard/settings"
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Settings
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Email Templates</h1>
        <p className="text-gray-500 mt-1">Customize email notifications sent to subcontractors and brokers</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Template Type Selector */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-4">Template Types</h3>
            <div className="space-y-2">
              {TEMPLATE_TYPES.map((templateType) => {
                const Icon = templateType.icon
                const isSelected = selectedType === templateType.type
                return (
                  <button
                    key={templateType.type}
                    onClick={() => setSelectedType(templateType.type)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                      isSelected
                        ? 'bg-blue-50 border border-blue-200'
                        : 'hover:bg-gray-50 border border-transparent'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${templateType.color}`} />
                    <span className={`text-sm ${isSelected ? 'font-medium text-blue-700' : 'text-gray-700'}`}>
                      {templateType.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Available Variables */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mt-4">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-500" />
              Variables
            </h3>
            <p className="text-xs text-gray-500 mb-3">Click to insert into template body</p>
            <div className="space-y-2">
              {AVAILABLE_VARIABLES.map((v) => (
                <button
                  key={v.variable}
                  onClick={() => insertVariable(v.variable)}
                  className="w-full text-left p-2 rounded hover:bg-gray-50 group"
                  title={v.description}
                >
                  <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-blue-600 group-hover:bg-blue-100">
                    {v.variable}
                  </code>
                  <p className="text-xs text-gray-500 mt-1 truncate">{v.description}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Template Editor */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            {/* Editor Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {currentTemplateInfo && (
                  <>
                    <currentTemplateInfo.icon className={`w-5 h-5 ${currentTemplateInfo.color}`} />
                    <div>
                      <h2 className="font-semibold text-gray-900">{currentTemplateInfo.label}</h2>
                      <p className="text-sm text-gray-500">Edit the email template below</p>
                    </div>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleReset}
                  disabled={isSaving}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg flex items-center gap-1.5 disabled:opacity-50"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset
                </button>
                <button
                  onClick={handleSave}
                  disabled={!hasChanges || isSaving}
                  className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>

            {/* Save Message */}
            {saveMessage && (
              <div className={`mx-4 mt-4 p-3 rounded-lg flex items-center gap-2 ${
                saveMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}>
                {saveMessage.type === 'success' ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <AlertTriangle className="w-4 h-4" />
                )}
                <span className="text-sm">{saveMessage.text}</span>
              </div>
            )}

            {/* Editor Content */}
            <div className="p-4 space-y-4">
              {/* Subject */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Subject
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={editedSubject}
                    onChange={(e) => handleSubjectChange(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter email subject..."
                  />
                </div>
              </div>

              {/* Body */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Body
                </label>
                <textarea
                  id="template-body"
                  value={editedBody}
                  onChange={(e) => handleBodyChange(e.target.value)}
                  rows={16}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                  placeholder="Enter email body..."
                />
              </div>

              {/* Preview hint */}
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Info className="w-4 h-4" />
                <span>Variables like <code className="bg-gray-100 px-1 rounded">{"{{subcontractor_name}}"}</code> will be replaced with actual values when emails are sent.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
