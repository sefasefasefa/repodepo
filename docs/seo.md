# SEO Ayarları Rehberi

Admin Paneli → **Ayarlar → SEO** sekmesindeki her alanın ne olduğunu ve nasıl doldurulacağını açıklar.

---

## 📋 TEMEL SEKMESİ

### Site Başlığı
**Ne:** Tarayıcı sekmesinde ve Google arama sonuçlarında çıkan başlık.  
**İdeal uzunluk:** 50–60 karakter  
**Örnek:**
```
Soci — 18+ Video Platform | Türkiye'nin Creator Platformu
```
> ⚠️ Her sayfada bu başlık görünür. Marka adını başa yaz.

---

### Site Açıklaması
**Ne:** Google'da başlığın altında çıkan kısa açıklama (snippet).  
**İdeal uzunluk:** 150–160 karakter  
**Örnek:**
```
Türkiye'nin önde gelen 18+ video paylaşım platformu. Creator ol, video yükle, canlı yayın yap ve topluluğa katıl.
```
> ✅ Kullanıcıyı tıklamaya teşvik eden, sitenin ne olduğunu net anlatan bir metin yaz.

---

### Anahtar Kelimeler
**Ne:** Sitenin konusunu özetleyen terimler. Google bu alanı artık çok dikkate almıyor ama Yandex için faydalı.  
**Format:** Virgülle ayır  
**Örnek:**
```
video platform, 18+ içerik, canlı yayın, creator, video izle, türk creator
```

---

### Robots Direktifi
**Ne:** Arama motorlarına sayfanı indeksleyip indekslemeyeceğini söyler.

| Seçenek | Ne Anlama Gelir | Ne Zaman Kullan |
|---|---|---|
| `index,follow` | ✅ Her şeyi tara | **Normal durum — bunu seç** |
| `noindex,follow` | Sayfayı indeksleme | Bakım modu, test sayfaları |
| `noindex,nofollow` | Hiçbir şeyi yapma | Geliştirme ortamı |

> ✅ **Seç: `index,follow`**

---

### Canonical URL
**Ne:** Sitenin ana adresi. Aynı içeriğin birden fazla URL'de açılmasını engeller.  
**Örnek:**
```
https://hotpulse.me
```
> ⚠️ `www` kullanıyorsan `https://www.hotpulse.me` yaz. Her zaman `https://` ile başlamalı.

---

### Sayfa Dili (hreflang)
**Ne:** Google'a sitenin hangi dilde olduğunu söyler.  
**Türkçe site için:**
```
tr
```

---

## 🌐 OPEN GRAPH SEKMESİ
*(Facebook, WhatsApp, Telegram, Discord — sosyal paylaşım önizlemesi)*

### OG Başlık
**Ne:** Sosyal medyada paylaşıldığında çıkan başlık.  
**Boş bırakırsan:** Site Başlığı otomatik kullanılır.  
**Örnek:**
```
Soci — 18+ Video Platform
```

---

### OG Açıklama
**Ne:** Sosyal paylaşım kartındaki açıklama metni.  
**Boş bırakırsan:** Site Açıklaması kullanılır.  
**Örnek:**
```
Türkiye'nin creator platformu. Video izle, yükle, canlı yayın yap.
```

---

### OG Görseli *(En Önemli Alan)*
**Ne:** WhatsApp, Facebook, Discord'da paylaşılınca çıkan büyük önizleme görseli.  
**Boyut:** **1200 × 630 piksel** (zorunlu)  
**Format:** JPG veya PNG  
**Nasıl:** Görseli bir CDN'e veya hosting'e yükle, URL'ini buraya yaz.

**Örnek:**
```
https://hotpulse.me/og-banner.jpg
```

> ✅ **Bu alanı doldurursan sitenin her sosyal paylaşımında profesyonel bir kart çıkar.**  
> Görselde site adı + slogan + görsel arka plan olsun.

---

### OG Türü
Seçenek: `website`  
> Video platform olsa da ana sayfa için `website` doğrudur. Video sayfaları zaten otomatik `video.other` alıyor.

---

## 🐦 TWITTER SEKMESİ

### Twitter Card
**Ne:** Twitter/X'te paylaşımda çıkan kart türü.  

