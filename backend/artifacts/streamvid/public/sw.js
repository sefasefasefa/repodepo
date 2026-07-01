/**
 * Hotpulse Service Worker
 *
 * Cache-First : /assets/, /static/, /media/  → disk'ten (0ms, immutable)
 * Network-First: HTML sayfaları              → taze, offline fallback
 * API (/api/)  : doğrudan network, CACHE YAPILMAZ
 *   — tüm API yanıtları Cache-Control: private, no-store içerir;
 *     bu başlığa saygı göstererek özel/oturum verisi asla önbelleklenmez.
 */

const CACHE_VER   = 'v4';
const STATIC_CACHE = `hp-static-${CACHE_VER}`;

// ── Install: hemen etkinleş ──────────────────────────────────────────
self.addEventListener('install', () => self.skipWaiting());

// ── Activate: eski cache'leri temizle ───────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k.startsWith('hp-') && k !== STATIC_CACHE)
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

  // Farklı origin (Google Analytics vb.) — atla
  if (url.origin !== self.location.origin) return;

  const p = url.pathname;

  // SW'nin kendisi — asla önbellekleme
  if (p === '/sw.js') return;

  // Admin + Django admin — her zaman network
  if (p.startsWith('/django-admin') || p.startsWith('/admin')) return;

  // ── API: CACHE YAPILMAZ ──────────────────────────────────────────
  // Tüm /api/ yanıtları "Cache-Control: private, no-store" içerir.
  // Oturum/kimlik verisinin shared cihazlarda sızmaması için geçiyoruz.
  if (p.startsWith('/api/')) return;

  // ── Medya dosyaları: Cache-First (büyük, nadiren değişir) ──────────
  if (p.startsWith('/media/')) {
    event.respondWith(cacheFirst(req, true));
    return;
  }

  // ── Hashed static varlıklar: Cache-First + sonsuz TTL ─────────────
  // Vite, değişen her dosyaya yeni hash verir → sürüm çakışması yok.
  if (p.startsWith('/assets/') || p.startsWith('/static/')) {
    event.respondWith(cacheFirst(req, false));
    return;
  }

  // ── HTML sayfaları: Network-First, offline varsa cache ─────────────
  event.respondWith(networkFirstHtml(req));
});

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
        // Medya: 50 MB üstünü cache'leme
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

// ── Network-First (HTML) ─────────────────────────────────────────────
async function networkFirstHtml(request) {
  const cache = await caches.open(STATIC_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request) || await cache.match('/');
    if (cached) return cached;
    return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  }
}
