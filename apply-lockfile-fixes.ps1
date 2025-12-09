# Script to apply lockfile fixes to llmService.ts
# This script fixes all instances where package*.json needs to be replaced with explicit lockfile copies

$filePath = "src\llmService.ts"
$content = Get-Content $filePath -Raw -Encoding UTF8

Write-Host "Applying lockfile fixes to $filePath..." -ForegroundColor Cyan

# Backup original file
Copy-Item $filePath "$filePath.backup" -Force
Write-Host "Created backup: $filePath.backup" -ForegroundColor Green

# Fix 1: Replace all instances of "COPY package*.json ./" with the new pattern
# This is the simple COPY line without comments
$oldPattern1 = 'COPY package\*\.json \./'
$newPattern1 = 'COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./'

$count1 = ([regex]::Matches($content, $oldPattern1)).Count
$content = $content -replace $oldPattern1, $newPattern1
Write-Host "Replaced $count1 instances of 'COPY package*.json ./'" -ForegroundColor Yellow

# Fix 2: Enhance the RUN commands to support yarn and pnpm
# Pattern: Simple npm ci fallback (used in Next.js deps stage)
$oldPattern2 = 'RUN if \[ -f package-lock\.json \]; then npm ci --prefer-offline; \\\\[\r\n\s]+else npm install; fi'
$newPattern2 = @'
RUN if [ -f package-lock.json ]; then npm ci --prefer-offline; \\
    elif [ -f yarn.lock ]; then yarn install --frozen-lockfile; \\
    elif [ -f pnpm-lock.yaml ]; then corepack enable && pnpm install --frozen-lockfile; \\
    else npm install; fi
'@

$count2 = ([regex]::Matches($content, $oldPattern2)).Count
$content = $content -replace $oldPattern2, $newPattern2
Write-Host "Enhanced $count2 simple npm ci commands to support yarn/pnpm" -ForegroundColor Yellow

# Save the modified content
$content | Set-Content $filePath -Encoding UTF8 -NoNewline
Write-Host "`nFixes applied successfully!" -ForegroundColor Green
Write-Host "Modified file: $filePath" -ForegroundColor Green
Write-Host "Backup saved: $filePath.backup" -ForegroundColor Green

Write-Host "`nSummary:" -ForegroundColor Cyan
Write-Host "- Replaced $count1 COPY commands" -ForegroundColor White
Write-Host "- Enhanced $count2 RUN commands" -ForegroundColor White
Write-Host "`nPlease review the changes and test the extension." -ForegroundColor Yellow
