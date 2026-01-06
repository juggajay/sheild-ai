# RiskShield AI

**Autonomous Certificate of Currency (COC) Compliance Platform for the Australian Construction Industry**

RiskShield AI transforms manual insurance document verification from a time-consuming administrative burden into an automated system that reads insurance certificates via AI, verifies them against project-specific requirements, communicates deficiencies directly to brokers, and provides real-time portfolio risk visibility.

## Overview

Head contractors in the Australian construction industry must verify that every subcontractor has valid insurance before they work on site. This involves:

- Collecting Certificates of Currency (COCs) from subcontractors
- Verifying coverage types, limits, and extensions match contract requirements
- Checking policy expiry dates and principal indemnity clauses
- Following up with brokers when certificates are non-compliant
- Managing exceptions and tracking expiring coverage

RiskShield AI automates this entire process using AI-powered document verification.

## Key Features

### AI-Powered Verification Engine
- GPT-4V extracts data from any COC format
- Automatic compliance checking against project requirements
- Confidence scoring for human review queue
- Multi-insurer format support (QBE, Allianz, CGU, Zurich, etc.)

### Automated Communications
- Deficiency notifications sent automatically to brokers
- Follow-up sequences on configurable schedules
- Confirmation emails on successful verification
- Expiration reminders before coverage lapses

### Real-Time Dashboard
- Morning Brief showing stop-work risks
- Portfolio-wide compliance metrics
- Drill-down from portfolio to project to subcontractor
- Exception tracking and audit trails

### Subcontractor Portal
- Self-service COC uploads
- Instant verification feedback
- Multi-builder compliance view
- Broker bulk upload capability

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14 (App Router), React, Tailwind CSS, shadcn/ui |
| State | React Query (TanStack Query), React Hook Form |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (email/password + magic links) |
| File Storage | Supabase Storage |
| Real-time | Convex |
| AI Processing | OpenAI GPT-4V + Tesseract.js (OCR fallback) |
| Email | SendGrid |
| SMS | Twilio |

## Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm
- Supabase account
- Convex account
- OpenAI API key

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd Sheild-AI
```

2. Run the setup script:
```bash
chmod +x init.sh
./init.sh
```

3. Configure environment variables:
```bash
# Edit .env.local with your credentials
nano .env.local
```

4. Start development server:
```bash
npm run dev
```

5. Open http://localhost:3000

### Environment Variables

```env
# Required
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_CONVEX_URL=
OPENAI_API_KEY=

# Optional (for email/SMS)
SENDGRID_API_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
```

## Project Structure

```
Sheild-AI/
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Authentication routes
│   ├── (dashboard)/       # Main application routes
│   ├── portal/            # Subcontractor portal
│   └── api/               # API routes
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   └── features/         # Feature-specific components
├── lib/                   # Utility libraries
│   ├── supabase/         # Supabase client
│   ├── convex/           # Convex functions
│   └── ai/               # AI processing utilities
├── convex/               # Convex schema and functions
├── supabase/             # Supabase migrations
└── public/               # Static assets
```

## User Roles

| Role | Permissions |
|------|-------------|
| Admin | Full access, user management, billing |
| Risk Manager | Portfolio-wide access, exception approval |
| Project Manager | Assigned projects only |
| Project Administrator | Day-to-day compliance operations |
| Read-Only | View access only |
| Subcontractor | Portal access only |
| Broker | Broker portal access only |

## Australian Insurance Terminology

- **COC**: Certificate of Currency (not Certificate of Insurance)
- **Public Liability**: (not General Liability)
- **Excess**: (not Deductible)
- **Principal Indemnity**: (not Additional Insured)
- **Head Contractor**: (not General Contractor)
- **Workers Compensation**: State-based schemes (NSW icare, VIC WorkSafe, QLD WorkCover, etc.)

## Development

### Running Tests
```bash
npm test
```

### Building for Production
```bash
npm run build
```

### Database Migrations
```bash
# Using Supabase CLI
supabase db push
```

### Convex Functions
```bash
# Start Convex development server
npx convex dev
```

## Feature Tracking

This project uses a feature tracking system to manage implementation progress:

- **Total Features**: 220
- **Categories**: Functional, Security, Navigation, Error Handling, Forms, UI/UX, Accessibility, Performance, Integration

Progress can be checked using the feature management tools in the development environment.

## License

Proprietary - All rights reserved.

## Support

For questions or issues, please contact the development team.
