@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

echo ===================================
echo   Hotpulse Windows Kurulum
echo ===================================
echo.

:: ── Yönetici kontrolü ──────────────────────────────────────────────────────
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo HATA: Bu scripti Yönetici olarak calistirin.
    echo Sag tikla -^> "Yönetici olarak çalıştır"
    pause
    exit /b 1
)

:: ── Python kontrolü ────────────────────────────────────────────────────────
where python >nul 2>&1
if %errorlevel% neq 0 (
    echo HATA: Python bulunamadi. https://python.org adresinden kurun.
    pause
    exit /b 1
)

:: ── PostgreSQL kontrolü ────────────────────────────────────────────────────
where psql >nul 2>&1
if %errorlevel% neq 0 (
    echo [0] PostgreSQL bulunamadi. Chocolatey ile kuruluyor...
    echo.

    :: Chocolatey kurulu mu?
    where choco >nul 2>&1
    if %errorlevel% neq 0 (
        echo Chocolatey kuruluyor...
        powershell -NoProfile -ExecutionPolicy Bypass -Command ^
            "Set-ExecutionPolicy Bypass -Scope Process -Force; ^
             [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; ^
             iex ((New-Object Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))"
        :: PATH'i yenile
        call refreshenv 2>nul || set "PATH=%PATH%;%ALLUSERSPROFILE%\chocolatey\bin"
    )

    choco install postgresql15 --params "/Password:postgres" -y
    :: PATH'i güncelle
    set "PATH=%PATH%;C:\Program Files\PostgreSQL\15\bin"
    echo.
    echo PostgreSQL kuruldu. Servis baslatiliyor...
    net start postgresql-x64-15 2>nul || net start postgresql 2>nul || echo Servis zaten calisiyor.
    echo.
) else (
    echo PostgreSQL zaten kurulu.
)

echo.
:: ── Veritabanı oluştur ─────────────────────────────────────────────────────
echo [1] Veritabani olusturuluyor...
echo.
set /p DB_USER="Veritabani kullanici adi (varsayilan: hotpulse): "
if "!DB_USER!"=="" set DB_USER=hotpulse

set /p DB_NAME="Veritabani adi (varsayilan: hotpulse): "
if "!DB_NAME!"=="" set DB_NAME=hotpulse

set /p DB_PASS="Sifre: "
if "!DB_PASS!"=="" set DB_PASS=hotpulse123

echo.
echo Kullanici ve veritabani olusturuluyor...
psql -U postgres -c "CREATE USER !DB_USER! WITH PASSWORD '!DB_PASS!';" 2>nul || echo (Kullanici zaten var)
psql -U postgres -c "CREATE DATABASE !DB_NAME! OWNER !DB_USER!;" 2>nul || echo (Veritabani zaten var)
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE !DB_NAME! TO !DB_USER!;"
echo Veritabani hazir.
echo.

:: ── .env dosyası ───────────────────────────────────────────────────────────
echo [2] .env dosyasi ayarlaniyor...
if not exist "backend\.env" (
    copy "backend\.env.example" "backend\.env" >nul
    echo .env olusturuldu.
)

:: DATABASE_URL satırını güncelle
set DB_URL=postgresql://!DB_USER!:!DB_PASS!@localhost:5432/!DB_NAME!
python -c "
import re, sys
with open('backend/.env', 'r', encoding='utf-8') as f:
    content = f.read()
content = re.sub(r'DATABASE_URL=.*', 'DATABASE_URL=%DB_URL%', content)
with open('backend/.env', 'w', encoding='utf-8') as f:
    f.write(content)
print('DATABASE_URL guncellendi.')
"
echo.

:: ── Python bağımlılıkları ──────────────────────────────────────────────────
echo [3] Python paketleri kuruluyor...
pip install -r backend\requirements.txt
echo.

:: ── Node / pnpm ────────────────────────────────────────────────────────────
echo [4] Node paketleri kuruluyor...
cd backend
pnpm install
cd ..
echo.

:: ── Frontend build ─────────────────────────────────────────────────────────
echo [5] Frontend derleniyor...
cd backend
pnpm --filter @workspace/streamvid run build
if !errorlevel! neq 0 (
    echo HATA: Frontend derlenemedi.
    cd ..
    pause
    exit /b 1
)
cd ..
echo.

:: ── Statik dosyalar ────────────────────────────────────────────────────────
echo [6] Statik dosyalar kopyalaniyor...
rd /s /q backend\static\assets 2>nul
xcopy /s /e /y "backend\artifacts\streamvid\dist\public\*" "backend\static\" >nul
echo.

:: ── Django migrate ─────────────────────────────────────────────────────────
echo [7] Veritabani tablolari olusturuluyor...
cd backend
python manage.py migrate --run-syncdb
python manage.py collectstatic --noinput
cd ..
echo.

:: ── Bitti ──────────────────────────────────────────────────────────────────
echo ===================================
echo   Kurulum tamamlandi!
echo ===================================
echo.
echo Sunucuyu baslatmak icin:
echo   start_windows.bat
echo.
echo Ilk admin olusturmak icin:
echo   cd backend
echo   python manage.py createsuperuser
echo.
echo SQLite verisi aktarmak icin:
echo   sqlite_to_postgres.bat
echo.
pause
