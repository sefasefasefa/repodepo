@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

echo === SQLite -^> PostgreSQL Veri Aktarma ===
echo.

:: ── Kontroller ────────────────────────────────────────────────────────────
if not exist "backend\db.sqlite3" (
    echo HATA: backend\db.sqlite3 bulunamadi.
    pause
    exit /b 1
)
if not exist "backend\.env" (
    echo HATA: backend\.env bulunamadi. Once setup_windows.bat calistirin.
    pause
    exit /b 1
)

:: DATABASE_URL PostgreSQL mi kontrol et
python -c "
import os, sys
from dotenv import load_dotenv
load_dotenv('backend/.env')
url = os.environ.get('DATABASE_URL', '')
if not url.startswith('postgresql'):
    print('HATA: DATABASE_URL postgresql:// ile baslamali.')
    print('Su an:', url)
    sys.exit(1)
print('Hedef:', url.split('@')[-1])
"
if %errorlevel% neq 0 (
    pause
    exit /b 1
)

echo.
echo UYARI: Bu islem PostgreSQL deki mevcut verilerin UZERINE YAZAR.
set /p onay="Devam etmek istiyor musunuz? (e/h): "
if /i "!onay!" neq "e" (
    echo Iptal edildi.
    pause
    exit /b 0
)

cd backend

:: ── 1. Migrate ────────────────────────────────────────────────────────────
echo.
echo [1/3] PostgreSQL tablolari olusturuluyor...
python manage.py migrate --run-syncdb --noinput

:: ── 2. Dump ───────────────────────────────────────────────────────────────
echo [2/3] SQLite verisi disa aktariliyor...
set DUMP_FILE=..\hotpulse_dump_%date:~-4%%date:~3,2%%date:~0,2%.json
python manage.py dumpdata ^
    --natural-foreign ^
    --natural-primary ^
    --exclude=contenttypes ^
    --exclude=auth.permission ^
    --exclude=admin.logentry ^
    --indent=2 ^
    -o "%DUMP_FILE%"
echo Dump dosyasi: %DUMP_FILE%

:: ── 3. Loaddata ───────────────────────────────────────────────────────────
echo [3/3] Veriler PostgreSQL e yukleniyor...
python manage.py loaddata "%DUMP_FILE%"

cd ..

echo.
echo =============================================
echo   Veri aktarma tamamlandi!
echo =============================================
echo.
echo Kontrol icin:
echo   cd backend
echo   python manage.py shell -c "from apps.accounts.models import User; print(User.objects.count(), 'kullanici')"
echo.
echo Dump dosyasini silebilirsiniz: %DUMP_FILE%
echo.
pause
