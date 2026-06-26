# PROJE TAM AKTARIM PROMPTU
# Bu dosyayı yeni hesapta agent'a olduğu gibi yapıştır.

---

## GÖREV

Aşağıdaki GitHub reposunu Replit'e kur, en detaylı frontend + backend versiyonunu çalışır hale getir ve tüm özellikleri aktif et.

**Ana repo:** https://github.com/sefasefasefa/repodepo

---

## ADIM 1 — Repoları klonla

```bash
# Ana repo (submodule içerir)
git clone https://github.com/sefasefasefa/repodepo workspace_root
cd workspace_root

# 4 submodule şu commit'lerde:
# Prnhub     → 5adab7519d328f084e279602138ee46091132efc  (Django backend)
# prnhbbbb   → ee7f2de6cf132ce2354cf104e57d99917a14f6f6  (React frontend)

# Prnhub (Django backend) klonla
git clone https://github.com/sefasefasefa/Prnhub /tmp/Prnhub

# prnhbbbb (React frontend) klonla — TÜM geçmişiyle
git clone https://github.com/sefasefasefa/prnhbbbb /tmp/prnhbbbb
```

---

## ADIM 2 — EN DETAYLI VERSİYONLARI BUL

prnhbbbb reposunun commit geçmişi 50 commit içerir.
Her dosya için en detaylı versiyon farklı commit'tedir:

```
GENEL EN DETAYLI COMMIT'LER (prnhbbbb):
  b92e070  → Sidebar tam (300 satır), leaderboard, live features
  dfb418d  → live-watch.tsx EN DETAYLI (canlı polling, fundraising, hediye)
  d903ba2  → developer.tsx EN DETAYLI (API key yönetimi, docs)
  6c81e8f  → transcript submission workflow
  b8abe2c  → subtitle ve quality controls (video player)
  4741260  → feature states ve maintenance mode
  33bbf96  → search sayfası gelişmiş filtreleme

DOSYA BAZLI EN DETAYLI VERSİYONLAR:
  sidebar.tsx      → commit b92e070  (300 satır — HEAD'de stub'a dönmüş!)
  live-watch.tsx   → commit dfb418d  (polling, fundraising, gifts)
  developer.tsx    → commit d903ba2  (API key management, tam docs)
  leaderboard.tsx  → commit b92e070
```

---

## ADIM 3 — WORKSPACE KURULUMU

### 3a. Backend dizini oluştur
```bash
mkdir -p /home/runner/workspace/backend
cp -r /tmp/Prnhub/* /home/runner/workspace/backend/
```

### 3b. Frontend'i yerleştir
```bash
mkdir -p /home/runner/workspace/backend/artifacts/streamvid
cp -r /tmp/prnhbbbb/artifacts/streamvid/* /home/runner/workspace/backend/artifacts/streamvid/
```

### 3c. Sidebar'ı orijinal tam versiyonuyla değiştir (ZORUNLU!)
```bash
# HEAD'deki sidebar stub'a dönmüş — b92e070'teki 300 satırlık versiyonu kullan:
git -C /tmp/prnhbbbb show b92e070:artifacts/streamvid/src/components/layout/sidebar.tsx \
  > /home/runner/workspace/backend/artifacts/streamvid/src/components/layout/sidebar.tsx
```

### 3d. live-watch.tsx en detaylı versiyonuyla değiştir
```bash
git -C /tmp/prnhbbbb show dfb418d:artifacts/streamvid/src/pages/live-watch.tsx \
  > /home/runner/workspace/backend/artifacts/streamvid/src/pages/live-watch.tsx
```

### 3e. developer.tsx en detaylı versiyonuyla değiştir
```bash
git -C /tmp/prnhbbbb show d903ba2:artifacts/streamvid/src/pages/developer.tsx \
  > /home/runner/workspace/backend/artifacts/streamvid/src/pages/developer.tsx
```

---

## ADIM 4 — BACKEND (Django) KURULUMU

