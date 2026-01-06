import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { getUserByToken } from "@/lib/auth"
import { PDFDocument, StandardFonts, rgb } from "pdf-lib"

interface ExceptionData {
  id: string
  issue_summary: string
  reason: string
  risk_level: string
  status: string
  expiration_type: string
  expires_at: string | null
  created_at: string
  subcontractor_name: string
  subcontractor_abn: string
  project_name: string
  created_by_name: string
  created_by_email: string
  approved_by_name: string | null
  approved_at: string | null
  company_name: string
}

interface AuditLogEntry {
  id: string
  action: string
  details: string
  created_at: string
  user_name: string | null
  user_email: string | null
  ip_address: string | null
}

// GET /api/exceptions/[id]/audit-trail - Generate PDF audit trail for an exception
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.cookies.get("auth_token")?.value
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = getUserByToken(token)
    if (!user) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    }

    // Only admin and risk_manager can export audit trails
    if (!['admin', 'risk_manager'].includes(user.role)) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 })
    }

    const db = getDb()
    const exceptionId = params.id

    // Fetch exception details
    const exception = db.prepare(`
      SELECT
        e.*,
        s.name as subcontractor_name,
        s.abn as subcontractor_abn,
        p.name as project_name,
        creator.name as created_by_name,
        creator.email as created_by_email,
        approver.name as approved_by_name,
        c.name as company_name
      FROM exceptions e
      JOIN project_subcontractors ps ON e.project_subcontractor_id = ps.id
      JOIN subcontractors s ON ps.subcontractor_id = s.id
      JOIN projects p ON ps.project_id = p.id
      JOIN users creator ON e.created_by_user_id = creator.id
      LEFT JOIN users approver ON e.approved_by_user_id = approver.id
      JOIN companies c ON p.company_id = c.id
      WHERE e.id = ? AND p.company_id = ?
    `).get(exceptionId, user.company_id) as ExceptionData | undefined

    if (!exception) {
      return NextResponse.json({ error: "Exception not found" }, { status: 404 })
    }

    // Fetch audit log entries for this exception
    const auditLogs = db.prepare(`
      SELECT
        al.id,
        al.action,
        al.details,
        al.created_at,
        al.ip_address,
        u.name as user_name,
        u.email as user_email
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.entity_type = 'exception' AND al.entity_id = ?
      ORDER BY al.created_at ASC
    `).all(exceptionId) as AuditLogEntry[]

    // Generate PDF
    const pdfDoc = await PDFDocument.create()
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    // First page
    let page = pdfDoc.addPage([595.28, 841.89]) // A4 size
    const { width, height } = page.getSize()
    let y = height - 50

    // Header
    page.drawText("EXCEPTION AUDIT TRAIL", {
      x: 50,
      y,
      size: 24,
      font: helveticaBold,
      color: rgb(0.1, 0.3, 0.6)
    })
    y -= 30

    page.drawText(`Generated: ${new Date().toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}`, {
      x: 50,
      y,
      size: 10,
      font: helvetica,
      color: rgb(0.5, 0.5, 0.5)
    })
    y -= 40

    // Exception Details Section
    page.drawText("EXCEPTION DETAILS", {
      x: 50,
      y,
      size: 14,
      font: helveticaBold,
      color: rgb(0.2, 0.2, 0.2)
    })
    y -= 25

    const statusLabel = exception.status.charAt(0).toUpperCase() + exception.status.slice(1).replace('_', ' ')
    const riskLabel = exception.risk_level.charAt(0).toUpperCase() + exception.risk_level.slice(1)

    const exceptionInfo = [
      ["Exception ID:", exception.id],
      ["Issue Summary:", exception.issue_summary],
      ["Project:", exception.project_name],
      ["Subcontractor:", `${exception.subcontractor_name} (ABN: ${exception.subcontractor_abn})`],
      ["Risk Level:", riskLabel],
      ["Status:", statusLabel],
      ["Expiration Type:", exception.expiration_type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')],
      ["Expires:", exception.expires_at ? new Date(exception.expires_at).toLocaleDateString('en-AU') : 'N/A'],
      ["Created By:", `${exception.created_by_name} (${exception.created_by_email})`],
      ["Created At:", new Date(exception.created_at).toLocaleString('en-AU')],
    ]

    if (exception.approved_by_name) {
      exceptionInfo.push(["Approved By:", exception.approved_by_name])
      if (exception.approved_at) {
        exceptionInfo.push(["Approved At:", new Date(exception.approved_at).toLocaleString('en-AU')])
      }
    }

    for (const [label, value] of exceptionInfo) {
      // Handle long values by wrapping text
      const maxValueWidth = 350
      const valueLines = wrapText(value, helvetica, 10, maxValueWidth)

      page.drawText(label, { x: 50, y, size: 10, font: helveticaBold, color: rgb(0.3, 0.3, 0.3) })

      for (let i = 0; i < valueLines.length; i++) {
        const lineY = y - (i * 12)
        page.drawText(valueLines[i], { x: 180, y: lineY, size: 10, font: helvetica, color: rgb(0.1, 0.1, 0.1) })
      }

      y -= Math.max(18, valueLines.length * 12 + 6)
    }
    y -= 10

    // Reason/Justification
    page.drawText("REASON / JUSTIFICATION", {
      x: 50,
      y,
      size: 14,
      font: helveticaBold,
      color: rgb(0.2, 0.2, 0.2)
    })
    y -= 20

    // Wrap reason text
    const reasonLines = wrapText(exception.reason, helvetica, 10, width - 100)
    for (const line of reasonLines) {
      if (y < 100) {
        page = pdfDoc.addPage([595.28, 841.89])
        y = height - 50
      }
      page.drawText(line, { x: 50, y, size: 10, font: helvetica, color: rgb(0.2, 0.2, 0.2) })
      y -= 14
    }
    y -= 20

    // Audit Trail Section
    page.drawText("AUDIT TRAIL", {
      x: 50,
      y,
      size: 14,
      font: helveticaBold,
      color: rgb(0.2, 0.2, 0.2)
    })
    y -= 25

    if (auditLogs.length === 0) {
      page.drawText("No audit entries recorded", {
        x: 50,
        y,
        size: 10,
        font: helvetica,
        color: rgb(0.5, 0.5, 0.5)
      })
    } else {
      // Table header
      page.drawText("Timestamp", { x: 50, y, size: 9, font: helveticaBold, color: rgb(0.3, 0.3, 0.3) })
      page.drawText("Action", { x: 180, y, size: 9, font: helveticaBold, color: rgb(0.3, 0.3, 0.3) })
      page.drawText("User", { x: 280, y, size: 9, font: helveticaBold, color: rgb(0.3, 0.3, 0.3) })
      page.drawText("IP Address", { x: 420, y, size: 9, font: helveticaBold, color: rgb(0.3, 0.3, 0.3) })
      y -= 15

      // Draw line
      page.drawLine({ start: { x: 50, y: y + 5 }, end: { x: 545, y: y + 5 }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) })

      for (const log of auditLogs) {
        // Check if we need a new page
        if (y < 100) {
          page = pdfDoc.addPage([595.28, 841.89])
          y = height - 50

          // Repeat header on new page
          page.drawText("AUDIT TRAIL (continued)", {
            x: 50,
            y,
            size: 14,
            font: helveticaBold,
            color: rgb(0.2, 0.2, 0.2)
          })
          y -= 25

          page.drawText("Timestamp", { x: 50, y, size: 9, font: helveticaBold, color: rgb(0.3, 0.3, 0.3) })
          page.drawText("Action", { x: 180, y, size: 9, font: helveticaBold, color: rgb(0.3, 0.3, 0.3) })
          page.drawText("User", { x: 280, y, size: 9, font: helveticaBold, color: rgb(0.3, 0.3, 0.3) })
          page.drawText("IP Address", { x: 420, y, size: 9, font: helveticaBold, color: rgb(0.3, 0.3, 0.3) })
          y -= 15
          page.drawLine({ start: { x: 50, y: y + 5 }, end: { x: 545, y: y + 5 }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) })
        }

        const timestamp = new Date(log.created_at).toLocaleString('en-AU', {
          day: '2-digit',
          month: '2-digit',
          year: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        })
        const actionLabel = log.action.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
        const userName = log.user_name || 'System'
        const ipAddress = log.ip_address || '-'

        page.drawText(timestamp, { x: 50, y, size: 8, font: helvetica, color: rgb(0.2, 0.2, 0.2) })
        page.drawText(actionLabel.substring(0, 18), { x: 180, y, size: 8, font: helvetica, color: rgb(0.2, 0.2, 0.2) })
        page.drawText(userName.substring(0, 20), { x: 280, y, size: 8, font: helvetica, color: rgb(0.2, 0.2, 0.2) })
        page.drawText(ipAddress, { x: 420, y, size: 8, font: helvetica, color: rgb(0.2, 0.2, 0.2) })
        y -= 14

        // If there are details, show them
        if (log.details && log.details !== '{}') {
          try {
            const details = JSON.parse(log.details)
            const detailsText = Object.entries(details)
              .map(([k, v]) => `${k}: ${v}`)
              .join(', ')

            if (detailsText) {
              const truncatedDetails = detailsText.length > 80 ? detailsText.substring(0, 77) + '...' : detailsText
              page.drawText(`  ${truncatedDetails}`, {
                x: 60,
                y,
                size: 7,
                font: helvetica,
                color: rgb(0.5, 0.5, 0.5)
              })
              y -= 12
            }
          } catch {
            // Ignore parsing errors
          }
        }
      }
    }

    // Footer on last page
    page.drawText("Generated by RiskShield AI - Insurance Compliance Platform", {
      x: 50,
      y: 30,
      size: 8,
      font: helvetica,
      color: rgb(0.6, 0.6, 0.6)
    })

    page.drawText(`Exception ID: ${exception.id}`, {
      x: 400,
      y: 30,
      size: 8,
      font: helvetica,
      color: rgb(0.6, 0.6, 0.6)
    })

    // Serialize PDF
    const pdfBytes = await pdfDoc.save()

    // Create safe filename
    const safeIssueSummary = exception.issue_summary.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30)

    // Return PDF
    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Exception_Audit_Trail_${safeIssueSummary}.pdf"`,
        'Content-Length': pdfBytes.length.toString()
      }
    })
  } catch (error) {
    console.error("Error generating audit trail:", error)
    return NextResponse.json({ error: "Failed to generate audit trail" }, { status: 500 })
  }
}

// Helper function to wrap text
function wrapText(text: string, font: any, fontSize: number, maxWidth: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let currentLine = ''

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word
    const width = font.widthOfTextAtSize(testLine, fontSize)

    if (width > maxWidth && currentLine) {
      lines.push(currentLine)
      currentLine = word
    } else {
      currentLine = testLine
    }
  }

  if (currentLine) {
    lines.push(currentLine)
  }

  return lines
}
