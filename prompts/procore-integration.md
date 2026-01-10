# Ralph Prompt: Perfect Procore Integration

## Objective
Create a bulletproof Procore integration for RiskSure AI that:
1. Works flawlessly in sandbox mode first
2. Handles all edge cases gracefully
3. Switches to production when verified

## Completion Promise
Output `<promise>PROCORE INTEGRATION COMPLETE</promise>` when:
- All OAuth flows work (connect, callback, disconnect, reconnect)
- Project sync works bidirectionally with proper field mapping
- Vendor sync works with ABN deduplication
- Compliance push updates Procore insurance records
- All error scenarios are handled gracefully
- Integration works in both sandbox AND production modes
- Build passes with no TypeScript errors

---

## Phase 1: Environment Setup (Sandbox Mode)

### 1.1 Configure Sandbox Environment
Update `.env.local` to use sandbox credentials:

```env
# Procore Sandbox Mode
PROCORE_SANDBOX=true
PROCORE_CLIENT_ID=cTyCKK5hQQGxm1fURogZOmcrnGiAtcdjBU5D8cW1hyg
PROCORE_CLIENT_SECRET=021n8k3Hm5Vl-SM_0zRfy4X2WAdHpnk8ACu7BixLZbI
PROCORE_REDIRECT_URI=http://localhost:3000/api/integrations/procore/callback
```

### 1.2 Verify Config Loading
Check `lib/procore/config.ts` correctly loads sandbox vs production:
- When `PROCORE_SANDBOX=true`: use `sandbox.procore.com` URLs
- When `PROCORE_SANDBOX=false`: use `api.procore.com` URLs
- Redirect URI should match environment (localhost vs app.risksure.ai)

---

## Phase 2: OAuth Flow Verification

### 2.1 Connect Flow (`/api/integrations/procore/connect`)
Test cases:
- [ ] Non-admin user gets 403 Forbidden
- [ ] State token is generated and stored in Convex
- [ ] Redirect URL is correctly formed with client_id, redirect_uri, state
- [ ] Dev mode (no credentials) returns mock data instead of redirect

### 2.2 Callback Flow (`/api/integrations/procore/callback`)
Test cases:
- [ ] Invalid/expired state token returns 400
- [ ] Missing code parameter returns 400
- [ ] Token exchange works and stores access_token + refresh_token
- [ ] Single company: connection stored immediately
- [ ] Multiple companies: pendingCompanySelection flag set, redirect to selector
- [ ] Token expiration tracked correctly

### 2.3 Company Selection (`/api/integrations/procore/select-company`)
Test cases:
- [ ] Only works when pendingCompanySelection=true
- [ ] Updates connection with selected company ID/name
- [ ] Clears pendingCompanySelection flag
- [ ] Creates audit log entry

### 2.4 Disconnect Flow (`/api/integrations/procore/disconnect`)
Test cases:
- [ ] Removes OAuth connection from database
- [ ] Sets all procore_mappings to syncStatus='paused'
- [ ] Creates audit log entry
- [ ] Subsequent connect flow works (reconnect scenario)

### 2.5 Token Refresh
Test cases:
- [ ] Expired token triggers automatic refresh
- [ ] Refresh token stored after refresh
- [ ] Failed refresh (invalid refresh_token) disconnects gracefully

---

## Phase 3: Project Sync Verification

### 3.1 Fetch Projects (`/api/procore/projects`)
Test cases:
- [ ] Returns list of projects from Procore company
- [ ] Handles pagination for large project lists
- [ ] Shows which projects are already synced
- [ ] Handles API errors gracefully (network, auth, rate limit)

### 3.2 Sync Projects (`/api/procore/projects/sync`)
Test cases:
- [ ] Creates new Shield-AI project from Procore project
- [ ] Field mapping correct:
  - name → name
  - address components → combined address string
  - state_code → Australian state enum (or null)
  - active → status ('active'/'completed')
  - start/end dates mapped correctly
