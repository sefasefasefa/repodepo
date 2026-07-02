#!/bin/bash
set -e

if [ -z "$1" ]; then
  echo "Kullanım: ./restore.sh backups/hotpulse_backup_XXXXXX.tar.gz"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Hata: $BACKUP_FILE bulunamadı"
  exit 1
fi

echo "=== Hotpulse Geri Yükleme ==="
echo "Kaynak: $BACKUP_FILE"
echo ""

# ── 1. Arşivi aç ─────────────────────────────────────────────────────────────
echo "[1/3] Arşiv açılıyor..."
tar xzf "$BACKUP_FILE" -C /tmp

# ── 2. Veritabanını geri yükle ───────────────────────────────────────────────
echo "[2/3] Veritabanı geri yükleniyor..."
cd backend

# Önce migrate (tablolar oluşsun)
python manage.py migrate --run-syncdb

# İçerik tabloları temizlenmeden yükle (--ignorenonexistent: bilinmeyen alanları atla)
python manage.py loaddata /tmp/hotpulse_db.json --ignorenonexistent
echo "      Veriler yüklendi"
cd ..

# Temizlik
rm -f /tmp/hotpulse_db.json

echo ""
echo "✓ Geri yükleme tamamlandı!"
echo ""
echo "Sunucuyu başlatmak için: ./scripts/start.sh"
