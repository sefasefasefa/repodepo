# PROJE TAM AKTARIM PROMPTU
# Bu dosyayı yeni hesapta agent'a olduğu gibi yapıştır.

---

## ÖNEMLİ NOT

Bu repo zaten en iyi versiyonlara sahip — eski commit'leri aramanıza gerek YOK.
Aşağıdaki dosyalar git geçmişinden çekilerek doğrudan workspace'e yazıldı:

| Dosya | Kaynak commit | Satır |
|-------|--------------|-------|
| sidebar.tsx | a9f776d | 397 satır (tam genişletilmiş) |
| live-watch.tsx | e3a7613 | 512 satır (SSE chat + hediyeler + liderlik tablosu) |
| live-streams.tsx | 0b5ca0e | 182 satır (canlı + geçmiş sekmeleri) |
| payment.tsx | bu session | 15 kripto + kart ödeme |
| admin-mining.tsx | bu session | 18 madencilik algoritması |

---

## GÖREV

Bu GitHub reposunu Replit'e kur ve çalışır hale getir.

**Ana repo:** https://github.com/sefasefasefa/repodepo

---

## ADIM 1 — Repoları klonla

```bash
# Ana repo
git clone https://github.com/sefasefasefa/repodepo /home/runner/workspace
cd /home/runner/workspace

# Django backend (Prnhub submodule)
git clone https://github.com/sefasefasefa/Prnhub /tmp/Prnhub
cp -r /tmp/Prnhub/. /home/runner/workspace/backend/

# React frontend (prnhbbbb submodule) — eğer backend/artifacts/streamvid boşsa:
git clone https://github.com/sefasefasefa/prnhbbbb /tmp/prnhbbbb
cp -r /tmp/prnhbbbb/artifacts /home/runner/workspace/backend/artifacts
```

> NOT: Repo zaten workspace'e klonlandıysa (bu dosya oradadır) bu adımı atla.

---

## ADIM 2 — Backend (Django) Kurulumu

```bash
cd /home/runner/workspace/backend

pip install Django==4.2.16 djangorestframework==3.15.2 \
  djangorestframework-simplejwt==5.3.1 django-cors-headers==4.4.0 \
  Pillow==10.4.0 python-dotenv==1.0.1 whitenoise==6.7.0 \
  gunicorn==22.0.0 waitress==3.0.1

cat > .env << 'EOF'
SECRET_KEY=django-insecure-replit-dev-key-change-in-production-xyz123
DEBUG=True
ALLOWED_HOSTS=*
CORS_ALLOW_ALL_ORIGINS=True
EOF

python manage.py migrate --noinput

python manage.py shell -c "
from django.contrib.auth import get_user_model
U = get_user_model()
if not U.objects.filter(username='admin').exists():
    u = U.objects.create_superuser('admin','admin@example.com','admin123')
    u.role = 'admin'
    u.save()
    print('Admin olusturuldu: admin / admin123')
"
```

---

## ADIM 3 — Frontend (React/Vite) Kurulumu

```bash
cd /home/runner/workspace/backend

# pnpm workspace dosyası
cat > pnpm-workspace.yaml << 'EOF'
packages:
  - 'artifacts/*'
  - 'lib/*'
EOF

pnpm install
```

### vite.config.ts içinde şu ayar olmalı:
```typescript
server: {
  port: parseInt(process.env.PORT || "5000"),
  host: "0.0.0.0",
  allowedHosts: true,
  proxy: { "/api": "http://localhost:8000" }
}
```

---

## ADIM 4 — Workflow Ayarları

**"Start application" workflow komutu:**
```
cd backend && PORT=5000 BASE_PATH=/ pnpm --filter @workspace/streamvid run dev
```

**Django backend (ayrı terminal/workflow):**
```
cd backend && python manage.py runserver localhost:8000
```

---

## ADIM 5 — Bu Repoda Zaten Mevcut Olan Özellikler

### sidebar.tsx (397 satır)
`backend/artifacts/streamvid/src/components/layout/sidebar.tsx`
- PWA yükleme banner'ı
- Modeller & Starlar (expand edilebilir, 6 alt kategori)
- En İyi Kategoriler (expand edilebilir, 10 kategori)
- Topluluk (2×3 grid: Güven, Creator Merkezi, Blog, İstatistikler, Wellness, Mağaza)
- Hesabım: Geçmiş, Kaydedilenler, Bildirimler
- Creator: Video Yükle, İçerik Paneli
- Admin: Admin Paneli (sadece admin role)
- API'den canlı kategori listesi
- Kişiselleştirilmiş Öneriler toggle
- Giriş yapılmamışsa login CTA

### live-watch.tsx (512 satır)
`backend/artifacts/streamvid/src/pages/live-watch.tsx`
- HLS video oynatıcı (hls.js)
- SSE ile gerçek zamanlı chat
- 15 saniyelik heartbeat (izleyici sayısı)
- Sohbet sekmesi + Liderlik Tablosu sekmesi
- Hediye gönderme (LiveGiftPicker)
- Mesaj silme (creator/admin)
- Link filtreleme (processMessage)
- Paylaşma butonu + tam ekran

