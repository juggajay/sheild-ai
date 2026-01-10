# Ralph Loop Prompt: Supabase to Convex Migration

## Command to Execute

```bash
/ralph-loop "$(cat RALPH-CONVEX-MIGRATION.md)" --completion-promise "MIGRATION COMPLETE" --max-iterations 100
```

---

## Mission

Migrate RiskShield AI from Supabase to Convex while maintaining 100% feature parity. The app must function exactly as it does now, but using Convex as the data layer instead of Supabase.

---

## Current Architecture Summary

### Tech Stack
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **UI:** React 18, Tailwind CSS, shadcn/ui
- **Current Database:** Supabase PostgreSQL (production) / SQLite (development)
- **Current Storage:** Supabase Storage
- **Current Auth:** Custom JWT with bcrypt (NOT Supabase Auth)
- **AI:** Google Generative AI (Gemini) for document extraction

### Database Tables to Migrate (20 tables)

| Table | Purpose | Key Relationships |
|-------|---------|-------------------|
| companies | Multi-tenant root entity | Has many: users, projects, subcontractors |
| users | User accounts with roles | Belongs to: company |
| sessions | JWT session storage | Belongs to: user |
| projects | Construction projects | Belongs to: company; Has many: requirements, subcontractors |
| subcontractors | Contractor database | Belongs to: company; Has many: documents |
| project_subcontractors | Project-contractor junction with compliance status | Belongs to: project, subcontractor |
| insurance_requirements | Project-specific insurance rules | Belongs to: project |
| coc_documents | Certificate of Currency files | Belongs to: subcontractor, project |
| verifications | AI verification results | Belongs to: document |
| communications | Email/SMS notifications | Belongs to: subcontractor, project |
| exceptions | Compliance waivers | Belongs to: project_subcontractor |
| notifications | In-app notifications | Belongs to: user |
| audit_logs | Full audit trail | Belongs to: company |
| email_templates | Customizable templates | Belongs to: company |
| requirement_templates | Reusable insurance requirements | Belongs to: company |
| compliance_snapshots | Historical compliance data | Belongs to: company |
| password_reset_tokens | Password reset flow | Belongs to: user |
| magic_link_tokens | Portal auth | - |
| oauth_states | OAuth CSRF protection | Belongs to: company |
| oauth_connections | OAuth token storage | Belongs to: company |

### Current File Structure

```
lib/
  db/
    index.ts           # Dual-mode DB abstraction (Supabase/SQLite)
    supabase-db.ts     # Supabase client and helpers (484 lines)
    sqlite-db.ts       # SQLite implementation
  supabase/
    client.ts          # Browser Supabase client
    server.ts          # Server Supabase client
  storage.ts           # File storage abstraction
  auth.ts              # JWT auth helpers

app/api/
  # 50+ API routes using Supabase
```

### Key Supabase Usage Patterns

```typescript
// Current pattern in API routes:
import { getSupabase, isProduction } from '@/lib/db'

export async function GET(request: NextRequest) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('projects')
    .select('*, company:companies(*)')
    .eq('company_id', user.company_id)
  return NextResponse.json({ projects: data })
}
```

```typescript
// Current React Query hooks:
export function useSubcontractors() {
  return useQuery({
    queryKey: ['subcontractors'],
    queryFn: async () => {
      const res = await fetch('/api/subcontractors')
      return res.json()
    },
    refetchInterval: 60_000,
  })
}
```

---

## Migration Tasks

### Phase 1: Convex Setup

1. **Initialize Convex** (if not already done)
   ```bash
   npx convex dev
   ```

2. **Create schema** at `convex/schema.ts`
   - Define all 20 tables with proper indexes
   - Denormalize where needed for query performance
   - Add indexes for every query pattern used in the app

3. **Create ConvexClientProvider** in `components/providers/convex-provider.tsx`

4. **Update root layout** to wrap app with ConvexProvider

### Phase 2: Core Functions

Create Convex functions for each domain:

```
convex/
  schema.ts              # Full schema definition
  auth.ts                # Login, logout, session management
  users.ts               # User CRUD
  companies.ts           # Company CRUD
  projects.ts            # Project CRUD + requirements
  subcontractors.ts      # Subcontractor CRUD
  projectSubcontractors.ts  # Compliance status management
  documents.ts           # Document upload, processing
  verifications.ts       # AI verification results
  communications.ts      # Email/SMS tracking
  exceptions.ts          # Compliance exceptions
  notifications.ts       # In-app notifications
  auditLogs.ts           # Audit trail
  dashboard.ts           # Morning brief, stats
  storage.ts             # File upload/download helpers
```

Each file should have:
- `query` functions for reading data
- `mutation` functions for writing data
- Proper authorization checks (verify user belongs to company)

### Phase 3: Replace API Routes

For each API route in `app/api/`:

1. **Option A (Preferred):** Remove the API route entirely and call Convex directly from components
2. **Option B:** Keep API route but call Convex functions instead of Supabase

Priority order for migration:
1. `/api/auth/*` - Login, logout, sessions
2. `/api/subcontractors/*` - Most used feature
3. `/api/projects/*` - Project management
4. `/api/documents/*` - Document upload/processing
5. `/api/dashboard/*` - Morning brief, stats
6. All remaining routes

