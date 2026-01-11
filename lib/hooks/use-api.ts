"use client"

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// Types
interface User {
  id: string
  email: string
  name: string
  role: string
  company: {
    id: string
    name: string
    abn: string
  } | null
}

interface Project {
  id: string
  name: string
  address: string | null
  state: string | null
  status: string
  start_date: string | null
  end_date: string | null
  estimated_value: number | null
  forwarding_email: string | null
  project_manager_name: string | null
  subcontractor_count: number
  compliant_count: number
  created_at: string
  updated_at?: string
}

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
  updated_at?: string
}

interface Document {
  id: string
  file_url: string
  file_name: string | null
  file_type?: string
  file_size: number | null
  source: string
  processing_status: string
  created_at: string
  subcontractor_name: string
  subcontractor_abn: string
  project_name: string
  subcontractor_id: string
  project_id: string
  company_id: string
  verification_status: string | null
  confidence_score: number | null
}

interface MorningBriefData {
  stopWorkRisks: any[]
  stats: {
    complianceRate: number | null
    activeProjects: number
    pendingReviews: number
    stopWorkCount: number
    pendingResponsesCount: number
    total: number
    compliant: number
    non_compliant: number
    pending: number
    exception: number
  }
  newCocs: any[]
  cocStats: {
    total: number
    autoApproved: number
    needsReview: number
  }
  pendingResponses: any[]
}

interface ComplianceHistoryData {
  history: any[]
  days: number
  generated: boolean
}

