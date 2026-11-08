# One-time local setup and test run for the membership pipeline (Windows PowerShell).
# Author: Ishita Tibrewal
# Usage (from this folder):  powershell -ExecutionPolicy Bypass -File .\setup_local.ps1
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "0/4 Installing GitHub workflows into .github\workflows" -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path ".github\workflows" | Out-Null
if (Test-Path ".\workflows-to-install") {
  Copy-Item ".\workflows-to-install\*.yml" ".github\workflows\" -Force
  Remove-Item ".\workflows-to-install" -Recurse -Force
}
if (Test-Path ".\assoc-pipeline\.github") { Remove-Item ".\assoc-pipeline\.github" -Recurse -Force }

Write-Host "1/4 Creating virtual environment (.venv)" -ForegroundColor Cyan
if (-not (Test-Path ".venv")) { python -m venv .venv }
& .\.venv\Scripts\python.exe -m pip install --upgrade pip -q
& .\.venv\Scripts\python.exe -m pip install -r .\assoc-pipeline\requirements.txt -q

Write-Host "2/4 Running tests (synthetic data)" -ForegroundColor Cyan
Push-Location .\assoc-pipeline
& ..\.venv\Scripts\python.exe -m pytest -q
Pop-Location

Write-Host "3/4 Looking for data files in .\data" -ForegroundColor Cyan
$cur  = ".\data\current.xlsx"
$pri  = ".\data\prior.xlsx"
$sup  = ".\data\supplement.xlsx"
if (-not (Test-Path $cur)) {
  Write-Host "Put this week's All Paids file at $cur (and last year's final list at $pri) then run again." -ForegroundColor Yellow
  exit 0
}
$pyArgs = @("-m","assoc_pipeline.run","--current",(Resolve-Path $cur).Path,"--out",(Join-Path $PSScriptRoot "out"))
if (Test-Path $pri) { $pyArgs += @("--prior",(Resolve-Path $pri).Path) }
if (Test-Path $sup) { $pyArgs += @("--supplement",(Resolve-Path $sup).Path) }

Write-Host "4/4 Running the pipeline" -ForegroundColor Cyan
Push-Location .\assoc-pipeline
Write-Host ("python " + ($pyArgs -join " "))
& ..\.venv\Scripts\python.exe @pyArgs
Pop-Location
Write-Host "Done. Results are in .\out\<date>\  (restricted\ holds lapsed lists with contact details; keep them off OneDrive and GitHub.)" -ForegroundColor Green
