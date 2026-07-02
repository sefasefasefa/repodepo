#!/bin/bash
# Build the React frontend (tools/streamvid-src) and deploy it into the
# Django app at artifacts/django-soci so the server serves the latest UI.
#
# Usage: bash scripts/build-frontend.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FE="$ROOT/tools/streamvid-src"
DJ="$ROOT/artifacts/django-soci"

echo "==> Building React bundle…"
cd "$FE"
BASE_PATH=/ PORT=5173 NODE_ENV=production pnpm run build

echo "==> Deploying to Django static/…"
rm -rf "$DJ/static/assets" "$DJ/static/index.html"
cp -r dist/public/* "$DJ/static/"

echo "==> Running collectstatic…"
cd "$DJ"
python3 manage.py collectstatic --noinput | tail -1

echo "==> Done. Restart 'artifacts/django-soci: web' workflow to pick up changes."
