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

# ══════════════════════════════════════════════════════════════════════
# [0] LINUX: Nginx + HTTPS kurulumu (sadece ilk seferinde, sonra atlar)
# ══════════════════════════════════════════════════════════════════════
if [ "$OS" = "linux" ]; then

    # Domain adini .env dosyasindan oku
    ENV_FILE="backend/.env"
    DOMAIN=""
    if [ -f "$ENV_FILE" ]; then
        RAW=$(grep -E "^ALLOWED_HOSTS=" "$ENV_FILE" | cut -d= -f2 | tr -d ' ')
        # Virgülle ayrılmış listeden ilk www olmayan, localhost olmayan domaini al
        for d in $(echo "$RAW" | tr ',' ' '); do
            case "$d" in
                localhost|127.*|0.0.0.0|"") continue ;;
                www.*) DOMAIN="$d"; break ;;
                *) DOMAIN="$d" ;;
            esac
        done
    fi

    # Domain bulunamazsa sor
    if [ -z "$DOMAIN" ]; then
        echo ""
        echo "   [?] Domain adi bulunamadi. Ornek: hotpulse.me"
        read -rp "   Domain adini girin: " DOMAIN
    fi

    # www. ve kök domain her ikisini de hazirla
    DOMAIN_BARE="${DOMAIN#www.}"
    DOMAIN_WWW="www.${DOMAIN_BARE}"
    NGINX_CONF="/etc/nginx/sites-available/hotpulse"
    NGINX_ENABLED="/etc/nginx/sites-enabled/hotpulse"
    CERT_PATH="/etc/letsencrypt/live/${DOMAIN_BARE}/fullchain.pem"

    # ── Nginx yuklu degil ise kur ─────────────────────────────────────
    if ! command -v nginx &>/dev/null; then
        echo "[0] Nginx + Certbot kuruluyor..."
        apt-get update -qq
        apt-get install -y -qq nginx certbot python3-certbot-nginx
        echo "   Nginx kuruldu."
    fi

    # ── Nginx site config yoksa olustur ──────────────────────────────
    if [ ! -f "$NGINX_CONF" ]; then
        echo "[0] Nginx yapılandırması oluşturuluyor..."
        cat > "$NGINX_CONF" <<NGINXCONF
server {
    listen 80;
    server_name ${DOMAIN_BARE} ${DOMAIN_WWW};

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
    }

    client_max_body_size 500M;
}
NGINXCONF

        # Eski default site'i devre disi birak
        rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

        # Yeni config'i aktif et
        ln -sf "$NGINX_CONF" "$NGINX_ENABLED"
        nginx -t && systemctl enable nginx && systemctl restart nginx
        echo "   Nginx yapılandırması tamamlandı (${DOMAIN_BARE})."
    fi

    # ── SSL sertifikasi yoksa al ──────────────────────────────────────
    if [ ! -f "$CERT_PATH" ]; then
        echo "[0] SSL sertifikası alınıyor (Let's Encrypt)..."
        echo "   Domain: ${DOMAIN_BARE} ve ${DOMAIN_WWW}"
        echo ""
        certbot --nginx \
            -d "${DOMAIN_BARE}" \
            -d "${DOMAIN_WWW}" \
            --non-interactive \
            --agree-tos \
            --redirect \
            -m "admin@${DOMAIN_BARE}" 2>/dev/null || \
        certbot --nginx \
            -d "${DOMAIN_BARE}" \
            --non-interactive \
            --agree-tos \
            --redirect \
            -m "admin@${DOMAIN_BARE}"
        echo "   HTTPS aktif! https://${DOMAIN_BARE}"
    fi

fi
# ══════════════════════════════════════════════════════════════════════

# ── 1. Sunucuyu durdur ──────────────────────────────────────────────
echo "[1/6] Sunucu durduruluyor..."
if [ "$OS" = "windows" ]; then
    taskkill //F //IM python.exe 2>/dev/null || true
    taskkill //F //IM waitress-serve.exe 2>/dev/null || true
else
    # Systemd servisi varsa onu durdur, yoksa direkt pkill
    if systemctl is-active --quiet hotpulse 2>/dev/null; then
        systemctl stop hotpulse
    else
        pkill -f "gunicorn" 2>/dev/null || true
        pkill -f "waitress" 2>/dev/null || true
    fi
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
# NOT: Built dosyalar git'te takip edilir (backend/static/).
# Windows'ta pnpm build calistirmak gereksiz ve sorun cikariyor.
# Sadece Linux'ta (Replit/CI ortami gibi) build yapilir.
echo "[4/6] Frontend kontrol ediliyor..."
if [ "$OS" = "windows" ]; then
    echo "   Windows: git'ten gelen onceden derlenmiş dosyalar kullaniliyor."
    echo "   (pnpm build atlandı — backend/static/ git'ten geldi)"
else
    # Linux: pnpm varsa build yap, yoksa git'teki dosyaları kullan
    if command -v pnpm &>/dev/null; then
        cd backend
        pnpm install --no-frozen-lockfile
        pnpm rebuild esbuild 2>/dev/null || true
        # Build başarılıysa statik dosyaları güncelle; başarısızsa git'tekini koru
        if pnpm --filter @workspace/streamvid run build; then
            cd ..
            echo "   Statik dosyalar guncelleniyor..."
            rm -rf backend/static/assets 2>/dev/null || true
            cp -r backend/artifacts/streamvid/dist/public/. backend/static/ 2>/dev/null || true
            echo "   Frontend build tamamlandi."
        else
            cd ..
            echo "   [UYARI] Build basarisiz — git'teki statik dosyalar korunuyor."
        fi
    else
        echo "   pnpm bulunamadi — git'teki statik dosyalar kullaniliyor."
    fi
fi

# ── 5. Migrate ─────────────────────────────────────────────────────────
echo "[5/6] Veritabani migrate ediliyor..."
cd backend
python manage.py migrate --noinput

# ── 6. Collectstatic ───────────────────────────────────────────────
echo "[6/6] Statik dosyalar toplaniyor..."
python manage.py collectstatic --noinput -v 0

# ── 7. Önbellek temizle ─────────────────────────────────────────────
echo ""
echo "[7/7] Onbellek temizleniyor..."
python manage.py shell -c "
from django.core.cache import cache
cache.clear()
print('  Onbellek temizlendi.')
"

# ── 8. Video durumu ─────────────────────────────────────────────────
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
    print(f'  Bilgi: {unpub} video taslak durumunda (admin panelinden yayinlayabilirsin).')
else:
    print(f'  Tum videolar yayinda.')
"

cd ..

echo ""
echo "Guncelleme tamamlandi! Sunucu baslatiliyor..."
echo ""

# ── Sunucuyu baslat ────────────────────────────────────────────────
if [ "$OS" = "linux" ]; then
    # Systemd servisi varsa onu kullan (daha guvenilir)
    if systemctl list-unit-files hotpulse.service &>/dev/null 2>&1; then
        systemctl start hotpulse
        echo "Sunucu baslatildi (systemd). HTTPS aktif: https://${DOMAIN:-hotpulse.me}"
    else
        exec ./start.sh
    fi
else
    exec ./start.sh
fi
