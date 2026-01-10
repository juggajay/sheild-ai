import { NextRequest, NextResponse } from "next/server"
import { getConvex, api } from '@/lib/convex'
import type { Id } from '@/convex/_generated/dataModel'

// GET /api/projects/[id]/report - Generate PDF compliance report
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.cookies.get("auth_token")?.value
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const convex = getConvex()

    // Get user session
    const sessionData = await convex.query(api.auth.getUserWithSession, { token })
    if (!sessionData) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    }

    const user = sessionData.user
    if (!user.companyId) {
      return NextResponse.json({ error: 'User has no company' }, { status: 400 })
    }

    const { id: projectId } = await params

    // Get report data from Convex
    const reportData = await convex.query(api.projects.getReportData, {
      projectId: projectId as Id<"projects">,
      companyId: user.companyId,
    })

    if (!reportData) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    const { project, requirements, subcontractors } = reportData

    // Dynamic import pdf-lib to reduce bundle size (~200KB)
    const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')

    // Generate PDF
    const pdfDoc = await PDFDocument.create()
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    // First page - Project Overview
    let page = pdfDoc.addPage([595.28, 841.89]) // A4 size
    const { width, height } = page.getSize()
    let y = height - 50

    // Header
    page.drawText("COMPLIANCE REPORT", {
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

    // Project Info Section
    page.drawText("PROJECT INFORMATION", {
      x: 50,
      y,
      size: 14,
      font: helveticaBold,
      color: rgb(0.2, 0.2, 0.2)
    })
    y -= 25

    const formatDate = (timestamp: number | null | undefined) => {
      if (!timestamp) return 'Not set'
      return new Date(timestamp).toLocaleDateString('en-AU')
    }

    const projectInfo = [
      ["Project Name:", project.name],
      ["Company:", project.company_name],
      ["Address:", project.address ? `${project.address}${project.state ? `, ${project.state}` : ''}` : 'Not specified'],
      ["Status:", project.status.charAt(0).toUpperCase() + project.status.slice(1).replace('_', ' ')],
      ["Start Date:", formatDate(project.start_date)],
      ["End Date:", formatDate(project.end_date)],
      ["Estimated Value:", project.estimated_value ? `$${project.estimated_value.toLocaleString()}` : 'Not specified']
    ]

    for (const [label, value] of projectInfo) {
      page.drawText(label, { x: 50, y, size: 10, font: helveticaBold, color: rgb(0.3, 0.3, 0.3) })
      page.drawText(value, { x: 180, y, size: 10, font: helvetica, color: rgb(0.1, 0.1, 0.1) })
      y -= 18
    }
    y -= 20

    // Insurance Requirements Section
    page.drawText("INSURANCE REQUIREMENTS", {
      x: 50,
      y,
      size: 14,
      font: helveticaBold,
      color: rgb(0.2, 0.2, 0.2)
    })
    y -= 25

    if (requirements.length === 0) {
      page.drawText("No insurance requirements specified", {
        x: 50,
        y,
        size: 10,
        font: helvetica,
        color: rgb(0.5, 0.5, 0.5)
      })
      y -= 18
    } else {
      // Table header
      page.drawText("Coverage Type", { x: 50, y, size: 9, font: helveticaBold, color: rgb(0.3, 0.3, 0.3) })
      page.drawText("Minimum Limit", { x: 200, y, size: 9, font: helveticaBold, color: rgb(0.3, 0.3, 0.3) })
      page.drawText("Maximum Excess", { x: 320, y, size: 9, font: helveticaBold, color: rgb(0.3, 0.3, 0.3) })
      y -= 15

      // Draw line
      page.drawLine({ start: { x: 50, y: y + 5 }, end: { x: 500, y: y + 5 }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) })

      for (const req of requirements) {
        const coverageLabel = req.coverage_type
          .split('_')
          .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ')

        page.drawText(coverageLabel, { x: 50, y, size: 9, font: helvetica, color: rgb(0.2, 0.2, 0.2) })
        page.drawText(req.minimum_limit ? `$${req.minimum_limit.toLocaleString()}` : '-', { x: 200, y, size: 9, font: helvetica, color: rgb(0.2, 0.2, 0.2) })
        page.drawText(req.maximum_excess ? `$${req.maximum_excess.toLocaleString()}` : '-', { x: 320, y, size: 9, font: helvetica, color: rgb(0.2, 0.2, 0.2) })
        y -= 15
      }
    }
    y -= 30

    // Compliance Summary
    const compliant = subcontractors.filter((s: any) => s.status === 'compliant').length
    const nonCompliant = subcontractors.filter((s: any) => s.status === 'non_compliant').length
    const pending = subcontractors.filter((s: any) => s.status === 'pending').length
    const withException = subcontractors.filter((s: any) => s.status === 'exception').length

    page.drawText("COMPLIANCE SUMMARY", {
      x: 50,
      y,
      size: 14,
      font: helveticaBold,
      color: rgb(0.2, 0.2, 0.2)
    })
    y -= 25

    const complianceRate = subcontractors.length > 0
      ? Math.round((compliant / subcontractors.length) * 100)
      : 0

    page.drawText(`Overall Compliance Rate: ${complianceRate}%`, {
      x: 50,
      y,
      size: 12,
      font: helveticaBold,
      color: complianceRate >= 80 ? rgb(0.1, 0.6, 0.1) : complianceRate >= 50 ? rgb(0.8, 0.6, 0) : rgb(0.8, 0.1, 0.1)
    })
    y -= 25

    const summaryStats = [
      [`Total Subcontractors: ${subcontractors.length}`, rgb(0.2, 0.2, 0.2)],
      [`Compliant: ${compliant}`, rgb(0.1, 0.6, 0.1)],
      [`Non-Compliant: ${nonCompliant}`, rgb(0.8, 0.1, 0.1)],
      [`Pending Review: ${pending}`, rgb(0.8, 0.6, 0)],
      [`With Exception: ${withException}`, rgb(0.5, 0.5, 0.5)]
    ] as const

    for (const [text, color] of summaryStats) {
      page.drawText(text, { x: 50, y, size: 10, font: helvetica, color })
      y -= 16
    }

    // Subcontractor Details Section (new page if needed)
    if (y < 300 && subcontractors.length > 0) {
      page = pdfDoc.addPage([595.28, 841.89])
      y = height - 50
    } else {
      y -= 30
    }

    page.drawText("SUBCONTRACTOR COMPLIANCE DETAILS", {
      x: 50,
      y,
      size: 14,
      font: helveticaBold,
      color: rgb(0.2, 0.2, 0.2)
    })
    y -= 25

    if (subcontractors.length === 0) {
      page.drawText("No subcontractors assigned to this project", {
        x: 50,
        y,
        size: 10,
        font: helvetica,
        color: rgb(0.5, 0.5, 0.5)
      })
    } else {
      // Table header
      page.drawText("Subcontractor", { x: 50, y, size: 9, font: helveticaBold, color: rgb(0.3, 0.3, 0.3) })
      page.drawText("ABN", { x: 200, y, size: 9, font: helveticaBold, color: rgb(0.3, 0.3, 0.3) })
      page.drawText("Trade", { x: 300, y, size: 9, font: helveticaBold, color: rgb(0.3, 0.3, 0.3) })
      page.drawText("Status", { x: 400, y, size: 9, font: helveticaBold, color: rgb(0.3, 0.3, 0.3) })
      page.drawText("Issues", { x: 480, y, size: 9, font: helveticaBold, color: rgb(0.3, 0.3, 0.3) })
      y -= 15

      // Draw line
      page.drawLine({ start: { x: 50, y: y + 5 }, end: { x: 545, y: y + 5 }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) })

      for (const sub of subcontractors) {
        // Check if we need a new page
        if (y < 50) {
          page = pdfDoc.addPage([595.28, 841.89])
          y = height - 50
        }

        const statusColor = sub.status === 'compliant' ? rgb(0.1, 0.6, 0.1)
          : sub.status === 'non_compliant' ? rgb(0.8, 0.1, 0.1)
          : sub.status === 'exception' ? rgb(0.5, 0.5, 0.5)
          : rgb(0.8, 0.6, 0)

        const statusLabel = sub.status.charAt(0).toUpperCase() + sub.status.slice(1).replace('_', ' ')

        // Truncate long names
        const truncatedName = sub.name.length > 25 ? sub.name.substring(0, 22) + '...' : sub.name
        const truncatedTrade = (sub.trade || '-').length > 15 ? (sub.trade || '').substring(0, 12) + '...' : (sub.trade || '-')

        page.drawText(truncatedName, { x: 50, y, size: 8, font: helvetica, color: rgb(0.2, 0.2, 0.2) })
        page.drawText(sub.abn, { x: 200, y, size: 8, font: helvetica, color: rgb(0.2, 0.2, 0.2) })
        page.drawText(truncatedTrade, { x: 300, y, size: 8, font: helvetica, color: rgb(0.2, 0.2, 0.2) })
        page.drawText(statusLabel, { x: 400, y, size: 8, font: helveticaBold, color: statusColor })
        page.drawText(sub.deficiency_count > 0 ? sub.deficiency_count.toString() : '-', {
          x: 490,
          y,
          size: 8,
          font: helvetica,
          color: sub.deficiency_count > 0 ? rgb(0.8, 0.1, 0.1) : rgb(0.5, 0.5, 0.5)
        })
        y -= 14
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

    // Serialize PDF
    const pdfBytes = await pdfDoc.save()

    // Return PDF
    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${project.name.replace(/[^a-zA-Z0-9]/g, '_')}_Compliance_Report.pdf"`,
        'Content-Length': pdfBytes.length.toString()
      }
    })
  } catch (error) {
    console.error("Error generating report:", error)
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 })
  }
}
