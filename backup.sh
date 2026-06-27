#!/bin/bash
set -e

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="backups"
BACKUP_FILE="$BACKUP_DIR/hotpulse_backup_$TIMESTAMP"

mkdir -p "$BACKUP_DIR"

echo "=== Hotpulse Yedekleme - $TIMESTAMP ==="

# ── 1. Veritabanı dışa aktar ─────────────────────────────────────────────────
echo "[1/3] Veritabanı dışa aktarılıyor..."
cd backend
python manage.py dumpdata \
  accounts \
  subscriptions \
  crosspost \
  videos \
  social \
  notifications \
  tokens \
  affiliate \
  core \
  --natural-foreign \
  --natural-primary \
  --indent 2 \
  -o /tmp/hotpulse_db.json
echo "      $(python -c "import json; data=json.load(open('/tmp/hotpulse_db.json')); print(len(data), 'kayıt')")"
cd ..

# ── 2. Medya dosyaları ───────────────────────────────────────────────────────
echo "[2/3] Medya dosyaları paketleniyor..."
MEDIA_PATH="backend/media"
if [ -d "$MEDIA_PATH" ] && [ "$(ls -A $MEDIA_PATH 2>/dev/null)" ]; then
  tar czf /tmp/hotpulse_media.tar.gz -C backend media/
  echo "      $(du -sh $MEDIA_PATH | cut -f1) medya"
else
  touch /tmp/hotpulse_media.tar.gz
  echo "      Medya klasörü boş, atlandı"
fi

# ── 3. Arşiv oluştur ─────────────────────────────────────────────────────────
echo "[3/3] Arşiv oluşturuluyor..."
tar czf "$BACKUP_FILE.tar.gz" \
  -C /tmp hotpulse_db.json hotpulse_media.tar.gz

rm -f /tmp/hotpulse_db.json /tmp/hotpulse_media.tar.gz

SIZE=$(du -sh "$BACKUP_FILE.tar.gz" | cut -f1)
echo ""
echo "✓ Yedek hazır: $BACKUP_FILE.tar.gz ($SIZE)"
echo ""
echo "VDS'e aktarmak için:"
echo "  scp $BACKUP_FILE.tar.gz kullanici@vds-ip:/root/hotpulse/"
echo "  Ardından VDS'de: ./restore.sh $BACKUP_FILE.tar.gz"
