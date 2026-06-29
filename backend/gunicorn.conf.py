import multiprocessing
import os

bind = "0.0.0.0:5000"

# GUNICORN_WORKERS env ile override edilebilir, yoksa standart formül
workers = int(os.environ.get("GUNICORN_WORKERS", multiprocessing.cpu_count() * 2 + 1))
worker_class = "gthread"
threads = 4

max_requests = 1000
max_requests_jitter = 100

timeout = 120
keepalive = 5

# Uygulamayı master process'te önceden yükle; worker fork'lar hızlı başlar
preload_app = True

accesslog = "-"
errorlog = "-"
loglevel = "info"
access_log_format = '%(h)s "%(r)s" %(s)s %(b)s %(D)sµs'

forwarded_allow_ips = "*"
proxy_protocol = False
