#!/bin/bash
set -e

echo "=== Hotpulse VDS Kurulum ==="

# ── 1. Python bağımlılıkları ──────────────────────────────────────────────────
echo "[1/5] Python paketleri kuruluyor..."
pip install -r backend/requirements.txt

# ── 2. Node / pnpm ───────────────────────────────────────────────────────────
echo "[2/5] Node paketleri kuruluyor..."
cd backend
pnpm install
cd ..

# ── 3. Frontend build ────────────────────────────────────────────────────────
echo "[3/5] Frontend derleniyor..."
cd backend
pnpm --filter @workspace/streamvid run build
cd ..

# ── 4. Build çıktısını Django static klasörüne kopyala ───────────────────────
echo "[4/5] Statik dosyalar kopyalanıyor..."
rm -rf backend/static/assets
cp -r backend/artifacts/streamvid/dist/public/. backend/static/

# ── 5. Django: migrate + collectstatic ───────────────────────────────────────
echo "[5/5] Veritabanı migrate + static dosyalar toplanıyor..."
cd backend
python manage.py migrate --run-syncdb
python manage.py collectstatic --noinput
cd ..

echo ""
echo "✓ Kurulum tamamlandı!"
echo ""
echo "Başlatmak için:  ./start.sh"
echo "Veya doğrudan:   cd backend && gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 3"
