import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get('SECRET_KEY') or os.environ.get('SESSION_SECRET', 'django-insecure-change-this-key-in-production-123456789')

DEBUG = os.environ.get('DEBUG', 'True').lower() in ('true', '1', 'yes')

_allowed_hosts_env = os.environ.get('ALLOWED_HOSTS', '*')
ALLOWED_HOSTS = [h.strip() for h in _allowed_hosts_env.split(',') if h.strip()]
# Waitress iç health-check ve lokal erişim için her zaman ekle
for _h in ['127.0.0.1', 'localhost', 'waitress.invalid']:
    if _h not in ALLOWED_HOSTS and '*' not in ALLOWED_HOSTS:
        ALLOWED_HOSTS.append(_h)

CSRF_TRUSTED_ORIGINS_ENV = os.environ.get(
    'CSRF_TRUSTED_ORIGINS',
    'https://hotpulse.me,https://www.hotpulse.me,https://*.hotpulse.me,https://*.pythonanywhere.com,https://*.replit.dev,https://*.repl.co,https://*.replit.app,http://localhost:8000,http://127.0.0.1:8000,http://localhost:5000,http://127.0.0.1:5000'
)
CSRF_TRUSTED_ORIGINS = [o.strip() for o in CSRF_TRUSTED_ORIGINS_ENV.split(',') if o.strip()]

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'apps.accounts',
    'apps.videos',
    'apps.social',
    'apps.subscriptions',
    'apps.notifications',
    'apps.live',
    'apps.messaging',
    'apps.tokens',
    'apps.affiliate',
    'apps.admin_panel',
    'apps.crosspost',
    'apps.ai',
    'apps.devices',
    'apps.core',
]

MIDDLEWARE = [
    'django.middleware.gzip.GZipMiddleware',        # API yanıtlarını sıkıştır (JS/JSON ~70% küçülür)
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',   # static dosyalar hızlı buradan çıkar
    'corsheaders.middleware.CorsMiddleware',        # CORS: preflight'lar erken yanıtlanır
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.http.ConditionalGetMiddleware',  # ETag + 304 desteği
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'apps.core.markdown_middleware.MarkdownNegotiationMiddleware',  # Accept: text/markdown desteği (RFC 7231)
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

import dj_database_url as _dj_db_url

_DATABASE_URL = os.environ.get('DATABASE_URL')
_FORCE_SQLITE = os.environ.get('FORCE_SQLITE', '').lower() in ('true', '1', 'yes')
if _DATABASE_URL and not _FORCE_SQLITE:
    _db_config = _dj_db_url.parse(_DATABASE_URL)
    _db_config['CONN_MAX_AGE'] = 60
    _db_config['OPTIONS'] = {
        'connect_timeout': 10,
        'options': '-c default_transaction_isolation=read\ committed',
    }
    DATABASES = {'default': _db_config}
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

AUTH_USER_MODEL = 'accounts.User'

LANGUAGE_CODE = 'tr'
TIME_ZONE = 'Europe/Istanbul'
USE_I18N = True
USE_TZ = True

CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'hotpulse-main',
        'TIMEOUT': 300,
        'OPTIONS': {
            'MAX_ENTRIES': 10000,
        },
    }
}

# JWT ile çalışıldığında session DB'ye çarpmaz; cache-only yeterli
SESSION_ENGINE = 'django.contrib.sessions.backends.cache'

PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.PBKDF2PasswordHasher',
    # Argon2PasswordHasher requires argon2-cffi; not available in this environment
]

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'static'
# Frontend build output — collectstatic copies + gzips these into STATIC_ROOT
_FRONTEND_DIST = BASE_DIR / 'artifacts' / 'streamvid' / 'dist' / 'public'
STATICFILES_DIRS = [_FRONTEND_DIST] if _FRONTEND_DIST.exists() else []
STATICFILES_STORAGE = 'whitenoise.storage.CompressedStaticFilesStorage'

# WhiteNoise doğrudan static/ klasörünü serve eder.
WHITENOISE_ROOT = str(BASE_DIR / 'static')
WHITENOISE_AUTOREFRESH = False
WHITENOISE_MAX_AGE = 31536000  # 1 yıl (hash'li dosyalar için)

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'apps.accounts.authentication.BearerTokenAuthentication',
        'apps.accounts.authentication.SilentJWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticatedOrReadOnly',
    ),
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_RENDERER_CLASSES': (
        'rest_framework.renderers.JSONRenderer',
    ),
    'DEFAULT_THROTTLE_CLASSES': [],
    'DEFAULT_THROTTLE_RATES': {},
}

