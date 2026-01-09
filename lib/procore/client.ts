/**
 * Procore API Client
 *
 * Handles all interactions with the Procore REST API.
 * Supports both production mode and dev mode (with mock data).
 */

import {
  getProcoreConfig,
  isProcoreDevMode,
  PROCORE_RATE_LIMITS,
  PROCORE_PAGINATION,
} from './config'
import {
  MOCK_PROCORE_COMPANIES,
  getMockProjects,
  getMockVendors,
  getMockProject,
  getMockVendor,
  createMockOAuthTokens,
  mockApiDelay,
} from './mock-data'
import type {
  ProcoreOAuthTokens,
  ProcoreCompany,
  ProcoreProject,
  ProcoreVendor,
  ProcoreVendorInsurance,
  ProcoreVendorInsuranceInput,
  ProcoreApiError,
  ProcorePaginationParams,
} from './types'

// ============================================================================
// Types
// ============================================================================

export interface ProcoreClientOptions {
  companyId: number
  accessToken: string
  refreshToken: string
  onTokenRefresh?: (tokens: ProcoreOAuthTokens) => void | Promise<void>
}

export interface ProcoreRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: Record<string, unknown>
  params?: Record<string, string | number | boolean | undefined>
  headers?: Record<string, string>
}

export interface ProcorePaginatedResponse<T> {
  data: T[]
  hasMore: boolean
  total?: number
  nextPage?: number
}

// ============================================================================
// Client Class
// ============================================================================

export class ProcoreClient {
  private companyId: number
  private accessToken: string
  private refreshToken: string
  private onTokenRefresh?: (tokens: ProcoreOAuthTokens) => void | Promise<void>
  private isDevMode: boolean
  private apiBaseUrl: string
  private tokenUrl: string

  constructor(options: ProcoreClientOptions) {
    this.companyId = options.companyId
    this.accessToken = options.accessToken
    this.refreshToken = options.refreshToken
    this.onTokenRefresh = options.onTokenRefresh

    const config = getProcoreConfig()
    this.isDevMode = config.isDevMode
    this.apiBaseUrl = config.apiBaseUrl
    this.tokenUrl = config.tokenUrl

    if (this.isDevMode) {
      console.log('[Procore Client] Running in DEV MODE - using mock data')
    }
  }

  // ==========================================================================
  // Token Management
  // ==========================================================================

