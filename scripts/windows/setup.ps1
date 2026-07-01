Write-Host "=== Hotpulse Windows Kurulum ===" -ForegroundColor Cyan

# 1. Python bagliliklar
Write-Host "[1/5] Python paketleri kuruluyor..." -ForegroundColor Yellow
pip install -r backend\requirements.txt
if ($LASTEXITCODE -ne 0) { Write-Host "HATA: pip install basarisiz" -ForegroundColor Red; exit 1 }

# 2. Node paketleri
Write-Host "[2/5] Node paketleri kuruluyor..." -ForegroundColor Yellow
Set-Location backend
pnpm install
if ($LASTEXITCODE -ne 0) { Write-Host "HATA: pnpm install basarisiz" -ForegroundColor Red; Set-Location ..; exit 1 }
Set-Location ..

# 3. Frontend build
Write-Host "[3/5] Frontend derleniyor..." -ForegroundColor Yellow
Set-Location backend
pnpm --filter "@workspace/streamvid" run build
if ($LASTEXITCODE -ne 0) { Write-Host "HATA: Frontend build basarisiz" -ForegroundColor Red; Set-Location ..; exit 1 }
Set-Location ..

# 4. Build ciktisini static klasorune kopyala
Write-Host "[4/5] Statik dosyalar kopyalaniyor..." -ForegroundColor Yellow
if (Test-Path "backend\static\assets") { Remove-Item -Recurse -Force "backend\static\assets" }
if (Test-Path "backend\static\index.html") { Remove-Item -Force "backend\static\index.html" }
Copy-Item -Recurse -Force "backend\artifacts\streamvid\dist\public\*" "backend\static\"
Write-Host "Kopyalandi. Icerik:" -ForegroundColor Green
Get-ChildItem "backend\static\"

# 5. Django migrate + collectstatic
Write-Host "[5/5] Veritabani migrate + static dosyalar..." -ForegroundColor Yellow
Set-Location backend
python manage.py migrate --run-syncdb
python manage.py collectstatic --noinput
Set-Location ..

Write-Host ""
Write-Host "Kurulum tamamlandi!" -ForegroundColor Green
Write-Host "Baslatmak icin: .\start.ps1" -ForegroundColor Cyan
