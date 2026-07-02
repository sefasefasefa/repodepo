@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

echo.
echo  ╔══════════════════════════════════════════╗
echo  ║      Hotpulse — Windows Kurulum          ║
echo  ╚══════════════════════════════════════════╝
echo.

:: ── Python kontrolü ──────────────────────────────────────────────────────────
python --version >nul 2>&1
if errorlevel 1 (
    echo [HATA] Python bulunamadi. https://www.python.org/downloads/ adresinden kur.
    echo        Kurulum sirasinda "Add Python to PATH" secenegini isaretlemeyi unutma!
    pause
    exit /b 1
)
for /f "tokens=2" %%v in ('python --version 2^>^&1') do set PYVER=%%v
echo [OK] Python %PYVER% bulundu.

:: ── Sanal ortam ──────────────────────────────────────────────────────────────
if not exist venv (
    echo [..] Sanal ortam olusturuluyor...
    python -m venv venv
)
call venv\Scripts\activate.bat

:: ── Bagimliliklar ─────────────────────────────────────────────────────────────
echo [..] Bagimliliklar yukleniyor...
pip install --upgrade pip -q
pip install -r requirements.txt -q
if errorlevel 1 (
    echo [HATA] pip install basarisiz. Internet baglantisini kontrol et.
    pause
    exit /b 1
)
echo [OK] Bagimliliklar yuklendi.

:: ── .env dosyasi ─────────────────────────────────────────────────────────────
if not exist .env (
    echo [..] .env dosyasi olusturuluyor...
    copy .env.example .env >nul
    :: Guvenli rastgele SECRET_KEY uret
    for /f %%k in ('python -c "import secrets; print(secrets.token_urlsafe(50))"') do set SK=%%k
    :: Windows icin powershell ile satir degistir
    powershell -Command "(Get-Content .env) -replace 'your-very-secret-key-change-this-in-production', '%SK%' | Set-Content .env"
    echo [OK] .env olusturuldu. Icindeki degerler (DATABASE_URL, ALLOWED_HOSTS) gozden gecir!
) else (
    echo [OK] .env zaten mevcut, atlanıyor.
)

:: ── Veritabani ───────────────────────────────────────────────────────────────
echo [..] Veritabani migrasyonlari uygulanıyor...
python manage.py migrate --noinput
if errorlevel 1 (
    echo [HATA] migrate basarisiz. .env dosyasindaki DATABASE_URL degerini kontrol et.
    pause
    exit /b 1
)
echo [OK] Veritabani hazir.

:: ── Static dosyalar ──────────────────────────────────────────────────────────
echo [..] Static dosyalar toplanıyor...
python manage.py collectstatic --noinput -v 0
echo [OK] Static dosyalar hazir.

:: ── Admin hesabi ─────────────────────────────────────────────────────────────
echo [..] Admin hesabi olusturuluyor...
python manage.py create_superuser_auto
echo.
echo ════════════════════════════════════════════════════
echo  Kurulum tamamlandi!
echo  Sunucuyu baslatmak icin: baslat.bat
echo ════════════════════════════════════════════════════
echo.
pause
