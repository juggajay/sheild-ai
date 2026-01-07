import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// Query key factory for projects
export const projectKeys = {
  all: ['projects'] as const,
  lists: () => [...projectKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...projectKeys.lists(), filters] as const,
  details: () => [...projectKeys.all, 'detail'] as const,
  detail: (id: string) => [...projectKeys.details(), id] as const,
}

// API functions
async function fetchProjects(filters?: Record<string, unknown>) {
  const params = new URLSearchParams()
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, String(value))
      }
    })
  }
  const response = await fetch(`/api/projects?${params}`)
  if (!response.ok) throw new Error('Failed to fetch projects')
  return response.json()
}

async function fetchProject(id: string) {
  const response = await fetch(`/api/projects/${id}`)
  if (!response.ok) throw new Error('Failed to fetch project')
  return response.json()
}

async function createProject(data: Record<string, unknown>) {
  const response = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!response.ok) throw new Error('Failed to create project')
  return response.json()
}

async function updateProject({ id, ...data }: { id: string } & Record<string, unknown>) {
  const response = await fetch(`/api/projects/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!response.ok) throw new Error('Failed to update project')
  return response.json()
}

async function deleteProject(id: string) {
  const response = await fetch(`/api/projects/${id}`, {
    method: 'DELETE',
  })
  if (!response.ok) throw new Error('Failed to delete project')
  return response.json()
}

// Hooks
export function useProjects(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: projectKeys.list(filters || {}),
    queryFn: () => fetchProjects(filters),
  })
}

export function useProject(id: string) {
  return useQuery({
    queryKey: projectKeys.detail(id),
    queryFn: () => fetchProject(id),
    enabled: !!id,
  })
}

export function useCreateProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createProject,
    onSuccess: () => {
      // Invalidate all project lists to refetch
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() })
    },
  })
}

export function useUpdateProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateProject,
    onSuccess: (data, variables) => {
      // Update the specific project in cache
      queryClient.setQueryData(projectKeys.detail(variables.id), data)
      // Invalidate all project lists to refetch
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() })
    },
  })
}

export function useDeleteProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteProject,
    onSuccess: (_, id) => {
      // Remove the project from cache
      queryClient.removeQueries({ queryKey: projectKeys.detail(id) })
      // Invalidate all project lists to refetch
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() })
    },
  })
}
