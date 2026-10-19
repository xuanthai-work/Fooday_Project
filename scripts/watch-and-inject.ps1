# File: scripts/watch-and-inject.ps1
# Theo doi justdoit.md va goi truc tiep OpenCode tiep tuc session bang --continue

$taskFile = Join-Path $PSScriptRoot "..\justdoit.md"
$taskFile = [System.IO.Path]::GetFullPath($taskFile)

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "OPENCODE NATIVE RUNNER (CONTINUE SESSION)" -ForegroundColor Green
Write-Host "File task: $taskFile" -ForegroundColor Gray
Write-Host "Che do: opencode run --continue (An toan 100%, khong dung SendKeys)" -ForegroundColor DarkCyan
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
                Write-Host "Dang tiep tuc session OpenCode: opencode run --continue..." -ForegroundColor Cyan
                Write-Host "============================================================" -ForegroundColor Green
                Write-Host ""

                # 1. Doi status sang IN_PROGRESS
                $updatedContent = $content -replace "status:\s*APPROVED", "status: IN_PROGRESS"
                [System.IO.File]::WriteAllText($taskFile, $updatedContent)

                # 2. Goi truc tiep OpenCode CLI tiep tuc session cu
                $prompt = "Hay doc file justdoit.md va thuc hien cac buoc duoc yeu cau."
                
                # Chay truc tiep tren Terminal nay, stream live 100% ket qua
                & opencode run --continue $prompt

                Write-Host ""
                Write-Host "============================================================" -ForegroundColor Cyan
                Write-Host "OPENCODE DA HOAN THANH TASK!" -ForegroundColor Green
                
                # 3. Cap nhat status sang DONE de Gemini biet ma Audit
                $finalContent = [System.IO.File]::ReadAllText($taskFile)
                $finalContent = $finalContent -replace "status:\s*IN_PROGRESS", "status: DONE"
                [System.IO.File]::WriteAllText($taskFile, $finalContent)

                Write-Host "Da cap nhat justdoit.md sang status: DONE!" -ForegroundColor Yellow
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
