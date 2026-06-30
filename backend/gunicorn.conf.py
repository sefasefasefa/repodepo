import multiprocessing
import os

bind = "0.0.0.0:5000"

# Replit gibi kısıtlı CPU'da az worker = daha hızlı yanıt.
# Çok worker → CPU context switching → herkese yavaş.
# Env ile override edilebilir (VDS'te daha yüksek ayarlanabilir).
_cpu = multiprocessing.cpu_count()
workers = int(os.environ.get("GUNICORN_WORKERS", max(2, min(_cpu, 3))))

worker_class = "gthread"
threads = int(os.environ.get("GUNICORN_THREADS", 4))

# Worker heartbeat RAM disk üzerinden → disk I/O yok → daha hızlı
worker_tmp_dir = "/dev/shm"

max_requests = 500
max_requests_jitter = 50

timeout = 120
graceful_timeout = 10
keepalive = 2

# Uygulamayı master process'te önceden yükle; worker fork'lar hızlı başlar
preload_app = True

accesslog = "-"
errorlog = "-"
loglevel = "warning"
access_log_format = '%(h)s "%(r)s" %(s)s %(b)s %(D)sµs'

forwarded_allow_ips = "*"
proxy_protocol = False