```bash
cd /home/runner/workspace/backend

# Python paketleri
pip install Django==4.2.16 djangorestframework==3.15.2 \
  djangorestframework-simplejwt==5.3.1 django-cors-headers==4.4.0 \
  Pillow==10.4.0 python-dotenv==1.0.1 whitenoise==6.7.0 \
  gunicorn==22.0.0 waitress==3.0.1

# .env dosyası
cat > .env << 'EOF'
SECRET_KEY=django-insecure-replit-dev-key-change-in-production-xyz123
DEBUG=True
ALLOWED_HOSTS=*
CORS_ALLOW_ALL_ORIGINS=True
EOF

# Migrations
python manage.py migrate --noinput

# Admin kullanıcısı
python manage.py shell -c "
from django.contrib.auth import get_user_model
U = get_user_model()
if not U.objects.filter(username='admin').exists():
    u = U.objects.create_superuser('admin','admin@example.com','admin123')
    u.role = 'admin'
    u.save()
    print('Admin oluşturuldu: admin / admin123')
"
```

---

## ADIM 5 — FRONTEND (React/Vite) KURULUMU

```bash
cd /home/runner/workspace/backend

# pnpm workspace kurulumu
cat > pnpm-workspace.yaml << 'EOF'
packages:
  - 'artifacts/*'
  - 'lib/*'
EOF

# pnpm install
pnpm install

# Vite config — PORT 5000 default
```

### vite.config.ts içinde şu ayar olmalı:
```typescript
server: {
  port: parseInt(process.env.PORT || "5000"),
  host: "0.0.0.0",
  proxy: { "/api": "http://localhost:8000" }
}
```

---

## ADIM 6 — WORKFLOW AYARLARI

**"Start application" workflow:**
```
cd backend && PORT=5000 BASE_PATH=/ pnpm --filter @workspace/streamvid run dev
```

**Django backend (console):**
```
cd backend && python manage.py runserver localhost:8000
```

---

## ADIM 7 — ÖZELLEŞTIRMELER (Bu session'da yapılanlar)

### 7a. payment.tsx — 15 Kripto Para
`/home/runner/workspace/backend/artifacts/streamvid/src/pages/payment.tsx`

Kart ödeme + 15 kripto içermeli:
BTC, ETH, USDT, USDC, BNB, SOL, XMR, LTC, ADA, DOGE, TRX, MATIC, DOT, AVAX, LINK

Her coin için:
- Gerçek cüzdan adresi + kopyalama butonu
- USD karşılığı tutar kopyalama
- Ağ uyarısı (yanlış ağ = geri alınamaz)
- 30 dakika timer
- Kur güncelle butonu

### 7b. admin-mining.tsx — 18 Algoritma
`/home/runner/workspace/backend/artifacts/streamvid/src/components/admin/admin-mining.tsx`

18 algoritma içermeli:
1. CryptoNight (XMR)       - pool: supportxmr.com:3333
2. RandomX (XMR v2)        - pool: moneroocean.stream:10008
3. CryptoNight Lite        - pool: minergate.com:45700
4. CryptoNight Heavy       - pool: haven.herominers.com:10380
5. CryptoNight Pico        - pool: tlo.herominers.com:10560
6. Ethash (ETH fork)       - pool: ethermine.org:4444
7. Etchash (ETC)           - pool: etc.2miners.com:1010
8. KawPow (RVN)            - pool: rvn.2miners.com:6060
9. GhostRider (RTM)        - pool: rtm.suprnova.cc:7777
10. Argon2id (WOW)         - pool: pool.wownero.com:3333
11. Yescrypt (YTN)         - pool: yescrypt.mine.zpool.ca:6233
12. SHA-256d (BTC)         - pool: stratum.slushpool.com:3333
13. SHA-3 Keccak (MAX)     - pool: sha3.mine.zpool.ca:3333
14. Scrypt (LTC)           - pool: litecoinpool.org:3333
15. X16R (RVN old)         - pool: rvn.2miners.com:6060
16. X11 (DASH)             - pool: dash.2miners.com:5005
17. Blake2b (SC)           - pool: siamining.com:3333
18. Özel Algoritma         - custom pool

### 7c. app-layout.tsx — MiningConsent eklendi
```tsx
import { MiningConsent } from "@/components/mining-consent";
// ... AppLayout fonksiyonu içinde:
<MiningConsent />  // </div>'den önce ekle
```