### live-streams.tsx (182 satır)
`backend/artifacts/streamvid/src/pages/live-streams.tsx`
- Şu An Yayında + Geçmiş Yayınlar sekmeleri
- İzleyici sayısı badge
- Yayın süresi gösterimi
- Yenile butonu

### payment.tsx — 15 Kripto + Kart
`backend/artifacts/streamvid/src/pages/payment.tsx`
- Kart ödeme (SSL badge'li)
- 15 kripto: BTC, ETH, USDT, USDC, BNB, SOL, XMR, LTC, ADA, DOGE, TRX, MATIC, DOT, AVAX, LINK
- Cüzdan adresi + kopyalama
- USD karşılığı hesaplama
- 30 dakika timer
- Ağ uyarısı

### admin-mining.tsx — 18 Algoritma
`backend/artifacts/streamvid/src/components/admin/admin-mining.tsx`
1. CryptoNight (XMR)       - supportxmr.com:3333
2. RandomX (XMR v2)        - moneroocean.stream:10008
3. CryptoNight Lite        - minergate.com:45700
4. CryptoNight Heavy       - haven.herominers.com:10380
5. CryptoNight Pico        - tlo.herominers.com:10560
6. Ethash (ETH fork)       - ethermine.org:4444
7. Etchash (ETC)           - etc.2miners.com:1010
8. KawPow (RVN)            - rvn.2miners.com:6060
9. GhostRider (RTM)        - rtm.suprnova.cc:7777
10. Argon2id (WOW)         - pool.wownero.com:3333
11. Yescrypt (YTN)         - yescrypt.mine.zpool.ca:6233
12. SHA-256d (BTC)         - stratum.slushpool.com:3333
13. SHA-3 Keccak (MAX)     - sha3.mine.zpool.ca:3333
14. Scrypt (LTC)           - litecoinpool.org:3333
15. X16R (RVN old)         - rvn.2miners.com:6060
16. X11 (DASH)             - dash.2miners.com:5005
17. Blake2b (SC)           - siamining.com:3333
18. Özel Algoritma         - custom pool

### app-layout.tsx — MiningConsent
`backend/artifacts/streamvid/src/components/layout/app-layout.tsx`
- `<MiningConsent />` global olarak eklendi
- Mining status butonu: sadece giriş yapmış + consent="yes" ise görünür

---

## ADIM 6 — Stub Sayfaları Doldur (Hâlâ Basit Olabilir)

Bu dosyalar hem bu repoda hem eski commit'lerde stub — sıfırdan yaz:

| Dosya | Yapılacak |
|-------|-----------|
| categories.tsx | Thumbnail'li grid, video sayısı, renk efektleri |
| category-detail.tsx | Video grid, filtreleme, kategori başlığı |
| bookmarks.tsx | Koleksiyon/klasör, arama, toplu silme |
| playlists.tsx | Playlist oluştur, public/private, paylaşım |
| playlist-detail.tsx | Video listesi, sürükle-bırak sıralama |
| notifications.tsx | Gruplama (bugün/bu hafta), toplu okundu |
| admin-subscriptions.tsx | Filtre, iptal, abonelik raporları |

---

## ADIM 7 — Kontrol Listesi

- [ ] Django çalışıyor: `curl http://localhost:8000/api/health`
- [ ] Frontend port 5000'de açık
- [ ] Yaş kapısı çalışıyor
- [ ] Hamburger → sidebar (20+ madde görünüyor, PWA banner var)
- [ ] Navbar: Mining butonu, Token bakiye, DM, Bildirim, Avatar
- [ ] /admin → 25 sekme (Madencilik sekmesi, 18 algoritma seçimi)
- [ ] /payment → Kart + 15 kripto
- [ ] /live → Şu An Yayında + Geçmiş sekmeleri
- [ ] Login: admin / admin123

---

## GitHub Repo Bilgileri

Ana repo   : https://github.com/sefasefasefa/repodepo
Hesap      : sefasefasefa (sefaspro@gmail.com)

Submodule commit'leri (ilk commit f44d8c9):
  Prnhub (Django backend) : 5adab7519d328f084e279602138ee46091132efc
  prnhbbbb (React frontend): ee7f2de6cf132ce2354cf104e57d99917a14f6f6
  Soci                    : b0bb7aafa3356953836760375d1bcf47f2048f56

prnhbbbb önemli commit'ler (artık doğrudan dosyalara yazıldı, gerekmez):
  a9f776d → sidebar 397 satır (şu an workspace'te)
  e3a7613 → live-watch 512 satır (şu an workspace'te)
  0b5ca0e → live-streams 182 satır (şu an workspace'te)
  b92e070 → leaderboard, sidebar (eski)
  dfb418d → live-watch fundraising (eski)
  d903ba2 → developer page API management (eski)
