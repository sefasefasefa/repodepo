#!/bin/bash
set -e

echo "=== Hotpulse Kurulum ==="
echo ""

# ── venv'deki pip'i PATH'e ekle ───────────────────────────────────────────────
cd "$(dirname "$0")/.."
if [ -d "venv/Scripts" ]; then
    export PATH="$PWD/venv/Scripts:$PATH"
elif [ -d "venv/bin" ]; then
    export PATH="$PWD/venv/bin:$PATH"
fi

# ── İşletim sistemi ───────────────────────────────────────────────────
case "$(uname -s)" in
    MINGW*|MSYS*|CYGWIN*) OS="windows" ;;
    *) OS="linux" ;;
esac
echo "Platform: $OS"
echo ""

# ── 0. PostgreSQL kurulumu ────────────────────────────────────────────────────
if ! command -v psql &>/dev/null; then
    echo "PostgreSQL bulunamadi."
    if [ "$OS" = "windows" ]; then
        echo ""
        echo "Windows'ta PostgreSQL manuel kurulumu gereklidir:"
        echo "  1. PowerShell (Yonetici):"
        echo "     Set-ExecutionPolicy Bypass -Scope Process -Force"
        echo "     [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12"
        echo "     iex ((New-Object Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))"
        echo "     choco install postgresql15 --params /Password:postgres -y"
        echo ""
        echo "  2. Kurulum bittikten sonra bu scripti tekrar calistirin."
        echo ""
        read -p "Enter'a basin..."
        exit 1
    fi
fi

# ── 0b. PostgreSQL veritabani olustur ────────────────────────────────────────
if command -v psql &>/dev/null; then
    echo "PostgreSQL kullanici/veritabani olusturulsun mu? (e/h)"
    read -r cevap
    if [[ "$cevap" =~ ^[Ee]$ ]]; then
        echo "Kullanici adi (varsayilan: hotpulse):"
        read -r DB_USER
        DB_USER="${DB_USER:-hotpulse}"
        echo "Sifre:"
        read -rs DB_PASS
        echo ""
        echo "Veritabani adi (varsayilan: hotpulse):"
        read -r DB_NAME
        DB_NAME="${DB_NAME:-hotpulse}"

        psql -U postgres -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';" 2>/dev/null || \
            psql -U postgres -c "ALTER USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"
        psql -U postgres -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};" 2>/dev/null || \
            echo "  (Veritabani zaten mevcut)"
        psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"

        DB_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}"
        echo "Veritabani hazir: ${DB_URL}"
        echo ""
    fi
fi

# ── 1. .env kontrol et ───────────────────────────────────────────────────────
echo "[1/6] .env kontrol ediliyor..."
if [ ! -f backend/.env ]; then
    cp backend/.env.example backend/.env 2>/dev/null || true
    echo ""
    echo "  backend/.env olusturuldu."
    if [ -n "$DB_URL" ]; then
        sed -i "s|DATABASE_URL=.*|DATABASE_URL=${DB_URL}|" backend/.env
        echo "  DATABASE_URL otomatik ayarlandi."
    fi
    echo ""
fi

# ── 2. Python bağımlılıkları ──────────────────────────────────────────────────
echo "[2/6] Python paketleri kuruluyor..."
pip install -r backend/requirements.txt

# ── 3. Node / pnpm ───────────────────────────────────────────────────────────
echo "[3/6] Node paketleri kuruluyor..."
cd backend
pnpm install
cd ..

# ── 4. Frontend build ────────────────────────────────────────────────────────
echo "[4/6] Frontend derleniyor..."
cd backend
pnpm --filter @workspace/streamvid run build
cd ..

# ── 5. Statik dosyalar ─────────────────────────────────────────────────────
echo "[5/6] Statik dosyalar kopyalaniyor..."
rm -rf backend/static/assets 2>/dev/null || true
cp -r backend/artifacts/streamvid/dist/public/. backend/static/ 2>/dev/null || true

# ── 6. Django: migrate + collectstatic ───────────────────────────────────────
echo "[6/6] Veritabani tablolari + statik dosyalar..."
cd backend
python manage.py migrate --run-syncdb
python manage.py collectstatic --noinput

# ── 7. Django önbelleği temizle ─────────────────────────────────────────────
echo ""
echo "[7/7] Onbellek temizleniyor..."
python manage.py shell -c "
from django.core.cache import cache
cache.clear()
print('  Onbellek temizlendi.')
"

# ── 8. Yayınlanmamış video kontrolü ────────────────────────────────────────
echo ""
echo "[8/7] Video durumu kontrol ediliyor..."
python manage.py shell -c "
from apps.videos.models import Video
total     = Video.objects.count()
published = Video.objects.filter(is_published=True).count()
unpub     = total - published

print(f'  Toplam video : {total}')
print(f'  Yayinda      : {published}')
print(f'  Taslak       : {unpub}')

if total > 0 and published == 0:
    n = Video.objects.filter(is_published=False).update(is_published=True)
    print(f'  Uyari: Hic yayinda video yoktu — {n} video otomatik yayina alindi.')
elif unpub > 0:
    print(f'  Bilgi: {unpub} video hala taslak durumunda (admin panelinden yayinlayabilirsin).')
"

cd ..

# ── 9. Servis yeniden başlatma (sadece systemd varsa) ─────────────────────
if systemctl is-active --quiet hotpulse 2>/dev/null; then
    echo ""
    echo "[9/7] Hotpulse servisi yeniden baslatiliyor..."
    sudo systemctl restart hotpulse && echo "  Servis yeniden baslatildi." || echo "  Servis baslatma basarisiz (manuel: sudo systemctl restart hotpulse)"
fi

echo ""
echo "Kurulum tamamlandi!"
echo ""
echo "  Baslatmak icin:  ./scripts/start.sh"
echo "  Guncellemek icin: ./scripts/update.sh"
echo ""
