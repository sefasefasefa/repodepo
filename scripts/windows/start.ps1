Write-Host "=== Hotpulse baslatiliyor (port 8000) ===" -ForegroundColor Cyan
Write-Host "Durdurmak icin: CTRL+C" -ForegroundColor Yellow
Write-Host ""
Set-Location backend
python -m waitress --port=8000 --threads=4 config.wsgi:application
