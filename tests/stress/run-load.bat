@echo off
REM Load Test - Standard expected traffic simulation
REM Duration: ~16 minutes

echo ============================================
echo RiskShield AI - Load Test
echo ============================================
echo.
echo This test simulates normal expected load.
echo Duration: approximately 16 minutes
echo.

set BASE_URL=http://localhost:3000
set ADMIN_EMAIL=admin@test.com
set ADMIN_PASSWORD=TestPassword123!

if not exist "results" mkdir results

k6 run ^
  -e BASE_URL=%BASE_URL% ^
  -e ADMIN_EMAIL=%ADMIN_EMAIL% ^
  -e ADMIN_PASSWORD=%ADMIN_PASSWORD% ^
  -e TEST_TYPE=load ^
  run-tests.js

echo.
echo Test complete! Check results/ folder for reports.
pause
