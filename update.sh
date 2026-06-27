#!/bin/bash
set -e

echo "=== Hotpulse Güncelleme ==="

# ── 1. Kodu çek ──────────────────────────────────────────────────────────────
echo "[1/5] Git pull..."
git pull

# ── 2. Python bağımlılıkları ──────────────────────────────────────────────────
echo "[2/5] Python paketleri kontrol ediliyor..."
pip install -r backend/requirements.txt -q

# ── 3. Frontend yeniden derle ─────────────────────────────────────────────────
echo "[3/5] Frontend derleniyor... (bu biraz sürebilir)"
cd backend
pnpm install -s
pnpm --filter @workspace/streamvid run build
cd ..

# ── 4. Statik dosyaları kopyala ───────────────────────────────────────────────
echo "[4/5] Statik dosyalar kopyalanıyor..."
rm -rf backend/static/assets
cp -r backend/artifacts/streamvid/dist/public/. backend/static/

# ── 5. Migrate + collectstatic ────────────────────────────────────────────────
echo "[5/5] Veritabanı migrate + static derleniyor..."
cd backend
python manage.py migrate --run-syncdb --noinput
python manage.py collectstatic --noinput -v 0
cd ..

echo ""
echo "✓ Güncelleme tamamlandı! Sunucuyu yeniden başlat:"
echo "  ./start.sh"
echo "  veya: cd backend && python -m waitress --port=8000 --threads=4 config.wsgi:application"
