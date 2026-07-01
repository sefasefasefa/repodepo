/**
 * Hotpulse Service Worker v6
 *
 * Cache-First           : /assets/, /static/ — immutable hash'li dosyalar (0ms)
 * Cache-First (sınırlı) : /media/           — büyük dosyalar hariç
 * Stale-While-Revalidate: /api/init         — anında + arka planda yenile
 * Stale-While-Revalidate: HTML sayfaları    — anında (cache varsa) + arka planda yenile
 * Network-First         : diğer /api/       — her zaman taze
 *
 * v6 değişiklikleri:
 *   - Install: kritik asset'leri önceden önbelleğe al (pre-cache)
 *   - HTML: network-first → stale-while-revalidate (repeat ziyaret anında yüklenir)
 */

const CACHE_VER    = 'v6';
const STATIC_CACHE = `hp-static-${CACHE_VER}`;
const API_CACHE    = `hp-api-${CACHE_VER}`;
const INIT_TTL_MS  = 5 * 60 * 1000; // 5 dakika
const HTML_TTL_MS  = 10 * 60 * 1000; // 10 dakika

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

// ── Activate: eski cache'leri temizle ───────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k.startsWith('hp-') && k !== STATIC_CACHE && k !== API_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
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

  // HTML sayfaları: Stale-While-Revalidate
  // Cache varsa anında döner (0ms) + arka planda yeniler
  // → Repeat ziyarette mobilde de anında yüklenir
  event.respondWith(staleWhileRevalidateHtml(req));
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

// ── Stale-While-Revalidate: HTML sayfaları ──────────────────────────
// Cache varsa: anında döner + arka planda yeniler (mobilde kritik)
// Cache yoksa: ağı bekler, gelince cache'e yazar
async function staleWhileRevalidateHtml(request) {
  const cache  = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request) || await cache.match('/');

  const fetchAndCache = fetch(request).then(res => {
    if (res.ok) cache.put(request, res.clone());
    return res;
  }).catch(() => null);

  if (cached) {
    const cachedAt = parseInt(cached.headers.get('x-sw-cached-at') || '0');
    if (!cachedAt || Date.now() - cachedAt < HTML_TTL_MS) {
      fetchAndCache; // arka planda yenile, bekletme
      return cached;
    }
    // Süre dolmuş — ağı bekle ama hata olursa cache'i kullan
    const fresh = await fetchAndCache;
    return fresh || cached;
  }

  // İlk ziyaret: ağı bekle
  const fresh = await fetchAndCache;
  return fresh || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
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
    return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  }
}
