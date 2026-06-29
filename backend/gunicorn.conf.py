bind = "0.0.0.0:5000"

workers = 2
worker_class = "gthread"
threads = 4

max_requests = 1000
max_requests_jitter = 100

timeout = 120
keepalive = 5

preload_app = True

accesslog = "-"
errorlog = "-"
loglevel = "info"
access_log_format = '%(h)s "%(r)s" %(s)s %(b)s %(D)sµs'

forwarded_allow_ips = "*"
proxy_protocol = False
