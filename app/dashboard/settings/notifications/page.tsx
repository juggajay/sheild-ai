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
  Info,
  Settings,
  User
} from 'lucide-react'

// Types
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

interface NotificationPreferences {
  emailDigest: 'immediate' | 'daily' | 'weekly' | 'none'
  emailNotifications: {
    cocReceived: boolean
    cocVerified: boolean
    cocFailed: boolean
    expirationWarning: boolean
    stopWorkRisk: boolean
    communicationSent: boolean
    exceptionUpdates: boolean
  }
  inAppNotifications: {
    cocReceived: boolean
    cocVerified: boolean
    cocFailed: boolean
    expirationWarning: boolean
    stopWorkRisk: boolean
    communicationSent: boolean
    exceptionUpdates: boolean
  }
  expirationWarningDays: number
}

// Constants
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

const NOTIFICATION_TYPES = [
  { key: 'cocReceived', label: 'COC Received', description: 'When a new certificate is uploaded' },
  { key: 'cocVerified', label: 'COC Verified', description: 'When a certificate passes verification' },
  { key: 'cocFailed', label: 'COC Failed', description: 'When a certificate fails verification' },
  { key: 'expirationWarning', label: 'Expiration Warning', description: 'Before a certificate expires' },
  { key: 'stopWorkRisk', label: 'Stop Work Risk', description: 'Critical compliance issues' },
  { key: 'communicationSent', label: 'Communication Sent', description: 'When emails are sent on your behalf' },
  { key: 'exceptionUpdates', label: 'Exception Updates', description: 'Changes to compliance exceptions' }
]

const DIGEST_OPTIONS = [
  { value: 'immediate', label: 'Immediate', description: 'Send emails as events occur' },
  { value: 'daily', label: 'Daily Digest', description: 'One summary email per day' },
  { value: 'weekly', label: 'Weekly Digest', description: 'One summary email per week' },
  { value: 'none', label: 'No Emails', description: 'In-app notifications only' }
]

