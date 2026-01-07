"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Building2,
  ArrowLeft,
  Loader2,
  Upload,
  Save,
  CheckCircle,
  Mail,
  Copy,
  Check
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"

interface Company {
  id: string
  name: string
  abn: string
  acn: string | null
  address: string | null
  logo_url: string | null
  forwarding_email: string | null
  primary_contact_name: string | null
  primary_contact_email: string | null
  primary_contact_phone: string | null
}

interface User {
  id: string
  email: string
  name: string
  role: string
}

export default function CompanySettingsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [user, setUser] = useState<User | null>(null)
  const [company, setCompany] = useState<Company | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // Form state
  const [name, setName] = useState("")
  const [abn, setAbn] = useState("")
  const [acn, setAcn] = useState("")
  const [address, setAddress] = useState("")
  const [logoUrl, setLogoUrl] = useState("")
  const [contactName, setContactName] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [contactPhone, setContactPhone] = useState("")
  const [copied, setCopied] = useState(false)

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast({
        title: "Copied!",
        description: "Forwarding email copied to clipboard"
      })
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive"
      })
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      // Fetch user
      const userResponse = await fetch("/api/auth/me")
      if (!userResponse.ok) {
        router.push("/login")
        return
      }
      const userData = await userResponse.json()
      setUser(userData.user)

      // Fetch company
      const companyResponse = await fetch("/api/company")
      if (companyResponse.ok) {
        const companyData = await companyResponse.json()
        setCompany(companyData.company)
        // Initialize form fields
        setName(companyData.company.name || "")
        setAbn(formatABN(companyData.company.abn) || "")
        setAcn(formatACN(companyData.company.acn) || "")
        setAddress(companyData.company.address || "")
        setLogoUrl(companyData.company.logo_url || "")
        setContactName(companyData.company.primary_contact_name || "")
        setContactEmail(companyData.company.primary_contact_email || "")
        setContactPhone(companyData.company.primary_contact_phone || "")
      }
    } catch (error) {
      console.error("Failed to fetch data:", error)
      toast({
        title: "Error",
        description: "Failed to load company data",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Format ABN with spaces (XX XXX XXX XXX)
  const formatABN = (abn: string | null): string => {
    if (!abn) return ""
    const digits = abn.replace(/\D/g, "")
    if (digits.length <= 2) return digits
    if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`
    if (digits.length <= 8) return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`
    return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 11)}`
  }

  // Format ACN with spaces (XXX XXX XXX)
  const formatACN = (acn: string | null): string => {
    if (!acn) return ""
    const digits = acn.replace(/\D/g, "")
    if (digits.length <= 3) return digits
    if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)}`
  }

  const handleABNChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatABN(e.target.value)
    setAbn(formatted)
    setHasChanges(true)
  }

  const handleACNChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatACN(e.target.value)
    setAcn(formatted)
    setHasChanges(true)
  }

  const handleInputChange = (setter: (value: string) => void) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setter(e.target.value)
    setHasChanges(true)
  }

  const handleSave = async () => {
    // Validation
    if (!name.trim()) {
      toast({
        title: "Validation Error",
        description: "Company name is required",
        variant: "destructive"
      })
      return
    }

    const abnDigits = abn.replace(/\D/g, "")
    if (abnDigits.length !== 11) {
      toast({
        title: "Validation Error",
        description: "ABN must be 11 digits",
        variant: "destructive"
      })
      return
    }

    const acnDigits = acn.replace(/\D/g, "")
    if (acn && acnDigits.length !== 9) {
      toast({
        title: "Validation Error",
        description: "ACN must be 9 digits",
        variant: "destructive"
      })
      return
    }

    if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      toast({
        title: "Validation Error",
        description: "Invalid contact email format",
        variant: "destructive"
      })
      return
    }

    setIsSaving(true)

    try {
      const response = await fetch("/api/company", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: name.trim(),
          abn: abnDigits,
          acn: acnDigits || null,
          address: address.trim() || null,
          logo_url: logoUrl.trim() || null,
          primary_contact_name: contactName.trim() || null,
          primary_contact_email: contactEmail.trim() || null,
          primary_contact_phone: contactPhone.trim() || null
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to save")
      }

      setCompany(data.company)
      setHasChanges(false)
      toast({
        title: "Success",
        description: "Company profile updated successfully"
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save changes"
      toast({
        title: "Error",
        description: message,
        variant: "destructive"
      })
    } finally {
      setIsSaving(false)
    }
  }

  const isAdmin = user?.role === 'admin'

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
          <div className="flex items-center gap-4">
            <Link href="/dashboard/settings" className="text-slate-400 hover:text-slate-600">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Company Profile</h1>
              <p className="text-slate-500">Manage your company information</p>
            </div>
          </div>
          {isAdmin && (
            <Button onClick={handleSave} disabled={isSaving || !hasChanges}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          )}
        </div>
      </header>

      {/* Content */}
      <div className="p-6 md:p-8 lg:p-12 max-w-4xl">
        {!isAdmin && (
          <Card className="mb-6 border-amber-200 bg-amber-50">
            <CardContent className="py-4">
              <p className="text-sm text-amber-800">
                Only administrators can edit company settings. Contact your admin to make changes.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Company Information */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Company Information
            </CardTitle>
            <CardDescription>
              Basic information about your company
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Company Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={handleInputChange(setName)}
                  placeholder="Enter company name"
                  disabled={!isAdmin}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="abn">ABN (Australian Business Number) *</Label>
                <Input
                  id="abn"
                  value={abn}
                  onChange={handleABNChange}
                  placeholder="XX XXX XXX XXX"
                  maxLength={14}
                  disabled={!isAdmin}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="acn">ACN (Australian Company Number)</Label>
                <Input
                  id="acn"
                  value={acn}
                  onChange={handleACNChange}
                  placeholder="XXX XXX XXX"
                  maxLength={11}
                  disabled={!isAdmin}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Business Address</Label>
                <Input
                  id="address"
                  value={address}
                  onChange={handleInputChange(setAddress)}
                  placeholder="Enter business address"
                  disabled={!isAdmin}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Email Integration */}
        {company?.forwarding_email && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email Integration
              </CardTitle>
              <CardDescription>
                Forward certificates to this email for automatic processing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label>Forwarding Email</Label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-slate-50 border rounded-md px-3 py-2 font-mono text-sm">
                    {company.forwarding_email}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(company.forwarding_email!)}
                    className="shrink-0"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-slate-500">
                  Forward COC emails to this address. Attachments will be automatically processed and matched to subcontractors.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Logo */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Company Logo</CardTitle>
            <CardDescription>
              Upload your company logo for branding
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-6">
              <div className="w-24 h-24 bg-slate-100 rounded-lg flex items-center justify-center overflow-hidden">
                {logoUrl ? (
                  <img src={logoUrl} alt="Company logo" className="w-full h-full object-contain" />
                ) : (
                  <Building2 className="h-12 w-12 text-slate-300" />
                )}
              </div>
              <div className="flex-1 space-y-2">
                <Label htmlFor="logoUrl">Logo URL</Label>
                <Input
                  id="logoUrl"
                  value={logoUrl}
                  onChange={handleInputChange(setLogoUrl)}
                  placeholder="https://example.com/logo.png"
                  disabled={!isAdmin}
                />
                <p className="text-xs text-slate-500">
                  Enter a URL for your company logo. Supported formats: PNG, JPG, SVG
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Primary Contact */}
        <Card>
          <CardHeader>
            <CardTitle>Primary Contact</CardTitle>
            <CardDescription>
              Main contact person for your company
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contactName">Contact Name</Label>
                <Input
                  id="contactName"
                  value={contactName}
                  onChange={handleInputChange(setContactName)}
                  placeholder="John Smith"
                  disabled={!isAdmin}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactEmail">Contact Email</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  value={contactEmail}
                  onChange={handleInputChange(setContactEmail)}
                  placeholder="contact@company.com"
                  disabled={!isAdmin}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactPhone">Contact Phone</Label>
                <Input
                  id="contactPhone"
                  type="tel"
                  value={contactPhone}
                  onChange={handleInputChange(setContactPhone)}
                  placeholder="02 1234 5678"
                  disabled={!isAdmin}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Save Button at Bottom (for mobile) */}
        {isAdmin && (
          <div className="mt-6 flex justify-end md:hidden">
            <Button onClick={handleSave} disabled={isSaving || !hasChanges} className="w-full">
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </>
  )
}
