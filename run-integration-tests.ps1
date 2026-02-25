#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Run Auto Docker Extension Integration Tests

.DESCRIPTION
    This script runs the comprehensive integration test suite for the Auto Docker extension.
    It tests Docker file generation across multiple project types and generates a detailed report.

.PARAMETER BuildDocker
    Enable actual Docker build testing (slow but thorough)

.PARAMETER Timeout
    Test timeout in milliseconds (default: 120000)

.PARAMETER ProjectType
    Test specific project type only (e.g., "node", "python", "all")

.PARAMETER CleanFirst
    Clean test-projects Docker files before running tests

.PARAMETER Verbose
    Enable verbose output

.EXAMPLE
    .\run-integration-tests.ps1
    Run basic tests without Docker builds

.EXAMPLE
    .\run-integration-tests.ps1 -BuildDocker
    Run full tests including Docker builds

.EXAMPLE
    .\run-integration-tests.ps1 -CleanFirst -Verbose
    Clean existing Docker files and run tests with verbose output
#>

param(
    [switch]$BuildDocker,
    [int]$Timeout = 120000,
    [string]$ProjectType = "all",
    [switch]$CleanFirst,
    [switch]$Verbose
)

# Color output functions
function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Color
}

function Write-Success {
    param([string]$Message)
    Write-ColorOutput "✓ $Message" "Green"
}

function Write-Info {
    param([string]$Message)
    Write-ColorOutput "ℹ $Message" "Cyan"
}

function Write-Warning {
    param([string]$Message)
    Write-ColorOutput "⚠ $Message" "Yellow"
}

function Write-ErrorMsg {
    param([string]$Message)
    Write-ColorOutput "✗ $Message" "Red"
}

# Banner
Write-Host ""
Write-ColorOutput "╔═══════════════════════════════════════════════════════════╗" "Cyan"
Write-ColorOutput "║   Auto Docker Extension - Integration Test Suite         ║" "Cyan"
Write-ColorOutput "╚═══════════════════════════════════════════════════════════╝" "Cyan"
Write-Host ""

# Check prerequisites
Write-Info "Checking prerequisites..."

# Check Node.js
try {
    $nodeVersion = node --version
    Write-Success "Node.js: $nodeVersion"
} catch {
    Write-ErrorMsg "Node.js not found. Please install Node.js first."
    exit 1
}

# Check npm
try {
    $npmVersion = npm --version
    Write-Success "npm: $npmVersion"
} catch {
    Write-ErrorMsg "npm not found. Please install npm first."
    exit 1
}

# Check if Docker is available (optional)
$dockerAvailable = $false
try {
    $dockerVersion = docker --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        $dockerAvailable = $true
        Write-Success "Docker: $dockerVersion"
    }
} catch {
    Write-Warning "Docker not found - Docker build tests will be skipped"
}

Write-Host ""

# Clean existing Docker files if requested
if ($CleanFirst) {
    Write-Info "Cleaning existing Docker files from test projects..."
    
    $testProjectsRoot = Join-Path $PSScriptRoot "../../test-projects"
    
    if (Test-Path $testProjectsRoot) {
        $dockerFiles = Get-ChildItem -Path $testProjectsRoot -Recurse -Include "Dockerfile", "docker-compose.yml", ".dockerignore", "nginx.conf"
        
        $count = 0
        foreach ($file in $dockerFiles) {
            Remove-Item $file.FullName -Force
            $count++
            if ($Verbose) {
                Write-Host "  Removed: $($file.FullName)"
            }
        }
        
        Write-Success "Cleaned $count Docker files"
    } else {
        Write-Warning "Test projects directory not found: $testProjectsRoot"
    }
    
    Write-Host ""
}

# Install dependencies
Write-Info "Checking dependencies..."
if (-not (Test-Path "node_modules")) {
    Write-Info "Installing dependencies..."
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-ErrorMsg "Failed to install dependencies"
        exit 1
    }
    Write-Success "Dependencies installed"
} else {
    Write-Success "Dependencies already installed"
}

