#!/bin/bash
set -e

echo "=== Hotpulse Guncelleme ==="

# ── venv'deki pip'i PATH'e ekle (Git Bash uyumlulugu) ─────────────────────
# scripts/ altında olduğumuz için bir üst dizine (proje kökü) geç
cd "$(dirname "$0")/.."
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

# ══════════════════════════════════════════════════════════════════════
# [WIN-FIX] Windows: Bozuk ayarları otomatik tespit et ve düzelt
# ══════════════════════════════════════════════════════════════════════
if [ "$OS" = "windows" ]; then
    echo ""
    echo "=== [WIN-FIX] Sistem kontrolu ve otomatik duzeltme ==="

    # ── FIX-1: Windows Firewall — 80, 443, 8000 portlarini ac ────────
    echo "   [FIX-1] Firewall kurallari kontrol ediliyor..."
    for PORT in 80 443 8000; do
        RULE_EXISTS=$(netsh advfirewall firewall show rule name="hotpulse-${PORT}" 2>/dev/null | grep -c "Rule Name" || true)
        if [ "$RULE_EXISTS" = "0" ]; then
            netsh advfirewall firewall add rule \
                name="hotpulse-${PORT}" \
                dir=in action=allow protocol=TCP \
                localport=${PORT} enable=yes profile=any 2>/dev/null \
                && echo "      Port ${PORT} kurali eklendi." \
                || echo "      [UYARI] Port ${PORT} kurali eklenemedi."
        else
            echo "      Port ${PORT} kurali zaten var. OK"
        fi
    done

    # ── FIX-2: Zombie nginx process'leri temizle ──────────────────────
    echo "   [FIX-2] Eski nginx process'leri temizleniyor..."
    NGINX_COUNT=$(tasklist 2>/dev/null | grep -ci "nginx.exe" || true)
    if [ "$NGINX_COUNT" -gt 4 ] 2>/dev/null; then
        echo "      $NGINX_COUNT nginx process tespit edildi — hepsi durduruluyor..."
        taskkill //F //IM nginx.exe 2>/dev/null || true
        sleep 1
        echo "      Nginx temizlendi."
    else
        echo "      Nginx process sayisi normal ($NGINX_COUNT). OK"
    fi

    # ── FIX-3: Nginx cache dizini ─────────────────────────────────────
    echo "   [FIX-3] Nginx cache dizini kontrol ediliyor..."
    if [ -n "$NGINX_DIR" ] && [ ! -d "${NGINX_DIR}/cache" ]; then
        mkdir -p "${NGINX_DIR}/cache" 2>/dev/null \
            && echo "      Cache dizini olusturuldu: ${NGINX_DIR}/cache" \
            || echo "      [UYARI] Cache dizini olusturulamadi."
    else
        mkdir -p "C:/nginx/cache" 2>/dev/null || true
        echo "      Cache dizini mevcut. OK"
    fi

    # ── FIX-4: SSL sertifika dosyalari var mi ────────────────────────
    echo "   [FIX-4] SSL sertifika dosyalari kontrol ediliyor..."
    CERT_FILE="${NGINX_DIR}/conf/cloudflare-cert.pem"
    KEY_FILE="${NGINX_DIR}/conf/cloudflare-key.pem"
    CERT_OK=true
    if [ ! -f "$CERT_FILE" ] || [ ! -s "$CERT_FILE" ]; then
        echo "      [UYARI] SSL sertifika dosyasi eksik: $CERT_FILE"
        echo "      Cloudflare Dashboard > SSL/TLS > Origin Server > Create Certificate"
        CERT_OK=false
    else
        echo "      SSL sertifika mevcut. OK"
    fi
    if [ ! -f "$KEY_FILE" ] || [ ! -s "$KEY_FILE" ]; then
        echo "      [UYARI] SSL anahtar dosyasi eksik: $KEY_FILE"
        CERT_OK=false
    else
        echo "      SSL anahtar mevcut. OK"
    fi

    # ── FIX-5: Nginx config syntax kontrolu ──────────────────────────
    echo "   [FIX-5] Nginx config syntax kontrol ediliyor..."
    if [ -n "$NGINX_WIN" ]; then
        if (cd "$NGINX_DIR" && "$NGINX_WIN" -t 2>/dev/null); then
            echo "      Nginx config gecerli. OK"
        else
            echo "      [UYARI] Nginx config hatali — repo'dan kopyalaniyor..."
            REPO_NGINX_CONF="$(cd "$(dirname "$0")" && pwd)/../infra/nginx/nginx-windows.conf"
            if [ -f "$REPO_NGINX_CONF" ]; then
                cp "$REPO_NGINX_CONF" "${NGINX_DIR}/conf/nginx.conf" 2>/dev/null \
                    && echo "      Nginx config yenilendi." \
                    || echo "      [HATA] Config kopyalanamadi!"
            fi
        fi
    fi

    # ── FIX-6: Port catisma kontrolu ──────────────────────────────────
    echo "   [FIX-6] Port 443 ve 80 kontrolu..."
    PORT443=$(netstat -ano 2>/dev/null | grep -c "0.0.0.0:443" || true)
    PORT80=$(netstat -ano 2>/dev/null | grep -c "0.0.0.0:80" || true)
    if [ "$PORT443" = "0" ] && [ "$PORT80" = "0" ]; then
        echo "      [UYARI] Nginx hicbir portu dinlemiyor — baslatilacak."
    else
        echo "      Port 80: ${PORT80} listener, Port 443: ${PORT443} listener. OK"
    fi

    # ── FIX-7: backend/.env ALLOWED_HOSTS kontrolu ───────────────────
    echo "   [FIX-7] ALLOWED_HOSTS kontrolu..."
    ENV_FILE="backend/.env"
    if [ -f "$ENV_FILE" ]; then
        AH_LINE=$(grep "^ALLOWED_HOSTS=" "$ENV_FILE" 2>/dev/null || true)
        if [ -n "$AH_LINE" ]; then
            AH_VAL=$(echo "$AH_LINE" | cut -d= -f2)
            # waitress.invalid ve 127.0.0.1 yoksa ekle
            CHANGED=false
            if ! echo "$AH_VAL" | grep -q "waitress.invalid"; then
                AH_VAL="${AH_VAL},waitress.invalid"
                CHANGED=true
            fi
            if ! echo "$AH_VAL" | grep -q "127.0.0.1" && ! echo "$AH_VAL" | grep -q "\*"; then
                AH_VAL="${AH_VAL},127.0.0.1"
                CHANGED=true
            fi
            if [ "$CHANGED" = "true" ]; then
                # Satiri guncelle (Windows-uyumlu sed)
                python - <<PYEOF 2>/dev/null
