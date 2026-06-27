#!/bin/bash
set -e

echo "=== Hotpulse Güncelleme ==="

# ── 1. Kodu çek ──────────────────────────────────────────────────────────────
echo "[1/3] Git pull..."
git pull

# ── 2. Veritabanı migrate ─────────────────────────────────────────────────────
echo "[2/3] Veritabanı migrate ediliyor..."
cd backend
python manage.py migrate --noinput

# ── 3. Statik dosyaları topla ─────────────────────────────────────────────────
echo "[3/3] Statik dosyalar toplanıyor..."
python manage.py collectstatic --noinput -v 0
cd ..

echo ""
echo "✓ Güncelleme tamamlandı! Sunucuyu yeniden başlat:"
echo "  cd backend && python -m waitress --port=8000 --threads=4 config.wsgi:application"
