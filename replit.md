# Hotpulse — Sosyal Video Platformu

Django 4.2 + React/Vite 18 tabanlı tam kapsamlı video paylaşım ve crosspost platformu.

---

## Özellikler

- Video yükleme (URL, dosya, chunked)
- Crosspost — birden fazla CDN/host'a otomatik dağıtım (Streamtape, DoodStream, Mixdrop vb.)
- Abonelik planları (standart + 18+ planlar)
- Live stream, hikayeler, mesajlaşma, bildirimler
- Admin paneli (video, kullanıcı, kategori, crosspost yönetimi)
- Creator dashboard
- JWT tabanlı kimlik doğrulama

---

## Teknoloji

| Katman | Teknoloji |
|---|---|
| Backend | Django 4.2, DRF, SimpleJWT |
| Frontend | React 18, Vite 7, TailwindCSS |
| Veritabanı | PostgreSQL (fallback: SQLite) |
| Statik dosyalar | WhiteNoise |
| WSGI | Gunicorn |

---

## Klasör Yapısı

```
/
├── backend/
│   ├── apps/                  # Django uygulamaları
│   │   ├── accounts/          # Kullanıcı & kimlik doğrulama
│   │   ├── videos/            # Video CRUD, yorum, beğeni
│   │   ├── crosspost/         # CDN crosspost sistemi
│   │   ├── subscriptions/     # Abonelik planları
│   │   ├── social/            # Hikayeler, takip, creator
│   │   ├── live/              # Canlı yayın
│   │   ├── messaging/         # Mesajlaşma
│   │   ├── notifications/     # Bildirimler
│   │   ├── admin_panel/       # Admin API'leri
│   │   └── ...
│   ├── artifacts/streamvid/   # React frontend (Vite)
│   │   └── src/
│   │       ├── pages/         # Sayfalar
│   │       └── components/    # Bileşenler
│   ├── config/                # Django ayarları & URL'ler
│   ├── static/                # Build edilmiş frontend (üretimde)
│   ├── media/                 # Yüklenen dosyalar
│   └── requirements.txt
├── setup.sh                   # İlk kurulum scripti
├── start.sh                   # Sunucu başlatma scripti
├── backup.sh                  # Veritabanı yedeği
└── restore.sh                 # Yedekten geri yükleme
```

---

## Ortam Değişkenleri

`backend/.env` dosyası oluştur (`.env.example`'dan kopyala):

```env
# Zorunlu
SECRET_KEY=cok-uzun-ve-rastgele-bir-deger   # python -c "import secrets; print(secrets.token_hex(50))"
DATABASE_URL=postgresql://kullanici:sifre@localhost:5432/hotpulse
DEBUG=False

# Domain
ALLOWED_HOSTS=hotpulse.me,www.hotpulse.me
CSRF_TRUSTED_ORIGINS=https://hotpulse.me,https://www.hotpulse.me
SITE_URL=https://hotpulse.me

# Medya (opsiyonel, varsayılan: backend/media/)
# MEDIA_ROOT=/var/www/hotpulse/media
```

---

## VDS Kurulum (Linux)

### Gereksinimler

```bash
apt install python3 python3-pip nodejs postgresql
npm install -g pnpm
```

### PostgreSQL

```bash
sudo -u postgres psql -c "CREATE USER hotpulse WITH PASSWORD 'sifren';"
sudo -u postgres psql -c "CREATE DATABASE hotpulse OWNER hotpulse;"
```

### İlk Kurulum

```bash
git clone <repo-url> hotpulse
cd hotpulse
cp .env.example backend/.env
nano backend/.env        # Değerleri doldur
./setup.sh               # Bağımlılıklar + build + migrate
```

### Başlatma

```bash
./start.sh               # Gunicorn, port 8000
```

### Systemd Servisi (otomatik başlatma)

```ini
# /etc/systemd/system/hotpulse.service
[Unit]
Description=Hotpulse
After=network.target postgresql.service

[Service]
User=root
WorkingDirectory=/root/hotpulse
ExecStart=/root/hotpulse/start.sh
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable hotpulse
sudo systemctl start hotpulse
```

### Güncelleme

```bash
git pull && ./setup.sh && sudo systemctl restart hotpulse
```
> `setup.sh` veritabanı verilerini **silmez**, sadece yeni tablo/sütun ekler.

---

## Replit (Geliştirme Ortamı)

Django, build edilmiş frontend'i port **5000**'den WhiteNoise ile serve eder.

| Workflow | Port | Açıklama |
|---|---|---|
| Start application | 5000 | Django (API + statik frontend) |

### İlk kurulum (bir kez çalıştır)

```bash
# Python bağımlılıkları
pip install -r backend/requirements.txt

# Frontend bağımlılıkları ve build
cd backend/artifacts/streamvid && pnpm install && pnpm run build && cd ../..

# Veritabanı migrate + statik dosyalar
cd backend && python manage.py migrate --run-syncdb && python manage.py collectstatic --noinput
```

### Admin kullanıcısı oluşturma

```bash
cd backend
python manage.py shell -c "
from apps.accounts.models import User
u = User.objects.create_user('admin', 'admin@example.com', 'sifre123')
u.role = 'admin'
u.save()
print('Admin oluşturuldu')
"
```

### Ortam değişkenleri (Replit'te ayarlanmış)

| Değişken | Değer |
|---|---|
| `DEBUG` | `True` |
| `FORCE_SQLITE` | `true` (SQLite kullanır) |
| `SESSION_SECRET` | Replit Secret olarak saklanır |

---

## Yedekleme & Geri Yükleme

```bash
# Yedek al (kullanıcılar + abonelikler + crosspost verileri)
./backup.sh
# → backups/hotpulse_backup_TARIH.json

# VDS'e gönder
scp backups/hotpulse_backup_*.json kullanici@vds-ip:/root/hotpulse/backups/

# VDS'de geri yükle
./restore.sh backups/hotpulse_backup_*.json
```

---

## Admin Paneli

`/admin` → `role = "admin"` olan kullanıcılar erişebilir.

İlk admin oluşturma:
```bash
cd backend
python manage.py shell -c "
from apps.accounts.models import User
u = User.objects.create_user('admin', 'admin@hotpulse.me', 'sifre')
u.role = 'admin'
u.save()
print('Admin oluşturuldu')
"
```

---

## Crosspost Sistemi

Admin paneli → **Video Yönetimi** → video kartı → **✏️ Düzenle** → **📡 Dağıtım** sekmesi

- Tüm aktif sağlayıcılar otomatik seçili gelir
- Tek tek açıp/kapatabilirsin
- Hiçbirini seçmezsen hiçbir yere gönderilmez

Sağlayıcı eklemek/düzenlemek: **Video Yükle** sayfası → sağlayıcı kartına hover → ✏️ ikonuna tıkla

---

## User Preferences

- Türkçe arayüz ve iletişim
