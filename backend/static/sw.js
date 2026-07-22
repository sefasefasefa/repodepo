/**
 * Hotpulse Service Worker v11
 *
 * Cache-First           : /assets/, /static/ — immutable hash'li dosyalar (0ms)
 * Cache-First (sınırlı) : /media/           — büyük dosyalar hariç
 * Stale-While-Revalidate: /api/init         — anında + arka planda yenile
 * Network-First         : HTML sayfaları    — her zaman taze; offline'da cache
 * Network-First         : diğer /api/       — her zaman taze
 *
 * v11 değişiklikleri:
 *   - Cache temizleme: period tab basitleştirme + admin dashboard/health tab birleştirme
 */

const CACHE_VER    = 'v11';
const STATIC_CACHE = `hp-static-${CACHE_VER}`;
const API_CACHE    = `hp-api-${CACHE_VER}`;
const INIT_TTL_MS  = 5 * 60 * 1000; // 5 dakika

// ── Install: kritik asset'leri önceden önbelleğe al ─────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    (async () => {
      try {
        const res = await fetch('/');
        if (res.ok) {
          const html = await res.text();
          const urls = ['/'];

          // HTML içindeki tüm /assets/ URL'lerini çıkar
          const srcPattern = /src="(\/assets\/[^"]+\.js)"/g;
          const hrefPattern = /href="(\/assets\/[^"]+)"/g;
          let m;
          while ((m = srcPattern.exec(html)) !== null) {
            if (!urls.includes(m[1])) urls.push(m[1]);
          }
          while ((m = hrefPattern.exec(html)) !== null) {
            if (!urls.includes(m[1])) urls.push(m[1]);
          }

          const cache = await caches.open(STATIC_CACHE);
          // Hata tolere et: bir URL başarısız olsa bile devam et
          await Promise.allSettled(urls.map(url =>
            fetch(url).then(r => { if (r.ok) cache.put(url, r); }).catch(() => {})
          ));
        }
      } catch (e) {}
      self.skipWaiting();
    })()
  );
});

// ── Activate: eski cache'leri temizle + tüm sekmeleri yenile ────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(k => k.startsWith('hp-') && k !== STATIC_CACHE && k !== API_CACHE)
            .map(k => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
      .then(() =>
        // Yeni SW devreye girince tüm açık sekmeleri yenile (taze içerik)
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
          clients.forEach(client => client.navigate(client.url));
        })
      )
  );
});

// ── Fetch ────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  if (url.origin !== self.location.origin) return;

  const p = url.pathname;

  if (p === '/sw.js') return;

  if (p.startsWith('/django-admin') || p.startsWith('/admin')) return;

  // /api/init → Stale-While-Revalidate (anında + arka planda yenile)
  if (p === '/api/init') {
    event.respondWith(staleWhileRevalidateInit(req));
    return;
  }

  // Diğer API → her zaman network
  if (p.startsWith('/api/')) return;

  // Medya dosyaları: Cache-First (50MB sınırı)
  if (p.startsWith('/media/')) {
    event.respondWith(cacheFirst(req, true));
    return;
  }

  // Hashed static varlıklar: Cache-First + sonsuz TTL
  if (p.startsWith('/assets/') || p.startsWith('/static/')) {
    event.respondWith(cacheFirst(req, false));
    return;
  }

  // HTML sayfaları: Network-First
  // Her zaman ağdan çeker; offline'da cache'e düşer
  event.respondWith(networkFirstHtml(req));
});

// ── Stale-While-Revalidate: /api/init ───────────────────────────────
async function staleWhileRevalidateInit(request) {
  const cache  = await caches.open(API_CACHE);
  const cached = await cache.match(request);

  const fetchAndCache = fetch(request.clone()).then(async res => {
    if (res.ok) {
      const cloned = res.clone();
      const headers = new Headers(cloned.headers);
      headers.set('x-sw-cached-at', Date.now().toString());
      const bodyText = await cloned.text();
      const newRes = new Response(bodyText, {
        status: cloned.status,
        statusText: cloned.statusText,
        headers,
      });
      cache.put(request, newRes);
    }
    return res;
  }).catch(() => null);

  if (cached) {
    const cachedAt = parseInt(cached.headers.get('x-sw-cached-at') || '0');
    if (Date.now() - cachedAt < INIT_TTL_MS) {
      fetchAndCache; // arka planda yenile
      return cached;
    }
    const fresh = await fetchAndCache;
    return fresh || cached;
  }

  const fresh = await fetchAndCache;
  return fresh || new Response('{}', { status: 503 });
}

// ── Network-First: HTML sayfaları ───────────────────────────────────
// Her zaman ağdan çeker → deployment sonrası anında güncel sayfa
// Ağ başarısız olursa cache'e düşer; o da yoksa offline sayfası gösterir
async function networkFirstHtml(request) {
  const cache = await caches.open(STATIC_CACHE);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    const cached = await cache.match(request) || await cache.match('/');
    return cached || offlinePage();
  }
}

// ── Cache-First ──────────────────────────────────────────────────────
async function cacheFirst(request, limitLargeFiles) {
  const cache  = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      if (!limitLargeFiles) {
        cache.put(request, response.clone());
      } else {
        const cl = response.headers.get('content-length');
        if (!cl || parseInt(cl) < 50 * 1024 * 1024) {
          cache.put(request, response.clone());
        }
      }
    }
    return response;
  } catch {
    return offlinePage();
  }
}

// ── Offline fallback sayfası ─────────────────────────────────────────
function offlinePage() {
  const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Bağlantı Yok — Hotpulse</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#0a0a0a;color:#fff;font-family:system-ui,sans-serif;
         display:flex;align-items:center;justify-content:center;
         min-height:100vh;padding:20px;text-align:center}
    .icon{font-size:56px;margin-bottom:20px}
    h1{font-size:22px;font-weight:700;margin-bottom:10px}
    p{color:#888;font-size:14px;line-height:1.6;max-width:300px}
    button{margin-top:24px;background:#7c3aed;color:#fff;border:none;
           padding:12px 28px;border-radius:8px;font-size:15px;cursor:pointer}
    button:hover{background:#6d28d9}
  </style>
</head>
<body>
  <div>
    <div class="icon">📡</div>
    <h1>Sunucuya ulaşılamıyor</h1>
    <p>İnternet bağlantını kontrol et veya birkaç saniye sonra tekrar dene.</p>
    <button onclick="location.reload()">Tekrar Dene</button>
  </div>
</body>
</html>`;
  return new Response(html, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
