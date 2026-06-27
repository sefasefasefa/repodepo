#!/bin/bash
set -e

echo "=== Hotpulse VDS Kurulum ==="
echo ""

# ── 0. PostgreSQL kurulumu ────────────────────────────────────────────────────
if ! command -v psql &>/dev/null; then
    echo "[0] PostgreSQL bulunamadı — kuruluyor..."
    apt-get update -q
    apt-get install -y postgresql postgresql-contrib
    systemctl start postgresql
    systemctl enable postgresql
    echo "✓ PostgreSQL kuruldu ve başlatıldı."
    echo ""
fi

# ── 0b. PostgreSQL kullanıcı ve veritabanı oluştur ───────────────────────────
echo "PostgreSQL veritabanı oluşturulsun mu? (e/h)"
read -r cevap
if [[ "$cevap" =~ ^[Ee]$ ]]; then
    echo "Veritabanı kullanıcı adı (örn: hotpulse):"
    read -r DB_USER
    echo "Şifre:"
    read -rs DB_PASS
    echo ""
    echo "Veritabanı adı (örn: hotpulse):"
    read -r DB_NAME

    sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';" 2>/dev/null || \
        sudo -u postgres psql -c "ALTER USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"
    sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};" 2>/dev/null || \
        echo "  (Veritabanı zaten mevcut)"
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"

    DB_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}"
    echo "✓ Veritabanı hazır."
    echo "  DATABASE_URL: ${DB_URL}"
    echo ""
fi

# ── 1. .env kontrol et ───────────────────────────────────────────────────────
echo "[1/6] Ortam değişkenleri kontrol ediliyor..."
if [ ! -f backend/.env ]; then
    cp backend/.env.example backend/.env
    echo ""
    echo "⚠  backend/.env oluşturuldu."
    if [ -n "$DB_URL" ]; then
        sed -i "s|DATABASE_URL=.*|DATABASE_URL=${DB_URL}|" backend/.env
        echo "✓ DATABASE_URL otomatik ayarlandı."
    else
        echo "   Lütfen backend/.env içindeki DATABASE_URL satırını düzenleyin:"
        echo "   nano backend/.env"
        echo ""
        read -p "Düzenledikten sonra Enter'a basın..."
    fi
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

# ── 5. Build çıktısını Django static klasörüne kopyala ───────────────────────
echo "[5/6] Statik dosyalar kopyalanıyor..."
rm -rf backend/static/assets
cp -r backend/artifacts/streamvid/dist/public/. backend/static/

# ── 6. Django: migrate + collectstatic ───────────────────────────────────────
echo "[6/6] Veritabanı tabloları oluşturuluyor + statik dosyalar toplanıyor..."
cd backend
python manage.py migrate --run-syncdb
python manage.py collectstatic --noinput
cd ..

echo ""
echo "✓ Kurulum tamamlandı!"
echo ""
echo "  Başlatmak için:          ./start.sh"
echo "  Systemd servisi:         sudo systemctl start hotpulse"
echo "  İlk admin oluşturmak:   cd backend && python manage.py createsuperuser"
echo ""
echo "  Mevcut SQLite verisini PostgreSQL'e aktarmak için:"
echo "    ./sqlite_to_postgres.sh"
echo ""
