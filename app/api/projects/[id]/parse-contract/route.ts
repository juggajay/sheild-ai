import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { getDb, type Project } from '@/lib/db'
import { getUserByToken } from '@/lib/auth'
import { extractContractRequirements } from '@/lib/gemini'
import fs from 'fs'
import path from 'path'

// Valid coverage types that can be extracted from contracts
const VALID_COVERAGE_TYPES = [
  'public_liability',
  'products_liability',
  'workers_comp',
  'professional_indemnity',
  'motor_vehicle',
  'contract_works'
]

// Helper function to check if user can access project
function canAccessProject(user: { id: string; company_id: string | null; role: string }, project: Project): boolean {
  if (project.company_id !== user.company_id) {
    return false
  }

  if (['admin', 'risk_manager', 'read_only'].includes(user.role)) {
    return true
  }

  if (['project_manager', 'project_administrator'].includes(user.role)) {
    return project.project_manager_id === user.id
  }

  return false
}

// POST /api/projects/[id]/parse-contract - Upload and parse a contract for insurance requirements
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.cookies.get('auth_token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const user = getUserByToken(token)
    if (!user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    // Only admin and risk_manager can parse contracts and set requirements
    if (!['admin', 'risk_manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Only admins and risk managers can parse contracts' }, { status: 403 })
    }

    const db = getDb()
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(params.id) as Project | undefined

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    if (!canAccessProject(user, project)) {
      return NextResponse.json({ error: 'Access denied to this project' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const autoApply = formData.get('autoApply') === 'true'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type (PDF only for Gemini - Word docs would need conversion)
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png'
    ]
    const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png']
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase()

    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
      return NextResponse.json({
        error: `Invalid file type. Please upload a PDF or image file (${allowedExtensions.join(', ')}). You uploaded: ${file.name}`
      }, { status: 400 })
    }

    // Check file size (max 20MB for contracts)
    const maxSize = 20 * 1024 * 1024 // 20MB
    if (file.size > maxSize) {
      return NextResponse.json({
        error: 'File too large. Maximum size is 20MB'
      }, { status: 400 })
    }

    // Create upload directory if it doesn't exist
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'contracts')
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }

    // Generate unique filename
    const fileExt = path.extname(file.name)
    const uniqueFilename = `${uuidv4()}${fileExt}`
    const filePath = path.join(uploadDir, uniqueFilename)
    const fileUrl = `/uploads/contracts/${uniqueFilename}`

    // Save file to disk
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    fs.writeFileSync(filePath, buffer)

    // Determine mime type
    let mimeType = file.type
    if (!mimeType || mimeType === 'application/octet-stream') {
      // Fallback based on extension
      const extMimeMap: Record<string, string> = {
        '.pdf': 'application/pdf',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png'
      }
      mimeType = extMimeMap[fileExtension] || 'application/pdf'
    }

    // Extract requirements using Gemini AI
    console.log(`[Contract Parse] Processing ${file.name} (${(file.size / 1024).toFixed(1)}KB) with Gemini...`)
    const extraction = await extractContractRequirements(buffer, mimeType, file.name)

    // Log the action
    db.prepare(`
      INSERT INTO audit_logs (id, company_id, user_id, entity_type, entity_id, action, details)
      VALUES (?, ?, ?, 'project', ?, 'parse_contract', ?)
    `).run(uuidv4(), user.company_id, user.id, params.id, JSON.stringify({
      fileName: file.name,
      fileSize: file.size,
      fileUrl,
      requirementsExtracted: extraction.requirements.length,
      clausesExtracted: extraction.extracted_clauses.length,
      confidenceScore: extraction.confidence_score,
      contractType: extraction.contract_type,
      extractionModel: extraction.extractionModel,
      autoApply,
      success: extraction.success,
      error: extraction.error
    }))

    // If extraction failed, return error
    if (!extraction.success) {
      return NextResponse.json({
        success: false,
        message: extraction.error?.message || 'Failed to extract requirements from contract',
        contract: {
          fileName: file.name,
          fileUrl,
          fileSize: file.size
        },
        extraction: {
          requirements: [],
          extracted_clauses: [],
          confidence_score: 0,
          warnings: extraction.warnings,
          error: extraction.error
        },
        applied: false,
        savedRequirements: null
      }, { status: 200 }) // Return 200 so frontend can show the error nicely
    }

    // If autoApply is true and we have requirements, save them to the project
    if (autoApply && extraction.requirements.length > 0) {
      // Delete existing requirements
      db.prepare('DELETE FROM insurance_requirements WHERE project_id = ?').run(params.id)

      // Insert new requirements
      for (const req of extraction.requirements) {
        // Validate coverage type
        if (!VALID_COVERAGE_TYPES.includes(req.coverage_type)) {
          continue
        }

        const requirementId = uuidv4()
        db.prepare(`
          INSERT INTO insurance_requirements (
            id, project_id, coverage_type, minimum_limit, limit_type,
            maximum_excess, principal_indemnity_required, cross_liability_required, other_requirements
          )
          VALUES (?, ?, ?, ?, 'per_occurrence', ?, ?, ?, ?)
        `).run(
          requirementId,
          params.id,
          req.coverage_type,
          req.minimum_limit,
          req.maximum_excess,
          req.principal_indemnity_required ? 1 : 0,
          req.cross_liability_required ? 1 : 0,
          req.notes
        )
      }

      // Log the auto-apply action
      db.prepare(`
        INSERT INTO audit_logs (id, company_id, user_id, entity_type, entity_id, action, details)
        VALUES (?, ?, ?, 'project', ?, 'auto_apply_requirements', ?)
      `).run(uuidv4(), user.company_id, user.id, params.id, JSON.stringify({
        requirementsApplied: extraction.requirements.length,
        source: 'gemini_contract_parsing',
        contractType: extraction.contract_type,
        confidence: extraction.confidence_score
      }))
    }

    // Get updated requirements if auto-applied
    const savedRequirements = autoApply
      ? db.prepare('SELECT * FROM insurance_requirements WHERE project_id = ?').all(params.id)
      : []

    return NextResponse.json({
      success: true,
      message: autoApply
        ? `Contract parsed with Gemini AI and ${extraction.requirements.length} requirements applied to project`
        : 'Contract parsed successfully with Gemini AI. Review and apply requirements.',
      contract: {
        fileName: file.name,
        fileUrl,
        fileSize: file.size
      },
      extraction: {
        requirements: extraction.requirements,
        extracted_clauses: extraction.extracted_clauses,
        confidence_score: extraction.confidence_score,
        warnings: extraction.warnings,
        contract_type: extraction.contract_type,
        estimated_value: extraction.estimated_value,
        extraction_model: extraction.extractionModel,
        extraction_timestamp: extraction.extractionTimestamp
      },
      applied: autoApply,
      savedRequirements: autoApply ? savedRequirements : null
    }, { status: 201 })

  } catch (error) {
    console.error('Parse contract error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
