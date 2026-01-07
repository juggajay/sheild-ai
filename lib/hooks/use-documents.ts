import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// Query key factory for documents
export const documentKeys = {
  all: ['documents'] as const,
  lists: () => [...documentKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...documentKeys.lists(), filters] as const,
  details: () => [...documentKeys.all, 'detail'] as const,
  detail: (id: string) => [...documentKeys.details(), id] as const,
}

// API functions
async function fetchDocuments(filters?: Record<string, unknown>) {
  const params = new URLSearchParams()
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, String(value))
      }
    })
  }
  const response = await fetch(`/api/documents?${params}`)
  if (!response.ok) throw new Error('Failed to fetch documents')
  return response.json()
}

async function fetchDocument(id: string) {
  const response = await fetch(`/api/documents/${id}`)
  if (!response.ok) throw new Error('Failed to fetch document')
  return response.json()
}

async function uploadDocument(formData: FormData) {
  const response = await fetch('/api/documents', {
    method: 'POST',
    body: formData,
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to upload document')
  }
  return response.json()
}

async function deleteDocument(id: string) {
  const response = await fetch(`/api/documents/${id}`, {
    method: 'DELETE',
  })
  if (!response.ok) throw new Error('Failed to delete document')
  return response.json()
}

// Hooks
export function useDocuments(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: documentKeys.list(filters || {}),
    queryFn: () => fetchDocuments(filters),
  })
}

export function useDocument(id: string) {
  return useQuery({
    queryKey: documentKeys.detail(id),
    queryFn: () => fetchDocument(id),
    enabled: !!id,
  })
}

export function useUploadDocument() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: uploadDocument,
    onSuccess: () => {
      // Invalidate all document lists to refetch
      queryClient.invalidateQueries({ queryKey: documentKeys.lists() })
    },
  })
}

export function useDeleteDocument() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteDocument,
    onSuccess: (_, id) => {
      // Remove the document from cache
      queryClient.removeQueries({ queryKey: documentKeys.detail(id) })
      // Invalidate all document lists to refetch
      queryClient.invalidateQueries({ queryKey: documentKeys.lists() })
    },
  })
}
