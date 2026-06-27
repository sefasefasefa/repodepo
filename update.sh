#!/bin/bash
set -e

echo "=== Hotpulse Güncelleme ==="

# ── 1. Çalışan waitress'i durdur ─────────────────────────────────────────────
echo "[1/4] Waitress durduruluyor..."
pkill -f "waitress" 2>/dev/null || true

# ── 2. Kodu çek ──────────────────────────────────────────────────────────────
echo "[2/4] Git pull..."
git pull

# ── 3. Veritabanı migrate ─────────────────────────────────────────────────────
echo "[3/4] Veritabanı migrate ediliyor..."
cd backend
python manage.py migrate --noinput

# ── 4. Statik dosyaları topla ─────────────────────────────────────────────────
echo "[4/4] Statik dosyalar toplanıyor..."
python manage.py collectstatic --noinput -v 0

# ── Waitress başlat ───────────────────────────────────────────────────────────
echo ""
echo "✓ Güncelleme tamamlandı! Sunucu başlatılıyor..."
echo ""
python -m waitress --port=8000 --threads=4 config.wsgi:application
