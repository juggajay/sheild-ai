# RiskShield AI Stress Test Suite

Comprehensive k6-based stress testing suite for the RiskShield AI application.

## Quick Start

### Prerequisites

1. **Install k6**
   ```bash
   # Windows (using Chocolatey)
   choco install k6

   # Windows (using winget)
   winget install k6

   # macOS
   brew install k6

   # Linux
   sudo apt-get install k6
   ```

2. **Start your application**
   ```bash
   npm run dev
   # or
   npm run start
   ```

3. **Create test user** (if not exists)
   - Email: `admin@test.com`
   - Password: `TestPassword123!`

### Running Tests

```bash
# Navigate to stress test directory
cd tests/stress

# Quick smoke test (3 min)
run-smoke.bat

# Standard load test (16 min)
run-load.bat

# Stress test - find limits (43 min)
run-stress.bat

# Run all tests (~30 min)
run-all.bat
```

## Test Suites

### 1. API Endpoints (`tests/api-endpoints.js`)
Tests all 76 API endpoints under load.

```bash
k6 run -e BASE_URL=http://localhost:3000 tests/api-endpoints.js
```

**Coverage:**
- Dashboard & Monitoring APIs
- Project APIs
- Subcontractor APIs
- Document APIs
- Exception APIs
- Communication APIs
- User APIs
- Company & Settings APIs
- Integration APIs
- Stripe APIs
- External APIs (ABN validation)
- Template APIs

### 2. User Journeys (`tests/user-journeys.js`)
Simulates realistic user workflows.

```bash
k6 run -e BASE_URL=http://localhost:3000 tests/user-journeys.js
```

**Journeys:**
1. **Signup & Setup** (15%) - New user onboarding
2. **Document Upload & Verification** (30%) - COC processing
3. **Exception Management** (15%) - Compliance exceptions
4. **Dashboard Monitoring** (25%) - Daily usage patterns
5. **Project Management** (15%) - Project lifecycle

### 3. Stress Scenarios (`tests/stress-scenarios.js`)
Various stress test patterns.

```bash
# Spike test
k6 run -e SCENARIO=spike tests/stress-scenarios.js

# Stress test
k6 run -e SCENARIO=stress tests/stress-scenarios.js

# Breakpoint test
k6 run -e SCENARIO=breakpoint tests/stress-scenarios.js

# Soak test (4+ hours)
k6 run -e SCENARIO=soak tests/stress-scenarios.js

# Concurrent uploads
k6 run -e SCENARIO=concurrent_uploads tests/stress-scenarios.js

# Database stress
k6 run -e SCENARIO=database_stress tests/stress-scenarios.js

# Bulk operations
k6 run -e SCENARIO=bulk_operations tests/stress-scenarios.js
```

### 4. Rate Limiting (`tests/rate-limiting.js`)
Tests rate limiting and security.

```bash
k6 run -e BASE_URL=http://localhost:3000 tests/rate-limiting.js
```

**Tests:**
- Auth endpoint rate limiting
- Brute force protection
- API rate limiting
- Concurrent authentication
- IP-based limiting

### 5. Webhook Stress (`tests/webhook-stress.js`)
Tests webhook handling under load.

```bash
k6 run -e BASE_URL=http://localhost:3000 tests/webhook-stress.js
```

**Coverage:**
- Stripe webhook flood (50/sec)
- SendGrid webhook flood (100/sec)
- Mixed webhook load
- Idempotency testing
- Malformed payload handling

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BASE_URL` | `http://localhost:3000` | Application base URL |
| `API_URL` | `http://localhost:3000/api` | API base URL |
| `ADMIN_EMAIL` | `admin@test.com` | Test admin email |
| `ADMIN_PASSWORD` | `TestPassword123!` | Test admin password |
| `USER_EMAIL` | `user@test.com` | Test user email |
| `USER_PASSWORD` | `TestPassword123!` | Test user password |
| `TEST_TYPE` | `smoke` | Test type for run-tests.js |
| `SCENARIO` | `spike` | Scenario for stress-scenarios.js |

### Load Profiles

Edit `config.js` to customize load stages:

```javascript
export const LOAD_STAGES = {
  smoke: {
    stages: [
      { duration: '1m', target: 5 },
      { duration: '1m', target: 5 },
      { duration: '1m', target: 0 },
    ],
  },
  load: {
    stages: [
      { duration: '2m', target: 50 },
      { duration: '5m', target: 50 },
      { duration: '2m', target: 100 },
      { duration: '5m', target: 100 },
      { duration: '2m', target: 0 },
    ],
  },
  // ... more profiles
};
```

### Thresholds

Default performance thresholds:

| Metric | Threshold | Description |
|--------|-----------|-------------|
| `http_req_duration` | p(95) < 500ms | 95th percentile response time |
| `http_req_failed` | rate < 1% | Error rate |
| `login_success` | rate > 95% | Login success rate |
| `journey_complete` | rate > 85% | User journey completion |

## Output & Reports

### Console Output
Real-time metrics during test execution.

### HTML Reports
Generated in `results/` folder:
- `summary-{test_type}-{timestamp}.html`

### JSON Reports
Machine-readable results:
- `summary-{test_type}-{timestamp}.json`
- `stress-{scenario}-summary.json`
- `rate-limiting-summary.json`
- `webhook-stress-summary.json`

## Test Data

### Generated Data
The test suite generates realistic test data:
- Projects with Australian addresses
- Subcontractors with valid ABN formats
- Insurance requirements
- COC documents (fake PDFs)
- Exception records
- Communication records

### Sample ABNs
```javascript
['51824753556', '33102417032', '51002046384', '80004552064', '34132104560']
```

### Australian States
```javascript
['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'NT', 'ACT']
```

## Troubleshooting

### "Login failed" errors
1. Ensure the test user exists in the database
2. Check the password matches
3. Verify the application is running

### Rate limit errors during testing
This is expected! The tests intentionally trigger rate limits.

### High error rates
1. Check if the server is overloaded
2. Reduce VU count in config.js
3. Check server logs for errors

### Out of memory
1. Reduce concurrent VUs
2. Add more think time (sleep)
3. Use smaller batch sizes

## Best Practices

1. **Start with smoke tests** - Verify basic functionality first
2. **Run in isolation** - Don't run against production
3. **Monitor server resources** - Watch CPU, memory, DB connections
4. **Gradual ramp-up** - Let the system warm up
5. **Clean up test data** - Remove test records after testing
6. **Review reports** - Check HTML reports for detailed analysis

## Directory Structure

```
tests/stress/
├── config.js                 # Configuration & thresholds
├── run-tests.js             # Main test runner
├── README.md                # This file
├── run-smoke.bat            # Quick smoke test
├── run-load.bat             # Standard load test
├── run-stress.bat           # Stress test
├── run-all.bat              # Run all tests
├── helpers/
│   ├── auth.js              # Authentication helpers
│   ├── api.js               # API request helpers
│   └── data.js              # Test data generators
├── tests/
│   ├── api-endpoints.js     # All API endpoints
│   ├── user-journeys.js     # User workflow simulations
│   ├── stress-scenarios.js  # Various stress patterns
│   ├── rate-limiting.js     # Security & rate limit tests
│   └── webhook-stress.js    # Webhook handling tests
└── results/                 # Generated reports
```

## Contributing

1. Add new test scenarios in `tests/`
2. Add helpers in `helpers/`
3. Update config.js for new thresholds
4. Document in this README

## License

Part of RiskShield AI project.
