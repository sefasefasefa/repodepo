#!/bin/bash
set -e

cd backend

MIGRATION_MARKER=".migration_done"

# Yeni migration dosyası varsa veya hiç çalışmadıysa migrate et
MIGRATION_HASH=$(find apps -name "*.py" -path "*/migrations/*" 2>/dev/null | sort | xargs md5sum 2>/dev/null | md5sum | cut -d' ' -f1)

if [ ! -f "$MIGRATION_MARKER" ] || [ "$(cat $MIGRATION_MARKER 2>/dev/null)" != "$MIGRATION_HASH" ]; then
  echo "Applying migrations..."
  python manage.py migrate --run-syncdb --no-input
  echo "$MIGRATION_HASH" > "$MIGRATION_MARKER"
else
  echo "Migrations up to date, skipping."
fi

# Veritabanı boşsa (ilk kurulum) temel seed datayı yükle
CATEGORY_COUNT=$(python manage.py shell -c "from apps.videos.models import Category; print(Category.objects.count())" 2>/dev/null | tail -1)
if [ "$CATEGORY_COUNT" = "0" ] || [ -z "$CATEGORY_COUNT" ]; then
  echo "Veritabanı boş — temel seed data yükleniyor..."
  python manage.py seed_data --env=prod 2>&1 | grep -v "^80 objects"
fi

# Cache temizle (eski boş cache sorununu önle)
python manage.py shell -c "from django.core.cache import cache; cache.clear()" 2>/dev/null | grep -v "^80 objects" || true

# Frontend build hash'ini dist/public'ten hesapla (static/'ten değil)
# Böylece collectstatic --clear sonrası tekrar tetiklenmez
STATIC_MARKER=".static_done"
DIST_DIR="artifacts/streamvid/dist/public"

if [ -d "$DIST_DIR" ]; then
  STATIC_HASH=$(find "$DIST_DIR" -name "*.js" -o -name "*.css" 2>/dev/null | sort | xargs md5sum 2>/dev/null | md5sum | cut -d' ' -f1)
else
  STATIC_HASH="no-dist"
fi

if [ ! -f "$STATIC_MARKER" ] || [ "$(cat $STATIC_MARKER 2>/dev/null)" != "$STATIC_HASH" ]; then
  echo "Collecting and compressing static files..."
  # 1. Django uygulamalarının static dosyalarını topla (admin, rest_framework vb.)
  python manage.py collectstatic --clear --noinput -v 0
  # 2. Frontend build çıktısını static/'e kopyala (collectstatic --clear sonrası)
  if [ -d "$DIST_DIR" ]; then
    cp -r "$DIST_DIR/." static/
    echo "Frontend build dosyaları kopyalandı."
  fi
  echo "$STATIC_HASH" > "$STATIC_MARKER"
else
  # Hash aynı ama index.html yoksa (ilk kurulum edge case) yine kopyala
  if [ ! -f "static/index.html" ] && [ -d "$DIST_DIR" ]; then
    cp -r "$DIST_DIR/." static/
    echo "Frontend build dosyaları (recovery) kopyalandı."
  else
    echo "Static files up to date, skipping."
  fi
fi

echo "Starting Django + Gunicorn on port 5000..."
exec gunicorn config.wsgi:application --config gunicorn.conf.py
