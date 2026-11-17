# Cathy Luxe Collections - Windows Setup Script
# This script checks for Node.js, installs dependencies, creates .env file,
# and seeds the database. Run as Administrator if needed.

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Cathy Luxe Collections Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Node.js is installed
Write-Host "[1/5] Checking for Node.js..." -ForegroundColor Yellow
$nodeVersion = node -v 2>$null
if (-not $nodeVersion) {
    Write-Host "ERROR: Node.js is not installed." -ForegroundColor Red
    Write-Host "Please download and install Node.js LTS from https://nodejs.org" -ForegroundColor Red
    Write-Host "Then run this script again." -ForegroundColor Red
    exit 1
}
Write-Host "Node.js version: $nodeVersion" -ForegroundColor Green
Write-Host ""

# Check if npm is installed
Write-Host "[2/5] Checking for npm..." -ForegroundColor Yellow
$npmVersion = npm -v 2>$null
if (-not $npmVersion) {
    Write-Host "ERROR: npm is not installed." -ForegroundColor Red
    exit 1
}
Write-Host "npm version: $npmVersion" -ForegroundColor Green
Write-Host ""

# Install dependencies
Write-Host "[3/5] Installing project dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to install dependencies." -ForegroundColor Red
    exit 1
}
Write-Host "Dependencies installed successfully." -ForegroundColor Green
Write-Host ""

# Create .env file if it doesn't exist
Write-Host "[4/5] Configuring environment variables..." -ForegroundColor Yellow
if (-not (Test-Path .env)) {
    Write-Host "Creating .env file from .env.example..." -ForegroundColor Cyan
    Copy-Item .env.example .env
    
    # Generate a random JWT secret
    $jwtSecret = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | % {[char]$_})
    (Get-Content .env) -replace 'change_this_to_a_long_random_string', $jwtSecret | Set-Content .env
    
    Write-Host ".env file created with random JWT secret." -ForegroundColor Green
} else {
    Write-Host ".env file already exists. Skipping." -ForegroundColor Cyan
}
Write-Host ""

# Seed the database
Write-Host "[5/5] Seeding database..." -ForegroundColor Yellow
Write-Host "This will clear existing data and create sample data." -ForegroundColor Cyan
$confirm = Read-Host "Continue? (y/n)"
if ($confirm -eq 'y' -or $confirm -eq 'Y') {
    npm run seed
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Database seeding failed." -ForegroundColor Red
        Write-Host "Make sure MongoDB is running and MONGO_URI is correct in .env" -ForegroundColor Red
        exit 1
    }
    Write-Host "Database seeded successfully." -ForegroundColor Green
} else {
    Write-Host "Database seeding skipped." -ForegroundColor Cyan
}
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "To start the application:" -ForegroundColor Cyan
Write-Host "  npm start        (production)" -ForegroundColor White
Write-Host "  npm run dev      (development with auto-restart)" -ForegroundColor White
Write-Host ""
Write-Host "Default login:" -ForegroundColor Cyan
Write-Host "  Email:    admin@perfume.com" -ForegroundColor White
Write-Host "  Password: admin123" -ForegroundColor White
Write-Host ""
Write-Host "Access the app at: http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