import re
with open("$ENV_FILE", encoding="utf-8") as f:
    content = f.read()
new_content = re.sub(r'^ALLOWED_HOSTS=.*', 'ALLOWED_HOSTS=$AH_VAL', content, flags=re.MULTILINE)
with open("$ENV_FILE", "w", encoding="utf-8") as f:
    f.write(new_content)
print("      ALLOWED_HOSTS guncellendi.")
PYEOF
            else
                echo "      ALLOWED_HOSTS zaten dogru. OK"
            fi
        else
            echo "      ALLOWED_HOSTS satiri bulunamadi — varsayilan kullanilacak (*)."
        fi
    else
        echo "      .env dosyasi yok — ayarlar ortam degiskenlerinden okunacak."
    fi

    echo "=== [WIN-FIX] Kontrol tamamlandi ==="
    echo ""
fi
# ══════════════════════════════════════════════════════════════════════

# ── 1. Sunucuyu durdur ──────────────────────────────────────────────
echo "[1/6] Sunucu durduruluyor..."
if [ "$OS" = "windows" ]; then
    taskkill //F //IM python.exe 2>/dev/null || true
    taskkill //F //IM waitress-serve.exe 2>/dev/null || true
    # Nginx'i de durdur (tum instance'lari temizle)
    taskkill //F //IM nginx.exe 2>/dev/null || true
    sleep 1
    if [ -n "$NGINX_WIN" ]; then
        echo "   Tum nginx process'leri durduruldu."
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
    # Neden tarball/clone, neden git fetch değil:
    #   git fetch → Defender yeni pack dosyasini kilitler → git gc silerken
    #   CONIN$ üzerinden "try again?" sorusu açar → hicbir env/flag kapatamaz.
    #
    # YENİ STRATEJİ: git clone --depth=1 (sadece son commit, gecmis yok)
    #   - Taze klasore clone → eski pack yok → gc calismiyor → CONIN$ yok
    #   - Sadece kaynak kodunu kopyala, media/ atlaniyor
    #   - media/ sunucuda kullanicilarin yuklediginden degismez; yeniden
    #     indirmek gereksiz ve yavas → mevcut dosyalar yerinde kalir
    #   - Sonuc: sadece kaynak kodu indirilir (~MB), medya atlanir (~GB)
    #
    # YEDEK: clone basarisiz olursa tarball (medyasiz, sadece src)

    GIT_URL=$(git remote get-url origin 2>/dev/null)
    ORIGIN=$(echo "$GIT_URL" | sed 's|\.git$||')
    if [ -z "$GIT_URL" ]; then
        echo "   [HATA] git remote bulunamadi. 'git remote -v' kontrol edin."
        exit 1
    fi

    CLONE_TMP="/tmp/hotpulse_clone_$$"
    _UPDATE_OK=false

    # ── Yöntem 1: git clone --depth=1 --filter=blob:limit:512k ─────
    # --filter=blob:limit:512k → 512 KB'dan büyük blob'lar (video/gorsel)
    # hic indirilmez; sadece kaynak kodu gelir. GitHub bu filtreyi destekler.
    echo "   git clone --depth=1 --filter=blob:limit:512k deneniyor..."
    echo "   (buyuk media dosyalari atlanacak — sadece kaynak kodu inecek)"
    if GIT_TERMINAL_PROMPT=0 \
       git clone \
           --depth=1 \
           --branch main \
           --single-branch \
           --filter=blob:limit:512k \
           -c gc.auto=0 \
           -c gc.autoDetach=false \
           --quiet \
           "$GIT_URL" "$CLONE_TMP" 2>/dev/null; then

        echo "   Clone basarili — kaynak dosyalari kopyalaniyor (media/ atlanıyor)..."
        # media/ atlanıyor: sunucudaki kullanici yukleme dosyalari korunuyor
        # .git/ atlanıyor: calisma dizinindeki git geçmişine dokunma
        (
          cd "$CLONE_TMP" && \
          tar cf - \
              --exclude='.git' \
              --exclude='./media' \
              --exclude='./backend/media' \
              . 2>/dev/null
        ) | tar xf - 2>/dev/null
        _UPDATE_OK=true
    else
        echo "   [UYARI] git clone basarisiz — tarball yontemine geciyor..."
    fi
    rm -rf "$CLONE_TMP"

    # ── Yöntem 2: tarball (medyasız extract) ────────────────────────
    if [ "$_UPDATE_OK" = "false" ]; then
        TARBALL="${ORIGIN}/archive/refs/heads/main.tar.gz"
        # PID tabanlı yol — mktemp KULLANMA.
        # mktemp önce boş bir placeholder dosyası oluşturur;
        # aria2c aynı isimde dosya görünce çakışmayı önlemek için
        # .1 ekler (tmp.XXX.tar.1.gz) → tar bulamaz → "bozuk" hatası.
        # PID yolu önceden var olmaz, aria2c tam istenen isimle yazar.
        TARBALL_TMP="/tmp/hotpulse_update_$$.tar.gz"
        rm -f "$TARBALL_TMP"   # önceki başarısız denemeden kalan varsa temizle
        echo "   Indiriliyor: $TARBALL"

        _DL_OK=false
        if command -v aria2c &>/dev/null; then
            echo "   aria2c — 16 paralel parca..."
            if aria2c \
                    --split=16 --max-connection-per-server=16 \
                    --min-split-size=1M --connect-timeout=30 \
                    --max-tries=3 --retry-wait=5 \
                    --console-log-level=warn --summary-interval=10 \
                    --out="$(basename "$TARBALL_TMP")" \
                    --dir="$(dirname "$TARBALL_TMP")" \
                    "$TARBALL"; then
                _DL_OK=true
            else
                echo "   [UYARI] aria2c basarisiz — curl ile deneniyor..."
                rm -f "$TARBALL_TMP"
            fi
        fi
        if [ "$_DL_OK" = "false" ]; then
            curl -fSL \
                --connect-timeout 30 \
                --speed-limit 512 --speed-time 60 \
                --retry 3 --retry-delay 5 \
                --output "$TARBALL_TMP" \
                "$TARBALL" || { rm -f "$TARBALL_TMP"; echo "   [HATA] Indirme basarisiz!"; exit 1; }
        fi

        # Extract: media/ ve db.sqlite3 atlanıyor (mevcut dosyalar korunuyor)
        if ! tar xz --strip-components=1 \
                --exclude='*/media/*' \
                --exclude='*/backend/db.sqlite3' \
                -f "$TARBALL_TMP" 2>/dev/null; then
            rm -f "$TARBALL_TMP"
            echo "   [HATA] Tarball acılamadi — dosya bozuk olabilir."
            exit 1
        fi
        rm -f "$TARBALL_TMP"
        _UPDATE_OK=true
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

