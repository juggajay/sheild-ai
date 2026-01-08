@echo off
REM Stress Test - Find breaking points
REM Duration: ~43 minutes

echo ============================================
echo RiskShield AI - Stress Test
echo ============================================
echo.
echo WARNING: This test will push the system to its limits!
echo Duration: approximately 43 minutes
echo.
echo Press Ctrl+C to cancel, or any key to continue...
pause > nul

set BASE_URL=http://localhost:3000
set ADMIN_EMAIL=admin@test.com
set ADMIN_PASSWORD=TestPassword123!

if not exist "results" mkdir results

k6 run ^
  -e BASE_URL=%BASE_URL% ^
  -e ADMIN_EMAIL=%ADMIN_EMAIL% ^
  -e ADMIN_PASSWORD=%ADMIN_PASSWORD% ^
  -e TEST_TYPE=stress ^
  run-tests.js

echo.
echo Test complete! Check results/ folder for reports.
pause
