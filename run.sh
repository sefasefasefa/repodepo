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

# staticfiles dizini yoksa oluştur (WhiteNoise uyarısını önler)
if [ ! -d "staticfiles" ]; then
  echo "Collecting static files..."
  python manage.py collectstatic --noinput -v 0
fi

echo "Starting Django + Gunicorn on port 5000..."
exec gunicorn config.wsgi:application --config gunicorn.conf.py
