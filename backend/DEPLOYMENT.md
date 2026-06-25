# Soci Django – PythonAnywhere Deployment Guide

## Proje Yapısı

```
soci/
├── manage.py
├── requirements.txt
├── .env               ← Oluşturulacak (.env.example'dan kopyala)
├── db.sqlite3         ← migrate sonrası oluşur
├── config/
│   ├── settings.py
│   ├── urls.py
│   └── wsgi.py
├── apps/              ← Tüm Django uygulamaları
├── media/             ← Kullanıcı yüklemeleri
└── staticfiles/       ← collectstatic sonrası

```

---

## 1. PythonAnywhere'e Yükleme

### Yöntem A: Git (önerilen)
```bash
git clone https://github.com/kullaniciadiniz/soci.git
cd soci
```

### Yöntem B: Zip ile
1. Projeyi zip'le: `zip -r soci.zip artifacts/django-soci/`
2. PythonAnywhere Files sekmesinden yükle
3. Bash konsolunda: `unzip soci.zip`

---

## 2. Virtualenv Oluştur

PythonAnywhere **Bash** konsolunda:
```bash
mkvirtualenv soci-venv --python=python3.11
workon soci-venv
cd ~/soci
pip install -r requirements.txt
```

---

## 3. .env Dosyası Oluştur

```bash
cp .env.example .env
nano .env
```

Şu değerleri güncelle:
```
SECRET_KEY=cok-gizli-bir-key-buraya-yaz
DEBUG=False
ALLOWED_HOSTS=kullaniciadiniz.pythonanywhere.com
```

---

## 4. Veritabanı Başlatma

```bash
python manage.py migrate
python manage.py seed_data           # üretim modu — admin şifresi rastgele üretilir ve bir kez ekrana yazılır
python manage.py createsuperuser     # isteğe bağlı, ek superuser
```

> **Önemli — seed_data davranışı:**
> - Varsayılan (`--env=prod`): admin kullanıcısı **rastgele** bir şifreyle oluşturulur.  
>   Şifre yalnızca bu komutun çıktısında bir kez gösterilir — kaydedin!  
> - Geliştirme ortamı için: `python manage.py seed_data --env=dev`  
>   Bu modda `admin / admin123` ve örnek creator hesapları oluşturulur.  
>   **Production'da `--env=dev` kullanmayın.**

---

## 5. Static Dosyalar

```bash
python manage.py collectstatic --noinput
```

Bu komut React frontend'i (`static/` klasöründen), Django admin CSS'ini ve diğer statik dosyaları `staticfiles/` dizinine kopyalar.

> **Not:** Zip içinde `static/` klasöründe önceden derlenmiş React uygulaması bulunur.
> Frontend URL'leri `/static/assets/...` şeklindedir — Django'nun `STATIC_URL = '/static/'` ayarıyla uyumludur.

---

## 6. PythonAnywhere WSGI Ayarı

PythonAnywhere **Web** sekmesi → **WSGI configuration file** linkine tıkla.

Dosya içeriğini tamamen şununla değiştir:
```python
import sys, os

path = '/home/kullaniciadiniz/soci'
if path not in sys.path:
    sys.path.insert(0, path)

os.environ['DJANGO_SETTINGS_MODULE'] = 'config.settings'
os.environ['DEBUG'] = 'False'
os.environ['ALLOWED_HOSTS'] = 'kullaniciadiniz.pythonanywhere.com'
os.environ['SECRET_KEY'] = 'cok-gizli-bir-key-buraya-yaz'

from django.core.wsgi import get_wsgi_application
application = get_wsgi_application()
```

---

## 7. Static ve Media Dosya Yolu Ayarı

**Web** sekmesi → **Static files** bölümü:

| URL         | Directory                                    |
|-------------|----------------------------------------------|
| `/static/`  | `/home/kullaniciadiniz/soci/staticfiles/`    |
| `/media/`   | `/home/kullaniciadiniz/soci/media/`          |

---

## 8. Virtualenv Yolu

