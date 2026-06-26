# Soci — Sosyal Video Platformu

Django (backend) + React/Vite (frontend) tabanlı tam kapsamlı bir video paylaşım ve sosyal platform.

---

## İçindekiler

1. [Gereksinimler](#1-gereksinimler)
2. [Kurulum (Windows VDS)](#2-kurulum-windows-vds)
3. [Ortam Değişkenleri (.env)](#3-ortam-değişkenleri-env)
4. [Veritabanı Kurulumu](#4-veritabanı-kurulumu)
5. [Frontend Derleme](#5-frontend-derleme)
6. [Statik Dosyaları Toplama](#6-statik-dosyaları-toplama)
7. [Admin Kullanıcısı Oluşturma](#7-admin-kullanıcısı-oluşturma)
8. [Siteyi Başlatma (Waitress)](#8-siteyi-başlatma-waitress)
9. [Windows Servisi Olarak Çalıştırma (NSSM)](#9-windows-servisi-olarak-çalıştırma-nssm)
10. [PostgreSQL Kurulumu (İsteğe Bağlı)](#10-postgresql-kurulumu-i̇steğe-bağlı)
11. [Nginx ile Ters Proxy (İsteğe Bağlı)](#11-nginx-ile-ters-proxy-i̇steğe-bağlı)
12. [Klasör Yapısı](#12-klasör-yapısı)
13. [Sık Karşılaşılan Sorunlar](#13-sık-karşılaşılan-sorunlar)

---

## 1. Gereksinimler

| Yazılım | Sürüm | İndirme |
|---|---|---|
| Python | 3.11 veya üzeri | https://www.python.org/downloads/ |
| Node.js | 20 veya üzeri | https://nodejs.org/ |
| pnpm | En güncel | `npm install -g pnpm` |
| Git | Herhangi | https://git-scm.com/ |

> **Not:** Python kurulumunda **"Add Python to PATH"** seçeneğini işaretleyin.

---

## 2. Kurulum (Windows VDS)

Komut İstemcisi'ni (CMD) veya PowerShell'i **Yönetici olarak** açın.

```bat
:: Projeyi klonla (veya ZIP'i çıkar)
git clone <repo-url> C:\soci
cd C:\soci\backend

:: Python sanal ortamı oluştur
python -m venv venv

:: Sanal ortamı etkinleştir
venv\Scripts\activate

:: Bağımlılıkları yükle
pip install -r requirements.txt
```

---

## 3. Ortam Değişkenleri (.env)

`C:\soci\backend` klasöründe `.env` adında bir dosya oluşturun:

```env
# Güvenlik — MUTLAKA değiştirin!
SECRET_KEY=buraya-cok-uzun-ve-rastgele-bir-anahtar-yazin-123!@#

# Geliştirme: True | Production: False
DEBUG=False

# Sitenin erişileceği domain veya IP
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com,192.168.1.100

# HTTPS kullanıyorsanız
CSRF_TRUSTED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Veritabanı (boş bırakılırsa SQLite kullanılır)
# PostgreSQL kullanmak için aşağıdaki satırı açın:
# DATABASE_URL=postgresql://kullanici:sifre@localhost:5432/soci_db

# CORS (frontend farklı portta ise)
CORS_ALLOW_ALL=False
CORS_ALLOWED_ORIGINS=https://yourdomain.com
```

> **SECRET_KEY üretmek için:**
> ```bat
> python -c "import secrets; print(secrets.token_urlsafe(50))"
> ```

---

## 4. Veritabanı Kurulumu

```bat
:: Sanal ortam aktifken backend klasöründe çalıştırın
cd C:\soci\backend
venv\Scripts\activate

python manage.py migrate
```

Tüm migrationlar uygulandıktan sonra şu çıktıyı görmelisiniz:

```
Operations to perform:
  Apply all migrations: accounts, admin, admin_panel, ...
Running migrations:
  Applying accounts.0001_initial... OK
  ...
```

---

## 5. Frontend Derleme

**Yeni bir CMD penceresi açın** (sanal ortam olmadan):

```bat
cd C:\soci\backend

:: Frontend bağımlılıklarını yükle
pnpm install

:: React uygulamasını derle
pnpm --filter @workspace/streamvid run build
```

Derleme tamamlandıktan sonra `backend/artifacts/streamvid/dist/public/` klasörü oluşur.

Derlenmiş dosyaları Django'nun statik klasörüne kopyalayın:

```bat
:: Eski dosyaları temizle
rmdir /s /q C:\soci\backend\static\assets

:: Yeni dosyaları kopyala
xcopy /s /y C:\soci\backend\artifacts\streamvid\dist\public\* C:\soci\backend\static\
```

---

## 6. Statik Dosyaları Toplama

```bat
cd C:\soci\backend
venv\Scripts\activate

python manage.py collectstatic --noinput
```

---

## 7. Admin Kullanıcısı Oluşturma

```bat
cd C:\soci\backend
venv\Scripts\activate

python manage.py createsuperuser
```

Kullanıcı adı, e-posta ve şifre girmeniz istenecek.

Admin paneline erişim: `http://yourdomain.com/django-admin/`

---

## 8. Siteyi Başlatma (Waitress)

```bat
cd C:\soci\backend
venv\Scripts\activate

waitress-serve --host=0.0.0.0 --port=8000 --threads=8 config.wsgi:application
```

Site `http://yourdomain.com:8000` adresinde erişilebilir olur.

Portu `.env` olmadan test etmek için:

```bat
:: Hızlı test (production değil)
python manage.py runserver 0.0.0.0:8000
```

---

## 9. Windows Servisi Olarak Çalıştırma (NSSM)

Siteyi bilgisayar yeniden başlayınca otomatik başlatmak için [NSSM](https://nssm.cc/) kullanın.

```bat
:: NSSM'i indirip PATH'e ekleyin, ardından:
nssm install SociApp

:: Açılan arayüzde:
::   Path: C:\soci\backend\venv\Scripts\waitress-serve.exe
::   Arguments: --host=0.0.0.0 --port=8000 --threads=8 config.wsgi:application
::   Startup directory: C:\soci\backend

:: Servisi başlat
nssm start SociApp

:: Servisi durdur
nssm stop SociApp

:: Servisi kaldır
nssm remove SociApp
```

---

## 10. PostgreSQL Kurulumu (İsteğe Bağlı)

SQLite üretim için yeterli değilse PostgreSQL kurun:

1. https://www.postgresql.org/download/windows/ adresinden indirin ve kurun
2. pgAdmin veya psql ile veritabanı oluşturun:

```sql
CREATE DATABASE soci_db;
CREATE USER soci_user WITH PASSWORD 'guclu-sifre';
GRANT ALL PRIVILEGES ON DATABASE soci_db TO soci_user;
```

3. `.env` dosyasına ekleyin:

```env
DATABASE_URL=postgresql://soci_user:guclu-sifre@localhost:5432/soci_db
```

4. Migrationları tekrar çalıştırın:

```bat
python manage.py migrate
```

---

## 11. Nginx ile Ters Proxy (İsteğe Bağlı)

80/443 portundan erişim ve SSL için Nginx kullanın.

`nginx.conf` örneği:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Medya dosyaları (yüklenen videolar, görseller)
    location /media/ {
        alias C:/soci/backend/media/;
    }

    # Statik dosyalar
    location /static/ {
        alias C:/soci/backend/staticfiles/;
    }

    # Tüm diğer istekler Waitress'e
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Büyük video yüklemeleri için
        client_max_body_size 10G;
        proxy_read_timeout 3600;
        proxy_send_timeout 3600;
    }
}
```

---

## 12. Klasör Yapısı

```
C:\soci\
├── backend\
│   ├── apps\                  # Django uygulamaları
│   │   ├── accounts\          # Kullanıcı & kimlik doğrulama
│   │   ├── videos\            # Video yükleme & akış
│   │   ├── social\            # Takip, hikayeler, rozetler
│   │   ├── live\              # Canlı yayın
│   │   ├── messaging\         # Özel mesajlar
│   │   ├── tokens\            # Token & bahşiş sistemi
│   │   ├── subscriptions\     # Abonelik yönetimi
│   │   ├── notifications\     # Bildirimler
│   │   ├── affiliate\         # Affiliate sistemi
│   │   ├── admin_panel\       # Platform yönetimi
│   │   └── ai\                # AI özellikleri
│   ├── artifacts\
│   │   └── streamvid\         # React frontend kaynak kodu
│   ├── config\                # Django ayarları (settings.py, urls.py)
│   ├── static\                # Derlenmiş frontend (index.html, assets/)
│   ├── staticfiles\           # collectstatic çıktısı (Whitenoise servis eder)
│   ├── media\                 # Kullanıcı yüklemeleri (videolar, görseller)
│   ├── venv\                  # Python sanal ortamı
│   ├── manage.py
│   └── requirements.txt
└── README.md
```

---

## 13. Sık Karşılaşılan Sorunlar

### `ALLOWED_HOSTS` hatası
```
DisallowedHost at /
```
**Çözüm:** `.env` dosyasında `ALLOWED_HOSTS` değerine sitenizin domain/IP adresini ekleyin.

---

### Statik dosyalar yüklenmiyor (CSS/JS 404)
**Çözüm:**
```bat
python manage.py collectstatic --noinput
```
Ardından Waitress'i yeniden başlatın.

---

### `ModuleNotFoundError`
**Çözüm:** Sanal ortamın aktif olduğundan emin olun:
```bat
venv\Scripts\activate
pip install -r requirements.txt
```

---

### Medya dosyaları görünmüyor
**Çözüm:** Nginx kullanıyorsanız `location /media/` bloğunu ekleyin. Nginx kullanmıyorsanız `DEBUG=True` ile test edin (sadece geliştirme için).

---

### Port 8000 zaten kullanımda
```bat
netstat -ano | findstr :8000
taskkill /PID <PID numarasi> /F
```

---

### Frontend değişikliklerini yayına almak

```bat
cd C:\soci\backend

:: Derle
pnpm --filter @workspace/streamvid run build

:: Kopyala
xcopy /s /y artifacts\streamvid\dist\public\* static\

:: Statik dosyaları güncelle
venv\Scripts\activate
python manage.py collectstatic --noinput

:: Waitress'i yeniden başlat (NSSM kullanıyorsanız)
nssm restart SociApp
```

---

## API Uç Noktaları

| URL | Açıklama |
|---|---|
| `/api/healthz` | Sunucu sağlık kontrolü |
| `/api/auth/register/` | Kayıt |
| `/api/auth/login/` | Giriş (JWT token alır) |
| `/api/token/refresh/` | JWT token yenile |
| `/api/videos/` | Video listesi |
| `/django-admin/` | Admin paneli |

---

## Güvenlik Kontrol Listesi (Yayına Almadan Önce)

- [ ] `.env` dosyasında `DEBUG=False` yapıldı
- [ ] `SECRET_KEY` güçlü ve benzersiz bir değere ayarlandı
- [ ] `ALLOWED_HOSTS` sadece gerçek domain adreslerini içeriyor
- [ ] `CSRF_TRUSTED_ORIGINS` HTTPS adresleriyle dolduruldu
- [ ] Veritabanı şifresi güçlü seçildi
- [ ] `collectstatic` çalıştırıldı
- [ ] Firewall'da sadece gerekli portlar açık (80, 443, 8000)
- [ ] Admin şifresi güçlü ve tahmin edilemez
