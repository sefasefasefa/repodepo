#!/bin/bash
# SQLite → PostgreSQL veri aktarma scripti
# Çalıştırmadan önce backend/.env içinde DATABASE_URL=postgresql://... olmalı
set -e

echo "=== SQLite → PostgreSQL Veri Aktarma ==="
echo ""

SQLITE_PATH="backend/db.sqlite3"

# ── Kontroller ────────────────────────────────────────────────────────────────
if [ ! -f "$SQLITE_PATH" ]; then
    echo "HATA: $SQLITE_PATH bulunamadı."
    exit 1
fi

if [ ! -f "backend/.env" ]; then
    echo "HATA: backend/.env bulunamadı. Önce setup.sh çalıştırın."
    exit 1
fi

# DATABASE_URL'nin PostgreSQL olduğunu kontrol et
DB_URL=$(grep "^DATABASE_URL=" backend/.env | cut -d= -f2-)
if [[ "$DB_URL" != postgresql* ]]; then
    echo "HATA: backend/.env içinde DATABASE_URL bir PostgreSQL URL'si olmalı."
    echo "       Şu an: $DB_URL"
    exit 1
fi

echo "Kaynak:  $SQLITE_PATH"
echo "Hedef:   $DB_URL"
echo ""
echo "⚠  Bu işlem PostgreSQL'deki mevcut verilerin ÜZERİNE YAZAR."
echo "   Devam etmek istiyor musunuz? (e/h)"
read -r onay
if [[ ! "$onay" =~ ^[Ee]$ ]]; then
    echo "İptal edildi."
    exit 0
fi

cd backend

# ── 1. PostgreSQL tablolarını oluştur ─────────────────────────────────────────
echo ""
echo "[1/4] PostgreSQL tabloları oluşturuluyor (migrate)..."
python manage.py migrate --run-syncdb --noinput

# ── 2. SQLite'tan JSON'a dışa aktar ──────────────────────────────────────────
echo "[2/4] SQLite verisi dışa aktarılıyor..."
DUMP_FILE="/tmp/hotpulse_sqlite_dump_$(date +%Y%m%d_%H%M%S).json"

# Content types ve permissions hariç tut (bunlar migrate ile otomatik gelir)
python manage.py dumpdata \
    --database=default \
    --natural-foreign \
    --natural-primary \
    --exclude=contenttypes \
    --exclude=auth.permission \
    --exclude=admin.logentry \
    --indent=2 \
    -o "$DUMP_FILE"

echo "   Dump dosyası: $DUMP_FILE"

# ── 3. PostgreSQL'e geçiş yap ────────────────────────────────────────────────
echo "[3/4] Veriler PostgreSQL'e aktarılıyor..."

# Geçici olarak SQLite kullan, dump al, sonra Postgres'e yükle
# DATABASE_URL'yi Postgres'e çevirip loaddata yap
python manage.py loaddata "$DUMP_FILE"

# ── 4. Sıra (sequence) değerlerini güncelle ──────────────────────────────────
echo "[4/4] Otomatik ID sayaçları güncelleniyor..."
python manage.py shell -c "
from django.db import connection
with connection.cursor() as cursor:
    cursor.execute('''
        SELECT 'SELECT SETVAL(' || quote_literal(quote_ident(sequence_schema) || '.' || quote_ident(sequence_name)) ||
               ', COALESCE(MAX(' || quote_ident(column_name) || '), 1)) FROM ' ||
               quote_ident(table_schema) || '.' || quote_ident(table_name) || ';'
        FROM information_schema.columns
        JOIN information_schema.sequences
          ON sequence_name = regexp_replace(column_default, $$.*'(.+)'.*$$, E'\\\\1')
        WHERE column_default LIKE 'nextval%'
          AND table_schema = 'public'
    ''')
    sqls = cursor.fetchall()
    for sql, in sqls:
        try:
            cursor.execute(sql)
        except Exception as e:
            pass
print('Sequence güncelleme tamamlandı.')
"

cd ..

echo ""
echo "✓ Veri aktarma tamamlandı!"
echo ""
echo "  Kontrol için:  cd backend && python manage.py shell -c \"from apps.accounts.models import User; print(User.objects.count(), 'kullanici')\""
echo "  Dump dosyası:  $DUMP_FILE  (silebilirsiniz)"
echo ""
