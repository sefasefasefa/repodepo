#!/bin/bash
set -e

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="backups"
BACKUP_FILE="$BACKUP_DIR/hotpulse_backup_$TIMESTAMP.json"

mkdir -p "$BACKUP_DIR"

echo "=== Hotpulse Yedekleme - $TIMESTAMP ==="

echo "Veritabanı dışa aktarılıyor..."
cd backend
python manage.py dumpdata \
  accounts \
  subscriptions \
  crosspost \
  social \
  notifications \
  tokens \
  affiliate \
  core \
  --exclude videos.category \
  --natural-foreign \
  --natural-primary \
  --indent 2 \
  -o "../$BACKUP_FILE"

COUNT=$(python -c "import json; data=json.load(open('../$BACKUP_FILE')); print(len(data))")
cd ..

echo ""
echo "✓ Yedek hazır: $BACKUP_FILE ($COUNT kayıt)"
echo ""
echo "VDS'e aktarmak için:"
echo "  scp $BACKUP_FILE kullanici@vds-ip:/root/hotpulse/backups/"
echo "  Ardından VDS'de: ./scripts/restore.sh $BACKUP_FILE"
