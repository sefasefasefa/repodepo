#!/bin/bash

# ── İşletim sistemi tespiti ───────────────────────────────────────────────────
case "$(uname -s)" in
    Linux*)   OS="linux" ;;
    Darwin*)  OS="mac" ;;
    MINGW*|MSYS*|CYGWIN*) OS="windows" ;;
    *)        OS="unknown" ;;
esac

cd backend

if [ "$OS" = "windows" ]; then
    # Gunicorn Windows'u resmi olarak desteklemez — waitress kullanılır
    echo "Windows: Waitress sunucusu başlatılıyor (port 8000)..."
    exec python -m waitress \
        --port=8000 \
        --threads=8 \
        --connection-limit=1000 \
        --channel-timeout=120 \
        config.wsgi:application
else
    # Linux/Mac: Gunicorn (çok worker destekli, üretim için önerilen)
    echo "Linux/Mac: Gunicorn başlatılıyor..."
    exec gunicorn config.wsgi:application --config gunicorn.conf.py
fi
