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

# ── Windows: nginx yolu bul (bir kez bul, sonra kullan) ─────────────────
NGINX_WIN=""
if [ "$OS" = "windows" ]; then
    for p in \
        "C:/nginx/nginx.exe" \
        "C:/Program Files/nginx/nginx.exe" \
        "C:/tools/nginx/nginx.exe" \
        "$USERPROFILE/nginx/nginx.exe"
    do
        if [ -f "$p" ]; then
            NGINX_WIN="$p"
            NGINX_DIR=$(dirname "$p")
            break
        fi
    done
    if [ -z "$NGINX_WIN" ]; then
        # PATH'de var mı?
        NGINX_WIN=$(command -v nginx.exe 2>/dev/null || true)
        [ -n "$NGINX_WIN" ] && NGINX_DIR=$(dirname "$NGINX_WIN")
    fi
fi

# ── 1. Sunucuyu durdur ──────────────────────────────────────────────
echo "[1/6] Sunucu durduruluyor..."
if [ "$OS" = "windows" ]; then
    taskkill //F //IM python.exe 2>/dev/null || true
    taskkill //F //IM waitress-serve.exe 2>/dev/null || true
    # Nginx'i de durdur (graceful)
    if [ -n "$NGINX_WIN" ]; then
        echo "   Nginx durduruluyor..."
        "$NGINX_WIN" -p "$NGINX_DIR" -s quit 2>/dev/null || \
        taskkill //F //IM nginx.exe 2>/dev/null || true
    fi
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

# PostgreSQL kullanılıyorsa önce bağlantıyı test et (5 sn timeout)
# Bağlantı başarısızsa migrate'i atla — asılı kalmak yerine hızlıca geç
_DB_URL="${DATABASE_URL:-}"
_FORCE_SQLITE="${FORCE_SQLITE:-}"
_SKIP_MIGRATE=false

if [ -n "$_DB_URL" ] && [ "$_FORCE_SQLITE" != "true" ] && [ "$_FORCE_SQLITE" != "1" ]; then
    # DATABASE_URL'den host ve port çıkar (postgresql://user:pass@host:port/db)
    _PG_HOST=$(python - <<'PYEOF'
import os, urllib.parse
url = os.environ.get("DATABASE_URL", "")
try:
    p = urllib.parse.urlparse(url)
    print(p.hostname or "localhost")
except Exception:
    print("localhost")
PYEOF
)
    _PG_PORT=$(python - <<'PYEOF'
import os, urllib.parse
url = os.environ.get("DATABASE_URL", "")
try:
    p = urllib.parse.urlparse(url)
    print(p.port or 5432)
except Exception:
    print(5432)
PYEOF
)
    echo "   PostgreSQL baglantisi kontrol ediliyor: $_PG_HOST:$_PG_PORT (5 sn timeout)..."
    # Python ile TCP bağlantı dene (nc/telnet her ortamda yok)
    if ! python - <<PYEOF 2>/dev/null; then
import socket, sys
try:
    s = socket.create_connection(("$_PG_HOST", $_PG_PORT), timeout=5)
    s.close()
    sys.exit(0)
except Exception as e:
    print(f"   [HATA] PostgreSQL'e bagilanamadi: {e}")
    sys.exit(1)
PYEOF
        echo "   [UYARI] PostgreSQL erisilemez — migrate atlaniyor."
        echo "           Servisin calistigini dogrulayin: 'pg_ctl status' veya 'sc query postgresql-*'"
        _SKIP_MIGRATE=true
    else
        echo "   PostgreSQL erislebilir."
    fi
fi

if [ "$_SKIP_MIGRATE" = "false" ]; then
    python manage.py migrate --noinput
fi

# ── 6. Collectstatic ───────────────────────────────────────────────
echo "[6/6] Statik dosyalar toplaniyor..."
if [ "$OS" = "windows" ]; then
    # Windows'ta collectstatic, Vite hash'lerindeki özel karakterler (-/_)
    # nedeniyle OSError [Errno 22] verebiliyor.
    # Çözüm: doğrudan kopyala, Django'yu atla.
    mkdir -p staticfiles
    cp -rf static/. staticfiles/ 2>/dev/null || true
    echo "   Statik dosyalar kopyalandi (Windows modu)."
