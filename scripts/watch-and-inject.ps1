# File: scripts/watch-and-inject.ps1
# Theo doi justdoit.md va dieu phoi OpenCode voi Context Isolation va Telemetry

$taskFile = Join-Path $PSScriptRoot "..\justdoit.md"
$taskFile = [System.IO.Path]::GetFullPath($taskFile)
$logDir   = Join-Path $PSScriptRoot "..\docs\logs"
if (!(Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
$logFile  = Join-Path $logDir "last_opencode_run.log"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "OPENCODE SMART RUNNER (ISOLATED SESSIONS & TELEMETRY)" -ForegroundColor Green
Write-Host "File task: $taskFile" -ForegroundColor Gray
Write-Host "Log file:  $logFile" -ForegroundColor Gray
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Dang theo doi justdoit.md... (Doi status: APPROVED)" -ForegroundColor Yellow
Write-Host ""

while ($true) {
    if (Test-Path $taskFile) {
        try {
            $content = [System.IO.File]::ReadAllText($taskFile)
            
            if ($content -match "status:\s*APPROVED") {
                Write-Host ""
                Write-Host "============================================================" -ForegroundColor Green
                Write-Host "PHAT HIEN TASK DA DUYET (status: APPROVED)!" -ForegroundColor Green
                
                # 1. Doi status sang IN_PROGRESS
                $updatedContent = $content -replace "status:\s*APPROVED", "status: IN_PROGRESS"
                [System.IO.File]::WriteAllText($taskFile, $updatedContent)

                # 2. Xac dinh che do Session (Chong tran Context)
                $isContinue = $content -match "session:\s*continue"
                $cmdArgs = @("run")
                if ($isContinue) {
                    $cmdArgs += "--continue"
                    Write-Host "Che do: CONTINUE session cu" -ForegroundColor Yellow
                } else {
                    Write-Host "Che do: FRESH session moi (Chong tran context)" -ForegroundColor Cyan
                }

                $prompt = "Doc file justdoit.md va thuc hien chinh xac cac yeu cau trong do."
                $cmdArgs += $prompt

                Write-Host "Dang thuc thi OpenCode: opencode $($cmdArgs -join ' ')..." -ForegroundColor DarkCyan
                Write-Host "============================================================" -ForegroundColor Green
                Write-Host ""

                # 3. Chay OpenCode, dong thoi stream live terminal va ghi vao file log
                & opencode @cmdArgs 2>&1 | Tee-Object -FilePath $logFile
                $exitCode = $LASTEXITCODE

                Write-Host ""
                Write-Host "============================================================" -ForegroundColor Cyan
                Write-Host "OPENCODE DA HOAN TAT LENH (Exit Code: $exitCode)" -ForegroundColor $(if ($exitCode -eq 0) { "Green" } else { "Red" })
                
                # 4. Thu thap Telemetry (Bao cao hien truong tu Git)
                Write-Host "Dang thu thap Git Telemetry..." -ForegroundColor Gray
                $gitChangedFiles = (git status --short) | Out-String
                $gitDiffSummary  = (git diff --stat) | Out-String

                # 5. Cap nhat ket qua vao justdoit.md
                $finalContent = [System.IO.File]::ReadAllText($taskFile)
                $finalStatus = if ($exitCode -eq 0) { "DONE" } else { "FAILED" }

                $summaryReport = @"

---
## Dev Execution Telemetry
- **Timestamp**: $((Get-Date).ToString("yyyy-MM-dd HH:mm:ss"))
- **Exit Code**: $exitCode ($finalStatus)
- **Session Mode**: $(if ($isContinue) { "continue" } else { "fresh" })
- **Changed Files**:
```text
$gitChangedFiles
```
- **Git Diff Summary**:
```text
$gitDiffSummary
```
> Full log terminal: `docs/logs/last_opencode_run.log`
"@

                $finalContent = $finalContent -replace "status:\s*IN_PROGRESS", "status: $finalStatus"
                $finalContent = $finalContent + "`n" + $summaryReport
                [System.IO.File]::WriteAllText($taskFile, $finalContent)

                Write-Host "Da cap nhat justdoit.md sang status: $finalStatus kem Telemetry!" -ForegroundColor $(if ($exitCode -eq 0) { "Green" } else { "Red" })
                Write-Host "Dang tiep tuc theo doi task tiep theo..." -ForegroundColor Gray
                Write-Host "============================================================" -ForegroundColor Cyan
                Write-Host ""
            }
        } catch {
            # Bo qua loi file lock tam thoi
        }
    }
    Start-Sleep -Milliseconds 1000
}
