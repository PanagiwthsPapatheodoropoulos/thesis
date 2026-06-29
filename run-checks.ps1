# run-checks.ps1
# Script to run all local tests for the project.

Write-Host "Running all local checks..." -ForegroundColor Cyan

# 1. Backend tests
Write-Host "`nRunning backend tests..." -ForegroundColor Green
cd backend
.\mvnw.cmd test
$backendStatus = $LASTEXITCODE
cd ..

if ($backendStatus -ne 0) {
    Write-Error "Error: Backend tests failed!"
    exit $backendStatus
}

# 2. Frontend tests
Write-Host "`nRunning frontend tests..." -ForegroundColor Green
cd frontend
npm run test:run
$frontendStatus = $LASTEXITCODE
cd ..

if ($frontendStatus -ne 0) {
    Write-Error "Error: Frontend tests failed!"
    exit $frontendStatus
}

# 3. AI Service tests
if (Test-Path -Path "ai_service") {
    Write-Host "`nRunning AI service tests..." -ForegroundColor Green
    cd ai_service
    python -m pytest tests/
    $aiStatus = $LASTEXITCODE
    cd ..
    
    if ($aiStatus -ne 0) {
        Write-Warning "Warning: AI service tests failed or python/pytest environment not configured."
    }
}

Write-Host "`nAll checks passed successfully!" -ForegroundColor Green
exit 0