# pip saglik kontrolu — bozuksa otomatik onar
echo "   pip saglik kontrolu..."
if ! python -m pip --version >/dev/null 2>&1; then
    echo "   [UYARI] pip bozuk veya erisemiyor — onariliyor..."
    # ensurepip ile yeniden yukle
    python -m ensurepip --upgrade 2>/dev/null || true
    # Hala calismiyor mu? pip'i sifirdan yukle
    if ! python -m pip --version >/dev/null 2>&1; then
        echo "   pip sifirdan yukleniyor..."
        curl -fsSL https://bootstrap.pypa.io/get-pip.py -o /tmp/get-pip.py 2>/dev/null && \
            python /tmp/get-pip.py --quiet 2>/dev/null || true
        rm -f /tmp/get-pip.py
    fi
    echo "   pip onarildi."
else
    echo "   pip calisior. OK"
fi

# Gereksinimleri yukle — hata olursa 2. kez dene
if ! python -m pip install -r backend/requirements.txt -q 2>/dev/null; then
    echo "   [UYARI] 1. deneme basarisiz, 3 sn sonra tekrar deneniyor..."
    sleep 3
    python -m pip install -r backend/requirements.txt --no-cache-dir -q || \
        echo "   [HATA] Paket yuklemesi basarisiz! Internet baglantisini kontrol edin."
