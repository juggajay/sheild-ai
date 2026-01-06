import { NextRequest, NextResponse } from 'next/server'

// ABN validation helper - uses Australian checksum algorithm
function validateABNChecksum(abn: string): boolean {
  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19]
  const digits = abn.split('').map(Number)
  digits[0] = digits[0] - 1 // Subtract 1 from first digit
  const sum = digits.reduce((acc, digit, i) => acc + digit * weights[i], 0)
  return sum % 89 === 0
}

// Mock ABR data for development (in production, this would call the real ABR API)
// The ABR API requires registration at https://abr.business.gov.au/Tools/WebServices
const MOCK_ABR_DATA: Record<string, { entityName: string; status: string; entityType: string }> = {
  '51824753556': { entityName: 'AUSTRALIAN BROADCASTING CORPORATION', status: 'Active', entityType: 'Commonwealth Entity' },
  '33102417032': { entityName: 'TELSTRA GROUP LIMITED', status: 'Active', entityType: 'Public Company' },
  '12345678901': { entityName: 'ABC Electrical Pty Ltd', status: 'Active', entityType: 'Private Company' },
  '99887766554': { entityName: 'Test Plumbing Services Pty Ltd', status: 'Active', entityType: 'Private Company' },
  '11222333444': { entityName: 'Test Subcontractor Pty Ltd', status: 'Active', entityType: 'Private Company' },
}

// GET /api/external/abn/[abn] - Validate ABN and lookup entity details
export async function GET(
  request: NextRequest,
  { params }: { params: { abn: string } }
) {
  try {
    const abn = params.abn?.replace(/\s/g, '')

    if (!abn) {
      return NextResponse.json({ error: 'ABN is required' }, { status: 400 })
    }

    // Validate format (11 digits)
    if (!/^\d{11}$/.test(abn)) {
      return NextResponse.json({
        valid: false,
        error: 'ABN must be exactly 11 digits'
      }, { status: 400 })
    }

    // Validate checksum
    if (!validateABNChecksum(abn)) {
      return NextResponse.json({
        valid: false,
        error: 'Invalid ABN checksum - please verify the ABN is correct'
      }, { status: 400 })
    }

    // In development, use mock data
    // In production, this would call the ABR API
    const abrData = MOCK_ABR_DATA[abn]

    if (abrData) {
      return NextResponse.json({
        valid: true,
        abn: abn,
        entityName: abrData.entityName,
        status: abrData.status,
        entityType: abrData.entityType,
        source: 'mock' // In production, this would be 'abr'
      })
    }

    // ABN format is valid but not found in our mock data
    // In production, this would indicate the ABN is not registered
    // For development, we'll return valid but with no entity data
    return NextResponse.json({
      valid: true,
      abn: abn,
      entityName: null,
      status: 'Unknown',
      entityType: null,
      message: 'ABN format is valid but entity not found in lookup. Entity details not available.',
      source: 'mock'
    })

  } catch (error) {
    console.error('ABN validation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
