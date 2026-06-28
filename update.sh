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

# ── 2. Kodu guncelle ───────────────────────────────────────────────
echo "[2/6] Kod guncelleniyor..."
if [ "$OS" = "windows" ]; then
    # Windows'ta git gc, pack dosyalarini silerken Defender kilitlemesinden
    # "Should I try again?" sorusu cikiyor. Git bunu CONIN$ C API ile sorar;
    # hicbir env degiskeni veya flag bunu engelleyemez.
    #
    # KALICI COZUM: git fetch yerine GitHub'dan tarball indir.
    # Tarball'da pack/gc islemi yok → Defender'in kilitleyecegi dosya olusmuyor.
    # Tarball yalnizca git-tracked dosyalari icerir; db.sqlite3, .env, media/
    # tarball'da olmadigi icin tar xz onlara dokunmaz.

    ORIGIN=$(git remote get-url origin 2>/dev/null | sed 's|\.git$||')
    if [ -z "$ORIGIN" ]; then
        echo "   [HATA] git remote bulunamadi. 'git remote -v' kontrol edin."
        exit 1
    fi
    TARBALL="${ORIGIN}/archive/refs/heads/main.tar.gz"
    echo "   Indiriliyor: $TARBALL"
    if ! curl -fsSL --max-time 120 "$TARBALL" | tar xz --strip-components=1 2>/dev/null; then
        echo "   [HATA] Tarball indirilemedi! Internet ve repo URL kontrol edin."
        exit 1
    fi
    echo "   Kod guncellendi."
else
    # Linux: normal git pull
    git config gc.auto 0
    git fetch origin
    if ! git merge --ff-only origin/main 2>/dev/null; then
        echo "   Yerel degisiklikler var, remote ustu aliniyor..."
        git reset --hard origin/main
    fi
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
