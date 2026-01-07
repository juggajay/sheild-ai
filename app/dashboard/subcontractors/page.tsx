"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import {
  Building2,
  Plus,
  Search,
  Phone,
  Mail,
  MapPin,
  Briefcase,
  Users,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Upload,
  Download,
  FileSpreadsheet,
  ArrowRight,
  GitMerge,
  SkipForward
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog"
import { useToast } from "@/components/ui/use-toast"
import { Skeleton } from "@/components/ui/skeleton"

interface Subcontractor {
  id: string
  name: string
  abn: string
  trading_name: string | null
  trade: string | null
  address: string | null
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  broker_name: string | null
  broker_email: string | null
  broker_phone: string | null
  project_count: number
  created_at: string
}

export default function SubcontractorsPage() {
  const { toast } = useToast()
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [userRole, setUserRole] = useState<string | null>(null)

  // Add subcontractor modal state
  const [showAddModal, setShowAddModal] = useState(false)
  const [isAdding, setIsAdding] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    abn: '',
    tradingName: '',
    trade: '',
    address: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    brokerName: '',
    brokerEmail: '',
    brokerPhone: ''
  })

  // ABN validation state
  const [abnError, setAbnError] = useState<string | null>(null)
  const [abnLookupLoading, setAbnLookupLoading] = useState(false)
  const [abnLookupResult, setAbnLookupResult] = useState<{
    valid: boolean
    entityName?: string | null
    status?: string
    entityType?: string | null
    message?: string
  } | null>(null)

  // CSV Import state
  const [showImportModal, setShowImportModal] = useState(false)
  const [importStep, setImportStep] = useState<'upload' | 'mapping' | 'preview' | 'duplicates' | 'importing'>('upload')
  const [csvData, setCsvData] = useState<string[][]>([])
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({})
  const [importPreview, setImportPreview] = useState<Array<Record<string, string>>>([])
  const [isImporting, setIsImporting] = useState(false)
  const [importErrors, setImportErrors] = useState<string[]>([])
  const [duplicates, setDuplicates] = useState<Array<{
    rowNum: number
    importData: Record<string, string>
    existingId: string
    existingName: string
    cleanedABN: string
  }>>([])
  const [selectedMergeIds, setSelectedMergeIds] = useState<string[]>([])

  // Field mapping options for CSV import
  const fieldMappingOptions = [
    { value: '', label: 'Do not import' },
    { value: 'name', label: 'Company Name' },
    { value: 'abn', label: 'ABN' },
    { value: 'tradingName', label: 'Trading Name' },
    { value: 'trade', label: 'Trade' },
    { value: 'address', label: 'Address' },
    { value: 'contactName', label: 'Contact Name' },
    { value: 'contactEmail', label: 'Contact Email' },
    { value: 'contactPhone', label: 'Contact Phone' },
    { value: 'brokerName', label: 'Broker Name' },
    { value: 'brokerEmail', label: 'Broker Email' },
    { value: 'brokerPhone', label: 'Broker Phone' },
  ]

  useEffect(() => {
    fetchUserRole()
    fetchSubcontractors()
  }, [])

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

  const canAddSubcontractors = userRole && ['admin', 'risk_manager', 'project_manager'].includes(userRole)

  const fetchSubcontractors = async () => {
    try {
      const response = await fetch('/api/subcontractors')
      if (response.ok) {
        const data = await response.json()
        setSubcontractors(data.subcontractors || [])
      }
    } catch (error) {
      console.error('Failed to fetch subcontractors:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpenAddModal = () => {
    setFormData({
      name: '',
      abn: '',
      tradingName: '',
      trade: '',
      address: '',
      contactName: '',
      contactEmail: '',
      contactPhone: '',
      brokerName: '',
      brokerEmail: '',
      brokerPhone: ''
    })
    setAbnError(null)
    setAbnLookupResult(null)
    setShowAddModal(true)
  }

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const formatABN = (value: string) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '')
    // Format as XX XXX XXX XXX
    if (digits.length <= 2) return digits
    if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`
    if (digits.length <= 8) return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`
    return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 11)}`
  }

  const handleABNChange = (value: string) => {
    const formatted = formatABN(value)
    setFormData(prev => ({ ...prev, abn: formatted }))

    // Clear previous validation
    setAbnError(null)
    setAbnLookupResult(null)
  }

  // Validate ABN format and checksum client-side
  const validateABNFormat = (abn: string): { valid: boolean; error?: string } => {
    const digits = abn.replace(/\s/g, '')

    if (!digits) {
      return { valid: false, error: 'ABN is required' }
    }

    if (!/^\d+$/.test(digits)) {
      return { valid: false, error: 'ABN must contain only digits' }
    }

    if (digits.length !== 11) {
      return { valid: false, error: 'ABN must be exactly 11 digits' }
    }

    // Validate checksum using Australian algorithm
    const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19]
    const abnDigits = digits.split('').map(Number)
    abnDigits[0] = abnDigits[0] - 1 // Subtract 1 from first digit
    const sum = abnDigits.reduce((acc, digit, i) => acc + digit * weights[i], 0)

    if (sum % 89 !== 0) {
      return { valid: false, error: 'Invalid ABN checksum - please verify the ABN is correct' }
    }

    return { valid: true }
  }

  // Look up ABN against ABR (Australian Business Register)
  const lookupABN = async () => {
    const digits = formData.abn.replace(/\s/g, '')

    // First validate format
    const validation = validateABNFormat(digits)
    if (!validation.valid) {
      setAbnError(validation.error || 'Invalid ABN')
      return
    }

    setAbnLookupLoading(true)
    setAbnError(null)

    try {
      const response = await fetch(`/api/external/abn/${digits}`)
      const data = await response.json()

      if (!response.ok) {
        setAbnError(data.error || 'ABN validation failed')
        setAbnLookupResult(null)
        return
      }

      setAbnLookupResult(data)

      // Auto-populate company name if available and name field is empty
      if (data.entityName && !formData.name.trim()) {
        setFormData(prev => ({ ...prev, name: data.entityName }))
        toast({
          title: "ABN Verified",
          description: `Company name auto-populated: ${data.entityName}`
        })
      } else if (data.entityName) {
        toast({
          title: "ABN Verified",
          description: `Registered entity: ${data.entityName}`
        })
      } else {
        toast({
          title: "ABN Format Valid",
          description: "ABN checksum is valid. Entity details not available."
        })
      }
    } catch (error) {
      setAbnError('Failed to validate ABN')
    } finally {
      setAbnLookupLoading(false)
    }
  }

  // Handle ABN blur (validate format when user leaves field)
  const handleABNBlur = () => {
    const digits = formData.abn.replace(/\s/g, '')
    if (digits.length > 0) {
      const validation = validateABNFormat(digits)
      if (!validation.valid) {
        setAbnError(validation.error || 'Invalid ABN')
      }
    }
  }

  // CSV Export function
  const handleExportCSV = () => {
    if (subcontractors.length === 0) {
      toast({
        title: "No data to export",
        description: "Add some subcontractors first",
        variant: "destructive"
      })
      return
    }

    // Define CSV headers
    const headers = [
      'Name',
      'ABN',
      'Trading Name',
      'Trade',
      'Address',
      'Contact Name',
      'Contact Email',
      'Contact Phone',
      'Broker Name',
      'Broker Email',
      'Broker Phone',
      'Project Count',
      'Created At'
    ]

    // Build CSV content
    const csvContent = [
      headers.join(','),
      ...subcontractors.map(sub => [
        `"${(sub.name || '').replace(/"/g, '""')}"`,
        `"${(sub.abn || '').replace(/"/g, '""')}"`,
        `"${(sub.trading_name || '').replace(/"/g, '""')}"`,
        `"${(sub.trade || '').replace(/"/g, '""')}"`,
        `"${(sub.address || '').replace(/"/g, '""')}"`,
        `"${(sub.contact_name || '').replace(/"/g, '""')}"`,
        `"${(sub.contact_email || '').replace(/"/g, '""')}"`,
        `"${(sub.contact_phone || '').replace(/"/g, '""')}"`,
        `"${(sub.broker_name || '').replace(/"/g, '""')}"`,
        `"${(sub.broker_email || '').replace(/"/g, '""')}"`,
        `"${(sub.broker_phone || '').replace(/"/g, '""')}"`,
        sub.project_count || 0,
        `"${(sub.created_at || '').replace(/"/g, '""')}"`
      ].join(','))
    ].join('\n')

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `subcontractors_export_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    toast({
      title: "Export Complete",
      description: `Exported ${subcontractors.length} subcontractors to CSV`
    })
  }

  // CSV Import functions
  const handleOpenImportModal = () => {
    setImportStep('upload')
    setCsvData([])
    setCsvHeaders([])
    setColumnMapping({})
    setImportPreview([])
    setImportErrors([])
    setDuplicates([])
    setSelectedMergeIds([])
    setShowImportModal(true)
  }

  const parseCSV = (text: string): string[][] => {
    const lines = text.split(/\r?\n/).filter(line => line.trim())
    return lines.map(line => {
      const result: string[] = []
      let current = ''
      let inQuotes = false

      for (let i = 0; i < line.length; i++) {
        const char = line[i]
        if (char === '"') {
          inQuotes = !inQuotes
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim())
          current = ''
        } else {
          current += char
        }
      }
      result.push(current.trim())
      return result
    })
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const parsed = parseCSV(text)

      if (parsed.length < 2) {
        toast({
          title: "Invalid CSV",
          description: "CSV must have at least a header row and one data row",
          variant: "destructive"
        })
        return
      }

      const headers = parsed[0]
      const data = parsed.slice(1)

      setCsvHeaders(headers)
      setCsvData(data)

      // Auto-map columns based on header names
      const autoMapping: Record<string, string> = {}
      headers.forEach((header, index) => {
        const headerLower = header.toLowerCase().replace(/[^a-z]/g, '')
        if (headerLower.includes('companyname') || headerLower === 'name') {
          autoMapping[index.toString()] = 'name'
        } else if (headerLower === 'abn') {
          autoMapping[index.toString()] = 'abn'
        } else if (headerLower.includes('tradingname') || headerLower.includes('trading')) {
          autoMapping[index.toString()] = 'tradingName'
        } else if (headerLower === 'trade') {
          autoMapping[index.toString()] = 'trade'
        } else if (headerLower === 'address') {
          autoMapping[index.toString()] = 'address'
        } else if (headerLower.includes('contactname') || headerLower.includes('contact') && headerLower.includes('name')) {
          autoMapping[index.toString()] = 'contactName'
        } else if (headerLower.includes('contactemail') || (headerLower.includes('contact') && headerLower.includes('email'))) {
          autoMapping[index.toString()] = 'contactEmail'
        } else if (headerLower.includes('contactphone') || (headerLower.includes('contact') && headerLower.includes('phone'))) {
          autoMapping[index.toString()] = 'contactPhone'
        } else if (headerLower.includes('brokername') || (headerLower.includes('broker') && headerLower.includes('name'))) {
          autoMapping[index.toString()] = 'brokerName'
        } else if (headerLower.includes('brokeremail') || (headerLower.includes('broker') && headerLower.includes('email'))) {
          autoMapping[index.toString()] = 'brokerEmail'
        } else if (headerLower.includes('brokerphone') || (headerLower.includes('broker') && headerLower.includes('phone'))) {
          autoMapping[index.toString()] = 'brokerPhone'
        }
      })

      setColumnMapping(autoMapping)
      setImportStep('mapping')
    }
    reader.readAsText(file)
  }

  const handleMappingChange = (columnIndex: string, field: string) => {
    setColumnMapping(prev => {
      const newMapping = { ...prev }
      // Remove previous mapping for this field
      Object.keys(newMapping).forEach(key => {
        if (newMapping[key] === field && key !== columnIndex) {
          delete newMapping[key]
        }
      })
      if (field) {
        newMapping[columnIndex] = field
      } else {
        delete newMapping[columnIndex]
      }
      return newMapping
    })
  }

  const generatePreview = () => {
    // Check required fields are mapped
    const mappedFields = Object.values(columnMapping)
    if (!mappedFields.includes('name')) {
      toast({
        title: "Mapping Required",
        description: "Company Name is required - please map a column to it",
        variant: "destructive"
      })
      return
    }
    if (!mappedFields.includes('abn')) {
      toast({
        title: "Mapping Required",
        description: "ABN is required - please map a column to it",
        variant: "destructive"
      })
      return
    }

    // Generate preview data
    const preview = csvData.map(row => {
      const record: Record<string, string> = {}
      Object.entries(columnMapping).forEach(([colIndex, field]) => {
        record[field] = row[parseInt(colIndex)] || ''
      })
      return record
    })

    setImportPreview(preview)
    setImportStep('preview')
  }

  const handleBulkImport = async (mergeIds?: string[]) => {
    setIsImporting(true)
    setImportErrors([])

    try {
      const response = await fetch('/api/subcontractors/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subcontractors: importPreview,
          mergeIds: mergeIds || selectedMergeIds
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Import failed')
      }

      // If there are duplicates and we haven't shown them yet, show duplicates step
      if (data.duplicates && data.duplicates.length > 0 && importStep !== 'duplicates') {
        setDuplicates(data.duplicates)
        setImportStep('duplicates')

        // Show partial success message
        if (data.created > 0) {
          toast({
            title: "Partial Import",
            description: `Imported ${data.created} new subcontractors. ${data.duplicates.length} duplicate(s) found.`
          })
        } else {
          toast({
            title: "Duplicates Found",
            description: `${data.duplicates.length} subcontractor(s) already exist. Choose to merge or skip.`
          })
        }

        if (data.errors && data.errors.length > 0) {
          setImportErrors(data.errors)
        }
        return
      }

      // Build success message
      let message = ''
      if (data.created > 0) {
        message += `${data.created} created`
      }
      if (data.merged > 0) {
        message += `${message ? ', ' : ''}${data.merged} merged`
      }
      if (data.errors?.length > 0) {
        message += `${message ? ', ' : ''}${data.errors.length} failed`
      }

      toast({
        title: "Import Complete",
        description: `Successfully processed: ${message || 'No changes'}`
      })

      if (data.errors && data.errors.length > 0) {
        setImportErrors(data.errors)
      } else {
        setShowImportModal(false)
        fetchSubcontractors()
      }
    } catch (error) {
      toast({
        title: "Import Failed",
        description: error instanceof Error ? error.message : 'Failed to import subcontractors',
        variant: "destructive"
      })
    } finally {
      setIsImporting(false)
    }
  }

  const handleMergeSelection = (existingId: string, selected: boolean) => {
    setSelectedMergeIds(prev =>
      selected
        ? [...prev, existingId]
        : prev.filter(id => id !== existingId)
    )
  }

  const handleMergeAll = () => {
    setSelectedMergeIds(duplicates.map(d => d.existingId))
  }

  const handleSkipAll = () => {
    setSelectedMergeIds([])
  }

  const handleConfirmMerge = async () => {
    // Re-run import with selected merge IDs
    await handleBulkImport(selectedMergeIds)

    // If successful and no more duplicates, close modal
    if (importStep !== 'duplicates') {
      setShowImportModal(false)
      fetchSubcontractors()
    }
  }

  const handleAddSubcontractor = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Subcontractor name is required",
        variant: "destructive"
      })
      return
    }

    if (!formData.abn.trim()) {
      toast({
        title: "Validation Error",
        description: "ABN is required",
        variant: "destructive"
      })
      return
    }

    // Validate ABN format before submission
    const validation = validateABNFormat(formData.abn)
    if (!validation.valid) {
      setAbnError(validation.error || 'Invalid ABN')
      toast({
        title: "Validation Error",
        description: validation.error || "Invalid ABN format",
        variant: "destructive"
      })
      return
    }

    // Validate email format if provided
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (formData.contactEmail && !emailRegex.test(formData.contactEmail)) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid contact email address",
        variant: "destructive"
      })
      return
    }

    if (formData.brokerEmail && !emailRegex.test(formData.brokerEmail)) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid broker email address",
        variant: "destructive"
      })
      return
    }

    setIsAdding(true)
    try {
      const response = await fetch('/api/subcontractors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create subcontractor')
      }

      toast({
        title: "Success",
        description: "Subcontractor created successfully"
      })

      setShowAddModal(false)
      fetchSubcontractors()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to create subcontractor',
        variant: "destructive"
      })
    } finally {
      setIsAdding(false)
    }
  }

  // Trim search query - whitespace-only should be treated as empty search
  const trimmedSearchQuery = searchQuery.trim()

  const filteredSubcontractors = subcontractors.filter(sub => {
    // If search query is empty (or whitespace-only), show all results
    if (!trimmedSearchQuery) return true

    return sub.name.toLowerCase().includes(trimmedSearchQuery.toLowerCase()) ||
      sub.abn.includes(trimmedSearchQuery) ||
      sub.trade?.toLowerCase().includes(trimmedSearchQuery.toLowerCase()) ||
      sub.contact_name?.toLowerCase().includes(trimmedSearchQuery.toLowerCase())
  })

  if (isLoading) {
    return (
      <>
        {/* Header Skeleton */}
        <header className="bg-white border-b px-6 py-4 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-8 w-48 mb-2" />
              <Skeleton className="h-4 w-56" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-10 w-28" />
              <Skeleton className="h-10 w-28" />
              <Skeleton className="h-10 w-36" />
            </div>
          </div>
        </header>
        <div className="p-6 md:p-8 lg:p-12 space-y-6">
          {/* Search Skeleton */}
          <Skeleton className="h-10 w-80 max-w-md" />

          {/* Stats Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <Skeleton className="h-4 w-32 mb-2" />
                      <Skeleton className="h-8 w-12" />
                    </div>
                    <Skeleton className="h-10 w-10 rounded-lg" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Subcontractor List Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Card key={i}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <Skeleton className="h-5 w-3/4 mb-2" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                    <Skeleton className="h-6 w-16 rounded-full" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-4 w-4" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-4 w-4" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-4 w-4" />
                      <Skeleton className="h-4 w-36" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      {/* Top Bar */}
      <header className="bg-white border-b px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Subcontractors</h1>
            <p className="text-slate-500">Manage your subcontractor database</p>
          </div>
          {canAddSubcontractors && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleExportCSV}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Button variant="outline" onClick={handleOpenImportModal}>
                <Upload className="h-4 w-4 mr-2" />
                Import CSV
              </Button>
              <Button onClick={handleOpenAddModal}>
                <Plus className="h-4 w-4 mr-2" />
                Add Subcontractor
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* Content */}
      <div className="p-6 md:p-8 lg:p-12 space-y-6">
        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by name, ABN, trade, or contact..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Total Subcontractors</p>
                  <p className="text-3xl font-bold mt-1">{subcontractors.length}</p>
                </div>
                <div className="p-2 bg-slate-100 rounded-lg">
                  <Building2 className="h-5 w-5 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">With Projects</p>
                  <p className="text-3xl font-bold mt-1">
                    {subcontractors.filter(s => s.project_count > 0).length}
                  </p>
                </div>
                <div className="p-2 bg-slate-100 rounded-lg">
                  <Briefcase className="h-5 w-5 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Available</p>
                  <p className="text-3xl font-bold mt-1">
                    {subcontractors.filter(s => s.project_count === 0).length}
                  </p>
                </div>
                <div className="p-2 bg-slate-100 rounded-lg">
                  <Users className="h-5 w-5 text-amber-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Subcontractor List */}
        {filteredSubcontractors.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Building2 className="h-12 w-12 mx-auto mb-4 text-slate-300" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">
                {searchQuery ? 'No subcontractors found' : 'No subcontractors yet'}
              </h3>
              <p className="text-slate-500 mb-4">
                {searchQuery
                  ? 'Try adjusting your search terms'
                  : 'Add your first subcontractor to get started'
                }
              </p>
              {!searchQuery && canAddSubcontractors && (
                <Button onClick={handleOpenAddModal}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Subcontractor
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSubcontractors.map(sub => (
              <Link key={sub.id} href={`/dashboard/subcontractors/${sub.id}`}>
                <Card className="h-full hover:shadow-md hover:border-primary transition-all cursor-pointer">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg truncate" title={sub.name}>{sub.name}</CardTitle>
                        {sub.trading_name && sub.trading_name !== sub.name && (
                          <CardDescription className="truncate" title={`Trading as: ${sub.trading_name}`}>Trading as: {sub.trading_name}</CardDescription>
                        )}
                      </div>
                      {sub.trade && (
                        <span className="px-2 py-1 text-xs font-medium bg-slate-100 text-slate-700 rounded-full">
                          {sub.trade}
                        </span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-sm">
                      <span className="text-slate-500">ABN:</span>
                      <span className="ml-2 font-mono">{sub.abn}</span>
                    </div>

                    {sub.contact_name && (
                      <div className="text-sm flex items-center gap-2">
                        <Users className="h-4 w-4 text-slate-400" />
                        <span>{sub.contact_name}</span>
                      </div>
                    )}

                    {sub.contact_email && (
                      <div className="text-sm flex items-center gap-2">
                        <Mail className="h-4 w-4 text-slate-400" />
                        <span className="truncate" title={sub.contact_email}>{sub.contact_email}</span>
                      </div>
                    )}

                    {sub.contact_phone && (
                      <div className="text-sm flex items-center gap-2">
                        <Phone className="h-4 w-4 text-slate-400" />
                        <span>{sub.contact_phone}</span>
                      </div>
                    )}

                    {sub.address && (
                      <div className="text-sm flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-slate-400" />
                        <span className="truncate" title={sub.address}>{sub.address}</span>
                      </div>
                    )}

                    <div className="pt-3 border-t flex items-center justify-between text-sm">
                      <span className="text-slate-500">Projects</span>
                      <span className="font-medium">{sub.project_count}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Add Subcontractor Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent onClose={() => setShowAddModal(false)} className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Add Subcontractor
            </DialogTitle>
            <DialogDescription>
              Enter the subcontractor&apos;s details
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {/* Company Details */}
            <div className="space-y-4">
              <h4 className="font-medium text-slate-900">Company Details</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Company Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="e.g., ABC Electrical Pty Ltd"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="abn">ABN *</Label>
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <Input
                        id="abn"
                        value={formData.abn}
                        onChange={(e) => handleABNChange(e.target.value)}
                        onBlur={handleABNBlur}
                        placeholder="e.g., 12 345 678 901"
                        maxLength={14}
                        className={abnError ? 'border-red-500 focus:ring-red-500' : abnLookupResult?.valid ? 'border-green-500 focus:ring-green-500' : ''}
                      />
                      {abnLookupResult?.valid && !abnError && (
                        <CheckCircle2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-green-500" />
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={lookupABN}
                      disabled={abnLookupLoading || !formData.abn.trim()}
                      className="whitespace-nowrap"
                    >
                      {abnLookupLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Verify'
                      )}
                    </Button>
                  </div>
                  {abnError && (
                    <p className="text-sm text-red-500 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {abnError}
                    </p>
                  )}
                  {abnLookupResult?.valid && abnLookupResult.entityName && (
                    <p className="text-sm text-green-600 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Registered: {abnLookupResult.entityName}
                    </p>
                  )}
                  {abnLookupResult?.valid && !abnLookupResult.entityName && (
                    <p className="text-sm text-amber-600">
                      ABN format valid. Entity details not available.
                    </p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tradingName">Trading Name</Label>
                  <Input
                    id="tradingName"
                    value={formData.tradingName}
                    onChange={(e) => handleInputChange('tradingName', e.target.value)}
                    placeholder="e.g., ABC Electrical"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="trade">Trade</Label>
                  <Input
                    id="trade"
                    value={formData.trade}
                    onChange={(e) => handleInputChange('trade', e.target.value)}
                    placeholder="e.g., Electrical"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  placeholder="e.g., 123 Main St, Sydney NSW 2000"
                />
              </div>
            </div>

            {/* Contact Details */}
            <div className="space-y-4">
              <h4 className="font-medium text-slate-900">Contact Details</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contactName">Contact Name</Label>
                  <Input
                    id="contactName"
                    value={formData.contactName}
                    onChange={(e) => handleInputChange('contactName', e.target.value)}
                    placeholder="e.g., John Smith"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactEmail">Contact Email</Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    value={formData.contactEmail}
                    onChange={(e) => handleInputChange('contactEmail', e.target.value)}
                    placeholder="e.g., john@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactPhone">Contact Phone</Label>
                  <Input
                    id="contactPhone"
                    value={formData.contactPhone}
                    onChange={(e) => handleInputChange('contactPhone', e.target.value)}
                    placeholder="e.g., 0400 123 456"
                  />
                </div>
              </div>
            </div>

            {/* Broker Details */}
            <div className="space-y-4">
              <h4 className="font-medium text-slate-900">Insurance Broker Details</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="brokerName">Broker Name</Label>
                  <Input
                    id="brokerName"
                    value={formData.brokerName}
                    onChange={(e) => handleInputChange('brokerName', e.target.value)}
                    placeholder="e.g., Jane Doe"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="brokerEmail">Broker Email</Label>
                  <Input
                    id="brokerEmail"
                    type="email"
                    value={formData.brokerEmail}
                    onChange={(e) => handleInputChange('brokerEmail', e.target.value)}
                    placeholder="e.g., jane@broker.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="brokerPhone">Broker Phone</Label>
                  <Input
                    id="brokerPhone"
                    value={formData.brokerPhone}
                    onChange={(e) => handleInputChange('brokerPhone', e.target.value)}
                    placeholder="e.g., 02 1234 5678"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleAddSubcontractor}
              disabled={isAdding}
            >
              {isAdding ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                'Add Subcontractor'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV Import Modal */}
      <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
        <DialogContent onClose={() => setShowImportModal(false)} className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              Import Subcontractors from CSV
            </DialogTitle>
            <DialogDescription>
              {importStep === 'upload' && 'Upload a CSV file with your subcontractor data'}
              {importStep === 'mapping' && 'Map CSV columns to subcontractor fields'}
              {importStep === 'preview' && `Preview ${importPreview.length} records to import`}
              {importStep === 'duplicates' && `${duplicates.length} duplicate(s) found - choose to merge or skip`}
              {importStep === 'importing' && 'Importing subcontractors...'}
            </DialogDescription>
          </DialogHeader>

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 py-4">
            <div className={`flex items-center gap-1 ${importStep === 'upload' ? 'text-primary font-medium' : 'text-slate-400'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${importStep === 'upload' ? 'bg-primary text-white' : 'bg-slate-200'}`}>1</div>
              Upload
            </div>
            <ArrowRight className="h-4 w-4 text-slate-300" />
            <div className={`flex items-center gap-1 ${importStep === 'mapping' ? 'text-primary font-medium' : 'text-slate-400'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${importStep === 'mapping' ? 'bg-primary text-white' : 'bg-slate-200'}`}>2</div>
              Map
            </div>
            <ArrowRight className="h-4 w-4 text-slate-300" />
            <div className={`flex items-center gap-1 ${importStep === 'preview' || importStep === 'importing' ? 'text-primary font-medium' : 'text-slate-400'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${importStep === 'preview' || importStep === 'importing' ? 'bg-primary text-white' : 'bg-slate-200'}`}>3</div>
              Import
            </div>
            {importStep === 'duplicates' && (
              <>
                <ArrowRight className="h-4 w-4 text-slate-300" />
                <div className="flex items-center gap-1 text-primary font-medium">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs bg-amber-500 text-white">!</div>
                  Duplicates
                </div>
              </>
            )}
          </div>

          {/* Upload Step */}
          {importStep === 'upload' && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-slate-200 rounded-lg p-8 text-center">
                <Upload className="h-10 w-10 mx-auto text-slate-400 mb-4" />
                <p className="text-slate-600 mb-2">Drag and drop a CSV file, or click to browse</p>
                <p className="text-sm text-slate-400 mb-4">Supports .csv files</p>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="csv-upload"
                />
                <Button asChild variant="outline">
                  <label htmlFor="csv-upload" className="cursor-pointer">
                    Select CSV File
                  </label>
                </Button>
              </div>
              <div className="bg-slate-50 rounded-lg p-4">
                <h4 className="font-medium text-sm mb-2">Expected CSV Format</h4>
                <p className="text-xs text-slate-500 mb-2">
                  Your CSV should have a header row with column names. Required columns: Name, ABN
                </p>
                <code className="text-xs bg-slate-200 px-2 py-1 rounded block">
                  Company Name,ABN,Trading Name,Trade,Address,Contact Name,Contact Email,Contact Phone
                </code>
              </div>
            </div>
          )}

          {/* Mapping Step */}
          {importStep === 'mapping' && (
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-sm text-slate-600">
                  Found <span className="font-medium">{csvData.length}</span> records in your CSV.
                  Map each column to the appropriate field.
                </p>
              </div>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {csvHeaders.map((header, index) => (
                  <div key={index} className="flex items-center gap-4">
                    <div className="w-1/3 text-sm font-medium text-slate-700 truncate" title={header}>
                      {header}
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-400 flex-shrink-0" />
                    <select
                      className="flex-1 border rounded-md px-3 py-2 text-sm"
                      value={columnMapping[index.toString()] || ''}
                      onChange={(e) => handleMappingChange(index.toString(), e.target.value)}
                    >
                      {fieldMappingOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <AlertCircle className="h-4 w-4" />
                Company Name and ABN are required fields
              </div>
            </div>
          )}

          {/* Preview Step */}
          {importStep === 'preview' && (
            <div className="space-y-4">
              {importErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h4 className="font-medium text-red-800 mb-2">Import Errors</h4>
                  <ul className="text-sm text-red-600 list-disc pl-4">
                    {importErrors.map((error, i) => (
                      <li key={i}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto max-h-64">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-slate-600">#</th>
                        <th className="px-3 py-2 text-left font-medium text-slate-600">Company Name</th>
                        <th className="px-3 py-2 text-left font-medium text-slate-600">ABN</th>
                        <th className="px-3 py-2 text-left font-medium text-slate-600">Trade</th>
                        <th className="px-3 py-2 text-left font-medium text-slate-600">Contact</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.map((record, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-3 py-2 text-slate-500">{i + 1}</td>
                          <td className="px-3 py-2 font-medium">{record.name || '-'}</td>
                          <td className="px-3 py-2 font-mono text-xs">{record.abn || '-'}</td>
                          <td className="px-3 py-2">{record.trade || '-'}</td>
                          <td className="px-3 py-2">{record.contactName || record.contactEmail || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <p className="text-sm text-slate-500">
                Ready to import {importPreview.length} subcontractors
              </p>
            </div>
          )}

          {/* Duplicates Step */}
          {importStep === 'duplicates' && (
            <div className="space-y-4">
              {importErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h4 className="font-medium text-red-800 mb-2">Import Errors</h4>
                  <ul className="text-sm text-red-600 list-disc pl-4 max-h-24 overflow-y-auto">
                    {importErrors.map((error, i) => (
                      <li key={i}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-amber-800">Duplicate ABNs Detected</h4>
                    <p className="text-sm text-amber-700 mt-1">
                      The following subcontractors already exist in your database.
                      Select which ones to merge (update with new data) or skip.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 text-sm">
                <Button variant="outline" size="sm" onClick={handleMergeAll}>
                  <GitMerge className="h-3 w-3 mr-1" />
                  Select All to Merge
                </Button>
                <Button variant="outline" size="sm" onClick={handleSkipAll}>
                  <SkipForward className="h-3 w-3 mr-1" />
                  Skip All
                </Button>
              </div>

              <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                {duplicates.map((dup) => (
                  <div key={dup.existingId} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`merge-${dup.existingId}`}
                            checked={selectedMergeIds.includes(dup.existingId)}
                            onChange={(e) => handleMergeSelection(dup.existingId, e.target.checked)}
                            className="w-4 h-4 rounded border-gray-300"
                          />
                          <label htmlFor={`merge-${dup.existingId}`} className="font-medium text-sm cursor-pointer">
                            Row {dup.rowNum}: {dup.importData.name}
                          </label>
                        </div>
                        <div className="mt-2 ml-6 text-xs text-slate-500 space-y-1">
                          <p>
                            <span className="font-medium">ABN:</span> {dup.cleanedABN}
                          </p>
                          <p>
                            <span className="font-medium">Existing Name:</span> {dup.existingName}
                          </p>
                          {dup.importData.trade && (
                            <p>
                              <span className="font-medium">New Trade:</span> {dup.importData.trade}
                            </p>
                          )}
                          {dup.importData.contactEmail && (
                            <p>
                              <span className="font-medium">New Contact:</span> {dup.importData.contactEmail}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded ${
                        selectedMergeIds.includes(dup.existingId)
                          ? 'bg-green-100 text-green-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}>
                        {selectedMergeIds.includes(dup.existingId) ? 'Will Merge' : 'Will Skip'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-sm text-slate-500">
                {selectedMergeIds.length} of {duplicates.length} selected to merge
              </p>
            </div>
          )}

          <DialogFooter className="mt-6">
            {importStep === 'upload' && (
              <Button variant="outline" onClick={() => setShowImportModal(false)}>
                Cancel
              </Button>
            )}
            {importStep === 'mapping' && (
              <>
                <Button variant="outline" onClick={() => setImportStep('upload')}>
                  Back
                </Button>
                <Button onClick={generatePreview}>
                  Preview Import
                </Button>
              </>
            )}
            {importStep === 'preview' && (
              <>
                <Button variant="outline" onClick={() => setImportStep('mapping')}>
                  Back
                </Button>
                <Button onClick={() => handleBulkImport()} disabled={isImporting}>
                  {isImporting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    `Import ${importPreview.length} Subcontractors`
                  )}
                </Button>
              </>
            )}
            {importStep === 'duplicates' && (
              <>
                <Button variant="outline" onClick={() => {
                  setShowImportModal(false)
                  fetchSubcontractors()
                }}>
                  Done (Skip Remaining)
                </Button>
                <Button onClick={handleConfirmMerge} disabled={isImporting}>
                  {isImporting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : selectedMergeIds.length > 0 ? (
                    <>
                      <GitMerge className="h-4 w-4 mr-2" />
                      Merge {selectedMergeIds.length} Selected
                    </>
                  ) : (
                    'Finish (Skip All)'
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