**Web** sekmesi → **Virtualenv**:
```
/home/kullaniciadiniz/.virtualenvs/soci-venv
```

---

## 9. Reload

**Web** sekmesi → **Reload** düğmesine bas.

Artık `https://kullaniciadiniz.pythonanywhere.com` adresinde çalışıyor!

---

## Admin Hesabı

`python manage.py seed_data` (varsayılan üretim modu) çalıştırıldıktan sonra:
- **URL:** `/django-admin/`
- Kullanıcı adı: `admin`
- Şifre: komut çıktısında **bir kez** gösterilir — kaydedin, tekrar gösterilmez.

Geliştirme ortamında `python manage.py seed_data --env=dev` ile `admin / admin123` kullanılabilir.

---

## API Dokümantasyonu

Tüm endpointler `/api/` prefix'i altında:

### Auth
| Method | URL | Açıklama |
|--------|-----|----------|
| POST | `/api/auth/register` | Kayıt |
| POST | `/api/auth/login` | Giriş → `token` döner |
| POST | `/api/auth/logout` | Çıkış |
| GET | `/api/auth/me` | Mevcut kullanıcı |

### Videos
| Method | URL | Açıklama |
|--------|-----|----------|
| GET | `/api/videos` | Video listesi |
| GET | `/api/videos/feed` | Ana feed |
| GET | `/api/videos/trending` | Trend videolar |
| GET | `/api/videos/shorts` | Kısa videolar |
| GET | `/api/videos/<id>` | Video detayı |
| POST | `/api/videos/create` | Video oluştur (Creator) |
| PUT | `/api/videos/<id>/update` | Güncelle |
| DELETE | `/api/videos/<id>/delete` | Sil |
| POST | `/api/videos/<id>/like` | Beğen |
| DELETE | `/api/videos/<id>/unlike` | Beğeniyi kaldır |
| POST | `/api/videos/<id>/bookmark` | Kaydet |
| POST | `/api/videos/<id>/view` | Görüntüleme kaydet |
| POST | `/api/upload/video` | Video yükle |

### Kategoriler
| Method | URL |
|--------|-----|
| GET | `/api/categories` |
| GET | `/api/categories/<slug>` |

### Sosyal
| Method | URL |
|--------|-----|
| POST | `/api/users/<id>/follow` |
| DELETE | `/api/users/<id>/unfollow` |
| GET | `/api/stories` |
| POST | `/api/stories/create` |

### Live
| Method | URL |
|--------|-----|
| GET | `/api/live` |
| POST | `/api/live/create` |
| POST | `/api/live/<id>/start` |
| POST | `/api/live/<id>/end` |

### Tokens
| Method | URL |
|--------|-----|
| GET | `/api/tokens/packages` |
| GET | `/api/tokens/balance` |
| POST | `/api/tokens/purchase` |
| POST | `/api/tokens/tip` |

### Abonelikler
| Method | URL |
|--------|-----|
| GET | `/api/subscriptions/plans` |
| POST | `/api/subscriptions/subscribe` |

### Admin
| Method | URL |
|--------|-----|
| GET | `/api/analytics/platform` |
| GET | `/api/admin/users` |
| GET | `/api/admin/reports` |
| GET | `/api/admin/videos` |

---

## Authentication

Tüm korunan endpointler için header:
```
Authorization: Bearer <token>
```

`/api/auth/login` cevabından gelen `token` değerini kullan.

---

## Sorun Giderme

**`502 Bad Gateway`:**  
→ WSGI dosyasındaki path doğru mu? `sys.path.insert(0, '/home/kullaniciadiniz/soci')`

**`DisallowedHost`:**  
→ `ALLOWED_HOSTS` ortam değişkenine `kullaniciadiniz.pythonanywhere.com` ekle

**`Static files 404`:**  
→ `collectstatic` çalıştırdın mı? PythonAnywhere Web sekmesindeki static file path doğru mu?

**Veritabanı hatası:**  
→ `python manage.py migrate` çalıştırıldı mı?
