@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

echo === Hotpulse Guncelleme ===
echo.

:: ── Çalışan sunucuyu durdur ────────────────────────────────────────────────
echo [1/4] Sunucu durduruluyor...
taskkill /F /IM python.exe 2>nul || echo (Calisan sunucu bulunamadi)
timeout /t 2 /nobreak >nul

:: ── Kodu çek ──────────────────────────────────────────────────────────────
echo [2/4] Git pull...
git pull
echo.

:: ── Python bağımlılıkları ─────────────────────────────────────────────────
echo [3/4] Python paketleri guncelleniyor...
pip install -r backend\requirements.txt -q
echo.

:: ── Migrate + collectstatic ───────────────────────────────────────────────
echo [4/4] Veritabani migrate ediliyor...
cd backend
python manage.py migrate --noinput
python manage.py collectstatic --noinput -v 0
cd ..
echo.

echo Guncelleme tamamlandi! Sunucu baslatiliyor...
echo.
call start_windows.bat
