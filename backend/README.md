# Soci — Sosyal Video Platformu
### Tam Yayın Rehberi | Windows · Linux · Cloud

> %100 Python/Django backend + önceden derlenmiş React frontend.  
> Kurulum → Domain → HTTPS → Yayın — hepsi bu dosyada.

---

## İçindekiler

1. [Hızlı Başlangıç — Windows (tek tıkla kurulum)](#1-hızlı-başlangıç--windows)
2. [Sunucuyu Başlat](#2-sunucuyu-başlat)
3. [Domain Bağlama ve HTTPS (Cloudflare — en kolay yol)](#3-domain-bağlama-ve-https--cloudflare)
4. [Alternatif: VPS / Linux Sunucu](#4-alternatif-vps--linux-sunucu)
5. [Alternatif: PythonAnywhere](#5-alternatif-pythonanywhere)
6. [Production Ayarları (.env)](#6-production-ayarları-env)
7. [Admin Paneli](#7-admin-paneli)
8. [API Referansı](#8-api-referansı)
9. [Proje Yapısı](#9-proje-yapısı)
10. [Sorun Giderme](#10-sorun-giderme)

---

## 1. Hızlı Başlangıç — Windows

### Gereksinim

**Python 3.11** kur → https://www.python.org/downloads/  
⚠️ Kurulum ekranında **"Add Python to PATH"** kutusunu mutlaka işaretle!

### Kurulum (tek tıkla)

1. ZIP'i bir klasöre çıkart (örn: `C:\soci\`)
2. `kurulum.bat` dosyasına **çift tıkla**

Otomatik olarak şunları yapar:
- Python sanal ortamı oluşturur
- Tüm bağımlılıkları yükler
- `.env` dosyasını güçlü `SECRET_KEY` ile oluşturur
- Veritabanını hazırlar (`migrate`)
- Frontend static dosyalarını toplar (`collectstatic`)
- Demo veriyi yükler → `admin / admin123` hesabı oluşturur

---

## 2. Sunucuyu Başlat

### Windows — `baslat.bat`'a çift tıkla

Veya komut satırından:

```cmd
cd C:\soci
call venv\Scripts\activate
waitress-serve --host=0.0.0.0 --port=8000 config.wsgi:application
```

Tarayıcıda aç: **http://localhost:8000**  
Admin paneli: **http://localhost:8000/django-admin/** → `admin / admin123`

### Bilgisayar açılınca otomatik başlat

1. `Win + R` → `shell:startup` yaz → Enter
2. Açılan klasöre `baslat.bat` dosyasının **kısayolunu** kopyala

---

## 3. Domain Bağlama ve HTTPS — Cloudflare

> Kendi bilgisayarından yayın yapmanın en kolay ve güvenli yolu.  
> Port yönlendirme gerekmez. HTTPS otomatik gelir. Ücretsiz.

### Adım 1 — Domain al

Bir domain satın al (önerilen kayıtçılar):
- https://www.namecheap.com
- https://www.godaddy.com
- https://domains.google.com

### Adım 2 — Domain'i Cloudflare'e taşı (ücretsiz)

1. https://cloudflare.com → ücretsiz hesap oluştur
2. **"Add a Site"** → domain adını gir → **Free plan** seç
3. Cloudflare sana 2 adet nameserver adresi verir:
   ```
   örn: aria.ns.cloudflare.com
        ben.ns.cloudflare.com
   ```
4. Domain satın aldığın sitede (Namecheap/GoDaddy vb.) **nameserver** ayarlarını bu iki adresle değiştir
5. 15 dakika — 24 saat içinde aktif olur (genellikle çok daha hızlı)

### Adım 3 — Cloudflare Tunnel kur (Windows)

Cloudflare Tunnel, bilgisayarındaki sunucuyu dışarıya açar.  
Router ayarı, port açma, statik IP gerekmez.

**cloudflared'ı indir:**  
https://github.com/cloudflare/cloudflared/releases/latest  
→ `cloudflared-windows-amd64.msi` dosyasını indir ve kur

**Terminali aç ve giriş yap:**
```cmd
cloudflared tunnel login
```
Tarayıcı açılır → Cloudflare hesabına giriş yap → domain'i seç → İzin ver.

**Tunnel oluştur:**
```cmd
cloudflared tunnel create soci
```
Bir tunnel ID ve credentials dosyası oluşturulur — bunları not et.

**Tunnel yapılandırması:**  
`C:\Users\KULLANICIADINIZ\.cloudflared\config.yml` dosyasını oluştur:

```yaml
tunnel: TUNNEL_ID_BURAYA
credentials-file: C:\Users\KULLANICIADINIZ\.cloudflared\TUNNEL_ID_BURAYA.json

ingress:
  - hostname: siteniz.com
    service: http://localhost:8000
  - hostname: www.siteniz.com
    service: http://localhost:8000
  - service: http_status:404
```

**DNS kaydı ekle:**
```cmd
cloudflared tunnel route dns soci siteniz.com
cloudflared tunnel route dns soci www.siteniz.com
```

**Tunnel'ı çalıştır:**
```cmd
cloudflared tunnel run soci
```

Artık `https://siteniz.com` adresi çalışıyor! HTTPS otomatik.

**Windows servis olarak kur (bilgisayar açılınca otomatik başlasın):**
```cmd
cloudflared service install
```

### Cloudflare Dashboard'da Son Ayarlar

Cloudflare panelinde sitenin ayarlarına gir:

- **SSL/TLS** → **Full (strict)** seç
- **Speed → Optimization** → Auto Minify → hepsini işaretle
- **Security** → Gerekirse bot korumasını aç

---

### Alternatif: Statik IP varsa port yönlendirme ile

İnternet sağlayıcından statik IP aldıysan veya dinamik DNS kullanacaksan:

1. Router yönetim paneline gir (genellikle `192.168.1.1`)
2. **Port Forwarding** bölümünde:
   - Dış port: `80` → İç IP: `192.168.1.X` → İç port: `8000`
   - Dış port: `443` → İç IP: `192.168.1.X` → İç port: `8000`
3. Cloudflare DNS'te bir **A kaydı** oluştur:
   - Type: `A`, Name: `@`, Content: `dış IP adresin`
   - **Proxy status: Proxied (turuncu bulut)** → HTTPS otomatik gelir

**Dinamik IP için (ücretsiz):** https://www.duckdns.org veya https://www.noip.com

---

### .env Dosyasını Production İçin Güncelle

Domain bağladıktan sonra `.env` dosyasını güncelle:

```env
SECRET_KEY=cok-guclu-50-karakterlik-rastgele-bir-key
DEBUG=False
ALLOWED_HOSTS=siteniz.com,www.siteniz.com,localhost
CSRF_TRUSTED_ORIGINS=https://siteniz.com,https://www.siteniz.com
CORS_ALLOWED_ORIGINS=https://siteniz.com,https://www.siteniz.com
```

Sonra sunucuyu yeniden başlat.

---

## 4. Alternatif: VPS / Linux Sunucu

Hetzner, DigitalOcean, Linode, Vultr gibi bulut sunucular için.

```bash
# Dosyaları yükle
scp -r soci-django.zip kullanici@sunucu_ip:~/
ssh kullanici@sunucu_ip
unzip soci-django.zip && cd soci-django

# Kurulum
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
nano .env   # SECRET_KEY, ALLOWED_HOSTS, DEBUG=False güncelle

python manage.py migrate
python manage.py collectstatic --noinput
python manage.py seed_data      # Admin şifresini kaydet!

# Gunicorn ile başlat
gunicorn config.wsgi:application --bind 127.0.0.1:8000 --workers 3 --daemon
```

### Nginx + HTTPS (Let's Encrypt)

```bash
# Nginx ve Certbot kur
sudo apt install nginx certbot python3-certbot-nginx -y

# Nginx ayarı
sudo nano /etc/nginx/sites-available/soci
```

```nginx
server {
    listen 80;
    server_name siteniz.com www.siteniz.com;

    client_max_body_size 10G;

    location /static/ {
        alias /home/kullanici/soci-django/staticfiles/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    location /media/ {
        alias /home/kullanici/soci-django/media/;
    }
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/soci /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# Ücretsiz SSL sertifikası al
sudo certbot --nginx -d siteniz.com -d www.siteniz.com
```

### Systemd Servisi (otomatik başlatma)

```bash
sudo nano /etc/systemd/system/soci.service
```

```ini
[Unit]
Description=Soci Django App
After=network.target

[Service]
User=kullanici
WorkingDirectory=/home/kullanici/soci-django
ExecStart=/home/kullanici/soci-django/venv/bin/gunicorn config.wsgi:application --bind 127.0.0.1:8000 --workers 3
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable soci
sudo systemctl start soci
```

---

## 5. Alternatif: PythonAnywhere

Ücretsiz hosting için (sınırlı kaynak, SQLite yeterli).

```bash
# PythonAnywhere Bash konsolunda:
unzip soci-django.zip
cd soci-django
bash bootstrap.sh     # Tek komutla her şeyi kurar
```

> ⚠️ Admin şifresi ekrana bir kez yazdırılır — mutlaka kaydet!

**Web sekmesinde:**
- WSGI dosyasını `pythonanywhere_wsgi.py` içeriğiyle güncelle (`KULLANICIADINIZ` kısmını değiştir)
- Static files: `/static/` → `~/soci-django/staticfiles/`
- Media files: `/media/` → `~/soci-django/media/`
- Virtualenv: `~/.virtualenvs/prnhub-venv`
- **Reload** düğmesine bas → ✅

---

## 6. Production Ayarları (.env)

`.env.example` dosyasını `.env` olarak kopyala:

```cmd
copy .env.example .env
```

| Değişken | Açıklama |
|----------|----------|
| `SECRET_KEY` | **Mutlaka değiştir.** Üretmek için: `python -c "import secrets; print(secrets.token_urlsafe(50))"` |
| `DEBUG` | Yayında `False` olmalı |
| `ALLOWED_HOSTS` | Domainini ve www'sini virgülle ekle |
| `CSRF_TRUSTED_ORIGINS` | `https://siteniz.com,https://www.siteniz.com` |
| `CORS_ALLOWED_ORIGINS` | `https://siteniz.com` |
| `DATABASE_URL` | Varsayılan SQLite. PostgreSQL için: `postgresql://user:pass@host/db` |

---

## 7. Admin Paneli

| Alan | Değer |
|------|-------|
| URL | `https://siteniz.com/django-admin/` |
| Kullanıcı | `admin` |
| Şifre | kurulum sırasında ekrana yazdırılır |

**Geliştirme modunda** (`--env=dev`): `admin / admin123`

**Şifre sıfırla:**
```cmd
python manage.py changepassword admin
```

**Admin panel özellikleri:**
- Kullanıcı yönetimi ve moderasyon
- Video yönetimi ve içerik raporları
- Ödeme gateway yapılandırması
- A/B test yönetimi
- SEO ve webhook ayarları
- Platform analitiği

---

## 8. API Referansı

Tüm endpointler `/api/` altında. Korunan endpointler için header:
```
Authorization: Bearer <token>
```

### Auth
| Metod | URL | Açıklama |
|-------|-----|----------|
| POST | `/api/auth/register` | Kayıt |
| POST | `/api/auth/login` | Giriş → token döner |
| POST | `/api/auth/logout` | Çıkış |
| GET | `/api/auth/me` | Mevcut kullanıcı |
| POST | `/api/auth/phone/send-otp` | SMS OTP gönder |
| POST | `/api/auth/phone/verify-otp` | OTP doğrula |

### Videolar
| Metod | URL | Açıklama |
|-------|-----|----------|
| GET | `/api/videos` | Tüm videolar |
| GET | `/api/videos/feed` | Ana feed |
| GET | `/api/videos/trending` | Trend videolar |
| GET | `/api/videos/shorts` | Kısa videolar |
| GET | `/api/videos/<id>` | Detay |
| POST | `/api/videos/create` | Oluştur |
| PUT | `/api/videos/<id>/update` | Güncelle |
| DELETE | `/api/videos/<id>/delete` | Sil |
| POST | `/api/videos/<id>/like` | Beğen |
| POST | `/api/videos/<id>/bookmark` | Kaydet |
| POST | `/api/videos/<id>/view` | Görüntüleme kaydet |
| POST | `/api/upload/video` | Dosya yükle |

### Sosyal
| Metod | URL | Açıklama |
|-------|-----|----------|
| POST | `/api/users/<id>/follow` | Takip et |
| DELETE | `/api/users/<id>/unfollow` | Takibi bırak |
| GET | `/api/users/<id>/followers` | Takipçiler |
| GET | `/api/users/<id>/following` | Takip edilenler |
| GET | `/api/stories` | Hikayeler |
| POST | `/api/stories/create` | Hikaye ekle |

### Canlı Yayın
| Metod | URL | Açıklama |
|-------|-----|----------|
| GET | `/api/live` | Aktif yayınlar |
| POST | `/api/live/create` | Yayın oluştur |
| POST | `/api/live/<id>/start` | Başlat |
| POST | `/api/live/<id>/end` | Bitir |

### Tokenlar
| Metod | URL | Açıklama |
|-------|-----|----------|
| GET | `/api/tokens/packages` | Paketler |
| GET | `/api/tokens/balance` | Bakiye |
| POST | `/api/tokens/purchase` | Satın al |
| POST | `/api/tokens/tip` | Bahşiş gönder |

### Abonelikler
| Metod | URL | Açıklama |
|-------|-----|----------|
| GET | `/api/subscriptions/plans` | Planlar |
| POST | `/api/subscriptions/subscribe` | Abone ol |

### Bildirimler
| Metod | URL | Açıklama |
|-------|-----|----------|
| GET | `/api/notifications` | Bildirimler |
| POST | `/api/notifications/<id>/read` | Okundu işaretle |
| POST | `/api/notifications/read-all` | Hepsini oku |

### Admin / Analitik
| Metod | URL | Açıklama |
|-------|-----|----------|
| GET | `/api/analytics/platform` | Platform istatistikleri |
| GET | `/api/admin/users` | Kullanıcılar |
| GET | `/api/admin/reports` | Raporlar |
| GET | `/api/admin/videos` | Videolar |
| GET | `/api/health` | Sağlık kontrolü |

---

## 9. Proje Yapısı

```
soci-django/
├── kurulum.bat                ← Windows: ilk kurulum (çift tıkla)
├── baslat.bat                 ← Windows: sunucuyu başlat
├── manage.py                  ← Django yönetim komutu
├── requirements.txt           ← Python bağımlılıkları
├── bootstrap.sh               ← Linux/PythonAnywhere otomatik kurulum
├── pythonanywhere_wsgi.py     ← PythonAnywhere WSGI şablonu
├── .env.example               ← Ortam değişkeni şablonu
├── README.md                  ← Bu dosya
│
├── config/
│   ├── settings.py            ← Tüm Django ayarları
│   ├── urls.py                ← URL yönlendirmeleri
│   └── wsgi.py                ← WSGI giriş noktası
│
├── apps/                      ← Tüm Django modülleri
│   ├── accounts/              ← Kullanıcı, JWT auth, SMS OTP
│   ├── videos/                ← Video çekirdeği
│   ├── social/                ← Takip, hikaye, rozetler
│   ├── live/                  ← Canlı yayın
│   ├── messaging/             ← DM ve aramalar
│   ├── notifications/         ← Bildirim sistemi
│   ├── tokens/                ← Token ekonomisi
│   ├── subscriptions/         ← Abonelik yönetimi
│   ├── affiliate/             ← Bağlı ortaklık
│   ├── ai/                    ← İçerik öneri motoru
│   ├── devices/               ← Cihaz kaydı
│   ├── crosspost/             ← Çapraz platform paylaşım
│   ├── admin_panel/           ← Yönetici API
│   └── core/                  ← Yardımcı komutlar, health
│
├── static/                    ← Önceden derlenmiş React frontend
│   ├── index.html
│   └── assets/
│
├── staticfiles/               ← collectstatic sonrası oluşur (git'e eklenmez)
├── media/                     ← Kullanıcı yüklemeleri (runtime'da oluşur)
└── db.sqlite3                 ← SQLite veritabanı (migrate sonrası oluşur)
```

---

## 10. Sorun Giderme

### `python` komutu bulunamıyor (Windows)
Python kurulurken "Add Python to PATH" işaretlenmemiş.  
Çözüm: Python'ı yeniden kur → https://www.python.org/downloads/

### `venv\Scripts\activate` çalışmıyor (PowerShell)
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### `DisallowedHost` hatası
`.env` dosyasında `ALLOWED_HOSTS` değerini güncelle:
```
ALLOWED_HOSTS=siteniz.com,www.siteniz.com,localhost,127.0.0.1
```

### Static dosyalar gelmiyor (CSS/JS eksik)
```cmd
python manage.py collectstatic --noinput
```

### Veritabanı hatası
```cmd
python manage.py migrate --noinput
```

### Port 8000 kullanımda
```cmd
waitress-serve --port=8080 config.wsgi:application
```
→ `http://localhost:8080` ile gir, Cloudflare config.yml'de de portu güncelle.

### Cloudflare Tunnel bağlanmıyor
1. `cloudflared tunnel login` tekrar çalıştır
2. `config.yml` dosyasındaki tunnel ID'nin doğru olduğunu kontrol et
3. `cloudflared tunnel list` ile tunnel'ı doğrula

### Admin şifresini unuttum
```cmd
python manage.py changepassword admin
```

### HTTPS çalışmıyor (Cloudflare)
Cloudflare → SSL/TLS → **Full (strict)** seçili olmalı.

---

## Teknoloji Yığını

| Katman | Teknoloji |
|--------|-----------|
| Backend | Python 3.11, Django 4.2 |
| REST API | Django REST Framework 3.15 |
| Auth | JWT — djangorestframework-simplejwt |
| Veritabanı | SQLite (varsayılan) / PostgreSQL destekli |
| Static Dosyalar | WhiteNoise |
| Sunucu (Windows) | Waitress 3.0 |
| Sunucu (Linux) | Gunicorn |
| HTTPS / CDN | Cloudflare (ücretsiz) |
| Frontend | React — önceden derlenmiş, ek araç gerekmez |
