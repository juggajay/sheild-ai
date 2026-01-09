# RiskShield AI - Comprehensive Product Report
## Insurance Compliance Verification Platform for Australian Construction

**Generated:** January 2026
**Version:** Production-Ready
**Target Market:** Australian Head Contractors, Builders, Construction Companies

---

## EXECUTIVE SUMMARY

RiskShield AI is an enterprise-grade insurance compliance verification platform that uses AI to automatically verify Certificates of Currency (COC) for subcontractors in the Australian construction industry. The platform eliminates the manual review of insurance documents, detects compliance gaps instantly, and provides a complete audit trail for regulatory compliance.

### The Problem We Solve

> "A Certificate of Currency is not enough."

Australian head contractors face significant legal and financial exposure when subcontractors work on-site without proper insurance coverage. Current manual processes:

- Miss critical exclusions buried in 40-page Policy Disclosure Statements
- Fail to verify Principal Indemnity and Cross-Liability clauses
- Cannot detect unpaid WorkCover premiums (creating "Deemed Employer" liability)
- Lack audit trails required for Industrial Manslaughter defense

### Our Solution

RiskShield AI reads the fine print your team misses. We detect:
- Missing **Principal Indemnity** clauses
- **Worker-to-Worker** exclusions
- Unpaid **WorkCover** premiums
- **APRA** unlicensed insurers
- Coverage **gaps and deficiencies** instantly

---

## PLATFORM ARCHITECTURE

### Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14 (App Router), React, TypeScript |
| Styling | Tailwind CSS, shadcn/ui components |
| Database | Supabase (PostgreSQL) - Production |
| Database | SQLite - Development |
| Realtime | Convex |
| AI/ML | OpenAI GPT-4 Vision |
| Email | Resend |
| SMS | Twilio |
| Payments | Stripe |
| Auth | JWT + Magic Links |
| Storage | Supabase Storage |

### Database Schema (21 Tables)

```
Core Entities:
├── companies          - Tenant organizations (builders)
├── users              - Team members with RBAC
├── projects           - Construction projects
├── subcontractors     - Contractor registry
├── project_subcontractors - Project-contractor assignments
├── insurance_requirements - Per-project coverage mandates
├── coc_documents      - Uploaded certificates
├── verifications      - AI verification results
├── exceptions         - Compliance waivers
├── communications     - Email/SMS tracking
├── notifications      - In-app alerts
├── audit_logs         - Complete audit trail
└── billing_events     - Stripe webhook events
```

---

## CORE FEATURES

### 1. AI-Powered Document Verification

**What It Does:**
Automatically extracts and verifies insurance certificate data using GPT-4 Vision.

**Extracted Fields:**
- Insured party name, ABN, address
- Insurer name & ABN
- Policy number, start/end dates
- Coverage types (6 types supported)
- Coverage limits and excesses
- Endorsements (PI, Cross-Liability, Waiver)
- Broker details

**Verification Checks Performed:**

| Check | Severity | Description |
|-------|----------|-------------|
| Policy Expiry | Critical | Certificate has not expired |
| Project Coverage | Critical | Policy covers entire project period |
| ABN Verification | Critical | Certificate ABN matches subcontractor ABN |
| APRA Validation | Critical | Insurer is licensed in Australia |
| Coverage Limits | Major | Meets minimum required limits |
| Excess Limits | Minor | Within maximum allowed deductible |
| Principal Indemnity | Major | Extension is present if required |
| Cross Liability | Major | Extension is present if required |
| Waiver of Subrogation | Major | Extension is present if required |
| Principal Naming | Major | Correct naming type (Principal vs Interested Party) |
| Workers Comp State | Critical | Scheme covers project state (NSW/VIC/QLD) |
| Confidence Score | Review | AI extraction confidence > 70% |

**Verification Statuses:**
- **PASS** - All checks passed, auto-approved
- **FAIL** - Critical issues found, auto-rejected
- **REVIEW** - Warnings present, requires manual review

### 2. Fraud Detection System

**Multi-Layer Analysis:**

| Check | Risk Score | Description |
|-------|------------|-------------|
| Insurer Template | 0-65 | Policy number format validation |
| Document Metadata | 0-60 | Modification date analysis |
| Creation Software | 0-70 | Suspicious editor detection |
| ABN Checksum | 0-80 | Australian Business Number validation |
| Policy Date Logic | 0-90 | Start/end date validity |
| Coverage Amounts | 0-70 | Reasonable limit validation |
| Duplicate Detection | 0-95 | Same policy with different expiry dates |

**Blocked Software (Indicates Tampering):**
- Adobe Photoshop, GIMP, Paint.NET
- Foxit PhantomPDF, PDFelement, Nitro Pro
- iLovePDF, SmallPDF, PDF Escape

