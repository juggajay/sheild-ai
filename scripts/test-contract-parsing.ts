/**
 * Test script for Gemini-powered contract parsing
 * Creates a sample construction contract PDF and tests extraction
 */

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import fs from 'fs'
import path from 'path'

// Import the extraction function directly for testing
import { extractContractRequirements } from '../lib/gemini'

async function createTestContractPDF(): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  // Page 1 - Title and Overview
  const page1 = pdfDoc.addPage([595, 842]) // A4
  let y = 800

  page1.drawText('SUBCONTRACT AGREEMENT', {
    x: 180, y, size: 18, font: boldFont, color: rgb(0, 0, 0)
  })

  y -= 40
  page1.drawText('AS4000-1997 General Conditions of Contract', {
    x: 170, y, size: 12, font, color: rgb(0.3, 0.3, 0.3)
  })

  y -= 60
  page1.drawText('PROJECT:', { x: 50, y, size: 12, font: boldFont })
  page1.drawText('Sydney Metro West Station Development', { x: 120, y, size: 12, font })

  y -= 25
  page1.drawText('CONTRACT VALUE:', { x: 50, y, size: 12, font: boldFont })
  page1.drawText('$45,000,000 (Forty-Five Million Dollars)', { x: 170, y, size: 12, font })

  y -= 25
  page1.drawText('PRINCIPAL:', { x: 50, y, size: 12, font: boldFont })
  page1.drawText('Transport for NSW', { x: 130, y, size: 12, font })

  y -= 25
  page1.drawText('HEAD CONTRACTOR:', { x: 50, y, size: 12, font: boldFont })
  page1.drawText('BuildCorp Construction Pty Ltd', { x: 180, y, size: 12, font })

  y -= 60
  page1.drawText('SECTION 15 - INSURANCE REQUIREMENTS', {
    x: 50, y, size: 14, font: boldFont, color: rgb(0, 0, 0.5)
  })

  y -= 35
  page1.drawText('15.1 Public Liability Insurance', { x: 50, y, size: 12, font: boldFont })
  y -= 20
  const pl_text = [
    'The Subcontractor shall effect and maintain Public Liability insurance for an amount',
    'of not less than TWENTY MILLION DOLLARS ($20,000,000) per occurrence and in',
    'the aggregate, with a maximum deductible of TEN THOUSAND DOLLARS ($10,000).',
    'The policy must include:',
    '  (a) Principal Indemnity Extension naming the Principal as an insured party',
    '  (b) Cross Liability clause',
    '  (c) Waiver of Subrogation in favour of the Principal'
  ]
  for (const line of pl_text) {
    page1.drawText(line, { x: 50, y, size: 10, font })
    y -= 15
  }

  y -= 20
  page1.drawText('15.2 Products Liability Insurance', { x: 50, y, size: 12, font: boldFont })
  y -= 20
  const prod_text = [
    'Products Liability insurance of not less than TWENTY MILLION DOLLARS',
    '($20,000,000) in the aggregate for any one period of insurance.',
    'Maximum excess: $10,000. Principal Indemnity extension required.'
  ]
  for (const line of prod_text) {
    page1.drawText(line, { x: 50, y, size: 10, font })
    y -= 15
  }

  y -= 20
  page1.drawText('15.3 Workers Compensation Insurance', { x: 50, y, size: 12, font: boldFont })
  y -= 20
  const wc_text = [
    'The Subcontractor shall maintain Workers Compensation insurance as required by',
    'the Workers Compensation Act 1987 (NSW) with a limit of not less than FIFTY',
    'MILLION DOLLARS ($50,000,000). Common Law extension required.',
    'Employer Indemnity insurance must be current for the duration of the works.'
  ]
  for (const line of wc_text) {
    page1.drawText(line, { x: 50, y, size: 10, font })
    y -= 15
  }

  y -= 20
  page1.drawText('15.4 Professional Indemnity Insurance', { x: 50, y, size: 12, font: boldFont })
  y -= 20
  const pi_text = [
    'Where the Subcontractor provides design services, Professional Indemnity',
    'insurance of not less than TEN MILLION DOLLARS ($10,000,000) per claim',
    'and in the aggregate shall be maintained. Maximum deductible: $25,000.',
    'Coverage to be maintained for 7 years after practical completion.'
  ]
  for (const line of pi_text) {
    page1.drawText(line, { x: 50, y, size: 10, font })
    y -= 15
  }

  // Page 2 - More insurance requirements
  const page2 = pdfDoc.addPage([595, 842])
  y = 800

  page2.drawText('15.5 Motor Vehicle Insurance', { x: 50, y, size: 12, font: boldFont })
  y -= 20
  const mv_text = [
    'Comprehensive Motor Vehicle insurance covering all vehicles used in connection',
    'with the Works for an amount of not less than FIVE MILLION DOLLARS ($5,000,000)',
    'per occurrence. Maximum excess: $2,000.'
  ]
  for (const line of mv_text) {
    page2.drawText(line, { x: 50, y, size: 10, font })
    y -= 15
  }

  y -= 20
  page2.drawText('15.6 Contract Works Insurance', { x: 50, y, size: 12, font: boldFont })
  y -= 20
  const cw_text = [
    'Contract Works (Construction All Risks) insurance for the full replacement value',
    'of the Works including materials on and off site, being not less than FIFTY',
    'MILLION DOLLARS ($50,000,000). Maximum deductible: $50,000.',
    'Waiver of Subrogation clause required in favour of the Principal.'
  ]
  for (const line of cw_text) {
    page2.drawText(line, { x: 50, y, size: 10, font })
    y -= 15
  }

  y -= 30
  page2.drawText('15.7 Evidence of Insurance', { x: 50, y, size: 12, font: boldFont })
  y -= 20
  const evidence_text = [
    'Prior to commencing work on site, the Subcontractor shall provide the Head',
    'Contractor with Certificates of Currency for all insurances required under',
    'this clause. Certificates must be issued by APRA-licensed insurers only.',
    'Failure to maintain required insurances is grounds for immediate termination.'
  ]
  for (const line of evidence_text) {
    page2.drawText(line, { x: 50, y, size: 10, font })
    y -= 15
  }

  y -= 40
  page2.drawText('SCHEDULE B - INSURANCE SUMMARY', {
    x: 50, y, size: 14, font: boldFont, color: rgb(0, 0, 0.5)
  })

  y -= 30
  // Table header
  page2.drawText('Coverage Type', { x: 50, y, size: 10, font: boldFont })
  page2.drawText('Minimum Limit', { x: 200, y, size: 10, font: boldFont })
  page2.drawText('Max Excess', { x: 320, y, size: 10, font: boldFont })
  page2.drawText('Extensions', { x: 420, y, size: 10, font: boldFont })

  y -= 5
  page2.drawLine({ start: { x: 50, y }, end: { x: 550, y }, thickness: 1 })

  const tableData = [
    ['Public Liability', '$20,000,000', '$10,000', 'PI, CL, WoS'],
    ['Products Liability', '$20,000,000', '$10,000', 'PI'],
    ['Workers Compensation', '$50,000,000', 'Statutory', 'EI'],
    ['Professional Indemnity', '$10,000,000', '$25,000', '-'],
    ['Motor Vehicle', '$5,000,000', '$2,000', '-'],
    ['Contract Works', '$50,000,000', '$50,000', 'WoS'],
  ]

  for (const row of tableData) {
    y -= 18
    page2.drawText(row[0], { x: 50, y, size: 9, font })
    page2.drawText(row[1], { x: 200, y, size: 9, font })
    page2.drawText(row[2], { x: 320, y, size: 9, font })
    page2.drawText(row[3], { x: 420, y, size: 9, font })
  }

  y -= 30
  page2.drawText('Legend: PI = Principal Indemnity, CL = Cross Liability, WoS = Waiver of Subrogation, EI = Employer Indemnity', {
    x: 50, y, size: 8, font, color: rgb(0.4, 0.4, 0.4)
  })

  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}

