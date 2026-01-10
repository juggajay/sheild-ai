import { NextRequest, NextResponse } from 'next/server'
import { getConvex, api } from '@/lib/convex'
import type { Id } from '@/convex/_generated/dataModel'

// POST /api/documents/[id]/verify - Manual verification action (approve/reject)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.cookies.get('auth_token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const convex = getConvex()

    // Get user session
    const sessionData = await convex.query(api.auth.getUserWithSession, { token })
    if (!sessionData) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const user = sessionData.user
    if (!user.companyId) {
      return NextResponse.json({ error: 'User has no company' }, { status: 400 })
    }

    // Only certain roles can manually verify documents
    if (!['admin', 'risk_manager', 'project_manager'].includes(user.role)) {
      return NextResponse.json({ error: 'You do not have permission to verify documents' }, { status: 403 })
    }

    const body = await request.json()
    const { action, notes } = body

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Must be "approve" or "reject"' }, { status: 400 })
    }

    const { id: documentId } = await params

    // Get document with verification
    const document = await convex.query(api.documents.getByIdForCompany, {
      id: documentId as Id<"cocDocuments">,
      companyId: user.companyId,
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    if (!document.verification_id) {
      return NextResponse.json({ error: 'Document has not been verified yet' }, { status: 400 })
    }

    const newStatus = action === 'approve' ? 'pass' : 'fail'
    const previousStatus = document.verification_status

    // Update the verification status
    await convex.mutation(api.verifications.manualVerify, {
      id: document.verification_id,
      status: newStatus as 'pass' | 'fail',
      verifiedByUserId: user._id,
    })

    // Update project_subcontractors status based on verification result
    const complianceStatus = action === 'approve' ? 'compliant' : 'non_compliant'
    await convex.mutation(api.projectSubcontractors.updateStatusByProjectAndSubcontractor, {
      projectId: document.projectId,
      subcontractorId: document.subcontractorId,
      status: complianceStatus as 'compliant' | 'non_compliant',
    })

    // Log the manual verification action
    await convex.mutation(api.auditLogs.create, {
      companyId: user.companyId,
      userId: user._id,
      entityType: 'verification',
      entityId: document.verification_id,
      action: `manual_${action}`,
      details: {
        documentId,
        previousStatus,
        newStatus,
        notes: notes || null,
        subcontractorId: document.subcontractorId,
        projectId: document.projectId
      },
    })

    return NextResponse.json({
      success: true,
      message: `Document ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
      newStatus
    })
  } catch (error) {
    console.error('Manual verification error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
