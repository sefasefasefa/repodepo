#!/bin/bash
set -e

cd backend

echo "Starting Django + Gunicorn on port 5000..."
exec gunicorn config.wsgi:application --config gunicorn.conf.py
