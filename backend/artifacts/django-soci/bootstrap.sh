#!/usr/bin/env bash
# PythonAnywhere otomatik kurulum scripti.
# Kullanim: Bash konsolunda projenin koku icinde calistirir:
#     bash bootstrap.sh
#
# Yapacaklari:
#  1) Python virtualenv olusturur (yoksa) ve aktif eder
#  2) requirements.txt yukler
#  3) .env dosyasi yoksa otomatik olusturur (rastgele SECRET_KEY ile)
#  4) Migrations + collectstatic + seed_data calistirir
#  5) WSGI dosyasinin kullanici adi ile guncel oldugundan emin olur
#  6) Olasi PythonAnywhere yollarini sonunda yazdirir

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

YELLOW="\033[1;33m"; GREEN="\033[1;32m"; RED="\033[1;31m"; NC="\033[0m"
log() { echo -e "${GREEN}[bootstrap]${NC} $*"; }
warn() { echo -e "${YELLOW}[bootstrap]${NC} $*"; }
err() { echo -e "${RED}[bootstrap]${NC} $*"; }

# Python tespit ----------------------------------------------------------------
PY="${PYTHON:-python3.10}"
if ! command -v "$PY" >/dev/null 2>&1; then
  PY="python3"
fi
log "Python: $($PY --version)"

# Virtualenv -------------------------------------------------------------------
VENV_DIR="${VENV_DIR:-$HOME/.virtualenvs/prnhub-venv}"
if [ ! -d "$VENV_DIR" ]; then
  log "Virtualenv olusturuluyor: $VENV_DIR"
  "$PY" -m venv "$VENV_DIR"
fi
# shellcheck disable=SC1091
source "$VENV_DIR/bin/activate"
log "Aktif venv: $VIRTUAL_ENV"

# Pip + paketler ---------------------------------------------------------------
log "pip yukseltiliyor..."
python -m pip install --upgrade pip wheel >/dev/null

log "requirements.txt yukleniyor..."
pip install -r requirements.txt

# .env -------------------------------------------------------------------------
USER_NAME="${USER:-$(whoami)}"
HOST_GUESS="${USER_NAME}.pythonanywhere.com"

if [ ! -f .env ]; then
  log ".env olusturuluyor (rastgele SECRET_KEY ile)..."
  SECRET=$(python -c "import secrets; print(secrets.token_urlsafe(50))")
  cat > .env <<EOF
DEBUG=False
SECRET_KEY=${SECRET}
ALLOWED_HOSTS=${HOST_GUESS},.pythonanywhere.com,localhost,127.0.0.1
CSRF_TRUSTED_ORIGINS=https://${HOST_GUESS},https://*.pythonanywhere.com
DATABASE_URL=sqlite:///${PROJECT_DIR}/db.sqlite3
EOF
  log ".env hazir."
else
  warn ".env zaten var, dokunulmadi."
fi

# Migrate + static + seed ------------------------------------------------------
log "Migration calistiriliyor..."
python manage.py migrate --noinput

log "Static dosyalar toplaniyor..."
python manage.py collectstatic --noinput

log "Demo veri yuklendiyor (varsa) - hata olursa atlanir..."
python manage.py seed_data --env=prod 2>/dev/null || warn "seed_data atlandi (zaten dolu ya da komut yok)."

# WSGI dosyasini kullanici adi ile guncelle ------------------------------------
WSGI_TARGET="$VIRTUAL_ENV/../../var/www/${USER_NAME}_pythonanywhere_com_wsgi.py"
if [ -w "$(dirname "$WSGI_TARGET")" ] 2>/dev/null; then
  sed "s|YOURUSER|${USER_NAME}|g" pythonanywhere_wsgi.py > "$WSGI_TARGET"
  log "WSGI dosyasi guncellendi: $WSGI_TARGET"
else
  warn "WSGI dosyasi otomatik guncellenemedi (yol bulunamadi)."
  warn "Manuel: pythonanywhere_wsgi.py'yi /var/www/${USER_NAME}_pythonanywhere_com_wsgi.py konumuna kopyala"
  warn "ve icindeki YOURUSER'i '${USER_NAME}' ile degistir."
fi

echo ""
log "===== KURULUM TAMAM ====="
echo ""
echo "Sirada PythonAnywhere Web sekmesinde:"
echo "  1) Add a new web app > Manual configuration > Python 3.10"
echo "  2) Source code:       ${PROJECT_DIR}"
echo "  3) Working directory: ${PROJECT_DIR}"
echo "  4) Virtualenv:        ${VIRTUAL_ENV}"
echo "  5) Static files:"
echo "       URL: /static/  ->  Path: ${PROJECT_DIR}/staticfiles"
echo "       URL: /media/   ->  Path: ${PROJECT_DIR}/media"
echo "  6) Reload tusuna bas."
echo ""
echo "Site URL'i: https://${HOST_GUESS}"
