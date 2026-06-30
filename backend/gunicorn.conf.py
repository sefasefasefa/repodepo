import multiprocessing
import os
import tempfile

bind = "0.0.0.0:5000"

_cpu = multiprocessing.cpu_count()

# VDS'te standart formül kullan; Replit gibi kısıtlı ortamlar için
# GUNICORN_WORKERS=2 şeklinde override et.
# Örnek VDS (4 CPU): 9 worker × 4 thread = 36 eş zamanlı istek
_replit = os.environ.get("REPL_ID") or os.environ.get("REPLIT_DEV_DOMAIN")
_default = min(_cpu * 2 + 1, 4) if _replit else (_cpu * 2 + 1)
workers = int(os.environ.get("GUNICORN_WORKERS", _default))

worker_class = "gthread"
threads = int(os.environ.get("GUNICORN_THREADS", 8))

# Worker heartbeat: Linux'ta RAM disk kullan, Windows/diğer'de sistem temp klasörü
worker_tmp_dir = "/dev/shm" if os.path.isdir("/dev/shm") else tempfile.gettempdir()

max_requests = 1000
max_requests_jitter = 100

timeout = 120
graceful_timeout = 15
keepalive = 5

# Uygulamayı master process'te önceden yükle; worker fork'lar hızlı başlar
preload_app = True

accesslog = "-"
errorlog = "-"
loglevel = "warning"
access_log_format = '%(h)s "%(r)s" %(s)s %(b)s %(D)sµs'

forwarded_allow_ips = "*"
proxy_protocol = False