**Risk Levels:**
- **CRITICAL** (80+): Document blocked, investigation required
- **HIGH** (60-79): Manual verification recommended
- **MEDIUM** (40-59): Caution advised
- **LOW** (0-39): Document appears authentic

### 3. APRA Licensed Insurer Database

Validates against 18+ registered Australian insurers:
- QBE Insurance (Australia) Limited
- Allianz Australia Insurance Limited
- Suncorp Group Limited
- CGU Insurance Limited
- Zurich Australian Insurance Limited
- AIG Australia Limited
- Vero Insurance
- GIO General Limited
- And more international underwriters

### 4. Morning Brief Dashboard

**Real-Time Compliance Overview:**
- Compliance rate gauge (color-coded)
- Active projects counter
- Pending reviews counter
- Stop work risks (critical alerts)

**Stop Work Risks Section:**
Lists subcontractors on-site TODAY with compliance issues:
- Subcontractor name and project
- Status badge (Non-Compliant / Pending)
- Direct link to create exception

**New COCs (Last 24 Hours):**
- Auto-approved count
- Needs review count
- Processing status

**Pending Responses:**
- Brokers who haven't responded to deficiency notices
- Days waiting indicator (escalating urgency)
- One-click resend follow-up

### 5. Automated Communications

**Email Types:**
| Type | Trigger | Content |
|------|---------|---------|
| Deficiency Notice | Verification fails | Specific issues with required vs actual values |
| Follow-up 1 | 3 days no response | Reminder with original issues |
| Follow-up 2 | 5 days no response | Escalated reminder |
| Follow-up 3 | 7 days no response | Urgent final notice |
| Confirmation | Verification passes | Compliance confirmed |
| Expiration Reminder | 30 days before expiry | Certificate renewal needed |

**Tracking:**
- Pending → Sent → Delivered → Opened
- Full audit trail of all communications

### 6. Exception Management

**Exception Types:**
- **Until Resolved** - Active until compliant COC uploaded
- **Fixed Duration** - X days from creation
- **Specific Date** - Expires on chosen date
- **Permanent** - Requires password confirmation

**Risk Levels:** Low, Medium, High

**Workflow:**
1. Exception created (pending approval)
2. Admin/Risk Manager reviews
3. Approved → Subcontractor marked compliant with exception
4. System monitors expiration
5. Auto-expires and reverts status when due

### 7. Subcontractor Portal (Passwordless)

**Magic Link Authentication:**
- No passwords to manage
- 15-minute token expiry
- One-time use tokens
- 24-hour sessions

**Portal Features:**
- View all builder relationships
- See compliance status per project
- Upload certificates directly
- Instant AI verification feedback
- View deficiencies and required actions

### 8. Broker Portal

**For Insurance Brokers:**
- View all client subcontractors
- Monitor compliance across builders
- Bulk upload certificates
- Client contact management
- One-click upload for specific projects

### 9. Project Management

**Project Configuration:**
- Name, address, Australian state
- Start/end dates, estimated value
- Assigned project manager
- Forwarding email for auto-ingestion

**Insurance Requirements:**
- Public Liability (per occurrence)
- Products Liability (aggregate)
- Workers Compensation (state-specific)
- Professional Indemnity (per claim)
- Motor Vehicle (per occurrence)
- Contract Works (per project)

**Per Coverage Type:**
- Minimum limit required
- Maximum excess allowed
- Principal indemnity required (yes/no)
- Cross liability required (yes/no)
- Waiver of subrogation required (yes/no)
- Principal naming type (Principal Named / Interested Party)

### 10. Expiration Calendar

**Visual Calendar View:**
- Monthly navigation
- Color-coded by urgency:
  - Red: Expired
  - Amber: Expiring within 14 days
  - Green: Valid

**Bulk Actions:**
- Send expiration reminders to multiple subcontractors
- Track reminder delivery status

---

## USER ROLES & PERMISSIONS

| Role | Access Level |
|------|--------------|
| **Admin** | Full access: billing, users, audit logs, integrations |
| **Risk Manager** | All compliance features, approve exceptions |
| **Project Manager** | Assigned projects only, create exceptions |
| **Project Administrator** | Limited project access |
| **Read Only** | View-only access |
| **Subcontractor** | Portal only - upload certificates |
| **Broker** | Portal only - manage client compliance |

---

## INTEGRATIONS

### Email (Resend)
- Deficiency notifications
- Follow-up reminders
- Compliance confirmations
- Password resets
- Portal invitations

### SMS (Twilio)
- Critical alerts
- Stop work notifications
- Expiration warnings

### Storage (Supabase)
- Certificate document storage
- 10MB file size limit
- PDF, JPG, PNG support

### Payments (Stripe)
- Subscription management
- Per-vendor billing
- Customer portal
- Webhook events

### OAuth (Microsoft 365 / Google)
- Email inbox integration
- Auto-ingestion of certificates from email

---

## PRICING MODEL