| Seçenek | Görünüm |
|---|---|
| `summary_large_image` | ✅ Büyük görsel kartı — **bunu seç** |
| `summary` | Küçük kare görsel |

---

### Twitter Site
**Ne:** Sitenin Twitter/X kullanıcı adı.  
**Format:** `@` ile başlamalı  
**Örnek:**
```
@hotpulse_me
```
> Yoksa boş bırak.

---

### Twitter Creator
**Ne:** İçerik sahibinin Twitter kullanıcı adı (genellikle admin hesabı).  
**Örnek:**
```
@hotpulse_me
```

---

## 📊 ANALYTİCS SEKMESİ

### Google Analytics ID
**Ne:** Ziyaretçi sayısı, trafik kaynağı, hangi sayfaların izlendiğini görmeni sağlar.

**Nasıl alınır:**
1. [analytics.google.com](https://analytics.google.com) → Hesap oluştur
2. **Mülk oluştur** → Web → domain adını gir
3. **Ölçüm ID**'yi kopyala

**Format:** `G-XXXXXXXXXX`  
**Örnek:**
```
G-ABC123DEF4
```

---

### Google Search Console
**Ne:** Google'ın seni tanıması için doğrulama kodu. DNS ile doğruladıysan bu alanı boş bırakabilirsin.

**HTML meta tag yöntemi için:**
1. [search.google.com/search-console](https://search.google.com/search-console)
2. **URL Öneki** yöntemi → **HTML etiketi** seç
3. `content="..."` kısmındaki değeri kopyala

**Örnek:**
```
abc123xyz789
```
*(Sadece content değeri — tırnak işaretleri olmadan)*

---

### Bing Doğrulama *(Yeni Eklendi)*
**Ne:** Bing'in seni tanıması için doğrulama kodu.

**Nasıl alınır:**
1. [bing.com/webmasters](https://www.bing.com/webmasters) → Giriş yap
2. Siteyi ekle → **HTML Meta Tag** seç
3. `content="..."` kısmındaki değeri kopyala

**Örnek:**
```
1A2B3C4D5E6F7G8H9I0J
```

---

### Yandex Doğrulama *(Yeni Eklendi)*
**Ne:** Yandex'in seni tanıması için doğrulama kodu. Türk kullanıcılar Yandex de kullanıyor.

**Nasıl alınır:**
1. [webmaster.yandex.com](https://webmaster.yandex.com) → Giriş yap
2. Site ekle → **Meta Tag** seç
3. `content="..."` kısmındaki değeri kopyala

**Örnek:**
```
a1b2c3d4e5f6g7h8
```

---

## ⚙️ GELİŞMİŞ SEKMESİ

### Yapılandırılmış Veri (Structured Data)
**Ne:** Google'ın siteyi daha iyi anlaması için JSON-LD formatında ek bilgi.  
> ✅ **Açık bırak** — otomatik oluşturuluyor.

---

### Sitemap
**Ne:** Sitenin tüm sayfalarını Google'a bildiren XML dosyası.  
> ✅ **Açık bırak** — `https://hotpulse.me/sitemap.xml` adresi zaten çalışıyor.

---

### Schema.org Türü
**Ne:** Sitenin ne tür bir işletme olduğunu Google'a söyler.

| Seçenek | Ne Zaman |
|---|---|
| `Organization` | ✅ Genel platform — **bunu seç** |
| `WebSite` | Bilgi/blog siteleri |

---

## ✅ Doldurma Sırası (Öncelik)

```
1. Site Başlığı          ← Hemen doldur
2. Site Açıklaması       ← Hemen doldur  
3. Canonical URL         ← https://hotpulse.me
4. OG Görseli            ← 1200×630 px görsel yükle
5. Google Analytics ID   ← analytics.google.com'dan al
6. Bing Doğrulama        ← bing.com/webmasters'dan al
7. Yandex Doğrulama      ← webmaster.yandex.com'dan al
8. Robots                ← index,follow seç
9. Dil                   ← tr seç
```

---

## 🚀 Kaydettikten Sonra

Admin Paneli → SEO → Ayarları kaydet → ardından **Sitemap Ping** butonu varsa tıkla.  
Bu; Bing ve Yandex'e sitemap adresini otomatik bildirir.

Google için: **Search Console → Sitemaps → `sitemap.xml` → Gönder**
