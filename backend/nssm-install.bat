@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

:: ══════════════════════════════════════════════════════════════════════════
::  Hotpulse — NSSM ile Windows Servisi Kurulumu
::
::  Gereksinim: NSSM (Non-Sucking Service Manager)
::    İndir: https://nssm.cc/download
::    nssm.exe'yi PATH'e veya aşağıdaki klasöre koy.
::
::  Kullanım: Bu dosyayı YÖNETİCİ olarak çalıştır
::            (sağ tık → Yönetici olarak çalıştır)
:: ══════════════════════════════════════════════════════════════════════════

:: ── AYARLAR — sadece burası doldurulacak ─────────────────────────────────
set "SERVIS_ADI=HotpulseDjango"
set "PROJE_DIR=C:\hotpulse\backend"
set "NSSM_EXE=C:\nssm\win64\nssm.exe"
:: ─────────────────────────────────────────────────────────────────────────

:: Admin kontrolü
net session >nul 2>&1
if errorlevel 1 (
    echo [HATA] Bu scripti Yonetici olarak calistir.
    pause
    exit /b 1
)

:: NSSM varlık kontrolü
if not exist "%NSSM_EXE%" (
    echo [HATA] NSSM bulunamadi: %NSSM_EXE%
    echo        https://nssm.cc/download adresinden indir.
    echo        nssm.exe yolunu NSSM_EXE degiskeniyle guncelle.
    pause
    exit /b 1
)

:: Python ve Waitress kontrolü
set "PYTHON=%PROJE_DIR%\venv\Scripts\python.exe"
set "WAITRESS=%PROJE_DIR%\venv\Scripts\waitress-serve.exe"

if not exist "%PYTHON%" (
    echo [HATA] Python bulunamadi: %PYTHON%
    echo        Once kurulum.bat ile sanal ortami olustur.
    pause
    exit /b 1
)
if not exist "%WAITRESS%" (
    echo [HATA] waitress-serve bulunamadi: %WAITRESS%
    echo        pip install waitress komutuyla yukle.
    pause
    exit /b 1
)

:: .env kontrolü
if not exist "%PROJE_DIR%\.env" (
    echo [HATA] .env bulunamadi: %PROJE_DIR%\.env
    echo        Once kurulum.bat calistir.
    pause
    exit /b 1
)

:: Log klasörü
if not exist "%PROJE_DIR%\logs" mkdir "%PROJE_DIR%\logs"

:: CPU'ya göre thread sayısı
for /f %%c in ('"%PYTHON%" -c "import os; print(max(4, os.cpu_count()*4))"') do set THREADS=%%c
echo [OK] Threads: %THREADS%

:: Varsa mevcut servisi durdur ve sil
"%NSSM_EXE%" stop "%SERVIS_ADI%" >nul 2>&1
"%NSSM_EXE%" remove "%SERVIS_ADI%" confirm >nul 2>&1

echo [..] Servis olusturuluyor: %SERVIS_ADI%

:: Servis kur
"%NSSM_EXE%" install "%SERVIS_ADI%" "%WAITRESS%"

:: Parametreler
"%NSSM_EXE%" set "%SERVIS_ADI%" AppParameters ^
    --host=127.0.0.1 ^
    --port=8000 ^
    "--threads=%THREADS%" ^
    --connection-limit=500 ^
    --channel-timeout=120 ^
    --asyncore-use-poll=true ^
    config.wsgi:application

:: Çalışma dizini ve servis ayarları
"%NSSM_EXE%" set "%SERVIS_ADI%" AppDirectory   "%PROJE_DIR%"
"%NSSM_EXE%" set "%SERVIS_ADI%" DisplayName    "Hotpulse Django (Waitress)"
"%NSSM_EXE%" set "%SERVIS_ADI%" Description    "hotpulse.me Django backend — waitress 127.0.0.1:8000"
"%NSSM_EXE%" set "%SERVIS_ADI%" Start          SERVICE_AUTO_START
"%NSSM_EXE%" set "%SERVIS_ADI%" AppRestartDelay 5000

:: Log ayarları (10 MB döndür)
"%NSSM_EXE%" set "%SERVIS_ADI%" AppStdout      "%PROJE_DIR%\logs\django-stdout.log"
"%NSSM_EXE%" set "%SERVIS_ADI%" AppStderr      "%PROJE_DIR%\logs\django-stderr.log"
"%NSSM_EXE%" set "%SERVIS_ADI%" AppRotateFiles 1
"%NSSM_EXE%" set "%SERVIS_ADI%" AppRotateBytes 10485760

:: Servisi başlat
"%NSSM_EXE%" start "%SERVIS_ADI%"
if errorlevel 1 (
    echo [HATA] Servis baslatılamadi. Logları kontrol et: %PROJE_DIR%\logs\
    pause
    exit /b 1
)

echo.
echo ══════════════════════════════════════════════════════
echo  Servis kuruldu ve baslatildi!
echo.
echo  Ad    : %SERVIS_ADI%
echo  Durum : sc query %SERVIS_ADI%
echo  Durdur: nssm stop "%SERVIS_ADI%"
echo  Loglar: %PROJE_DIR%\logs\
echo ══════════════════════════════════════════════════════
echo.
pause
