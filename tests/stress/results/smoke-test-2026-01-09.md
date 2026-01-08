# Stress Test Results - 2026-01-09

## Test Type: Smoke Test

### Summary
- **Duration**: 3 minutes
- **Max VUs**: 5
- **Total Iterations**: 583
- **Total HTTP Requests**: 614

### Key Metrics

| Metric | Value |
|--------|-------|
| Login Success Rate | 2.05% (12/583) |
| HTTP Request Duration (avg) | 24.98ms |
| HTTP Request Duration (p95) | 25.14ms |
| HTTP Request Duration (max) | 546.54ms |
| HTTP Request Failed | 92.99% (rate limited) |
| API Duration (avg) | 92.97ms |

### Observations

1. **Rate Limiting Working**: The auth endpoint correctly enforces rate limits (5 attempts per 15 min window)
2. **Response Times Excellent**: All successful requests completed well under thresholds
3. **App Stability**: No 500 errors, no crashes under load
4. **Single User Bottleneck**: Test limited by using single test account

### Issues Identified

1. **Test Configuration Issue**: Single test user triggers rate limiting
   - Solution: Create multiple test users or bypass rate limiting for load testing

2. **Rate Limit Window Too Long**: 15-minute window is aggressive
   - Consider: Configurable rate limits for different environments

### Next Steps

1. Create multiple test users (10-20) for realistic load testing
2. Add environment variable to disable rate limiting during stress tests
3. Run full load test with proper configuration
