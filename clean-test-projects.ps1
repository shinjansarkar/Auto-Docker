#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Clean Docker files from test projects

.DESCRIPTION
    Removes all generated Docker files from test-projects directory
    Useful for resetting test environment

.PARAMETER Path
    Path to test projects directory (default: ./test-projects)

.PARAMETER DryRun
    Show what would be deleted without actually deleting

.EXAMPLE
    .\clean-test-projects.ps1

.EXAMPLE
    .\clean-test-projects.ps1 -DryRun
#>

param(
    [string]$Path = ".\test-projects",
    [switch]$DryRun
)

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "   Clean Test Projects Docker Files" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $Path)) {
    Write-Host "✗ Test projects directory not found: $Path" -ForegroundColor Red
    exit 1
}

Write-Host "Scanning: $Path" -ForegroundColor Cyan
Write-Host ""

# Files to clean
$filesToClean = @(
    "Dockerfile",
    "docker-compose.yml",
    ".dockerignore",
    "nginx.conf"
)

$totalRemoved = 0
$projectsCleaned = @()

# Find all test project directories
$projectDirs = Get-ChildItem -Path $Path -Directory -Recurse | Where-Object {
    $_.Parent.Name -match "backend|frontend|fullstack"
}

foreach ($projectDir in $projectDirs) {
    $filesInProject = @()
    
    foreach ($fileName in $filesToClean) {
        $filePath = Join-Path $projectDir.FullName $fileName
        
        if (Test-Path $filePath) {
            $filesInProject += $fileName
            
            if ($DryRun) {
                Write-Host "  [DRY RUN] Would remove: $filePath" -ForegroundColor Yellow
            } else {
                Remove-Item $filePath -Force
                Write-Host "  ✓ Removed: $fileName from $($projectDir.Name)" -ForegroundColor Green
            }
            
            $totalRemoved++
        }
    }
    
    if ($filesInProject.Count -gt 0) {
        $projectsCleaned += $projectDir.Name
    }
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan

if ($DryRun) {
    Write-Host "DRY RUN: Would remove $totalRemoved files from $($projectsCleaned.Count) projects" -ForegroundColor Yellow
} else {
    Write-Host "✓ Cleaned $totalRemoved files from $($projectsCleaned.Count) projects" -ForegroundColor Green
}

if ($projectsCleaned.Count -gt 0) {
    Write-Host ""
    Write-Host "Projects cleaned:" -ForegroundColor Cyan
    foreach ($project in $projectsCleaned) {
        Write-Host "  • $project" -ForegroundColor Gray
    }
}

Write-Host ""
