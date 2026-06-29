#!/bin/bash
set -e

cd backend

# Migrate sadece yeni migration varsa çalışır
echo "Checking migrations..."
if ! python manage.py migrate --check --no-input -q 2>/dev/null; then
  echo "Applying migrations..."
  python manage.py migrate --run-syncdb --no-input
else
  echo "No new migrations."
fi

echo "Starting Django + Gunicorn on port 5000..."
exec gunicorn config.wsgi:application --config gunicorn.conf.py
