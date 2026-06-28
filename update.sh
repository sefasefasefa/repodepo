#!/bin/bash
set -e

echo "=== Hotpulse Guncelleme ==="

# ── venv'deki pip'i PATH'e ekle (Git Bash uyumlulugu) ─────────────────────
cd "$(dirname "$0")"
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

# ── 1. Sunucuyu durdur ──────────────────────────────────────────────
echo "[1/6] Sunucu durduruluyor..."
if [ "$OS" = "windows" ]; then
    taskkill //F //IM python.exe 2>/dev/null || true
    taskkill //F //IM waitress-serve.exe 2>/dev/null || true
else
    pkill -f "gunicorn" 2>/dev/null || true
    pkill -f "waitress" 2>/dev/null || true
fi
sleep 1

# ── 2. Kodu cek (conflict varsa remote ustu al) ────────────────────────
echo "[2/6] Git pull..."
git config gc.auto 0
git config gc.autopacklimit 0
git config maintenance.auto false
git config core.fscache true

if [ "$OS" = "windows" ]; then
    # Windows'ta antivirus pack dosyalarini kilitler; git gc adiminda
    # "Should I try again?" sorar ve script takilir.
    # Cozum: fetch'i arka planda calistir, gc adiminda takilirsaa zorla sonlandir.
    # Fetch (yeni objeler indirme) onceden tamamlanir; sadece cleanup kesilir.

    # Onceki kalan git.exe islemleri temizle
    taskkill //F //IM git.exe 2>/dev/null || true
    sleep 1
    git maintenance unregister --force 2>/dev/null || true

    # Fetch'i arka planda baslat
    git -c gc.auto=0 -c gc.autopacklimit=0 -c maintenance.auto=false \
        -c receive.autogc=false fetch origin &
    GIT_BG=$!

    # En fazla 90 saniye bekle; gc adiminda takilirsaa zorla kes
    ELAPSED=0
    while kill -0 "$GIT_BG" 2>/dev/null; do
        sleep 2
        ELAPSED=$((ELAPSED + 2))
        if [ $ELAPSED -ge 90 ]; then
            echo "   [UYARI] git gc takildi, atlanyor (yeni kodlar zaten indirildi)..."
            kill -9 "$GIT_BG" 2>/dev/null || true
            taskkill //F //IM git.exe 2>/dev/null || true
            sleep 1
            break
        fi
    done
else
    git fetch origin
fi

if ! git merge --ff-only origin/main 2>/dev/null; then
    echo "   Yerel degisiklikler var, remote ustu aliniyor..."
    git reset --hard origin/main
fi

# ── 3. Python bağımlılıkları ────────────────────────────────────────────
echo "[3/6] Python paketleri guncelleniyor..."
python -m pip install -r backend/requirements.txt -q || pip install -r backend/requirements.txt -q

# ── 4. Frontend build (React → statik dosyalar) ─────────────────────────
echo "[4/6] Frontend derleniyor..."
if command -v pnpm &>/dev/null; then
    cd backend
    pnpm install --no-frozen-lockfile
    pnpm rebuild esbuild 2>/dev/null || true
    pnpm --filter @workspace/streamvid run build
    cd ..
    echo "   Statik dosyalar kopyalaniyor..."
    rm -rf backend/static/assets 2>/dev/null || true
    cp -r backend/artifacts/streamvid/dist/public/. backend/static/ 2>/dev/null || true
    echo "   Frontend build tamamlandi."
else
    echo "   [UYARI] pnpm bulunamadi — frontend build atlandi."
    echo "   Kurmak icin: npm install -g pnpm"
fi

# ── 5. Migrate ─────────────────────────────────────────────────────────
echo "[5/6] Veritabani migrate ediliyor..."
cd backend
python manage.py migrate --noinput

# ── 6. Collectstatic ───────────────────────────────────────────────
echo "[6/6] Statik dosyalar toplaniyor..."
python manage.py collectstatic --noinput -v 0
cd ..

echo ""
echo "Guncelleme tamamlandi! Sunucu baslatiliyor..."
echo ""
exec ./start.sh