| Plan | Price | Vendors | Projects |
|------|-------|---------|----------|
| **Trial** | Free (14 days) | 5 | 3 |
| **Starter** | $349/year | 25 | 10 |
| **Professional** | $999/year | 100 | Unlimited |
| **Enterprise** | $1,999/year | Unlimited | Unlimited |

**Per-Vendor Fees:**
- Starter: $19/vendor/year
- Professional: $24/vendor/year
- Enterprise: $29/vendor/year

**Subcontractors:** FREE (invited by builders)

---

## API COVERAGE

**75+ API Endpoints across 14 categories:**

| Category | Endpoints | Key Functions |
|----------|-----------|---------------|
| Authentication | 8 | Login, signup, password reset, magic links |
| Users | 3 | Team management, invitations |
| Projects | 8 | CRUD, requirements, subcontractor assignment |
| Subcontractors | 6 | Registry, import/export, portal access |
| Documents | 7 | Upload, verify, download, process |
| Exceptions | 4 | Create, approve, expire, resolve |
| Alerts | 6 | Critical alerts, notifications |
| Communications | 3 | Email tracking, follow-ups |
| Templates | 3 | Customizable email templates |
| Dashboards | 3 | Morning brief, expirations, history |
| Audit | 2 | Complete activity logging |
| Integrations | 8 | Microsoft, Google, SendGrid, Twilio |
| Billing | 4 | Stripe checkout, portal, webhooks |
| Portal | 7 | Subcontractor/broker authentication |

---

## SECURITY FEATURES

### Authentication
- JWT tokens with 8-hour expiry (main app)
- Magic links with 15-minute expiry (portals)
- Role-based access control on every endpoint
- Password strength requirements
- Rate limiting on auth endpoints

### Data Protection
- All API keys server-side only
- httpOnly, secure cookies
- CSRF protection via state tokens
- HTML escaping in email templates
- Audit logging of all actions

### Compliance
- Complete audit trail for legal defense
- Immutable verification records
- Timestamp tracking on all changes
- User attribution on every action

---

## KEY DIFFERENTIATORS

### vs Manual Review
| Manual | RiskShield AI |
|--------|---------------|
| 15-30 min per certificate | < 30 seconds |
| Human error risk | Consistent AI analysis |
| No fraud detection | Multi-layer fraud analysis |
| Paper trail gaps | Complete audit trail |

### vs Competitors
1. **Australian-Specific**: Built for AU insurance requirements
2. **APRA Validation**: Verifies insurer licensing
3. **State-Specific Workers Comp**: NSW, VIC, QLD scheme validation
4. **Principal Naming Hierarchy**: Distinguishes Principal Named vs Interested Party
5. **Fraud Detection**: Document manipulation detection
6. **Passwordless Portals**: Frictionless subcontractor onboarding

---

## COMPLIANCE & LEGAL VALUE

### Industrial Manslaughter Defense
- Demonstrates proactive Duty of Care
- Complete audit trail of verification
- Documented exception approvals
- Communication history with timestamps

### Deemed Employer Protection
- Workers Comp state verification
- Coverage limit validation
- Subcontractor compliance tracking

### Regulatory Compliance
- AS 4000 standard alignment
- State-specific requirements (NSW, VIC, QLD)
- APRA insurer validation

---

## IMPLEMENTATION TIMELINE

### Phase 1: Setup (Day 1)
- Account creation
- Company profile configuration
- Insurance requirement templates

### Phase 2: Data Import (Day 1-2)
- Subcontractor CSV import
- Project creation
- Email forwarding setup

### Phase 3: Go Live (Day 2-3)
- Portal invitations to subcontractors
- Document upload training
- Team onboarding

### Phase 4: Automation (Week 2+)
- Email integration (optional)
- Automated follow-up configuration
- Exception workflow setup

---

## SUCCESS METRICS

| Metric | Measurement |
|--------|-------------|
| Verification Time | < 30 seconds per document |
| Auto-Approval Rate | 60-70% of compliant certificates |
| Compliance Rate | Real-time tracking with trend charts |
| Response Time | Days waiting for broker response |
| Exception Coverage | % of non-compliant with active waivers |

---

## TECHNICAL REQUIREMENTS

### Supported Browsers
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

### File Formats
- PDF (recommended)
- JPG, PNG (images)
- Max 10MB per file

### Integrations Required
- Supabase account
- Resend account (for email)
- Stripe account (for billing)

### Optional Integrations
- Twilio (SMS alerts)
- Microsoft 365 (email ingestion)
- Google Workspace (email ingestion)

---

## CONTACT & SUPPORT

**Product:** RiskShield AI
**Target Market:** Australian Construction Industry
**Primary Users:** Head Contractors, Builders, Risk Managers
**Secondary Users:** Subcontractors, Insurance Brokers

---

*This report was generated from direct code analysis of the RiskShield AI platform.*
