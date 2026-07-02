@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

echo.
echo  ╔══════════════════════════════════════════╗
echo  ║       Hotpulse — Sunucu Baslatiliyor     ║
echo  ╚══════════════════════════════════════════╝
echo.

:: Sanal ortami etkinlestir
if not exist venv\Scripts\activate.bat (
    echo [HATA] Sanal ortam bulunamadi. Once kurulum.bat calistir.
    pause
    exit /b 1
)
call venv\Scripts\activate.bat

:: .env varligini kontrol et
if not exist .env (
    echo [HATA] .env dosyasi bulunamadi. Once kurulum.bat calistir.
    pause
    exit /b 1
)

:: CPU sayisina gore thread hesapla (CPU * 4, en az 4)
for /f %%c in ('python -c "import os; print(max(4, os.cpu_count()*4))"') do set THREADS=%%c

echo [OK] Threads: %THREADS%
echo [OK] Sunucu baslatiliyor: http://127.0.0.1:8000
echo      Durdurmak icin: Ctrl+C
echo.

waitress-serve ^
    --host=127.0.0.1 ^
    --port=8000 ^
    --threads=%THREADS% ^
    --connection-limit=500 ^
    --channel-timeout=120 ^
    --asyncore-use-poll=true ^
    config.wsgi:application