# Veritabanı bağlantı optimizasyonu (SQLite için de)
_using_sqlite = not os.environ.get('DATABASE_URL') or _FORCE_SQLITE
if _using_sqlite:
    DATABASES['default']['OPTIONS'] = {
        'timeout': 20,
        'check_same_thread': False,
    }
    DATABASES['default']['CONN_MAX_AGE'] = 600

from datetime import timedelta

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(days=7),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=30),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

CORS_ALLOW_ALL_ORIGINS = os.environ.get('CORS_ALLOW_ALL_ORIGINS', 'False').lower() in ('true', '1', 'yes')
CORS_ALLOWED_ORIGINS_ENV = os.environ.get(
    'CORS_ALLOWED_ORIGINS',
    'http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000'
)
CORS_ALLOWED_ORIGINS = [o.strip() for o in CORS_ALLOWED_ORIGINS_ENV.split(',') if o.strip()]
CORS_ALLOWED_ORIGIN_REGEXES = [
    r'^https://hotpulse\.me$',
    r'^https://www\.hotpulse\.me$',
    r'^https://.*\.hotpulse\.me$',
    r'^https://.*\.pythonanywhere\.com$',
    r'^https://.*\.replit\.dev$',
    r'^https://.*\.replit\.app$',
]
CORS_ALLOW_CREDENTIALS = True

# ── HTTPS Güvenlik (DEBUG=False + HTTPS kullanıldığında otomatik aktif) ───────
# Cloudflare arkasında çalışıyoruz: CF→nginx HTTP (port 80), nginx X-Forwarded-Proto:https set eder.
# SECURE_PROXY_SSL_HEADER ile Django bunu okur → request.is_secure() = True.
# SECURE_SSL_REDIRECT=False: CF zaten HTTP→HTTPS redirect yapıyor, Django yapmasın
# (yapsa CF→nginx arası HTTP olduğu için sonsuz redirect döngüsü oluşur).
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

if not DEBUG:
    SECURE_SSL_REDIRECT = False          # Cloudflare hallediyor
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = 'DENY'

SECURE_SSL_REDIRECT = False  # Her ortamda False — redirect Cloudflare/nginx sorumluluğu

# COOP başlığını devre dışı bırak — HTTP'de browser uyarısı çıkarıyor,
# HTTPS'e geçildiğinde 'same-origin' olarak açılabilir.
SECURE_CROSS_ORIGIN_OPENER_POLICY = None

MAX_UPLOAD_SIZE = 10 * 1024 * 1024 * 1024  # 10 GB

DATA_UPLOAD_MAX_MEMORY_SIZE = 100 * 1024 * 1024  # 100 MB form data
FILE_UPLOAD_MAX_MEMORY_SIZE = 100 * 1024 * 1024

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
    'loggers': {
        # django.request logs 4xx (403/404 vb.) olarak WARNING, 5xx olarak ERROR
        # üretir. İnternet genelinde her açık sunucuya gelen bot/tarayıcı
        # trafiğinin ürettiği 403/404 gürültüsünü konsoldan gizliyoruz;
        # gerçek sunucu hataları (5xx) yine görünür kalır.
        'django.request': {
            'handlers': ['console'],
            'level': 'ERROR',
            'propagate': False,
        },
        'django.security.csrf': {
            'handlers': ['console'],
            'level': 'ERROR',
            'propagate': False,
        },
    },
}

# Public site URL for distribution and absolute URLs
SITE_URL = (
    os.environ.get('SITE_URL')
    or os.environ.get('REPLIT_DEV_DOMAIN')
    or 'http://localhost:8000'
)
if SITE_URL and not SITE_URL.startswith('http'):
    SITE_URL = 'https://' + SITE_URL

# SQLite WAL modu — eş zamanlı okuma/yazma çakışmasını önler, hızı artırır
if _using_sqlite:
    from django.db.backends.signals import connection_created

    def _sqlite_wal(sender, connection, **kwargs):
        if connection.vendor == 'sqlite':
            cursor = connection.cursor()
            cursor.execute("PRAGMA journal_mode=WAL;")
            cursor.execute("PRAGMA synchronous=NORMAL;")
            cursor.execute("PRAGMA cache_size=-32000;")  # 32 MB page cache
            cursor.execute("PRAGMA temp_store=MEMORY;")
            cursor.execute("PRAGMA mmap_size=134217728;")  # 128 MB mmap

    connection_created.connect(_sqlite_wal)