fi

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

# ── 8. Bozuk thumbnail'ları düzelt ─────────────────────────────────
echo ""
echo "[8/7] Bozuk thumbnail'lar kontrol ediliyor..."
python manage.py fix_missing_thumbnails --async 2>/dev/null || \
    echo "   [BILGI] fix_missing_thumbnails komutu bulunamadi, atlanıyor."

# ── 9. Video durumu ─────────────────────────────────────────────────
echo ""
echo "[9/7] Video durumu kontrol ediliyor..."
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
        exec "$(dirname "$0")/start.sh"
    fi
else
    # Windows: önce Waitress'i arka planda başlat, sonra nginx'i yeniden başlat
    if [ -n "$NGINX_WIN" ]; then
        # nginx.conf'u otomatik güncelle
        REPO_NGINX_CONF="$(cd "$(dirname "$0")" && pwd)/../infra/nginx/nginx-windows.conf"
        NGINX_CONF_DEST="$NGINX_DIR/conf/nginx.conf"
        if [ -f "$REPO_NGINX_CONF" ]; then
            cp "$REPO_NGINX_CONF" "$NGINX_CONF_DEST" 2>/dev/null && \
                echo "   nginx.conf guncellendi: $NGINX_CONF_DEST" || \
                echo "   [UYARI] nginx.conf kopyalanamadi."
        fi

        # Proxy cache dizini yoksa oluştur
        mkdir -p "C:/nginx/cache" 2>/dev/null || true

        # Her seferinde temiz baslatma: once durdur, sonra basla
        taskkill //F //IM nginx.exe 2>/dev/null || true
        sleep 1
        echo "   Nginx baslatiliyor: $NGINX_WIN"
        (cd "$NGINX_DIR" && "$NGINX_WIN") &
        sleep 2
        NGINX_RUNNING=$(tasklist 2>/dev/null | grep -ci "nginx.exe" || true)
        if [ "$NGINX_RUNNING" -gt 0 ] 2>/dev/null; then
            echo "   Nginx calisiyor ($NGINX_RUNNING process). OK"
            # Port 443 dinleniyor mu?
            sleep 1
            P443=$(netstat -ano 2>/dev/null | grep -c ":443 " || true)
            P80=$(netstat -ano 2>/dev/null | grep -c ":80 " || true)
            echo "   Port 80:  ${P80} listener"
            echo "   Port 443: ${P443} listener"
            if [ "$P443" = "0" ]; then
                echo "   [UYARI] Port 443 dinlenmiyor! SSL sertifika dosyalarini kontrol edin:"
                echo "          ${NGINX_DIR}/conf/cloudflare-cert.pem"
                echo "          ${NGINX_DIR}/conf/cloudflare-key.pem"
                echo "   Nginx error log: ${NGINX_DIR}/logs/error.log"
            fi
        else
            echo "   [HATA] Nginx baslatılamadı!"
            echo "   Hata icin bak: ${NGINX_DIR}/logs/error.log"
        fi
    else
        echo "   [BILGI] Nginx bulunamadı (C:\\nginx\\nginx.exe yok)."
        echo "          Nginx'i kurmak için: https://nginx.org/en/download.html"
    fi
    exec "$(dirname "$0")/start.sh"
fi