- [ ] Creates procore_mapping record
- [ ] updateExisting=true updates existing projects
- [ ] updateExisting=false skips existing projects
- [ ] Sync log created with correct counts
- [ ] Audit log entry created

### 3.3 Edge Cases
- [ ] Project with missing required fields handled
- [ ] Duplicate project sync handled (idempotent)
- [ ] Non-Australian state codes handled (set null, not error)
- [ ] Very long project names truncated appropriately

---

## Phase 4: Vendor Sync Verification

### 4.1 Fetch Vendors (`/api/procore/vendors`)
Test cases:
- [ ] Returns list of vendors from Procore company directory
- [ ] Handles pagination
- [ ] Shows sync status for each vendor
- [ ] Handles API errors gracefully

### 4.2 Sync Vendors (`/api/procore/vendors/sync`)
Test cases:
- [ ] Creates new subcontractor from Procore vendor
- [ ] ABN extraction works from:
  - entity_id (when entity_type='abn')
  - tax_id field
  - business_id field
  - abbreviated_name field
- [ ] Field mapping correct:
  - name → name
  - email_address → email
  - business_phone → phone
  - address → address
  - city → city
  - state_code → state (Australian)
  - zip → postcode
  - is_active → status
- [ ] Creates procore_mapping record
- [ ] ABN deduplication:
  - skipDuplicates=true skips existing ABN
  - mergeExisting=true updates existing subcontractor
- [ ] Can assign to specific project

### 4.3 Edge Cases
- [ ] Vendor without ABN synced (ABN=null)
- [ ] Invalid ABN format handled (not 11 digits)
- [ ] Duplicate vendor by ABN merged correctly
- [ ] Missing email/phone handled gracefully

---

## Phase 5: Compliance Push Verification

### 5.1 Push Compliance (`/api/procore/push-compliance`)
Test cases:
- [ ] Finds correct Procore vendor mapping
- [ ] Gets latest verification results
- [ ] Creates/updates insurance records in Procore:
  - public_liability → General Liability
  - workers_comp → Workers Compensation
  - professional_indemnity → Professional Liability
  - motor_vehicle → Auto Liability
  - contract_works → Builders Risk
- [ ] Updates vendor custom fields (if available)
- [ ] Handles missing verification gracefully
- [ ] Audit log entry created

