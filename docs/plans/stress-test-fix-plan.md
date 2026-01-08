# Stress Test Fix Plan

## Executive Summary

Based on comprehensive k6 stress testing and codebase analysis, this plan addresses all issues found to ensure the RiskShield AI application functions perfectly under load.

---

## Issues Identified

### Critical Issues

| # | Issue | Severity | Impact |
|---|-------|----------|--------|
| 1 | Rate limiting blocks stress testing | High | Cannot run proper load tests |
| 2 | Single test user shared rate limit | High | All test VUs hit same limit |
| 3 | Database file locking issues | Medium | Git operations blocked |

### Performance Issues

| # | Issue | Severity | Impact |
|---|-------|----------|--------|
| 4 | Rate limit window too aggressive (15 min) | Medium | Poor UX during legitimate use |
| 5 | No test environment bypass for rate limits | Medium | Development/testing friction |
| 6 | Session creation overhead | Low | Extra DB write per login |

### Testing Issues

| # | Issue | Severity | Impact |
|---|-------|----------|--------|
| 7 | No multiple test users setup | High | Cannot simulate realistic load |
| 8 | Missing load test environment config | Medium | Tests not production-representative |
| 9 | Webhook tests need proper signatures | Low | Cannot test real webhook processing |

---

## Fix Implementation Plan

### Phase 1: Test Infrastructure Fixes (30 min)

#### 1.1 Create Multiple Test Users Script
**File:** `tests/stress/create-test-users.js`

Create 20 test users with unique emails for realistic load distribution:
- admin@test.com (admin role)
- user1@test.com through user19@test.com (various roles)

#### 1.2 Add Test Environment Rate Limit Bypass
**File:** `lib/rate-limit.ts`

Add environment variable `DISABLE_RATE_LIMIT=true` for testing:
```typescript
if (process.env.DISABLE_RATE_LIMIT === 'true') {
  return { success: true, limit: Infinity, remaining: Infinity, reset: 0 }
}
```

#### 1.3 Update k6 Config for Multiple Users
**File:** `tests/stress/helpers/auth.js`

Implement user pool rotation for stress tests.

### Phase 2: Rate Limiting Improvements (20 min)

#### 2.1 Configurable Rate Limit Windows
**File:** `lib/rate-limit.ts`

Make rate limits configurable via environment variables:
- `AUTH_RATE_LIMIT_WINDOW` (default: 900000 = 15 min)
- `AUTH_RATE_LIMIT_MAX` (default: 5)
- `API_RATE_LIMIT_WINDOW` (default: 60000 = 1 min)
- `API_RATE_LIMIT_MAX` (default: 60)

#### 2.2 Progressive Rate Limiting
Instead of hard block, implement progressive delay:
- 1-5 attempts: Normal
- 6-10 attempts: 1 second delay
- 11-15 attempts: 5 second delay
- 16+ attempts: Block for window

### Phase 3: Database & Git Fixes (15 min)

#### 3.1 Add SQLite Files to .gitignore
**File:** `.gitignore`

Add:
```
riskshield.db-shm
riskshield.db-wal
```

#### 3.2 Ensure Clean Database State for Tests
Create script to reset test database before stress tests.

### Phase 4: k6 Test Improvements (20 min)

#### 4.1 Add User Pool to Tests
Rotate through multiple test users to avoid rate limiting.

#### 4.2 Add Proper Webhook Signature Generation
For Stripe webhook tests, implement proper HMAC-SHA256 signing.

#### 4.3 Add Database Connection Pool Monitoring
Track concurrent database connections during tests.

### Phase 5: Verification & Documentation (15 min)

#### 5.1 Run Full Stress Test Suite
Execute all tests with fixes applied:
- Smoke test (3 min)
- Load test (16 min)
- Verify no rate limiting blocks

#### 5.2 Update Documentation
Document new environment variables and test procedures.

---

## Implementation Order

```
1. [Phase 1.2] Add rate limit bypass for tests
2. [Phase 3.1] Fix .gitignore for db files
3. [Phase 1.1] Create multiple test users
4. [Phase 1.3] Update k6 for user pool
5. [Phase 2.1] Make rate limits configurable
6. [Phase 4.1] Implement user pool rotation
7. [Phase 5.1] Run verification tests
8. [Phase 5.2] Update documentation
```

---

## Parallel Watcher Agent

A parallel agent will monitor all changes to ensure nothing breaks:

### Watcher Responsibilities

1. **Run TypeScript compilation** after each file change
2. **Run lint checks** to catch code quality issues
3. **Run affected unit tests** for changed modules
4. **Verify API endpoints** remain functional
5. **Check for regression** in existing functionality

### Watcher Commands

```bash
# TypeScript check
npx tsc --noEmit

# Lint check
npm run lint

# Quick API health check
curl -s http://localhost:3000/api/auth/me | jq .

# Login test
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"TestPassword123!"}'
```

---

## Success Criteria

1. ✅ Stress tests run without rate limiting blocks
2. ✅ 100+ concurrent VUs can authenticate
3. ✅ Response times remain under 500ms at p95
4. ✅ No 500 errors during load tests
5. ✅ Git operations work cleanly
6. ✅ All existing functionality preserved

---

## Rollback Plan

If issues occur:
1. Revert rate limit changes: `git checkout lib/rate-limit.ts`
2. Remove test environment variables
3. Restore original configuration

---

## Estimated Total Time: ~2 hours

Including parallel watcher agent verification throughout.
