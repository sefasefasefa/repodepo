@echo off
title Soci - Otomatik Kurulum
cd /d %~dp0

echo.
echo =============================================
echo   Soci - Otomatik Kurulum Basliyor
echo =============================================
echo.

REM Python kontrolu
python --version >nul 2>&1
if errorlevel 1 (
    echo [HATA] Python bulunamadi!
    echo Lutfen https://www.python.org/downloads/ adresinden Python 3.11 indirin.
    echo Kurulum sirasinda "Add Python to PATH" kutusunu isaretleyin!
    pause
    exit /b 1
)
echo [OK] Python bulundu.

REM Sanal ortam olustur
if not exist "venv\" (
    echo [1/6] Sanal ortam olusturuluyor...
    python -m venv venv
) else (
    echo [1/6] Sanal ortam zaten var, atlanıyor.
)

REM Aktif et
call venv\Scripts\activate

REM Pip guncelle
echo [2/6] pip guncelleniyor...
python -m pip install --upgrade pip --quiet

REM Bagimliliklar
echo [3/6] Bagimliliklar yukleniyor (bu birkas dakika surabilir)...
pip install -r requirements.txt --quiet
if errorlevel 1 (
    echo [HATA] Bagimliliklar yuklenemedi. Internet baglantinizi kontrol edin.
    pause
    exit /b 1
)
echo [OK] Bagimliliklar yuklendi.

REM .env olustur
if not exist ".env" (
    echo [4/6] .env dosyasi olusturuluyor...
    python -c "import secrets; key=secrets.token_urlsafe(50); lines=open('.env.example').read().replace('your-very-secret-key-change-this-in-production', key).replace('DEBUG=False','DEBUG=True').replace('ALLOWED_HOSTS=yourusername.pythonanywhere.com,.pythonanywhere.com','ALLOWED_HOSTS=localhost,127.0.0.1'); open('.env','w').write(lines)"
    echo [OK] .env olusturuldu (SECRET_KEY otomatik uretildi).
) else (
    echo [4/6] .env zaten var, atlanıyor.
)

REM Migrate
echo [5/6] Veritabani hazirlaniyor...
python manage.py migrate --noinput
if errorlevel 1 (
    echo [HATA] Migration basarisiz.
    pause
    exit /b 1
)

REM Collectstatic
python manage.py collectstatic --noinput --quiet

REM Seed data
echo [6/6] Demo veriler yukleniyor...
python manage.py seed_data --env=dev 2>nul
if errorlevel 1 (
    echo Seed data atlanmis olabilir (zaten yuklu).
)

echo.
echo =============================================
echo   KURULUM TAMAMLANDI!
echo.
echo   Kullanici adi : admin
echo   Sifre         : admin123
echo.
echo   Sunucuyu baslatmak icin: baslat.bat
echo   Veya: waitress-serve --port=8000 config.wsgi:application
echo =============================================
echo.
pause
