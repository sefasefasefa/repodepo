#!/bin/bash
set -e

echo "=== Hotpulse Güncelleme ==="

# ── İşletim sistemi tespiti ───────────────────────────────────────────────────
case "$(uname -s)" in
    Linux*)   OS="linux" ;;
    Darwin*)  OS="mac" ;;
    MINGW*|MSYS*|CYGWIN*) OS="windows" ;;
    *)        OS="unknown" ;;
esac

# ── 1. Çalışan sunucuyu durdur ───────────────────────────────────────────────
echo "[1/5] Sunucu durduruluyor..."
if [ "$OS" = "windows" ]; then
    taskkill //F //IM python.exe 2>/dev/null || true
    taskkill //F //IM waitress-serve.exe 2>/dev/null || true
else
    pkill -f "gunicorn" 2>/dev/null || true
    pkill -f "waitress" 2>/dev/null || true
fi
sleep 1

# ── 2. Kodu çek ──────────────────────────────────────────────────────────────
echo "[2/5] Git pull..."
git pull

# ── 3. Python bağımlılıkları güncelle ────────────────────────────────────────
echo "[3/5] Python paketleri güncelleniyor..."
pip install -r backend/requirements.txt -q

# ── 4. Veritabanı migrate ─────────────────────────────────────────────────────
echo "[4/5] Veritabanı migrate ediliyor..."
cd backend
python manage.py migrate --noinput

# ── 5. Statik dosyaları topla ─────────────────────────────────────────────────
echo "[5/5] Statik dosyalar toplanıyor..."
python manage.py collectstatic --noinput -v 0
cd ..

echo ""
echo "✓ Güncelleme tamamlandı! Sunucu başlatılıyor..."
echo ""

exec ./start.sh
