/**
 * Document Classification Module for Data Migration
 *
 * Simulates AI-powered document classification for bulk import.
 * Classifies documents as: COC, vendor_list, policy_schedule, or other
 */

export type DocumentClassification = 'coc' | 'vendor_list' | 'policy_schedule' | 'other'

export interface ClassificationResult {
  classification: DocumentClassification
  confidence: number
  extractedData?: ExtractedMigrationData
}

export interface ExtractedVendor {
  name: string
  abn?: string
  email?: string
  phone?: string
  address?: string
  tradeLicenseNumber?: string
}

export interface ExtractedCOCData {
  vendorName: string
  vendorAbn?: string
  insurerName: string
  policyNumber: string
  policyStartDate: string
  policyEndDate: string
  coverages: Array<{
    type: string
    limit: number
    excess?: number
  }>
}

export interface ExtractedPolicySchedule {
  insurerName: string
  policyNumber: string
  vendors: Array<{
    name: string
    abn?: string
    coverageType: string
    limit: number
  }>
}

export type ExtractedMigrationData = ExtractedVendor[] | ExtractedCOCData | ExtractedPolicySchedule

export interface MigrationDocument {
  id: string
  fileName: string
  fileType: string
  fileSize: number
  classification: ClassificationResult
  status: 'pending' | 'processed' | 'error'
  errorMessage?: string
}

export interface MigrationSession {
  id: string
  projectId: string
  companyId: string
  userId: string
  status: 'uploading' | 'classifying' | 'reviewing' | 'importing' | 'completed' | 'failed'
  documents: MigrationDocument[]
  vendorsToCreate: ExtractedVendor[]
  vendorsToMatch: Array<{
    extractedVendor: ExtractedVendor
    matchedSubcontractorId?: string
    matchedSubcontractorName?: string
    matchConfidence?: number
  }>
  cocDocuments: Array<{
    documentId: string
    vendorMatch?: string
    data: ExtractedCOCData
  }>
  createdAt: string
  updatedAt: string
}

/**
 * Classify a document based on filename and content hints
 * In production, this would use an AI model to analyze the document content
 */
export function classifyDocument(fileName: string, fileType: string, fileSize: number): ClassificationResult {
  const lowerName = fileName.toLowerCase()

  // COC documents (PDF certificates)
  if (fileType === 'application/pdf' || lowerName.endsWith('.pdf')) {
    // Check for COC indicators in filename
    if (lowerName.includes('coc') ||
        lowerName.includes('certificate') ||
        lowerName.includes('currency') ||
        lowerName.includes('insurance') ||
        lowerName.includes('policy_cert')) {
      return {
        classification: 'coc',
        confidence: 0.92 + Math.random() * 0.07
      }
    }

    // Check for policy schedule indicators
    if (lowerName.includes('schedule') ||
        lowerName.includes('policy_list') ||
        lowerName.includes('coverage_summary')) {
      return {
        classification: 'policy_schedule',
        confidence: 0.85 + Math.random() * 0.10
      }
    }

    // Default PDF to COC with medium confidence
    return {
      classification: 'coc',
      confidence: 0.70 + Math.random() * 0.15
    }
  }

  // Spreadsheets (vendor lists)
  if (fileType.includes('spreadsheet') ||
      fileType.includes('excel') ||
      lowerName.endsWith('.xlsx') ||
      lowerName.endsWith('.xls') ||
      lowerName.endsWith('.csv')) {

    if (lowerName.includes('vendor') ||
        lowerName.includes('subcontractor') ||
        lowerName.includes('contractor') ||
        lowerName.includes('supplier')) {
      return {
        classification: 'vendor_list',
        confidence: 0.95 + Math.random() * 0.04
      }
    }

    // Default spreadsheet to vendor list
    return {
      classification: 'vendor_list',
      confidence: 0.80 + Math.random() * 0.10
    }
  }

  // Images could be scanned COCs
  if (fileType.includes('image') ||
      lowerName.endsWith('.jpg') ||
      lowerName.endsWith('.jpeg') ||
      lowerName.endsWith('.png')) {
    return {
      classification: 'coc',
      confidence: 0.65 + Math.random() * 0.20
    }
  }

  // Unknown document type
  return {
    classification: 'other',
    confidence: 0.50 + Math.random() * 0.20
  }
}

