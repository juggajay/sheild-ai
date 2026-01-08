@echo off
REM Run All Stress Tests
REM This runs a comprehensive test suite

echo ============================================
echo RiskShield AI - Complete Stress Test Suite
echo ============================================
echo.
echo This will run the following tests:
echo   1. API Endpoints Test
echo   2. User Journeys Test
echo   3. Stress Scenarios Test (spike)
echo   4. Rate Limiting Test
echo   5. Webhook Stress Test
echo.
echo Estimated total duration: ~30 minutes
echo.
echo Press Ctrl+C to cancel, or any key to continue...
pause > nul

set BASE_URL=http://localhost:3000
set API_URL=http://localhost:3000/api
set ADMIN_EMAIL=admin@test.com
set ADMIN_PASSWORD=TestPassword123!

if not exist "results" mkdir results

echo.
echo [1/5] Running API Endpoints Test...
echo ----------------------------------------
k6 run ^
  -e BASE_URL=%BASE_URL% ^
  -e API_URL=%API_URL% ^
  -e ADMIN_EMAIL=%ADMIN_EMAIL% ^
  -e ADMIN_PASSWORD=%ADMIN_PASSWORD% ^
  tests/api-endpoints.js

echo.
echo [2/5] Running User Journeys Test...
echo ----------------------------------------
k6 run ^
  -e BASE_URL=%BASE_URL% ^
  -e API_URL=%API_URL% ^
  -e ADMIN_EMAIL=%ADMIN_EMAIL% ^
  -e ADMIN_PASSWORD=%ADMIN_PASSWORD% ^
  tests/user-journeys.js

echo.
echo [3/5] Running Stress Scenarios Test (Spike)...
echo ----------------------------------------
k6 run ^
  -e BASE_URL=%BASE_URL% ^
  -e API_URL=%API_URL% ^
  -e ADMIN_EMAIL=%ADMIN_EMAIL% ^
  -e ADMIN_PASSWORD=%ADMIN_PASSWORD% ^
  -e SCENARIO=spike ^
  tests/stress-scenarios.js

echo.
echo [4/5] Running Rate Limiting Test...
echo ----------------------------------------
k6 run ^
  -e BASE_URL=%BASE_URL% ^
  -e API_URL=%API_URL% ^
  -e ADMIN_EMAIL=%ADMIN_EMAIL% ^
  -e ADMIN_PASSWORD=%ADMIN_PASSWORD% ^
  tests/rate-limiting.js

echo.
echo [5/5] Running Webhook Stress Test...
echo ----------------------------------------
k6 run ^
  -e BASE_URL=%BASE_URL% ^
  -e API_URL=%API_URL% ^
  -e ADMIN_EMAIL=%ADMIN_EMAIL% ^
  -e ADMIN_PASSWORD=%ADMIN_PASSWORD% ^
  tests/webhook-stress.js

echo.
echo ============================================
echo All tests complete!
echo ============================================
echo.
echo Check the results/ folder for detailed reports.
echo.
pause
