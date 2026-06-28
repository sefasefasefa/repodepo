#!/bin/bash
set -e

cd backend

echo "Running database migrations..."
python manage.py migrate --run-syncdb

echo "Starting Django + Gunicorn on port 5000..."
exec gunicorn config.wsgi:application --config gunicorn.conf.py