/**
 * Extract vendor information from a vendor list file
 * Simulates parsing Excel/CSV files
 */
export function extractVendorsFromList(fileName: string): ExtractedVendor[] {
  // Generate simulated vendor data based on file name
  const lowerName = fileName.toLowerCase()

  // Number of vendors based on filename hints
  let vendorCount = 5 + Math.floor(Math.random() * 10)
  if (lowerName.includes('large') || lowerName.includes('full')) {
    vendorCount = 15 + Math.floor(Math.random() * 10)
  } else if (lowerName.includes('small') || lowerName.includes('partial')) {
    vendorCount = 2 + Math.floor(Math.random() * 4)
  }

  const vendorTypes = [
    { prefix: 'ABC', suffix: 'Constructions Pty Ltd', trade: 'General Construction' },
    { prefix: 'Smith', suffix: 'Electrical Services', trade: 'Electrical' },
    { prefix: 'Jones', suffix: 'Plumbing Solutions', trade: 'Plumbing' },
    { prefix: 'Metro', suffix: 'HVAC Systems', trade: 'HVAC' },
    { prefix: 'Premier', suffix: 'Roofing Co', trade: 'Roofing' },
    { prefix: 'Elite', suffix: 'Painting Services', trade: 'Painting' },
    { prefix: 'Pro', suffix: 'Carpentry Works', trade: 'Carpentry' },
    { prefix: 'Ace', suffix: 'Concrete Solutions', trade: 'Concrete' },
    { prefix: 'Quality', suffix: 'Steel Fabrication', trade: 'Steel Work' },
    { prefix: 'Expert', suffix: 'Landscaping', trade: 'Landscaping' },
    { prefix: 'Master', suffix: 'Tiling Services', trade: 'Tiling' },
    { prefix: 'Pacific', suffix: 'Glass & Glazing', trade: 'Glazing' },
    { prefix: 'Alpha', suffix: 'Security Systems', trade: 'Security' },
    { prefix: 'Delta', suffix: 'Fire Protection', trade: 'Fire Safety' },
    { prefix: 'Omega', suffix: 'Demolition Services', trade: 'Demolition' }
  ]

  const vendors: ExtractedVendor[] = []
  const usedIndices = new Set<number>()

  for (let i = 0; i < vendorCount; i++) {
    let typeIndex: number
    do {
      typeIndex = Math.floor(Math.random() * vendorTypes.length)
    } while (usedIndices.has(typeIndex) && usedIndices.size < vendorTypes.length)
    usedIndices.add(typeIndex)

    if (usedIndices.size >= vendorTypes.length) {
      usedIndices.clear()
    }

    const vendorType = vendorTypes[typeIndex]
    const randomNum = Math.floor(Math.random() * 900) + 100

    // Generate valid-looking ABN (11 digits)
    const abnBase = `${50 + Math.floor(Math.random() * 49)}${String(Math.random()).slice(2, 11).padStart(9, '0')}`

    vendors.push({
      name: `${vendorType.prefix} ${vendorType.suffix}`,
      abn: abnBase,
      email: `info@${vendorType.prefix.toLowerCase()}${randomNum}.com.au`,
      phone: `02 ${9000 + Math.floor(Math.random() * 999)} ${1000 + Math.floor(Math.random() * 8999)}`,
      address: `${Math.floor(Math.random() * 500) + 1} ${['Main', 'High', 'George', 'King', 'Queen', 'Victoria'][Math.floor(Math.random() * 6)]} Street, Sydney NSW ${2000 + Math.floor(Math.random() * 200)}`,
      tradeLicenseNumber: `TL${Date.now().toString().slice(-6)}${i}`
    })
  }

  return vendors
}

/**
 * Extract COC data from a certificate document
 * Simulates AI extraction from PDF/image
 */