Write-Host ""

# Compile extension
Write-Info "Compiling extension..."
npm run compile
if ($LASTEXITCODE -ne 0) {
    Write-ErrorMsg "Failed to compile extension"
    exit 1
}
Write-Success "Extension compiled"

Write-Host ""

# Compile tests
Write-Info "Compiling tests..."
npm run compile-tests
if ($LASTEXITCODE -ne 0) {
    Write-ErrorMsg "Failed to compile tests"
    exit 1
}
Write-Success "Tests compiled"

Write-Host ""

# Set environment variables
if ($BuildDocker -and $dockerAvailable) {
    $env:RUN_DOCKER_BUILD = "true"
    Write-Info "Docker build testing: ENABLED"
} else {
    $env:RUN_DOCKER_BUILD = "false"
    if ($BuildDocker) {
        Write-Warning "Docker not available - build testing disabled"
    } else {
        Write-Info "Docker build testing: DISABLED (use -BuildDocker to enable)"
    }
}

$env:TEST_TIMEOUT = $Timeout
Write-Info "Test timeout: $Timeout ms"

Write-Host ""

# Run tests
Write-ColorOutput "═══════════════════════════════════════════════════════════" "Cyan"
Write-ColorOutput "Running Integration Tests..." "Cyan"
Write-ColorOutput "═══════════════════════════════════════════════════════════" "Cyan"
Write-Host ""

$startTime = Get-Date

# Run the integration tests
npm run test:integration

$exitCode = $LASTEXITCODE
$endTime = Get-Date
$duration = ($endTime - $startTime).TotalSeconds

Write-Host ""
Write-ColorOutput "═══════════════════════════════════════════════════════════" "Cyan"

if ($exitCode -eq 0) {
    Write-Success "All tests passed! (Duration: $([math]::Round($duration, 2))s)"
    Write-Host ""
    
    # Check if report was generated
    $reportPath = Join-Path $PSScriptRoot "../../AUTO_DOCKER_TEST_REPORT.md"
    if (Test-Path $reportPath) {
        Write-Success "Test report generated: AUTO_DOCKER_TEST_REPORT.md"
        Write-Host ""
        
        # Display summary from report
        $reportContent = Get-Content $reportPath -Raw
        if ($reportContent -match "\*\*Total Projects:\*\* (\d+)") {
            $totalProjects = $matches[1]
        }
        if ($reportContent -match "\*\*Passed:\*\* (\d+)") {
            $passed = $matches[1]
        }
        if ($reportContent -match "\*\*Failed:\*\* (\d+)") {
            $failed = $matches[1]
        }
        
        Write-ColorOutput "Test Summary:" "Cyan"
        Write-Host "  Total Projects: $totalProjects"
        Write-Host "  Passed: $passed" -ForegroundColor Green
        if ($failed -gt 0) {
            Write-Host "  Failed: $failed" -ForegroundColor Red
        } else {
            Write-Host "  Failed: 0" -ForegroundColor Green
        }
        Write-Host ""
        
        # Open report
        Write-Info "Opening test report..."
        Start-Process $reportPath
    }
} else {
    Write-ErrorMsg "Tests failed! (Duration: $([math]::Round($duration, 2))s)"
    Write-Host ""
    Write-Info "Check the test output above for details"
    
    $reportPath = Join-Path $PSScriptRoot "../../AUTO_DOCKER_TEST_REPORT.md"
    if (Test-Path $reportPath) {
        Write-Info "Test report available: AUTO_DOCKER_TEST_REPORT.md"
    }
}

Write-Host ""

# Cleanup environment variables
Remove-Item Env:\RUN_DOCKER_BUILD -ErrorAction SilentlyContinue
Remove-Item Env:\TEST_TIMEOUT -ErrorAction SilentlyContinue

exit $exitCode