### Phase 4: React Hooks

Replace all React Query hooks with Convex hooks:

```typescript
// Before (React Query + fetch):
export function useSubcontractors() {
  return useQuery({
    queryKey: ['subcontractors'],
    queryFn: () => fetch('/api/subcontractors').then(r => r.json())
  })
}

// After (Convex):
export function useSubcontractors() {
  const { companyId } = useAuth()
  return useQuery(api.subcontractors.list, { companyId })
}
```

Update these hook files:
- `lib/hooks/use-api.ts`
- `lib/hooks/use-documents.ts`
- `lib/hooks/use-projects.ts`
- `lib/hooks/use-subcontractors.ts`

### Phase 5: File Storage

1. Update `lib/storage.ts` to use Convex storage
2. Create upload mutation that returns storage ID
3. Create URL generation query
4. Update all file upload components

### Phase 6: Authentication

Keep the JWT-based auth but store sessions in Convex:

1. Update `lib/auth.ts` to use Convex for session storage
2. Update login/logout to use Convex mutations
3. Update middleware to verify sessions via Convex

### Phase 7: Cleanup

1. Remove all Supabase dependencies:
   - `lib/db/supabase-db.ts`
   - `lib/supabase/client.ts`
   - `lib/supabase/server.ts`
   - Supabase imports from all files

2. Update environment variables:
   - Remove `NEXT_PUBLIC_SUPABASE_URL`
   - Remove `SUPABASE_SERVICE_ROLE_KEY`
   - Remove `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Ensure `NEXT_PUBLIC_CONVEX_URL` is set

3. Remove dual-mode logic from `lib/db/index.ts`

4. Uninstall Supabase packages:
   ```bash
   npm uninstall @supabase/supabase-js @supabase/ssr
   ```

---

## Critical Requirements

### 1. Feature Parity
Every feature that works now MUST work after migration:
- User login/logout/signup
- Project CRUD with insurance requirements
- Subcontractor CRUD with search
- Document upload and AI processing
- Compliance status tracking
- Exception management with approval workflow
- Communications (email/SMS) tracking
- Notifications
- Audit logging
- Portal access for subcontractors
- Broker portal
- Dashboard with morning brief
- Compliance history charts

### 2. Authorization
Every query/mutation must verify:
- User is authenticated
- User belongs to the company they're querying
- User has appropriate role for the action

### 3. Real-time Updates
Leverage Convex's real-time nature:
- Dashboard stats should update live
- Notifications should appear instantly
- Compliance status changes should reflect immediately

### 4. Performance
- Add indexes for all query patterns
- Denormalize data where it improves query performance
- Use pagination for large lists

### 5. Type Safety
- Full TypeScript types throughout
- Use Convex's generated types
- No `any` types

---

## Success Criteria Checklist

Before outputting the completion promise, verify ALL of these:

### Build & Lint
- [ ] `npm run build` succeeds with no errors
- [ ] No TypeScript errors
- [ ] No ESLint errors related to migration

### Supabase Removal
- [ ] No imports from `@supabase/supabase-js` in any file
- [ ] No imports from `@supabase/ssr` in any file
- [ ] `lib/db/supabase-db.ts` deleted
- [ ] `lib/supabase/` directory deleted
- [ ] No references to `getSupabase()` or `isProduction` (Supabase check)

### Convex Implementation
- [ ] `convex/schema.ts` exists with all tables
- [ ] All 20 tables defined with proper indexes
- [ ] Functions exist for all CRUD operations
- [ ] ConvexProvider wraps the app

### Feature Verification
- [ ] Auth: Login/logout/signup works
- [ ] Projects: Create, read, update, delete
- [ ] Subcontractors: Create, read, update, search
- [ ] Documents: Upload, process, download
- [ ] Verifications: AI processing stores results
- [ ] Exceptions: Create, approve, resolve
- [ ] Communications: Track send/delivery status
- [ ] Notifications: Create and display
- [ ] Dashboard: Morning brief loads with stats
- [ ] Audit logs: Actions are logged

### File Storage
- [ ] Document upload works via Convex storage
- [ ] File download/viewing works
- [ ] Storage URLs are accessible

---

## Iteration Strategy

Each Ralph Loop iteration should:

1. **Check current state** - What's been done? What's broken?
2. **Pick next task** - Follow the phase order above
3. **Implement** - Make changes
4. **Test** - Run build, check for errors
5. **Commit progress** - `git add . && git commit -m "convex: [description]"`
6. **Report status** - What was done, what's next

If build fails:
- Fix the errors before moving on
- Don't leave broken code

If stuck on a complex feature:
- Implement a simpler version first
- Add TODO comments for enhancements
- Move on and come back later

---

## Completion

When ALL success criteria are met, output:

```
<promise>MIGRATION COMPLETE</promise>
```

This signals the Ralph Loop to stop.

---

## Notes for Claude

- This is an unlaunched project - no production data to worry about
- SQLite development mode can be removed entirely
- The goal is Convex-only, no dual-mode needed
- Focus on working code over perfect code
- Commit frequently to track progress
- If a feature is complex, stub it out and mark with TODO