// API fetch helpers
async function fetchApi<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`)
  }
  return res.json()
}

async function postApi<T>(url: string, data: any): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error.error || `API error: ${res.status}`)
  }
  return res.json()
}

// Pending Review interface
interface PendingReview {
  id: string
  verificationId: string
  subcontractorId: string
  subcontractorName: string
  projectId: string
  projectName: string
  confidenceScore: number | null
  documentId: string
  fileName: string | null
  submittedAt: number
  daysWaiting: number
  lowConfidenceFields: string[]
}

// Query Keys
export const queryKeys = {
  user: ['user'] as const,
  morningBrief: ['morning-brief'] as const,
  complianceHistory: (days: number) => ['compliance-history', days] as const,
  projects: ['projects'] as const,
  project: (id: string) => ['project', id] as const,
  subcontractors: ['subcontractors'] as const,
  subcontractor: (id: string) => ['subcontractor', id] as const,
  documents: ['documents'] as const,
  document: (id: string) => ['document', id] as const,
  notifications: ['notifications'] as const,
  pendingReviews: ['pending-reviews'] as const,
  reviewDetail: (id: string) => ['review-detail', id] as const,
}

// User hooks
export function useUser() {
  return useQuery({
    queryKey: queryKeys.user,
    queryFn: () => fetchApi<{ user: User }>('/api/auth/me').then(r => r.user),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    retry: 1,
  })
}

// Morning Brief hooks
export function useMorningBrief() {
  return useQuery({
    queryKey: queryKeys.morningBrief,
    queryFn: () => fetchApi<MorningBriefData>('/api/morning-brief'),
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 60 * 1000, // Auto-refresh every 60 seconds
    refetchIntervalInBackground: false, // Only poll when tab is focused
  })
}

// Compliance History hooks
export function useComplianceHistory(days: number) {
  return useQuery({
    queryKey: queryKeys.complianceHistory(days),
    queryFn: () => fetchApi<ComplianceHistoryData>(`/api/compliance-history?days=${days}`),
    staleTime: 60 * 1000, // 1 minute
    gcTime: 10 * 60 * 1000, // 10 minutes
  })
}

// Combined Dashboard Data hook (OPTIMIZED - single HTTP request instead of 3)
interface DashboardData {
  user: User
  morningBrief: MorningBriefData
  complianceHistory: ComplianceHistoryData
}

export function useDashboardData(historyDays: number = 30) {
  return useQuery({
    queryKey: ['dashboard-data', historyDays],
    queryFn: () => fetchApi<DashboardData>(`/api/dashboard-data?historyDays=${historyDays}`),
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 60 * 1000, // Auto-refresh every 60 seconds
    refetchIntervalInBackground: false, // Only poll when tab is focused
  })
}

// Projects hooks
export function useProjects() {
  return useQuery({
    queryKey: queryKeys.projects,
    queryFn: () => fetchApi<{ projects: Project[] }>('/api/projects').then(r => r.projects),
    staleTime: 60 * 1000, // 1 minute
    gcTime: 10 * 60 * 1000, // 10 minutes
  })
}

export function useProject(id: string) {
  return useQuery({
    queryKey: queryKeys.project(id),
    queryFn: () => fetchApi<{ project: Project }>(`/api/projects/${id}`).then(r => r.project),
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled: !!id,
  })
}

// Subcontractors hooks
export function useSubcontractors() {
  return useQuery({
    queryKey: queryKeys.subcontractors,
    queryFn: () => fetchApi<{ subcontractors: Subcontractor[] }>('/api/subcontractors').then(r => r.subcontractors),
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })
}

export function useSubcontractor(id: string) {
  return useQuery({
    queryKey: queryKeys.subcontractor(id),
    queryFn: () => fetchApi<{ subcontractor: Subcontractor }>(`/api/subcontractors/${id}`).then(r => r.subcontractor),
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled: !!id,
  })
}

// Documents hooks
export function useDocuments(filters?: { projectId?: string; subcontractorId?: string }) {
  const params = new URLSearchParams()
  if (filters?.projectId) params.set('project_id', filters.projectId)
  if (filters?.subcontractorId) params.set('subcontractor_id', filters.subcontractorId)
  const queryString = params.toString()
  const url = `/api/documents${queryString ? `?${queryString}` : ''}`

  return useQuery({
    queryKey: [...queryKeys.documents, filters],
    queryFn: () => fetchApi<{ documents: Document[] }>(url).then(r => r.documents),
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })
}

export function useDocument(id: string) {
  return useQuery({
    queryKey: queryKeys.document(id),
    queryFn: () => fetchApi<{ document: Document }>(`/api/documents/${id}`).then(r => r.document),
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled: !!id,
  })
}

// Notifications hooks
export function useNotifications(limit = 10) {
  return useQuery({
    queryKey: [...queryKeys.notifications, limit],
    queryFn: () => fetchApi<{ notifications: any[] }>(`/api/notifications?limit=${limit}`).then(r => r.notifications),
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000,
    refetchInterval: 60 * 1000, // Refresh every minute
    refetchIntervalInBackground: false, // Only poll when tab is focused
  })
}

// Pending Reviews hooks
export function usePendingReviews() {
  return useQuery({
    queryKey: queryKeys.pendingReviews,
    queryFn: () => fetchApi<{ reviews: PendingReview[] }>('/api/reviews').then(r => r.reviews),
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000,
  })
}

export function useReviewDetail(id: string) {
  return useQuery({
    queryKey: queryKeys.reviewDetail(id),
    queryFn: () => fetchApi<any>(`/api/reviews/${id}`),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled: !!id,
  })
}

export function useApproveVerification() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => postApi<{ success: boolean }>(`/api/reviews/${id}/approve`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pendingReviews })
      queryClient.invalidateQueries({ queryKey: queryKeys.morningBrief })
      queryClient.invalidateQueries({ queryKey: ['dashboard-data'] })
    },
  })
}

export function useRejectVerification() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: { id: string; reason?: string; deficiencies?: any[] }) =>
      postApi<{ success: boolean; shouldSendEmail: boolean }>(`/api/reviews/${data.id}/reject`, {
        reason: data.reason,
        deficiencies: data.deficiencies,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pendingReviews })
      queryClient.invalidateQueries({ queryKey: queryKeys.morningBrief })
      queryClient.invalidateQueries({ queryKey: ['dashboard-data'] })
    },
  })
}

export function useRequestClearerCopy() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: { id: string; message?: string }) =>
      postApi<{ success: boolean }>(`/api/reviews/${data.id}/request-copy`, { message: data.message }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pendingReviews })
    },
  })
}

// Mutation hooks
export function useLogout() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => postApi<{ success: boolean }>('/api/auth/logout', {}),
    onSuccess: () => {
      // Clear all cached data on logout
      queryClient.clear()
    },
  })
}

export function useCreateProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: Partial<Project>) => postApi<{ project: Project }>('/api/projects', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects })
      queryClient.invalidateQueries({ queryKey: queryKeys.morningBrief })
    },
  })
}

export function useCreateSubcontractor() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: Partial<Subcontractor>) => postApi<{ subcontractor: Subcontractor }>('/api/subcontractors', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.subcontractors })
      queryClient.invalidateQueries({ queryKey: queryKeys.morningBrief })
    },
  })
}

// Prefetch helpers
export function usePrefetchProject(id: string) {
  const queryClient = useQueryClient()

  return () => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.project(id),
      queryFn: () => fetchApi<{ project: Project }>(`/api/projects/${id}`).then(r => r.project),
      staleTime: 60 * 1000,
    })
  }
}

export function usePrefetchSubcontractor(id: string) {
  const queryClient = useQueryClient()

  return () => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.subcontractor(id),
      queryFn: () => fetchApi<{ subcontractor: Subcontractor }>(`/api/subcontractors/${id}`).then(r => r.subcontractor),
      staleTime: 60 * 1000,
    })
  }
}