export function extractCOCData(fileName: string, vendorName?: string): ExtractedCOCData {
  const insurers = [
    'QBE Insurance (Australia) Limited',
    'Allianz Australia Insurance Limited',
    'Suncorp Group Limited',
    'CGU Insurance Limited',
    'Zurich Australian Insurance Limited',
    'AIG Australia Limited'
  ]

  const randomInsurer = insurers[Math.floor(Math.random() * insurers.length)]
  const policyNumber = `POL${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 1000)}`

  // Generate dates
  const startDate = new Date()
  startDate.setMonth(startDate.getMonth() - Math.floor(Math.random() * 6))
  const endDate = new Date(startDate)
  endDate.setFullYear(endDate.getFullYear() + 1)

  // If vendor name is provided, use it; otherwise extract from filename
  let extractedVendorName = vendorName || 'Unknown Contractor Pty Ltd'
  if (!vendorName) {
    // Try to extract from filename
    const nameMatch = fileName.match(/(?:coc_|certificate_|insurance_)?([a-zA-Z_]+)/i)
    if (nameMatch && nameMatch[1]) {
      extractedVendorName = nameMatch[1].replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) + ' Pty Ltd'
    }
  }

  // Generate ABN
  const abnBase = `${50 + Math.floor(Math.random() * 49)}${String(Math.random()).slice(2, 11).padStart(9, '0')}`

  return {
    vendorName: extractedVendorName,
    vendorAbn: abnBase,
    insurerName: randomInsurer,
    policyNumber,
    policyStartDate: startDate.toISOString().split('T')[0],
    policyEndDate: endDate.toISOString().split('T')[0],
    coverages: [
      {
        type: 'public_liability',
        limit: [5000000, 10000000, 20000000][Math.floor(Math.random() * 3)],
        excess: 1000
      },
      {
        type: 'products_liability',
        limit: [5000000, 10000000, 20000000][Math.floor(Math.random() * 3)],
        excess: 1000
      },
      {
        type: 'workers_comp',
        limit: [1000000, 2000000, 5000000][Math.floor(Math.random() * 3)],
        excess: 0
      },
      {
        type: 'professional_indemnity',
        limit: [1000000, 2000000, 5000000][Math.floor(Math.random() * 3)],
        excess: 5000
      }
    ]
  }
}

/**
 * Match extracted vendor data against existing subcontractors
 */
export function matchVendorToSubcontractor(
  vendor: ExtractedVendor,
  existingSubcontractors: Array<{ id: string; name: string; abn: string }>
): { matchedId?: string; matchedName?: string; confidence: number } {
  // First try ABN match (exact)
  if (vendor.abn) {
    const abnMatch = existingSubcontractors.find(
      s => s.abn.replace(/\s/g, '') === vendor.abn?.replace(/\s/g, '')
    )
    if (abnMatch) {
      return {
        matchedId: abnMatch.id,
        matchedName: abnMatch.name,
        confidence: 1.0 // Exact ABN match
      }
    }
  }

  // Try name matching (fuzzy)
  const vendorNameLower = vendor.name.toLowerCase().replace(/\s+(pty|ltd|limited|inc|corp|co)\.?\s*/gi, '').trim()

  let bestMatch: { id: string; name: string; confidence: number } | null = null

  for (const sub of existingSubcontractors) {
    const subNameLower = sub.name.toLowerCase().replace(/\s+(pty|ltd|limited|inc|corp|co)\.?\s*/gi, '').trim()

    // Check for exact name match
    if (vendorNameLower === subNameLower) {
      return {
        matchedId: sub.id,
        matchedName: sub.name,
        confidence: 0.95
      }
    }

    // Check if one contains the other
    if (vendorNameLower.includes(subNameLower) || subNameLower.includes(vendorNameLower)) {
      const conf = 0.70 + (Math.min(vendorNameLower.length, subNameLower.length) / Math.max(vendorNameLower.length, subNameLower.length)) * 0.2
      if (!bestMatch || conf > bestMatch.confidence) {
        bestMatch = { id: sub.id, name: sub.name, confidence: conf }
      }
    }

    // Simple word overlap check
    const vendorWords = new Set(vendorNameLower.split(/\s+/))
    const subWords = new Set(subNameLower.split(/\s+/))
    let overlap = 0
    vendorWords.forEach((word) => {
      if (subWords.has(word)) overlap++
    })

    if (overlap > 0) {
      const conf = 0.50 + (overlap / Math.max(vendorWords.size, subWords.size)) * 0.35
      if (!bestMatch || conf > bestMatch.confidence) {
        bestMatch = { id: sub.id, name: sub.name, confidence: conf }
      }
    }
  }

  if (bestMatch && bestMatch.confidence >= 0.60) {
    return {
      matchedId: bestMatch.id,
      matchedName: bestMatch.name,
      confidence: bestMatch.confidence
    }
  }

  // No match found
  return { confidence: 0 }
}