### 5.2 Edge Cases
- [ ] Subcontractor not mapped to Procore handled
- [ ] No verification exists handled
- [ ] Procore API error handled (logs, doesn't crash)
- [ ] Partial insurance data handled

---

## Phase 6: Error Handling & Edge Cases

### 6.1 Network Errors
- [ ] Timeout handled with retry
- [ ] Connection refused handled gracefully
- [ ] DNS resolution failure handled

### 6.2 API Errors
- [ ] 400 Bad Request logged with details
- [ ] 401 Unauthorized triggers token refresh
- [ ] 403 Forbidden logged (permission issue)
- [ ] 404 Not Found handled per endpoint
- [ ] 429 Rate Limited with exponential backoff
- [ ] 500+ Server Error with retry

### 6.3 Data Errors
- [ ] Non-JSON response handled (HTML error pages)
- [ ] Malformed JSON handled
- [ ] Missing required fields handled
- [ ] Type mismatches handled

---

## Phase 7: UI/UX Verification

### 7.1 Integration Settings Page
Location: `/dashboard/settings/integrations/procore`
- [ ] Shows connection status (connected/disconnected)
- [ ] Shows connected company name
- [ ] Shows last sync timestamp
- [ ] Connect button initiates OAuth
- [ ] Disconnect button with confirmation
- [ ] Sync buttons for projects/vendors

### 7.2 Company Selector
Location: `/dashboard/settings/integrations/procore/select-company`
- [ ] Only shown when multiple companies available
- [ ] Dropdown lists all available companies
- [ ] Selection updates connection
- [ ] Redirects back to settings on success

### 7.3 Sync Status
- [ ] Progress indicator during sync
- [ ] Success/error toast messages
- [ ] Sync results displayed (created/updated/skipped counts)

---

## Phase 8: Production Readiness

### 8.1 Switch to Production
After all sandbox tests pass, update `.env.local`:

```env
# Procore Production Mode
PROCORE_SANDBOX=false
PROCORE_CLIENT_ID=DJMsxodsmb_0IBnQXqIV2ORP01u9Pzsqa2uC_E78mcE
PROCORE_CLIENT_SECRET=-4M_72nZb8D6QXGRwsAfAQZl6LlgePwg_dYw9vZ31qA
PROCORE_REDIRECT_URI=https://app.risksure.ai/api/integrations/procore/callback
```

### 8.2 Production Verification
- [ ] OAuth flow works with production credentials
- [ ] Can connect to real Procore account
- [ ] Project sync works with real data
- [ ] Vendor sync works with real data
- [ ] Compliance push works (test with non-critical vendor first)

### 8.3 Security Checklist
- [ ] No credentials logged to console
- [ ] Tokens stored securely (encrypted in DB)
- [ ] State tokens expire after 10 minutes
- [ ] Admin-only access enforced on all routes
- [ ] Company isolation enforced (users only see their data)

---

## Phase 9: Code Quality

### 9.1 TypeScript
- [ ] No `any` types in Procore code
- [ ] All API responses typed
- [ ] Build passes with `npm run build`

### 9.2 Error Messages
- [ ] User-friendly error messages (not raw API errors)
- [ ] Actionable errors (tell user what to do)
- [ ] Technical details logged for debugging

### 9.3 Logging
- [ ] All sync operations logged
- [ ] Audit trail complete
- [ ] No sensitive data in logs

---

## Files to Review/Modify

### Core Library
- `lib/procore/config.ts` - Environment handling
- `lib/procore/client.ts` - API client
- `lib/procore/sync.ts` - Sync logic
- `lib/procore/types.ts` - Type definitions

### API Routes
- `app/api/integrations/procore/connect/route.ts`
- `app/api/integrations/procore/callback/route.ts`
- `app/api/integrations/procore/disconnect/route.ts`
- `app/api/integrations/procore/companies/route.ts`
- `app/api/integrations/procore/select-company/route.ts`
- `app/api/procore/projects/route.ts`
- `app/api/procore/projects/sync/route.ts`
- `app/api/procore/vendors/route.ts`
- `app/api/procore/vendors/sync/route.ts`
- `app/api/procore/push-compliance/route.ts`

### Convex Functions
- `convex/integrations.ts`

### UI Components
- `app/dashboard/settings/integrations/procore/page.tsx`
- `app/dashboard/settings/integrations/procore/select-company/page.tsx`

---

## Testing Commands

```bash
# Run dev server
npm run dev

# Build check
npm run build

# Test OAuth flow
# 1. Go to http://localhost:3000/dashboard/settings/integrations/procore
# 2. Click "Connect to Procore"
# 3. Complete OAuth in Procore sandbox
# 4. Verify connection shows in UI

# Test sync via API (use curl or Postman)
curl -X POST http://localhost:3000/api/procore/projects/sync \
  -H "Content-Type: application/json" \
  -H "Cookie: auth_token=YOUR_TOKEN" \
  -d '{"projectIds": [PROJECT_ID], "updateExisting": true}'
```

---

## Success Criteria

1. **OAuth**: Connect → use → disconnect → reconnect cycle works
2. **Projects**: Sync creates/updates with correct field mapping
3. **Vendors**: Sync with ABN deduplication works correctly
4. **Compliance**: Push updates Procore insurance records
5. **Errors**: All error scenarios handled gracefully
6. **UI**: Settings page shows correct status and enables all actions
7. **Build**: `npm run build` passes with no errors
8. **Both Modes**: Works in sandbox AND production

When all criteria met, output: `<promise>PROCORE INTEGRATION COMPLETE</promise>`
