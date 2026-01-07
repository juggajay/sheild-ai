import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// Query key factory for subcontractors
export const subcontractorKeys = {
  all: ['subcontractors'] as const,
  lists: () => [...subcontractorKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...subcontractorKeys.lists(), filters] as const,
  details: () => [...subcontractorKeys.all, 'detail'] as const,
  detail: (id: string) => [...subcontractorKeys.details(), id] as const,
}

// API functions
async function fetchSubcontractors(filters?: Record<string, unknown>) {
  const params = new URLSearchParams()
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, String(value))
      }
    })
  }
  const response = await fetch(`/api/subcontractors?${params}`)
  if (!response.ok) throw new Error('Failed to fetch subcontractors')
  return response.json()
}

async function fetchSubcontractor(id: string) {
  const response = await fetch(`/api/subcontractors/${id}`)
  if (!response.ok) throw new Error('Failed to fetch subcontractor')
  return response.json()
}

async function createSubcontractor(data: Record<string, unknown>) {
  const response = await fetch('/api/subcontractors', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to create subcontractor')
  }
  return response.json()
}

async function updateSubcontractor({ id, ...data }: { id: string } & Record<string, unknown>) {
  const response = await fetch(`/api/subcontractors/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!response.ok) throw new Error('Failed to update subcontractor')
  return response.json()
}

async function deleteSubcontractor(id: string) {
  const response = await fetch(`/api/subcontractors/${id}`, {
    method: 'DELETE',
  })
  if (!response.ok) throw new Error('Failed to delete subcontractor')
  return response.json()
}

// Hooks
export function useSubcontractors(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: subcontractorKeys.list(filters || {}),
    queryFn: () => fetchSubcontractors(filters),
  })
}

export function useSubcontractor(id: string) {
  return useQuery({
    queryKey: subcontractorKeys.detail(id),
    queryFn: () => fetchSubcontractor(id),
    enabled: !!id,
  })
}

export function useCreateSubcontractor() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createSubcontractor,
    onSuccess: () => {
      // Invalidate all subcontractor lists to refetch
      queryClient.invalidateQueries({ queryKey: subcontractorKeys.lists() })
    },
  })
}

export function useUpdateSubcontractor() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateSubcontractor,
    onSuccess: (data, variables) => {
      // Update the specific subcontractor in cache
      queryClient.setQueryData(subcontractorKeys.detail(variables.id), data)
      // Invalidate all subcontractor lists to refetch
      queryClient.invalidateQueries({ queryKey: subcontractorKeys.lists() })
    },
  })
}

export function useDeleteSubcontractor() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteSubcontractor,
    onSuccess: (_, id) => {
      // Remove the subcontractor from cache
      queryClient.removeQueries({ queryKey: subcontractorKeys.detail(id) })
      // Invalidate all subcontractor lists to refetch
      queryClient.invalidateQueries({ queryKey: subcontractorKeys.lists() })
    },
  })
}