  /**
   * Refresh the access token using the refresh token
   */
  async refreshAccessToken(): Promise<ProcoreOAuthTokens> {
    if (this.isDevMode) {
      console.log('[Procore Client DEV] Simulating token refresh')
      await mockApiDelay(200, 400)
      const tokens = createMockOAuthTokens()
      this.accessToken = tokens.access_token
      this.refreshToken = tokens.refresh_token

      if (this.onTokenRefresh) {
        await this.onTokenRefresh(tokens)
      }

      return tokens
    }

    const config = getProcoreConfig()

    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: this.refreshToken,
      }),
    })

    if (!response.ok) {
      const error = await response.json() as ProcoreApiError
      throw new Error(`Token refresh failed: ${error.error_description || error.error}`)
    }

    const tokens = await response.json() as ProcoreOAuthTokens
    this.accessToken = tokens.access_token
    this.refreshToken = tokens.refresh_token

    if (this.onTokenRefresh) {
      await this.onTokenRefresh(tokens)
    }

    return tokens
  }

  // ==========================================================================
  // HTTP Request Handler
  // ==========================================================================

  /**
   * Make an authenticated request to the Procore API
   */
  private async request<T>(
    endpoint: string,
    options: ProcoreRequestOptions = {}
  ): Promise<T> {
    const { method = 'GET', body, params, headers = {} } = options

    // Build URL with query params
    let url = `${this.apiBaseUrl}${endpoint}`
    if (params) {
      const searchParams = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, String(value))
        }
      })
      const queryString = searchParams.toString()
      if (queryString) {
        url += `?${queryString}`
      }
    }

    const requestHeaders: Record<string, string> = {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
      'Procore-Company-Id': String(this.companyId),
      ...headers,
    }

    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
    })

    // Handle rate limiting
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After')
      const waitMs = retryAfter
        ? parseInt(retryAfter, 10) * 1000
        : PROCORE_RATE_LIMITS.retryAfterMs

      console.warn(`[Procore Client] Rate limited. Waiting ${waitMs}ms...`)
      await new Promise(resolve => setTimeout(resolve, waitMs))

      // Retry the request
      return this.request<T>(endpoint, options)
    }

    // Handle token expiration
    if (response.status === 401) {
      console.log('[Procore Client] Token expired, refreshing...')
      await this.refreshAccessToken()
      return this.request<T>(endpoint, options)
    }

    if (!response.ok) {
      // Try to parse as JSON, but handle HTML error pages gracefully
      const contentType = response.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        const error = await response.json() as ProcoreApiError
        throw new Error(`Procore API error (${response.status}): ${error.error_description || error.error}`)
      } else {
        // HTML or other non-JSON response
        const text = await response.text()
        console.error(`[Procore Client] Non-JSON error response (${response.status}):`, text.substring(0, 500))
        throw new Error(`Procore API error (${response.status}): ${response.statusText || 'Request failed'}`)
      }
    }

    return response.json() as Promise<T>
  }

  // ==========================================================================
  // Companies
  // ==========================================================================

  /**
   * List companies the user has access to
   */
  async getCompanies(): Promise<ProcoreCompany[]> {
    if (this.isDevMode) {
      console.log('[Procore Client DEV] Returning mock companies')
      await mockApiDelay()
      return MOCK_PROCORE_COMPANIES
    }

    return this.request<ProcoreCompany[]>('/rest/v1.0/companies')
  }

  // ==========================================================================
  // Projects
  // ==========================================================================

  /**
   * List projects for the company
   */
  async getProjects(
    pagination: ProcorePaginationParams = {}
  ): Promise<ProcorePaginatedResponse<ProcoreProject>> {
    const {
      page = 1,
      per_page = PROCORE_PAGINATION.defaultPageSize,
    } = pagination

    if (this.isDevMode) {
      console.log(`[Procore Client DEV] Returning mock projects (page ${page})`)
      await mockApiDelay()
      const projects = getMockProjects(this.companyId, { page, perPage: per_page })
      const allProjects = getMockProjects(this.companyId, {})

      return {
        data: projects,
        hasMore: page * per_page < allProjects.length,
        total: allProjects.length,
        nextPage: page * per_page < allProjects.length ? page + 1 : undefined,
      }
    }

    const projects = await this.request<ProcoreProject[]>('/rest/v1.0/projects', {
      params: {
        company_id: this.companyId,
        page,
        per_page,
      },
    })

    // In production, we'd parse headers for pagination info
    return {
      data: projects,
      hasMore: projects.length === per_page,
      nextPage: projects.length === per_page ? page + 1 : undefined,
    }
  }

  /**
   * Get all projects (handles pagination automatically)
   */
  async getAllProjects(): Promise<ProcoreProject[]> {
    const allProjects: ProcoreProject[] = []
    let page = 1
    let hasMore = true

    while (hasMore) {
      const response = await this.getProjects({ page, per_page: PROCORE_PAGINATION.maxPageSize })
      allProjects.push(...response.data)
      hasMore = response.hasMore
      page++
    }

    return allProjects
  }

  /**
   * Get a single project by ID
   */
  async getProject(projectId: number): Promise<ProcoreProject | null> {
    if (this.isDevMode) {
      console.log(`[Procore Client DEV] Returning mock project ${projectId}`)
      await mockApiDelay()
      return getMockProject(projectId)
    }

    try {
      return await this.request<ProcoreProject>(`/rest/v1.0/projects/${projectId}`, {
        params: { company_id: this.companyId },
      })
    } catch {
      return null
    }
  }

  // ==========================================================================
  // Vendors
  // ==========================================================================

  /**
   * List company directory vendors
   */
  async getVendors(
    pagination: ProcorePaginationParams & { isActive?: boolean } = {}
  ): Promise<ProcorePaginatedResponse<ProcoreVendor>> {
    const {
      page = 1,
      per_page = PROCORE_PAGINATION.defaultPageSize,
      isActive,
    } = pagination

    if (this.isDevMode) {
      console.log(`[Procore Client DEV] Returning mock vendors (page ${page})`)
      await mockApiDelay()
      const vendors = getMockVendors(this.companyId, { page, perPage: per_page, isActive })
      const allVendors = getMockVendors(this.companyId, { isActive })

      return {
        data: vendors,
        hasMore: page * per_page < allVendors.length,
        total: allVendors.length,
        nextPage: page * per_page < allVendors.length ? page + 1 : undefined,
      }
    }

    const params: Record<string, string | number | boolean | undefined> = {
      page,
      per_page,
    }

    if (isActive !== undefined) {
      params['filters[is_active]'] = isActive
    }

    const vendors = await this.request<ProcoreVendor[]>(
      `/rest/v1.0/companies/${this.companyId}/vendors`,
      { params }
    )

    return {
      data: vendors,
      hasMore: vendors.length === per_page,
      nextPage: vendors.length === per_page ? page + 1 : undefined,
    }
  }

  /**
   * Get all vendors (handles pagination automatically)
   */
  async getAllVendors(options: { isActive?: boolean } = {}): Promise<ProcoreVendor[]> {
    const allVendors: ProcoreVendor[] = []
    let page = 1
    let hasMore = true

    while (hasMore) {
      const response = await this.getVendors({
        page,
        per_page: PROCORE_PAGINATION.maxPageSize,
        isActive: options.isActive,
      })
      allVendors.push(...response.data)
      hasMore = response.hasMore
      page++
    }

    return allVendors
  }

  /**
   * Get a single vendor by ID
   */
  async getVendor(vendorId: number): Promise<ProcoreVendor | null> {
    if (this.isDevMode) {
      console.log(`[Procore Client DEV] Returning mock vendor ${vendorId}`)
      await mockApiDelay()
      return getMockVendor(vendorId)
    }

    try {
      return await this.request<ProcoreVendor>(
        `/rest/v1.0/companies/${this.companyId}/vendors/${vendorId}`
      )
    } catch {
      return null
    }
  }

  /**
   * Update a vendor's custom fields (for compliance status push)
   */
  async updateVendorCustomFields(
    vendorId: number,
    customFields: Record<string, unknown>
  ): Promise<ProcoreVendor> {
    if (this.isDevMode) {
      console.log(`[Procore Client DEV] Would update vendor ${vendorId} with:`, customFields)
      await mockApiDelay()
      const vendor = getMockVendor(vendorId)
      if (!vendor) {
        throw new Error(`Vendor ${vendorId} not found`)
      }
      return {
        ...vendor,
        custom_fields: customFields,
        updated_at: new Date().toISOString(),
      }
    }

    return this.request<ProcoreVendor>(
      `/rest/v1.0/companies/${this.companyId}/vendors/${vendorId}`,
      {
        method: 'PATCH',
        body: {
          vendor: {
            custom_fields: customFields,
          },
        },
      }
    )
  }

  // ==========================================================================
  // Vendor Insurances API
  // ==========================================================================

  /**
   * List all insurance records for a vendor
   * GET /rest/v1.0/companies/{company_id}/vendor_insurances?filters[vendor_id]={vendor_id}
   */
  async getVendorInsurances(vendorId: number): Promise<ProcoreVendorInsurance[]> {
    if (this.isDevMode) {
      console.log(`[Procore Client DEV] Returning mock insurances for vendor ${vendorId}`)
      await mockApiDelay()
      // Return mock insurance data
      return [
        {
          id: vendorId * 1000 + 1,
          vendor_id: vendorId,
          insurance_type: 'General Liability',
          policy_number: `GL-${vendorId}-001`,
          insurance_company: 'Mock Insurance Co',
          agent_name: 'John Agent',
          agent_phone: '1300 000 000',
          limit: 20000000,
          aggregate_limit: 20000000,
          deductible: 1000,
          effective_date: '2024-01-01',
          expiration_date: '2025-12-31',
          status: 'compliant',
          exempt: false,
          certificate_number: `CERT-${vendorId}`,
          additional_insured: true,
          waiver_of_subrogation: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: vendorId * 1000 + 2,
          vendor_id: vendorId,
          insurance_type: 'Workers Compensation',
          policy_number: `WC-${vendorId}-001`,
          insurance_company: 'Mock WorkCover',
          agent_name: null,
          agent_phone: null,
          limit: 50000000,
          aggregate_limit: null,
          deductible: 0,
          effective_date: '2024-01-01',
          expiration_date: '2025-12-31',
          status: 'compliant',
          exempt: false,
          certificate_number: null,
          additional_insured: false,
          waiver_of_subrogation: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]
    }

    return this.request<ProcoreVendorInsurance[]>(
      `/rest/v1.0/companies/${this.companyId}/vendor_insurances`,
      {
        params: {
          'filters[vendor_id]': vendorId,
        },
      }
    )
  }

  /**
   * Create a new insurance record for a vendor
   * POST /rest/v1.0/companies/{company_id}/vendor_insurances
   */
  async createVendorInsurance(
    input: ProcoreVendorInsuranceInput
  ): Promise<ProcoreVendorInsurance> {
    if (this.isDevMode) {
      console.log(`[Procore Client DEV] Would create insurance for vendor ${input.vendor_id}:`, input)
      await mockApiDelay()
      return {
        id: Math.floor(Math.random() * 100000),
        vendor_id: input.vendor_id,
        insurance_type: input.insurance_type || 'General Liability',
        policy_number: input.policy_number || null,
        insurance_company: input.insurance_company || null,
        agent_name: input.agent_name || null,
        agent_phone: input.agent_phone || null,
        limit: input.limit || null,
        aggregate_limit: input.aggregate_limit || null,
        deductible: input.deductible || null,
        effective_date: input.effective_date || null,
        expiration_date: input.expiration_date || null,
        status: input.status || null,
        exempt: input.exempt || false,
        certificate_number: input.certificate_number || null,
        additional_insured: input.additional_insured || false,
        waiver_of_subrogation: input.waiver_of_subrogation || false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
    }

    return this.request<ProcoreVendorInsurance>(
      `/rest/v1.0/companies/${this.companyId}/vendor_insurances`,
      {
        method: 'POST',
        body: {
          vendor_insurance: input,
        },
      }
    )
  }

  /**
   * Update an existing insurance record
   * PATCH /rest/v1.0/companies/{company_id}/vendor_insurances/{id}
   */
  async updateVendorInsurance(
    insuranceId: number,
    input: Partial<ProcoreVendorInsuranceInput>
  ): Promise<ProcoreVendorInsurance> {
    if (this.isDevMode) {
      console.log(`[Procore Client DEV] Would update insurance ${insuranceId}:`, input)
      await mockApiDelay()
      return {
        id: insuranceId,
        vendor_id: input.vendor_id || 0,
        insurance_type: input.insurance_type || 'General Liability',
        policy_number: input.policy_number || null,
        insurance_company: input.insurance_company || null,
        agent_name: input.agent_name || null,
        agent_phone: input.agent_phone || null,
        limit: input.limit || null,
        aggregate_limit: input.aggregate_limit || null,
        deductible: input.deductible || null,
        effective_date: input.effective_date || null,
        expiration_date: input.expiration_date || null,
        status: input.status || null,
        exempt: input.exempt || false,
        certificate_number: input.certificate_number || null,
        additional_insured: input.additional_insured || false,
        waiver_of_subrogation: input.waiver_of_subrogation || false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
    }

    return this.request<ProcoreVendorInsurance>(
      `/rest/v1.0/companies/${this.companyId}/vendor_insurances/${insuranceId}`,
      {
        method: 'PATCH',
        body: {
          vendor_insurance: input,
        },
      }
    )
  }

  /**
   * Delete an insurance record
   * DELETE /rest/v1.0/companies/{company_id}/vendor_insurances/{id}
   */
  async deleteVendorInsurance(insuranceId: number): Promise<void> {
    if (this.isDevMode) {
      console.log(`[Procore Client DEV] Would delete insurance ${insuranceId}`)
      await mockApiDelay()
      return
    }

    await this.request<void>(
      `/rest/v1.0/companies/${this.companyId}/vendor_insurances/${insuranceId}`,
      { method: 'DELETE' }
    )
  }

  /**
   * Sync insurance records for a vendor
   * Creates or updates insurance records based on Shield-AI verification results
   */
  async syncVendorInsurances(
    vendorId: number,
    insurances: ProcoreVendorInsuranceInput[]
  ): Promise<{ created: number; updated: number; errors: string[] }> {
    const result = { created: 0, updated: 0, errors: [] as string[] }

    // Get existing insurances for this vendor
    const existingInsurances = await this.getVendorInsurances(vendorId)

    for (const insurance of insurances) {
      try {
        // Find existing insurance by type
        const existing = existingInsurances.find(
          e => e.insurance_type.toLowerCase() === (insurance.insurance_type || '').toLowerCase()
        )

        if (existing) {
          // Update existing
          await this.updateVendorInsurance(existing.id, {
            ...insurance,
            vendor_id: vendorId,
          })
          result.updated++
        } else {
          // Create new
          await this.createVendorInsurance({
            ...insurance,
            vendor_id: vendorId,
          })
          result.created++
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error'
        result.errors.push(`Failed to sync ${insurance.insurance_type}: ${msg}`)
      }
    }

    return result
  }

  // ==========================================================================
  // Project Vendors
  // ==========================================================================

  /**
   * List vendors assigned to a specific project
   */
  async getProjectVendors(
    projectId: number,
    pagination: ProcorePaginationParams = {}
  ): Promise<ProcorePaginatedResponse<ProcoreVendor>> {
    const {
      page = 1,
      per_page = PROCORE_PAGINATION.defaultPageSize,
    } = pagination

    if (this.isDevMode) {
      console.log(`[Procore Client DEV] Returning mock project vendors for project ${projectId}`)
      await mockApiDelay()
      // In dev mode, return a subset of vendors as "assigned" to the project
      const allVendors = getMockVendors(this.companyId, { isActive: true })
      const projectVendors = allVendors.slice(0, Math.min(5, allVendors.length))
      const start = (page - 1) * per_page
      const paginatedVendors = projectVendors.slice(start, start + per_page)

      return {
        data: paginatedVendors,
        hasMore: page * per_page < projectVendors.length,
        total: projectVendors.length,
        nextPage: page * per_page < projectVendors.length ? page + 1 : undefined,
      }
    }

    const vendors = await this.request<ProcoreVendor[]>(
      `/rest/v1.0/projects/${projectId}/vendors`,
      {
        params: {
          page,
          per_page,
        },
      }
    )

    return {
      data: vendors,
      hasMore: vendors.length === per_page,
      nextPage: vendors.length === per_page ? page + 1 : undefined,
    }
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Test the connection to Procore
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      if (this.isDevMode) {
        console.log('[Procore Client DEV] Testing connection (mock)')
        await mockApiDelay()
        return {
          success: true,
          message: 'DEV MODE: Connection simulated successfully',
        }
      }

      const companies = await this.getCompanies()
      return {
        success: true,
        message: `Connected successfully. Found ${companies.length} company(ies).`,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return {
        success: false,
        message: `Connection failed: ${message}`,
      }
    }
  }

  /**
   * Get the current company ID
   */
  getCompanyId(): number {
    return this.companyId
  }

  /**
   * Check if running in dev mode
   */
  isInDevMode(): boolean {
    return this.isDevMode
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a Procore client instance
 */
export function createProcoreClient(options: ProcoreClientOptions): ProcoreClient {
  return new ProcoreClient(options)
}

/**
 * Create a mock Procore client for testing/development
 */
export function createMockProcoreClient(companyId: number = 1001): ProcoreClient {
  const mockTokens = createMockOAuthTokens()
  return new ProcoreClient({
    companyId,
    accessToken: mockTokens.access_token,
    refreshToken: mockTokens.refresh_token,
  })
}
