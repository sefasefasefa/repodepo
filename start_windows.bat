@echo off
chcp 65001 >nul
echo Hotpulse sunucusu baslatiliyor...

:: Scriptin bulunduğu klasörden backend'e geç
cd /d "%~dp0backend"

:: ── CPU sayısına göre thread hesapla ──────────────────────────────────────
:: Formül: CPU * 4  (I/O ağırlıklı Django için iyi denge)
:: Min 8, max 64
for /f "tokens=2 delims==" %%i in ('wmic cpu get NumberOfLogicalProcessors /value ^| find "="') do set CPU_COUNT=%%i
set CPU_COUNT=%CPU_COUNT: =%

set /a THREADS=%CPU_COUNT% * 4
if %THREADS% LSS 8  set THREADS=8
if %THREADS% GTR 64 set THREADS=64

echo CPU: %CPU_COUNT% core  ^|  Waitress thread sayisi: %THREADS%
echo.

:: ── Waitress başlat ────────────────────────────────────────────────────────
:: --asyncore-use-poll : Windows'ta select() yerine poll() — daha verimli
:: --connection-limit  : eş zamanlı bağlantı limiti
:: --channel-timeout   : boşta kalan bağlantıyı kes (saniye)
:: --cleanup-interval  : kapalı bağlantıları temizle (saniye)
:: --backlog           : TCP bağlantı kuyruğu
python -m waitress ^
    --port=8000 ^
    --threads=%THREADS% ^
    --connection-limit=1000 ^
    --channel-timeout=120 ^
    --cleanup-interval=30 ^
    --backlog=1024 ^
    --asyncore-use-poll=True ^
    config.wsgi:application
