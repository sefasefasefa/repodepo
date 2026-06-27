#!/bin/bash
set -e

echo "=== Hotpulse Kurulum ==="
echo ""

# ── İşletim sistemi tespiti ───────────────────────────────────────────────────
detect_os() {
    case "$(uname -s)" in
        Linux*)   echo "linux" ;;
        Darwin*)  echo "mac" ;;
        MINGW*|MSYS*|CYGWIN*) echo "windows" ;;
        *)        echo "unknown" ;;
    esac
}
OS=$(detect_os)
echo "Platform: $OS"
echo ""

# ── 0. PostgreSQL kurulumu ────────────────────────────────────────────────────
if ! command -v psql &>/dev/null; then
    echo "PostgreSQL bulunamadı."
    echo ""

    if [ "$OS" = "linux" ]; then
        echo "[0] PostgreSQL Linux'a kuruluyor..."
        if command -v apt-get &>/dev/null; then
            apt-get update -q
            apt-get install -y postgresql postgresql-contrib
        elif command -v dnf &>/dev/null; then
            dnf install -y postgresql postgresql-server
            postgresql-setup --initdb
        elif command -v yum &>/dev/null; then
            yum install -y postgresql postgresql-server
            postgresql-setup initdb
        fi
        systemctl start postgresql
        systemctl enable postgresql
        echo "✓ PostgreSQL kuruldu ve başlatıldı."

    elif [ "$OS" = "mac" ]; then
        echo "[0] PostgreSQL Mac'e kuruluyor (Homebrew)..."
        brew install postgresql@15
        brew services start postgresql@15
        echo "✓ PostgreSQL kuruldu ve başlatıldı."

    elif [ "$OS" = "windows" ]; then
        echo "Windows'ta PostgreSQL manuel kurulumu gereklidir."
        echo ""
        echo "  Seçenek 1 — winget (PowerShell'de çalıştırın):"
        echo "    winget install PostgreSQL.PostgreSQL"
        echo ""
        echo "  Seçenek 2 — İndirip kurun:"
        echo "    https://www.enterprisedb.com/downloads/postgres-postgresql-downloads"
        echo ""
        echo "PostgreSQL'i kurduktan ve başlattıktan sonra bu scripti tekrar çalıştırın."
        echo ""
        echo "  Ardından aşağıdaki komutları PowerShell/CMD'de çalıştırın:"
        echo "    psql -U postgres -c \"CREATE USER hotpulse WITH PASSWORD 'sifreniz';\""
        echo "    psql -U postgres -c \"CREATE DATABASE hotpulse OWNER hotpulse;\""
        echo ""
        echo "  backend/.env dosyasında şunu ayarlayın:"
        echo "    DATABASE_URL=postgresql://hotpulse:sifreniz@localhost:5432/hotpulse"
        echo ""
        read -p "PostgreSQL'i kurduktan sonra Enter'a basın (atlamak için Ctrl+C)..."
    fi
    echo ""
fi

# ── 0b. PostgreSQL veritabanı oluştur ────────────────────────────────────────
if command -v psql &>/dev/null && [ "$OS" != "windows" ]; then
    echo "PostgreSQL kullanıcı/veritabanı oluşturulsun mu? (e/h)"
    read -r cevap
    if [[ "$cevap" =~ ^[Ee]$ ]]; then
        echo "Veritabanı kullanıcı adı (varsayılan: hotpulse):"
        read -r DB_USER
        DB_USER="${DB_USER:-hotpulse}"

        echo "Şifre:"
        read -rs DB_PASS
        echo ""

        echo "Veritabanı adı (varsayılan: hotpulse):"
        read -r DB_NAME
        DB_NAME="${DB_NAME:-hotpulse}"

        if [ "$OS" = "linux" ]; then
            sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';" 2>/dev/null || \
                sudo -u postgres psql -c "ALTER USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"
            sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};" 2>/dev/null || \
                echo "  (Veritabanı zaten mevcut)"
            sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"
        elif [ "$OS" = "mac" ]; then
            psql postgres -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';" 2>/dev/null || \
                psql postgres -c "ALTER USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"
            psql postgres -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};" 2>/dev/null || \
                echo "  (Veritabanı zaten mevcut)"
        fi

        DB_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}"
        echo "✓ Veritabanı hazır."
        echo "  DATABASE_URL: postgresql://${DB_USER}:***@localhost:5432/${DB_NAME}"
        echo ""
    fi
fi

# ── 1. .env kontrol et ───────────────────────────────────────────────────────
echo "[1/6] Ortam değişkenleri kontrol ediliyor..."
if [ ! -f backend/.env ]; then
    cp backend/.env.example backend/.env
    echo ""
    echo "⚠  backend/.env oluşturuldu."
    if [ -n "$DB_URL" ]; then
        sed -i "s|DATABASE_URL=.*|DATABASE_URL=${DB_URL}|" backend/.env
        echo "✓ DATABASE_URL otomatik ayarlandı."
    else
        echo ""
        echo "   Lütfen backend/.env dosyasını açıp şu satırları düzenleyin:"
        echo "     SECRET_KEY=... (güvenli bir değer girin)"
        echo "     DATABASE_URL=postgresql://kullanici:sifre@localhost:5432/hotpulse"
        echo ""
        if [ "$OS" = "windows" ]; then
            echo "   Düzenlemek için:  notepad backend/.env"
        else
            echo "   Düzenlemek için:  nano backend/.env"
        fi
        echo ""
        read -p "Düzenledikten sonra Enter'a basın..."
    fi
fi

# ── 2. Python bağımlılıkları ──────────────────────────────────────────────────
echo "[2/6] Python paketleri kuruluyor..."
pip install -r backend/requirements.txt

# ── 3. Node / pnpm ───────────────────────────────────────────────────────────
echo "[3/6] Node paketleri kuruluyor..."
cd backend
pnpm install
cd ..

# ── 4. Frontend build ────────────────────────────────────────────────────────
echo "[4/6] Frontend derleniyor..."
cd backend
pnpm --filter @workspace/streamvid run build
cd ..

# ── 5. Build çıktısını Django static klasörüne kopyala ───────────────────────
echo "[5/6] Statik dosyalar kopyalanıyor..."
rm -rf backend/static/assets
cp -r backend/artifacts/streamvid/dist/public/. backend/static/

# ── 6. Django: migrate + collectstatic ───────────────────────────────────────
echo "[6/6] Veritabanı tabloları oluşturuluyor + statik dosyalar toplanıyor..."
cd backend
python manage.py migrate --run-syncdb
python manage.py collectstatic --noinput
cd ..

echo ""
echo "✓ Kurulum tamamlandı!"
echo ""
echo "  Başlatmak için:          ./start.sh"
if [ "$OS" = "linux" ]; then
echo "  Systemd servisi:         sudo systemctl start hotpulse"
fi
echo "  İlk admin oluşturmak:   cd backend && python manage.py createsuperuser"
echo ""
echo "  SQLite verisini PostgreSQL'e aktarmak için:"
echo "    ./sqlite_to_postgres.sh"
echo ""