export default function NotificationsSettingsPage() {
  const [activeTab, setActiveTab] = useState<'preferences' | 'templates'>('preferences')

  // Preferences state
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null)
  const [preferencesLoading, setPreferencesLoading] = useState(true)
  const [preferencesSaving, setPreferencesSaving] = useState(false)
  const [preferencesMessage, setPreferencesMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // Templates state
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [selectedType, setSelectedType] = useState<string>('deficiency')
  const [templatesLoading, setTemplatesLoading] = useState(true)
  const [templatesSaving, setTemplatesSaving] = useState(false)
  const [editedSubject, setEditedSubject] = useState('')
  const [editedBody, setEditedBody] = useState('')
  const [templatesHasChanges, setTemplatesHasChanges] = useState(false)
  const [templatesMessage, setTemplatesMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // Fetch data on mount
  useEffect(() => {
    fetchPreferences()
    fetchTemplates()
  }, [])

  // Update template editor when selection changes
  useEffect(() => {
    const template = templates.find(t => t.type === selectedType)
    if (template) {
      setEditedSubject(template.subject || '')
      setEditedBody(template.body || '')
      setTemplatesHasChanges(false)
    }
  }, [selectedType, templates])

  // Fetch user preferences
  async function fetchPreferences() {
    try {
      const res = await fetch('/api/user/preferences')
      if (!res.ok) throw new Error('Failed to fetch preferences')
      const data = await res.json()
      setPreferences(data.preferences)
    } catch (error) {
      console.error('Error fetching preferences:', error)
    } finally {
      setPreferencesLoading(false)
    }
  }

  // Fetch email templates
  async function fetchTemplates() {
    try {
      const res = await fetch('/api/email-templates')
      if (!res.ok) throw new Error('Failed to fetch templates')
      const data = await res.json()
      setTemplates(data.templates)
    } catch (error) {
      console.error('Error fetching templates:', error)
    } finally {
      setTemplatesLoading(false)
    }
  }

  // Save preferences
  async function handleSavePreferences() {
    if (!preferences) return

    setPreferencesSaving(true)
    setPreferencesMessage(null)

    try {
      const res = await fetch('/api/user/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences)
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to save preferences')
      }

      setPreferencesMessage({ type: 'success', text: 'Preferences saved successfully' })
      setTimeout(() => setPreferencesMessage(null), 3000)
    } catch (error) {
      console.error('Error saving preferences:', error)
      setPreferencesMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to save preferences' })
    } finally {
      setPreferencesSaving(false)
    }
  }

  // Update digest preference
  function handleDigestChange(value: string) {
    if (!preferences) return
    setPreferences({
      ...preferences,
      emailDigest: value as NotificationPreferences['emailDigest']
    })
  }

  // Toggle email notification
  function toggleEmailNotification(key: string) {
    if (!preferences) return
    setPreferences({
      ...preferences,
      emailNotifications: {
        ...preferences.emailNotifications,
        [key]: !preferences.emailNotifications[key as keyof typeof preferences.emailNotifications]
      }
    })
  }

  // Toggle in-app notification
  function toggleInAppNotification(key: string) {
    if (!preferences) return
    setPreferences({
      ...preferences,
      inAppNotifications: {
        ...preferences.inAppNotifications,
        [key]: !preferences.inAppNotifications[key as keyof typeof preferences.inAppNotifications]
      }
    })
  }

  // Template handlers
  const currentTemplate = templates.find(t => t.type === selectedType)
  const currentTemplateInfo = TEMPLATE_TYPES.find(t => t.type === selectedType)

  function handleSubjectChange(value: string) {
    setEditedSubject(value)
    setTemplatesHasChanges(value !== currentTemplate?.subject || editedBody !== currentTemplate?.body)
  }

  function handleBodyChange(value: string) {
    setEditedBody(value)
    setTemplatesHasChanges(editedSubject !== currentTemplate?.subject || value !== currentTemplate?.body)
  }

  async function handleSaveTemplate() {
    if (!currentTemplate) return

    setTemplatesSaving(true)
    setTemplatesMessage(null)

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
      setTemplatesHasChanges(false)
      setTemplatesMessage({ type: 'success', text: 'Template saved successfully' })
      setTimeout(() => setTemplatesMessage(null), 3000)
    } catch (error) {
      console.error('Error saving template:', error)
      setTemplatesMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to save template' })
    } finally {
      setTemplatesSaving(false)
    }
  }

  async function handleResetTemplate() {
    if (!currentTemplate) return
    if (!confirm('Reset this template to the default? Your customizations will be lost.')) return

    setTemplatesSaving(true)
    setTemplatesMessage(null)

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
      setTemplatesHasChanges(false)
      setTemplatesMessage({ type: 'success', text: 'Template reset to default' })
      setTimeout(() => setTemplatesMessage(null), 3000)
    } catch (error) {
      console.error('Error resetting template:', error)
      setTemplatesMessage({ type: 'error', text: 'Failed to reset template' })
    } finally {
      setTemplatesSaving(false)
    }
  }

  function insertVariable(variable: string) {
    const textarea = document.getElementById('template-body') as HTMLTextAreaElement
    if (textarea) {
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const newBody = editedBody.substring(0, start) + variable + editedBody.substring(end)
      setEditedBody(newBody)
      setTemplatesHasChanges(true)
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + variable.length
        textarea.focus()
      }, 0)
    }
  }

  const isLoading = preferencesLoading || templatesLoading

  if (isLoading) {
    return (
      <div className="p-6 md:p-8 lg:p-12 flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="p-6 md:p-8 lg:p-12 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/dashboard/settings"
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Settings
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Notification Settings</h1>
        <p className="text-gray-500 mt-1">Manage your notification preferences and email templates</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('preferences')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === 'preferences'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <User className="w-4 h-4 inline-block mr-2" />
          My Preferences
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === 'templates'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Mail className="w-4 h-4 inline-block mr-2" />
          Email Templates
        </button>
      </div>

      {/* Preferences Tab */}
      {activeTab === 'preferences' && preferences && (
        <div className="space-y-6">
          {/* Email Digest Setting */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Mail className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">Email Digest Frequency</h2>
                <p className="text-sm text-gray-500">Choose how often you receive email notifications</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {DIGEST_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`relative flex flex-col p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                    preferences.emailDigest === option.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="emailDigest"
                    value={option.value}
                    checked={preferences.emailDigest === option.value}
                    onChange={(e) => handleDigestChange(e.target.value)}
                    className="sr-only"
                  />
                  <span className={`font-medium ${
                    preferences.emailDigest === option.value ? 'text-blue-700' : 'text-gray-900'
                  }`}>
                    {option.label}
                  </span>
                  <span className="text-xs text-gray-500 mt-1">{option.description}</span>
                  {preferences.emailDigest === option.value && (
                    <CheckCircle className="absolute top-2 right-2 w-4 h-4 text-blue-500" />
                  )}
                </label>
              ))}
            </div>
          </div>

          {/* Notification Types */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Bell className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">Notification Types</h2>
                <p className="text-sm text-gray-500">Choose which notifications you want to receive</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Notification</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-gray-700">Email</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-gray-700">In-App</th>
                  </tr>
                </thead>
                <tbody>
                  {NOTIFICATION_TYPES.map((type) => (
                    <tr key={type.key} className="border-b border-gray-100">
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium text-gray-900">{type.label}</p>
                          <p className="text-xs text-gray-500">{type.description}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={preferences.emailNotifications[type.key as keyof typeof preferences.emailNotifications]}
                            onChange={() => toggleEmailNotification(type.key)}
                            className="sr-only peer"
                            disabled={preferences.emailDigest === 'none'}
                          />
                          <div className={`w-9 h-5 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all ${
                            preferences.emailDigest === 'none'
                              ? 'bg-gray-200 cursor-not-allowed'
                              : 'bg-gray-300 peer-checked:bg-blue-600'
                          }`}></div>
                        </label>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={preferences.inAppNotifications[type.key as keyof typeof preferences.inAppNotifications]}
                            onChange={() => toggleInAppNotification(type.key)}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-gray-300 rounded-full peer peer-checked:bg-blue-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
                        </label>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {preferences.emailDigest === 'none' && (
              <div className="mt-4 p-3 bg-amber-50 rounded-lg flex items-center gap-2 text-amber-700 text-sm">
                <AlertTriangle className="w-4 h-4" />
                Email notifications are disabled. Enable a digest frequency to configure email preferences.
              </div>
            )}
          </div>

          {/* Expiration Warning Days */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">Expiration Warning</h2>
                <p className="text-sm text-gray-500">When to notify you about expiring certificates</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-gray-700">Notify me</span>
              <select
                value={preferences.expirationWarningDays}
                onChange={(e) => setPreferences({
                  ...preferences,
                  expirationWarningDays: parseInt(e.target.value)
                })}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value={7}>7 days</option>
                <option value={14}>14 days</option>
                <option value={30}>30 days</option>
                <option value={60}>60 days</option>
                <option value={90}>90 days</option>
              </select>
              <span className="text-gray-700">before a certificate expires</span>
            </div>
          </div>

          {/* Save Message */}
          {preferencesMessage && (
            <div className={`p-4 rounded-lg flex items-center gap-2 ${
              preferencesMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}>
              {preferencesMessage.type === 'success' ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                <AlertTriangle className="w-5 h-5" />
              )}
              <span>{preferencesMessage.text}</span>
            </div>
          )}

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              onClick={handleSavePreferences}
              disabled={preferencesSaving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {preferencesSaving ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        </div>
      )}

      {/* Templates Tab */}
      {activeTab === 'templates' && (
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
                    onClick={handleResetTemplate}
                    disabled={templatesSaving}
                    className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Reset
                  </button>
                  <button
                    onClick={handleSaveTemplate}
                    disabled={!templatesHasChanges || templatesSaving}
                    className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save className="w-4 h-4" />
                    {templatesSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>

              {/* Save Message */}
              {templatesMessage && (
                <div className={`mx-4 mt-4 p-3 rounded-lg flex items-center gap-2 ${
                  templatesMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                }`}>
                  {templatesMessage.type === 'success' ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    <AlertTriangle className="w-4 h-4" />
                  )}
                  <span className="text-sm">{templatesMessage.text}</span>
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
      )}
    </div>
  )
}
