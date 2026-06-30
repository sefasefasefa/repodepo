#!/bin/bash

# ── İşletim sistemi tespiti ───────────────────────────────────────────────────
case "$(uname -s)" in
    Linux*)   OS="linux" ;;
    Darwin*)  OS="mac" ;;
    MINGW*|MSYS*|CYGWIN*) OS="windows" ;;
    *)        OS="unknown" ;;
esac

cd backend

# ── Statik dosyaları her zaman güncelle (staticfiles/ git'te değil) ──────────
echo "Statik dosyalar hazirlaniyor..."
python manage.py collectstatic --noinput -v 0 2>/dev/null || true

if [ "$OS" = "windows" ]; then

    # ── Donanım bilgisini Python ile oku ─────────────────────────────────────
    echo "Windows: Donanim analiz ediliyor..."

    TUNE_OUTPUT=$(python - <<'PYEOF'
import os, sys

# ── CPU ──────────────────────────────────────────────────────────────────────
cpu = os.cpu_count() or 2

# ── RAM (MB cinsinden) ───────────────────────────────────────────────────────
ram_mb = 1024  # guvenli varsayilan
try:
    import psutil
    ram_mb = psutil.virtual_memory().total // (1024 * 1024)
except ImportError:
    # psutil yoksa Windows WMI ile dene
    try:
        import subprocess
        out = subprocess.check_output(
            'wmic ComputerSystem get TotalPhysicalMemory /Value',
            shell=True, stderr=subprocess.DEVNULL
        ).decode(errors='ignore')
        for line in out.splitlines():
            if '=' in line:
                val = line.split('=')[-1].strip()
                if val.isdigit():
                    ram_mb = int(val) // (1024 * 1024)
                    break
    except Exception:
        pass

# ── En iyi Waitress parametreleri ────────────────────────────────────────────
# Threads: Django I/O-bound oldugu icin cpu*8, en az 16, en fazla 64
# (cpu*2 cok az! Her yavas istek thread tutar, 6 thread aninda tikaniyor)
threads = max(16, min(cpu * 8, 64))

# connection-limit: RAM'e gore — her baglanti ~5-10 MB overhead
# 1 GB RAM → 200, 2 GB → 350, 4 GB → 600, 8 GB → 1000, 16 GB → 1600 (max 2000)
ram_gb = ram_mb / 1024
conn = int(min(max(100 + ram_gb * 120, 200), 2000))

# channel-timeout: video akisi icin yeterli sure
timeout = 120

print(f"THREADS={threads}")
print(f"CONNECTIONS={conn}")
print(f"TIMEOUT={timeout}")
print(f"CPU_CORES={cpu}")
print(f"RAM_MB={ram_mb}")
PYEOF
    )

    # ── Degerleri oku ─────────────────────────────────────────────────────────
    THREADS=$(echo "$TUNE_OUTPUT"    | grep '^THREADS='     | cut -d= -f2)
    CONNECTIONS=$(echo "$TUNE_OUTPUT" | grep '^CONNECTIONS=' | cut -d= -f2)
    TIMEOUT=$(echo "$TUNE_OUTPUT"    | grep '^TIMEOUT='     | cut -d= -f2)
    CPU_CORES=$(echo "$TUNE_OUTPUT"  | grep '^CPU_CORES='   | cut -d= -f2)
    RAM_MB=$(echo "$TUNE_OUTPUT"     | grep '^RAM_MB='      | cut -d= -f2)

    # ── Hesaplama basarisizsa guvenli varsayilan ──────────────────────────────
    THREADS=${THREADS:-8}
    CONNECTIONS=${CONNECTIONS:-500}
    TIMEOUT=${TIMEOUT:-180}

    # ── Sonuclari goster ──────────────────────────────────────────────────────
    RAM_GB_DISP=""
    if [ -n "$RAM_MB" ] && [ "$RAM_MB" -gt 0 ] 2>/dev/null; then
        RAM_GB_DISP="$(echo "scale=1; $RAM_MB / 1024" | bc 2>/dev/null || echo "${RAM_MB}MB") GB RAM"
    fi

    echo ""
    echo "  Donanim  : ${CPU_CORES:-?} CPU cekirdek${RAM_GB_DISP:+, $RAM_GB_DISP}"
    echo "  Threads  : $THREADS  (cpu_core x8, min=16, max=64)"
    echo "  Conn Lmt : $CONNECTIONS  (RAM'e gore otomatik)"
    echo "  Timeout  : $TIMEOUT s"
    echo ""
    echo "Waitress sunucusu baslatiliyor (port 8000)..."

    exec python -m waitress \
        --port=8000 \
        --threads="$THREADS" \
        --connection-limit="$CONNECTIONS" \
        --channel-timeout="$TIMEOUT" \
        config.wsgi:application

else
    # ── Linux/Mac: Gunicorn ───────────────────────────────────────────────────
    echo "Linux/Mac: Gunicorn baslatiliyor..."
    exec gunicorn config.wsgi:application --config gunicorn.conf.py
fi
