'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  Camera,
  Save,
  CheckCircle,
  AlertTriangle,
  Loader2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

interface Profile {
  id: string
  email: string
  name: string
  phone: string | null
  avatar_url: string | null
  company_id: string
}

export default function ProfileSettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [originalProfile, setOriginalProfile] = useState<Profile | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Form state
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)

  useEffect(() => {
    fetchProfile()
  }, [])

  // Track changes
  useEffect(() => {
    if (originalProfile) {
      const nameChanged = name !== originalProfile.name
      const phoneChanged = (phone || '') !== (originalProfile.phone || '')
      const avatarChanged = avatarPreview !== null && avatarPreview !== originalProfile.avatar_url
      setHasChanges(nameChanged || phoneChanged || avatarChanged)
    }
  }, [name, phone, avatarPreview, originalProfile])

  async function fetchProfile() {
    try {
      const res = await fetch('/api/user/profile')
      if (!res.ok) throw new Error('Failed to fetch profile')
      const data = await res.json()
      setProfile(data.profile)
      setOriginalProfile(data.profile)
      setName(data.profile.name || '')
      setPhone(data.profile.phone || '')
    } catch (error) {
      console.error('Error fetching profile:', error)
      toast.error('Failed to load profile')
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error('Name is required')
      return
    }

    setSaving(true)
    try {
      const updateData: Record<string, string | null> = {
        name: name.trim(),
        phone: phone.trim() || null
      }

      // If avatar was changed, include it
      if (avatarPreview !== null && avatarPreview !== originalProfile?.avatar_url) {
        updateData.avatar_url = avatarPreview
      }

      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to save profile')
      }

      const data = await res.json()
      setProfile(data.profile)
      setOriginalProfile(data.profile)
      setHasChanges(false)
      setAvatarPreview(null)
      toast.success('Profile updated successfully')
    } catch (error) {
      console.error('Error saving profile:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  function handleAvatarClick() {
    fileInputRef.current?.click()
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be less than 2MB')
      return
    }

    // Create preview URL
    const reader = new FileReader()
    reader.onload = (event) => {
      setAvatarPreview(event.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  function getInitials(name: string) {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2)
  }

  if (loading) {
    return (
      <div className="p-6 md:p-8 lg:p-12 flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <>
      {/* Header */}
      <header className="bg-white border-b px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/settings" aria-label="Back to settings">
              <Button variant="ghost" size="icon" aria-label="Back to settings">
                <ArrowLeft className="h-5 w-5" aria-hidden="true" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Profile Settings</h1>
              <p className="text-slate-500">Update your personal information</p>
            </div>
          </div>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || saving}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className="p-6 md:p-8 lg:p-12 max-w-3xl mx-auto space-y-6">
        {/* Avatar Section */}
        <Card>
          <CardHeader>
            <CardTitle>Profile Photo</CardTitle>
            <CardDescription>
              Click on the avatar to upload a new photo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div className="relative group">
                <button
                  onClick={handleAvatarClick}
                  className="relative w-24 h-24 rounded-full overflow-hidden bg-slate-100 hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  {(avatarPreview || profile?.avatar_url) ? (
                    <img
                      src={avatarPreview || profile?.avatar_url || ''}
                      alt={profile?.name || 'Profile'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-blue-100 text-blue-600 text-2xl font-semibold">
                      {profile?.name ? getInitials(profile.name) : <User className="h-10 w-10" />}
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="h-6 w-6 text-white" />
                  </div>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
              </div>
              <div>
                <p className="text-sm text-slate-600">
                  Recommended: Square image, at least 200x200 pixels
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Supports JPG, PNG, GIF up to 2MB
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Personal Information */}
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>
              Update your name and contact details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Email (read-only) */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type="email"
                  value={profile?.email || ''}
                  disabled
                  className="pl-10 bg-slate-50"
                />
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Contact your administrator to change your email address
              </p>
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your full name"
                  className="pl-10"
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Phone Number
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Enter your phone number"
                  className="pl-10"
                />
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Used for SMS alerts if enabled
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Unsaved Changes Warning */}
        {hasChanges && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="py-4">
              <div className="flex items-center gap-3 text-amber-700">
                <AlertTriangle className="h-5 w-5" />
                <p className="text-sm font-medium">You have unsaved changes</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}
