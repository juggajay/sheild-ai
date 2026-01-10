# RiskShield AI - Product Features

## Overview
Autonomous Certificate of Currency (COC) compliance platform for Australian construction.

---

## Core Features

### Document Management
- Upload COC documents (PDF support)
- AI-powered document reading using Google Gemini 2.0 Flash
- OCR fallback with Tesseract.js for handwritten documents
- Automatic data extraction (coverage amounts, policy numbers, expiry dates)
- Secure document storage with encryption
- Document download with access controls

### AI Verification
- Automated COC verification against project requirements
- Coverage amount validation ($10M-$20M public liability standard)
- Expiry date checking
- Policy holder matching
- Confidence scoring with human review flags for edge cases
- Fraud detection algorithms

### Compliance Dashboard
- Portfolio-wide compliance rate visualization
- Compliance trend charts (7/30/90 day views)
- Stop-work risk alerts
- Pending review queue
- Real-time polling (30-second auto-refresh)
- Morning brief with daily summary

### Project Management
- Create and manage construction projects
- Configure insurance requirements per project
- Assign subcontractors to projects
- Project-level compliance tracking
- Contract parsing for requirement extraction

### Subcontractor Management
- Subcontractor registry with contact info
- Compliance status tracking per project
- Historical document tracking
- ABN/ACN validation
- On-site date tracking

### Automated Communications
- Deficiency notifications to brokers via Resend
- SMS notifications via Twilio
- Follow-up sequence automation
- Re-send functionality for failed communications
- Communication history tracking
- Customizable email templates

### Exception Management
- Exception approval workflow
- Reason documentation
- Audit trail per exception
- Exception expiry tracking

### Expiration Monitoring
- Insurance renewal tracking
- Expiry alerts and warnings
- Proactive notification system

---

## Portals

### Subcontractor Portal
- Self-service COC upload
- Instant verification feedback
- Portfolio view (multi-builder compliance)
- Simple interface (no account required)

### Broker Portal
- Bulk COC upload capability
- Client management dashboard
- Deficiency notification interface

---

## User Roles & Permissions

| Role | Access Level |
|------|--------------|
| Admin | Full system access, user management, billing |
| Risk Manager | Portfolio-wide access, exception approval |
| Project Manager | Assigned projects only, subcontractor management |
| Project Administrator | Day-to-day operations, document processing |
| Read-Only | View-only access to all data |

---

## Australian-Specific Features

- Public liability coverage verification ($10M-$20M standard)
- Workers compensation compliance checking
- State-specific requirements (NSW, VIC, QLD, WA, SA)
- ABN/ACN validation
- Australian insurance document formats

---

## Technical Capabilities

### Integrations
- Google OAuth integration
- Microsoft OAuth integration
- Resend email service
- Twilio SMS service
- Google Gemini AI (gemini-2.0-flash-exp)
- Stripe payments

### Security
- JWT-based authentication
- Password hashing (bcryptjs)
- Rate limiting on auth endpoints
- Session management
- Role-based access control
- Security headers (HSTS, X-Frame-Options, etc.)
- Data encryption at rest

### Data & Reporting
- Complete audit logs
- Compliance history snapshots
- Export capabilities
- Data migration tools

---

## Settings & Configuration

- Company profile management
- User invitation system
- Notification preferences
- Integration configuration
- Email template customization
- Requirement templates (reusable)
- Billing management

---

## Tech Stack

- **Frontend:** Next.js 14, React 18, Tailwind CSS, shadcn/ui
- **Backend:** Next.js API routes, Convex functions
- **Database:** Convex (real-time backend with automatic caching)
- **AI:** Google Gemini 2.0 Flash (gemini-2.0-flash-exp), Tesseract.js OCR
- **Email:** Resend
- **SMS:** Twilio
- **Payments:** Stripe
- **State Management:** TanStack Query (React Query)
- **Charts:** Recharts

---

*Last updated: January 2025*
