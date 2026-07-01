# Cloudflare Hızlandırma Rehberi — hotpulse.me

Bu ayarları Cloudflare Dashboard → hotpulse.me zone'una uygula.

---

## 1. Cache Rules (EN ÖNEMLİ)

**Caching → Cache Rules → Create Rule**

### Kural 1 — Statik dosyalar (JS, CSS, font)
| Alan | Değer |
|------|-------|
| Kural adı | `Static Assets` |
| Eşleşme koşulu | URI Path → starts with → `/assets/` |
| Cache status | **Cache everything** |
| Edge Cache TTL | **1 year** |
| Browser Cache TTL | **1 year** |

### Kural 2 — /static/ klasörü
| Alan | Değer |
|------|-------|
| Kural adı | `Static Folder` |
| Eşleşme koşulu | URI Path → starts with → `/static/` |
| Cache status | **Cache everything** |
| Edge Cache TTL | **1 year** |
| Browser Cache TTL | **1 year** |

### Kural 3 — API asla cache'lenmesin
| Alan | Değer |
|------|-------|
| Kural adı | `API No Cache` |
| Eşleşme koşulu | URI Path → starts with → `/api/` |
| Cache status | **Bypass** |

> Bu kurallar olmadan Cloudflare statik dosyaları sunucudan her seferinde çeker.
> Kurallar aktif olunca JS/CSS dosyaları Cloudflare'in Türkiye edge'inden gelir → ilk yükleme 2-5× hızlanır.

---

## 2. Speed Ayarları

**Speed → Optimization**

| Ayar | Değer | Açıklama |
|------|-------|----------|
| Auto Minify → JavaScript | ✅ Açık | JS dosyalarını küçültür |
| Auto Minify → CSS | ✅ Açık | CSS dosyalarını küçültür |
| Auto Minify → HTML | ✅ Açık | HTML boşluklarını siler |
| Brotli | ✅ Açık | Gzip'ten %20 daha iyi sıkıştırma |
| HTTP/2 | ✅ Açık | Paralel bağlantılar (varsayılan açık) |
| HTTP/3 (QUIC) | ✅ Açık | Mobil bağlantılar için UDP tabanlı, daha hızlı |
| 0-RTT Connection Resumption | ✅ Açık | Tekrar ziyaretlerde handshake süresi 0 |
| Early Hints | ✅ Açık | Tarayıcı JS/CSS'i önceden yükler |

---

## 3. Network Ayarları

**Network**

| Ayar | Değer |
|------|-------|
| HTTP/2 | ✅ Açık |
| HTTP/2 to Origin | ✅ Açık (eğer VDS'de HTTP/2 varsa) |
| WebSockets | ✅ Açık (canlı yayın/chat için) |
| gRPC | Kapalı bırak |
| Pseudo IPv4 | Açık bırak |

---

## 4. SSL/TLS Ayarları

**SSL/TLS → Overview**

Şu anki mod: **Flexible** (Cloudflare ↔ VDS arası HTTP)

Bu mod sorun çıkarmıyorsa değiştirme. İleride Full (Strict) moduna geçmek için VDS'e origin certificate kur.

---

## 5. Page Rules (Alternatif: eski yöntem)

Cache Rules kullanamıyorsan Page Rules ile aynı şeyi yapabilirsin:

```
URL: hotpulse.me/assets/*
Cache Level: Cache Everything
Edge Cache TTL: a year

URL: hotpulse.me/static/*
Cache Level: Cache Everything
Edge Cache TTL: a year

URL: hotpulse.me/api/*
Cache Level: Bypass
```

---

## 6. Kontrol

Ayarları uyguladıktan sonra tarayıcıdan:
```
F12 → Network → index.html isteği → Response Headers
```

Beklenen değerler:
- `CF-Cache-Status: HIT` → statik dosyalar Cloudflare'den geliyor ✅
- `CF-Cache-Status: MISS` → ilk kez yükleniyor, sonraki HIT olacak
- `CF-Cache-Status: BYPASS` → API istekleri (doğru davranış) ✅

---

## Özet: Beklenen İyileşme

| Metrik | Önce | Sonra |
|--------|------|-------|
| index.html TTFB | ~200-400ms (Waitress) | ~5-15ms (nginx) |
| JS/CSS yükleme | Sunucudan her seferinde | Cloudflare edge'den (Türkiye) |
| Mobil ilk yükleme | 3-6s | 0.8-1.5s |
| Tekrar ziyaret | ~1s | <200ms (tümü cache) |
