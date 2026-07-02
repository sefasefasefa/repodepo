# Hotpulse — Sosyal Video Platformu

Django 4.2 + React/Vite tabanlı 18+ video paylaşım platformu.

## Klasör Yapısı

```
hotpulse/
├── backend/                    ← Django uygulaması
│   ├── apps/                   ← Django modülleri
│   │   ├── accounts/           ← Kullanıcı, JWT auth, SMS OTP
│   │   ├── videos/             ← Video çekirdeği, HLS, upload
│   │   ├── social/             ← Takip, hikaye, rozetler
│   │   ├── live/               ← Canlı yayın
│   │   ├── messaging/          ← DM ve sesli/görüntülü arama
│   │   ├── notifications/      ← Bildirim sistemi
│   │   ├── tokens/             ← Token ekonomisi (tip, satın al)
│   │   ├── subscriptions/      ← Abonelik yönetimi
│   │   ├── affiliate/          ← Bağlı ortaklık sistemi
│   │   ├── ai/                 ← İçerik öneri motoru
│   │   ├── devices/            ← Cihaz kaydı / push notif
│   │   ├── crosspost/          ← Çapraz platform paylaşım
│   │   ├── admin_panel/        ← Yönetici API + panel
│   │   └── core/               ← Health check, SEO, yardımcılar
│   ├── config/                 ← Django ayarları, URL'ler, WSGI
│   ├── artifacts/streamvid/    ← React/Vite frontend kaynak kodu
│   ├── static/                 ← Derlenmiş frontend + collectstatic çıktısı
│   │   └── assets/             ← Hash'li JS/CSS (git'te tutulur, CDN cache)
│   ├── media/                  ← Kullanıcı yüklemeleri (git'te YOK)
│   │   ├── uploads/            ← Video dosyaları (.mp4)
│   │   ├── thumbnails/         ← Otomatik oluşturulan kapak görselleri
│   │   ├── images/             ← Profil fotoğrafları
│   │   └── _chunks/            ← Çok parçalı upload geçici dosyaları
│   ├── nginx.conf              ← Nginx üretim config (Cloudflare + Windows)
│   ├── nssm-install.bat        ← Windows servisi kurulumu (NSSM)
│   ├── manage.py
│   ├── requirements.txt
│   ├── gunicorn.conf.py
│   └── .env.example            ← Ortam değişkeni şablonu
│
├── scripts/                    ← Deployment ve bakım scriptleri
│   ├── update.sh               ← Linux güncelleme (git pull + migrate)
│   ├── backup.sh               ← Veritabanı yedekleme
│   ├── restore.sh              ← Yedekten geri yükleme
│   ├── setup.sh                ← Linux ilk kurulum
│   ├── start.sh                ← Linux sunucu başlatma (Gunicorn)
│   ├── sqlite-to-postgres.sh   ← SQLite → PostgreSQL veri taşıma
│   └── windows/                ← Windows VDS scriptleri
│       ├── start.bat           ← Waitress başlat (127.0.0.1:8000)
│       ├── update.bat          ← git pull + migrate + başlat
│       ├── setup.bat           ← İlk kurulum
│       └── sqlite-to-postgres.bat
│
├── infra/nginx/                ← Nginx konfigürasyonları
│   ├── nginx-windows.conf      ← Windows VDS + Cloudflare
│   └── nginx-linux.conf        ← Linux VDS + Let's Encrypt
│
├── docs/                       ← Dökümantasyon
│   ├── cloudflare.md           ← Cloudflare cache + SSL ayarları
│   ├── seo.md                  ← SEO rehberi
│   └── aktarim-prompt.md       ← Aktarım notları
│
├── .gitignore
└── README.md
```

## Stack

| Katman | Teknoloji |
|---|---|
| Backend | Python 3.11, Django 4.2 |
| API | Django REST Framework + SimpleJWT |
| Frontend | React + Vite (önceden derlenmiş) |
| Sunucu (Windows) | Waitress `127.0.0.1:8000` |
| Sunucu (Linux) | Gunicorn + gthread |
| Reverse Proxy | Nginx |
| CDN / HTTPS | Cloudflare (Full Strict) |
| Veritabanı | PostgreSQL (üretim) / SQLite (geliştirme) |

## VDS'de Günlük Kullanım

```bash
# Güncelleme (Git Bash veya CMD'de repo kökünden)
./update.sh                        # Linux
scripts\windows\update.bat         # Windows

# Sadece sunucuyu başlat
scripts\windows\start.bat          # Windows
./start.sh                         # Linux

# Yedekleme
./backup.sh

# Windows servisi (NSSM) — tek seferlik kurulum
# Yönetici CMD'de:
backend\nssm-install.bat
```

## Git Kuralları

- `media/` → git'e GİRMEZ (229MB+ video) — VDS'de kalır
- `backend/static/assets/` → git'te TUTULUR (önceden derlenmiş frontend)
- `backend/db.sqlite3` → git'te TUTULUR (ortak dev DB)
- `__pycache__/`, `venv/`, `.env` → git'e GİRMEZ

## Önemli Notlar

- **Python sürümü**: `python3.11` kullan — `python3` sistem genelinde 3.12'ye gidebilir
- **Waitress bağlama**: Her zaman `127.0.0.1:8000` — `0.0.0.0` olursa port internete açılır
- **Cloudflare**: SSL/TLS → Full (Strict), nginx'te Cloudflare Origin Certificate gerekli
- **NSSM**: https://nssm.cc/download — Windows servis yöneticisi

## User preferences

- `python3.11` kullan her zaman (Replit'te)
- Waitress: `127.0.0.1` — asla `0.0.0.0` değil