else
    python manage.py collectstatic --noinput -v 0
fi

# ── 6b. CSS blocking + .gz ön-sıkıştırma + Service Worker ──────────

# CSS non-blocking: blocking <link rel="stylesheet"> → preload+onload
# JS CSS yüklenmesini beklemeden başlar; app-shell skeleton FOUC'u saklar
python - <<'PYEOF'
import re
idx = "staticfiles/index.html"
try:
    with open(idx, encoding="utf-8") as f:
        html = f.read()

    css_match = re.search(r'href=["\']([^"\']+\.css)["\']', html)
    if css_match:
        css_href = css_match.group(1)
        # Zaten non-blocking mı?
        if 'rel="preload" as="style"' in html or "rel='preload' as='style'" in html:
            print("   CSS zaten non-blocking, atlanıyor.")
        else:
            # blocking → non-blocking dönüştür
            blocking = '<link rel="stylesheet" crossorigin href="' + css_href + '">'
            nonblocking = (
                '<link rel="preload" as="style" href="' + css_href + '" onload="this.rel=\'stylesheet\'">'
                + '<noscript><link rel="stylesheet" href="' + css_href + '"></noscript>'
            )
            patched = html.replace(blocking, nonblocking, 1)
            if patched == html:
                # crossorigin olmayan varyant
                blocking2 = '<link rel="stylesheet" href="' + css_href + '">'
                patched = html.replace(blocking2, nonblocking, 1)
            if patched != html:
                with open(idx, "w", encoding="utf-8") as f:
                    f.write(patched)
                print("   CSS non-blocking yapildi (JS artik CSS beklemez).")
            else:
                print("   CSS link degistirilemedi, manuel kontrol gerekebilir.")
    else:
        print("   CSS link bulunamadi, atlanıyor.")
except FileNotFoundError:
    print("   [UYARI] staticfiles/index.html bulunamadi.")
PYEOF

# Pre-compressed .gz dosyaları üret → gzip_static on ile nginx CPU harcanmaz
echo "   .gz on-sıkıştırma yapılıyor..."
python - <<'PYEOF'
import gzip, glob, os

dirs = ["staticfiles/assets", "staticfiles/static"]
total = 0
for d in dirs:
    if not os.path.isdir(d):
        continue
    for ext in ("*.js", "*.css", "*.svg", "*.json"):
        for f in glob.glob(f"{d}/{ext}"):
            gz = f + ".gz"
            with open(f, "rb") as fi:
                data = gzip.compress(fi.read(), compresslevel=9)
            with open(gz, "wb") as fo:
                fo.write(data)
            total += 1
print(f"   {total} .gz dosyasi uretildi.")
PYEOF

# ── 6c. Service Worker — sw.js kopyala + index.html'e kayıt inja ───
_SW_REPO="$(dirname "$0")/backend/artifacts/streamvid/public/sw.js"
_SW_STATIC="staticfiles/sw.js"

# sw.js'i kaynak repodan kopyala (güncel tutar)
if [ -f "$_SW_REPO" ]; then
    cp "$_SW_REPO" "$_SW_STATIC" 2>/dev/null \
        && echo "   sw.js kopyalandi: $_SW_STATIC" \
        || echo "   [UYARI] sw.js kopyalanamadi."
fi

# index.html'de kayıt kodu yoksa enjekte et
_IDX="staticfiles/index.html"
if [ -f "$_IDX" ] && ! grep -q "serviceWorker.register" "$_IDX"; then
    python - <<'PYEOF'
import re, sys
idx = "staticfiles/index.html"
with open(idx, encoding="utf-8") as f:
    html = f.read()

