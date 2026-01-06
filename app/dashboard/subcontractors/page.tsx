"use client"

import { useState, useEffect } from "react"
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
  AlertCircle
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

  const filteredSubcontractors = subcontractors.filter(sub =>
    sub.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    sub.abn.includes(searchQuery) ||
    sub.trade?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    sub.contact_name?.toLowerCase().includes(searchQuery.toLowerCase())
  )

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
            <Button onClick={handleOpenAddModal}>
              <Plus className="h-4 w-4 mr-2" />
              Add Subcontractor
            </Button>
          )}
        </div>
      </header>

      {/* Content */}
      <div className="p-6 space-y-6">
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
              <Card key={sub.id} className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{sub.name}</CardTitle>
                      {sub.trading_name && sub.trading_name !== sub.name && (
                        <CardDescription>Trading as: {sub.trading_name}</CardDescription>
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
                      <span className="truncate">{sub.contact_email}</span>
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
                      <span className="truncate">{sub.address}</span>
                    </div>
                  )}

                  <div className="pt-3 border-t flex items-center justify-between text-sm">
                    <span className="text-slate-500">Projects</span>
                    <span className="font-medium">{sub.project_count}</span>
                  </div>
                </CardContent>
              </Card>
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
    </>
  )
}
