@echo off
title Soci - Sunucu Baslatiliyor...
cd /d %~dp0

if not exist "venv\Scripts\activate.bat" (
    echo [HATA] Sanal ortam bulunamadi. Lutfen once kurulum adimlarini tamamlayin.
    echo README.md dosyasina bakin.
    pause
    exit /b 1
)

call venv\Scripts\activate

if not exist ".env" (
    echo [HATA] .env dosyasi bulunamadi. .env.example dosyasini kopyalayip .env olusturun.
    pause
    exit /b 1
)

echo.
echo =============================================
echo   Soci Sunucusu Baslatiliyor...
echo   Adres: http://localhost:8000
echo   Durdurmak icin: CTRL+C
echo =============================================
echo.

waitress-serve --host=0.0.0.0 --port=8000 config.wsgi:application
pause