async function main() {
  console.log('========================================')
  console.log('CONTRACT PARSING TEST - GEMINI AI')
  console.log('========================================\n')

  // Check for API key
  if (!process.env.GOOGLE_AI_API_KEY) {
    console.error('ERROR: GOOGLE_AI_API_KEY environment variable not set')
    console.log('Please set it in your .env file')
    process.exit(1)
  }

  // Create test contract PDF
  console.log('1. Creating test construction contract PDF...')
  const pdfBuffer = await createTestContractPDF()

  // Save for inspection
  const testDir = path.join(process.cwd(), 'test-files')
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true })
  }
  const testFilePath = path.join(testDir, 'test_construction_contract.pdf')
  fs.writeFileSync(testFilePath, pdfBuffer)
  console.log(`   Saved to: ${testFilePath}`)
  console.log(`   Size: ${(pdfBuffer.length / 1024).toFixed(1)} KB\n`)

  // Test extraction
  console.log('2. Extracting requirements with Gemini AI...')
  const startTime = Date.now()

  const result = await extractContractRequirements(
    pdfBuffer,
    'application/pdf',
    'test_construction_contract.pdf'
  )

  const duration = Date.now() - startTime
  console.log(`   Extraction completed in ${duration}ms\n`)

  // Display results
  console.log('========================================')
  console.log('EXTRACTION RESULTS')
  console.log('========================================\n')

  console.log(`Success: ${result.success}`)
  console.log(`Confidence: ${(result.confidence_score * 100).toFixed(1)}%`)
  console.log(`Contract Type: ${result.contract_type || 'Not detected'}`)
  console.log(`Estimated Value: ${result.estimated_value ? `$${result.estimated_value.toLocaleString()}` : 'Not detected'}`)
  console.log(`Model: ${result.extractionModel}`)

  if (result.warnings.length > 0) {
    console.log(`\nWarnings:`)
    result.warnings.forEach(w => console.log(`  - ${w}`))
  }

  if (result.error) {
    console.log(`\nError: ${result.error.code} - ${result.error.message}`)
  }

  console.log('\n----------------------------------------')
  console.log('EXTRACTED REQUIREMENTS')
  console.log('----------------------------------------\n')

  if (result.requirements.length === 0) {
    console.log('No requirements extracted.')
  } else {
    for (const req of result.requirements) {
      console.log(`${req.coverage_type.toUpperCase().replace(/_/g, ' ')}:`)
      console.log(`  Minimum Limit: ${req.minimum_limit ? `$${req.minimum_limit.toLocaleString()}` : 'Not specified'}`)
      console.log(`  Maximum Excess: ${req.maximum_excess ? `$${req.maximum_excess.toLocaleString()}` : 'Not specified'}`)
      console.log(`  Principal Indemnity: ${req.principal_indemnity_required ? 'Required' : 'Not required'}`)
      console.log(`  Cross Liability: ${req.cross_liability_required ? 'Required' : 'Not required'}`)
      console.log(`  Waiver of Subrogation: ${req.waiver_of_subrogation_required ? 'Required' : 'Not required'}`)
      if (req.notes) console.log(`  Notes: ${req.notes}`)
      console.log('')
    }
  }

  console.log('----------------------------------------')
  console.log('EXTRACTED CLAUSES')
  console.log('----------------------------------------\n')

  if (result.extracted_clauses.length === 0) {
    console.log('No clauses extracted.')
  } else {
    for (const clause of result.extracted_clauses) {
      console.log(`[${clause.clause_number || 'N/A'}] ${clause.clause_title}`)
      console.log(`  Related to: ${clause.related_coverage || 'General'}`)
      console.log(`  Text: ${clause.clause_text.substring(0, 100)}...`)
      console.log('')
    }
  }

  // Summary
  console.log('========================================')
  console.log('TEST SUMMARY')
  console.log('========================================\n')

  const expected = {
    public_liability: { limit: 20000000, excess: 10000, pi: true, cl: true, wos: true },
    products_liability: { limit: 20000000, excess: 10000, pi: true, cl: false, wos: false },
    workers_comp: { limit: 50000000, excess: null, pi: false, cl: false, wos: false },
    professional_indemnity: { limit: 10000000, excess: 25000, pi: false, cl: false, wos: false },
    motor_vehicle: { limit: 5000000, excess: 2000, pi: false, cl: false, wos: false },
    contract_works: { limit: 50000000, excess: 50000, pi: false, cl: false, wos: true },
  }

  let correct = 0
  let total = Object.keys(expected).length

  for (const [type, exp] of Object.entries(expected)) {
    const found = result.requirements.find(r => r.coverage_type === type)
    if (found) {
      const limitMatch = found.minimum_limit === exp.limit
      const excessMatch = found.maximum_excess === exp.excess
      if (limitMatch && excessMatch) {
        correct++
        console.log(`✓ ${type}: Correct`)
      } else {
        console.log(`✗ ${type}: Limit ${found.minimum_limit} (expected ${exp.limit}), Excess ${found.maximum_excess} (expected ${exp.excess})`)
      }
    } else {
      console.log(`✗ ${type}: Not found`)
    }
  }

  console.log(`\nAccuracy: ${correct}/${total} coverage types correctly extracted (${((correct/total)*100).toFixed(0)}%)`)
  console.log(`Total extraction time: ${duration}ms`)
}

main().catch(console.error)
