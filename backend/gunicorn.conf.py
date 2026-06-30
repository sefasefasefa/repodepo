import multiprocessing
import os

bind = "0.0.0.0:5000"

_cpu = multiprocessing.cpu_count()

# VDS'te standart formül kullan; Replit gibi kısıtlı ortamlar için
# GUNICORN_WORKERS=2 şeklinde override et.
# Örnek VDS (4 CPU): 9 worker × 4 thread = 36 eş zamanlı istek
_default = min(_cpu * 2 + 1, 4)  # Replit gibi kısıtlı ortamlarda max 4 worker
workers = int(os.environ.get("GUNICORN_WORKERS", _default))

worker_class = "gthread"
threads = int(os.environ.get("GUNICORN_THREADS", 4))

# Worker heartbeat RAM disk üzerinden → disk I/O yok
worker_tmp_dir = "/dev/shm"

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