SW_SCRIPT = """
    <!-- Service Worker — tekrar ziyarette JS/CSS diskten gelir (0ms) -->
    <script>
    if('serviceWorker' in navigator){
      window.addEventListener('load',function(){
        navigator.serviceWorker.register('/sw.js',{scope:'/'})
          .then(function(reg){
            reg.addEventListener('updatefound',function(){
              var nw=reg.installing;
              if(nw) nw.addEventListener('statechange',function(){
                if(nw.state==='installed'&&navigator.serviceWorker.controller)
                  console.log('[SW] Yeni surum hazir.');
              });
            });
          }).catch(function(e){console.warn('[SW] Kayit basarisiz:',e);});
      });
    }
    </script>"""

html = html.replace("</body>", SW_SCRIPT + "\n  </body>", 1)
with open(idx, "w", encoding="utf-8") as f:
    f.write(html)
print("   Service Worker kaydi index.html'e eklendi.")
PYEOF
fi

# ── 7. Önbellek ısıt (temizle + hemen yeniden doldur) ───────────────
echo ""
echo "[7/7] Onbellek isitiliyor..."
python manage.py shell -c "
from django.core.cache import cache

# Eski anahtarları temizle (sürüm değişikliklerini geçersiz kıl)
stale_keys = [
    'init:combined:v1', 'init:anon:full:v1', 'init:anon:full:v2',
    'init:anon:full:v3', 'home_page:v2', 'geo_settings:v1',
    'core:defaults_done:v1',
]
cache.delete_many(stale_keys)

# Anonim init yanıtını önceden oluştur → ilk kullanıcı soğuk cache görmez
try:
    from apps.core.views import _build_init_anon, _ANON_INIT_CACHE_KEY, _ANON_INIT_TTL
    result = _build_init_anon()
    cache.set(_ANON_INIT_CACHE_KEY, result, _ANON_INIT_TTL)
    print('  Onbellek isitildi (init + homeData hazir).')
except Exception as e:
    print(f'  [UYARI] Cache isitma basarisiz: {e}')
    print('  Onbellek temizlendi (sonraki istek yeniden dolduracak).')
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
        systemctl reload nginx 2>/dev/null || systemctl restart nginx 2>/dev/null || true
        echo "Sunucu baslatildi (systemd). HTTPS aktif: https://${DOMAIN:-hotpulse.me}"
    else
        exec ./start.sh
    fi
else
    # Windows: önce Waitress'i arka planda başlat, sonra nginx'i yeniden başlat
    if [ -n "$NGINX_WIN" ]; then
        # nginx.conf'u otomatik güncelle
        REPO_NGINX_CONF="$(cd "$(dirname "$0")" && pwd)/nginx.conf"
        NGINX_CONF_DEST="$NGINX_DIR/conf/nginx.conf"
        if [ -f "$REPO_NGINX_CONF" ]; then
            cp "$REPO_NGINX_CONF" "$NGINX_CONF_DEST" 2>/dev/null && \
                echo "   nginx.conf guncellendi: $NGINX_CONF_DEST" || \
                echo "   [UYARI] nginx.conf kopyalanamadi."
        fi

        # Proxy cache dizini yoksa oluştur
        mkdir -p "C:/nginx/cache" 2>/dev/null || true

        # Çalışıyor mu? Reload, değilse başlat
        if tasklist 2>/dev/null | grep -qi "nginx.exe"; then
            echo "   Nginx yeniden yukleniyor (reload)..."
            "$NGINX_WIN" -p "$NGINX_DIR" -s reload 2>/dev/null && \
                echo "   Nginx yeniden yuklendi." || \
                echo "   [UYARI] Nginx reload basarisiz, manuel baslatmaniz gerekebilir."
        else
            echo "   Nginx baslatiliyor: $NGINX_WIN"
            (cd "$NGINX_DIR" && "$NGINX_WIN" -p "$NGINX_DIR") &
            sleep 1
            if tasklist 2>/dev/null | grep -qi "nginx.exe"; then
                echo "   Nginx calisiyor."
            else
                echo "   [UYARI] Nginx baslatılamadı — manuel olarak baslatın."
            fi
        fi
    else
        echo "   [BILGI] Nginx bulunamadı (C:\\nginx\\nginx.exe yok)."
        echo "          Nginx'i kurmak için: https://nginx.org/en/download.html"
    fi
    exec ./start.sh
fi
