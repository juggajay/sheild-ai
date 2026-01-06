"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  FolderKanban,
  MapPin,
  Calendar,
  DollarSign,
  User,
  Loader2,
  Building,
  Shield
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"

interface TeamMember {
  id: string
  name: string
  email: string
  role: string
}

interface RequirementTemplate {
  id: string
  name: string
  type: string
  requirements: Array<{
    coverage_type: string
    minimum_limit: number | null
    limit_type: string
    maximum_excess: number | null
    principal_indemnity_required: boolean
    cross_liability_required: boolean
  }>
  is_standard: boolean
}

const AUSTRALIAN_STATES = [
  { value: 'NSW', label: 'New South Wales' },
  { value: 'VIC', label: 'Victoria' },
  { value: 'QLD', label: 'Queensland' },
  { value: 'WA', label: 'Western Australia' },
  { value: 'SA', label: 'South Australia' },
  { value: 'TAS', label: 'Tasmania' },
  { value: 'NT', label: 'Northern Territory' },
  { value: 'ACT', label: 'Australian Capital Territory' }
]

export default function NewProjectPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [templates, setTemplates] = useState<RequirementTemplate[]>([])

  // Form state
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [state, setState] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [estimatedValue, setEstimatedValue] = useState('')
  const [projectManagerId, setProjectManagerId] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState('')

  useEffect(() => {
    fetchTeamMembers()
    fetchTemplates()
  }, [])

  const fetchTeamMembers = async () => {
    try {
      const response = await fetch('/api/users')
      if (response.ok) {
        const data = await response.json()
        // Filter to only show users who can be project managers
        const managers = data.users?.filter((u: TeamMember) =>
          ['admin', 'risk_manager', 'project_manager'].includes(u.role)
        ) || []
        setTeamMembers(managers)
      }
    } catch (error) {
      console.error('Failed to fetch team members:', error)
    }
  }

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/requirement-templates')
      if (response.ok) {
        const data = await response.json()
        setTemplates(data.templates || [])
      }
    } catch (error) {
      console.error('Failed to fetch templates:', error)
    }
  }

  const getSelectedTemplate = () => {
    return templates.find(t => t.id === selectedTemplateId)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      toast({
        title: "Validation Error",
        description: "Project name is required",
        variant: "destructive"
      })
      return
    }

    setIsLoading(true)

    try {
      // Get template requirements if selected
      const selectedTemplate = getSelectedTemplate()

      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: name.trim(),
          address: address.trim() || null,
          state: state || null,
          startDate: startDate || null,
          endDate: endDate || null,
          estimatedValue: estimatedValue ? parseFloat(estimatedValue) : null,
          projectManagerId: projectManagerId || null,
          templateId: selectedTemplateId || null
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create project')
      }

      // If template selected, add requirements to the project
      if (selectedTemplate && selectedTemplate.requirements.length > 0) {
        await fetch(`/api/projects/${data.project.id}/requirements`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requirements: selectedTemplate.requirements })
        })
      }

      toast({
        title: "Success",
        description: selectedTemplate
          ? `Project created with ${selectedTemplate.name} template requirements`
          : "Project created successfully"
      })

      // Redirect to the new project
      router.push(`/dashboard/projects/${data.project.id}`)

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create project'
      toast({
        title: "Error",
        description: message,
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      {/* Top Bar */}
      <header className="bg-white border-b px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/projects">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Projects
            </Button>
          </Link>
          <div className="border-l pl-4">
            <h1 className="text-2xl font-semibold text-slate-900">New Project</h1>
            <p className="text-slate-500">Create a new construction project</p>
          </div>
        </div>
      </header>

      {/* Form Content */}
      <div className="p-6 max-w-3xl mx-auto">
        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderKanban className="h-5 w-5 text-primary" />
                Project Details
              </CardTitle>
              <CardDescription>
                Enter the details for your new construction project
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Project Name */}
              <div className="space-y-2">
                <Label htmlFor="name" className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-slate-400" />
                  Project Name *
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Sydney Office Tower"
                  required
                />
              </div>

              {/* Address */}
              <div className="space-y-2">
                <Label htmlFor="address" className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-slate-400" />
                  Project Address
                </Label>
                <Input
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g., 123 George Street, Sydney"
                />
              </div>

              {/* State */}
              <div className="space-y-2">
                <Label htmlFor="state" className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-slate-400" />
                  State/Territory
                </Label>
                <select
                  id="state"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="">Select a state...</option>
                  {AUSTRALIAN_STATES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label} ({s.value})
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate" className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-slate-400" />
                    Start Date
                  </Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate" className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-slate-400" />
                    End Date
                  </Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Estimated Value */}
              <div className="space-y-2">
                <Label htmlFor="estimatedValue" className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-slate-400" />
                  Estimated Value (AUD)
                </Label>
                <Input
                  id="estimatedValue"
                  type="number"
                  min="0"
                  step="1000"
                  value={estimatedValue}
                  onChange={(e) => setEstimatedValue(e.target.value)}
                  placeholder="e.g., 5000000"
                />
              </div>

              {/* Project Manager */}
              <div className="space-y-2">
                <Label htmlFor="projectManager" className="flex items-center gap-2">
                  <User className="h-4 w-4 text-slate-400" />
                  Project Manager
                </Label>
                <select
                  id="projectManager"
                  value={projectManagerId}
                  onChange={(e) => setProjectManagerId(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="">Select a project manager...</option>
                  {teamMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name} ({member.email})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500">
                  The project manager will have full access to this project
                </p>
              </div>

              {/* Requirement Template */}
              <div className="space-y-2">
                <Label htmlFor="template" className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-slate-400" />
                  Insurance Requirement Template
                </Label>
                <select
                  id="template"
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="">No template (configure later)</option>
                  {templates.filter(t => t.is_standard).map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                  {templates.filter(t => !t.is_standard).length > 0 && (
                    <optgroup label="Custom Templates">
                      {templates.filter(t => !t.is_standard).map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                <p className="text-xs text-slate-500">
                  Select a template to auto-populate insurance requirements for subcontractors
                </p>
                {getSelectedTemplate() && (
                  <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                    <p className="text-sm font-medium text-blue-800 mb-2">
                      {getSelectedTemplate()?.name} includes:
                    </p>
                    <ul className="text-xs text-blue-700 space-y-1">
                      {getSelectedTemplate()?.requirements.map((req, idx) => (
                        <li key={idx} className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                          <span className="capitalize">{req.coverage_type.replace(/_/g, ' ')}</span>
                          {req.minimum_limit && (
                            <span className="text-blue-600">
                              - ${(req.minimum_limit / 1000000).toFixed(0)}M min
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Submit Buttons */}
          <div className="flex items-center justify-end gap-4 mt-6">
            <Link href="/dashboard/projects">
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Link>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <FolderKanban className="h-4 w-4 mr-2" />
                  Create Project
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </>
  )
}