### 7d. sidebar.tsx — Tam 300 satırlık versiyon
b92e070 commit'inden alınmalı. İçerik:
- Üst: Logo + kapat butonu + PWA yükleme banner
- Ana nav: Videolar, Shorts, Önerilenler, Trend 🇹🇷, Modeller (expand), Kanallar
- Top Kategoriler (expand): 10 kategori + tüm kategoriler butonu
- Oynatma Listeleri, Hikayeler, Canlı Yayınlar 🔴, Sadakat Sıralaması, Rastgele Eşleşme
- Topluluk (2x3 grid): Güven, Creator Merkezi, Blog, İstatistikler, Wellness, Mağaza
- Hesabım: Geçmiş, Kaydedilenler, Bildirimler, İndirilenler
- İçerik Paneli (creator/admin): Video Yükle, Dashboard
- Admin: Admin Paneli (yalnız admin role)
- DB kategorileri (API'den canlı)
- Kişiselleştirme toggle
- Login CTA (giriş yoksa)

---

## ADIM 8 — STUB SAYFALAR (Bunları da doldur!)

Aşağıdaki sayfalar kaynak repoda da stub — sıfırdan yaz:

| Dosya | Mevcut | Yapılacak |
|-------|--------|-----------|
| categories.tsx | 34 satır | Thumbnail'li kategori kartları, video sayısı, renk efektleri |
| category-detail.tsx | 13 satır | Video grid, filtreleme, sayfalama, kategori başlığı |
| bookmarks.tsx | 40 satır | Koleksiyon/klasör özelliği, Türkçe, filtreleme |
| history.tsx | 79 satır | Bugün/dün/bu hafta gruplaması, arama, toplu silme |
| playlists.tsx | 57 satır | Yeni playlist oluştur butonu, düzenleme |
| playlist-detail.tsx | 52 satır | Video listesi, public/private, paylaşım |
| notifications.tsx | 103 satır | Gruplama, okundu filtresi, toplu işlem |
| admin-subscriptions.tsx | 59 satır | Tam abonelik yönetimi, filtre, iptal, raporlar |

---

## ADIM 9 — KONTROL LİSTESİ

- [ ] Django çalışıyor: `curl http://localhost:8000/api/health`
- [ ] Frontend çalışıyor: port 5000
- [ ] Yaş kapısı geçiliyor
- [ ] Hamburger menü → tam sidebar (20+ nav item)
- [ ] Navbar'da: Mining butonu, Token bakiye, DM, Bildirim, Avatar
- [ ] /admin → 25 sekme (Madencilik sekmesi dahil, 18 algoritma)
- [ ] /payment → Kart + 15 kripto seçimi
- [ ] Login: admin / admin123

---

## ÖNEMLİ NOTLAR

- sidebar.tsx'in HEAD versiyonu BOZUK — mutlaka b92e070'ten al
- Mining butonu yalnızca: kullanıcı giriş yapmış + mining consent "yes" ise görünür
- MiningConsent popup → app-layout.tsx'e eklenmiş olmalı
- pnpm workspace backend/ klasöründe, frontend artifacts/streamvid/ altında
- Django proxy: tüm /api/* istekleri localhost:8000'e gider (vite proxy config)
- Admin paneli Django admin değil — /admin route'u React frontend'de

---

## GİTHUB REPO BİLGİLERİ

Ana repo   : https://github.com/sefasefasefa/repodepo
Hesap      : sefasefasefa

Submodule commit'leri (ilk commit'te):
  Prnhub     : 5adab7519d328f084e279602138ee46091132efc
  prnhbbbb   : ee7f2de6cf132ce2354cf104e57d99917a14f6f6
  Soci       : b0bb7aafa3356953836760375d1bcf47f2048f56

En detaylı frontend commit'leri (prnhbbbb):
  b92e070  → sidebar, leaderboard (EN ÖNEMLİ — sidebar buradan alınmalı)
  dfb418d  → live-watch (polling, fundraising, gifts)
  d903ba2  → developer page (API key management)
  6c81e8f  → transcript workflow
  b8abe2c  → subtitle + quality controls
