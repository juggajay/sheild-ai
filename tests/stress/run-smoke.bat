@echo off
REM Smoke Test - Quick verification that system works
REM Duration: ~3 minutes

echo ============================================
echo RiskShield AI - Smoke Test
echo ============================================

set BASE_URL=http://localhost:3000
set ADMIN_EMAIL=admin@test.com
set ADMIN_PASSWORD=TestPassword123!

if not exist "results" mkdir results

k6 run ^
  -e BASE_URL=%BASE_URL% ^
  -e ADMIN_EMAIL=%ADMIN_EMAIL% ^
  -e ADMIN_PASSWORD=%ADMIN_PASSWORD% ^
  -e TEST_TYPE=smoke ^
  run-tests.js

echo.
echo Test complete! Check results/ folder for reports.
pause
