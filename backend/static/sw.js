/**
 * Hotpulse Service Worker v5
 *
 * Cache-First  : /assets/, /static/, /media/ — immutable (0ms)
 * Stale-While-Revalidate: /api/init          — anında + arka planda yenile
 * Network-First: diğer HTML                  — taze, offline fallback
 */

const CACHE_VER    = 'v5';
const STATIC_CACHE = `hp-static-${CACHE_VER}`;
const API_CACHE    = `hp-api-${CACHE_VER}`;
const INIT_TTL_MS  = 5 * 60 * 1000; // 5 dakika

// ── Install: hemen etkinleş ──────────────────────────────────────────
self.addEventListener('install', () => self.skipWaiting());

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

  // Medya dosyaları: Cache-First
  if (p.startsWith('/media/')) {
    event.respondWith(cacheFirst(req, true));
    return;
  }

  // Hashed static varlıklar: Cache-First + sonsuz TTL
  if (p.startsWith('/assets/') || p.startsWith('/static/')) {
    event.respondWith(cacheFirst(req, false));
    return;
  }

  // HTML sayfaları: Network-First, offline fallback
  event.respondWith(networkFirstHtml(req));
});

// ── Stale-While-Revalidate: /api/init ───────────────────────────────
// Önce cache'den döner (0ms), arka planda network'ten günceller
async function staleWhileRevalidateInit(request) {
  const cache  = await caches.open(API_CACHE);
  const cached = await cache.match(request);

  const fetchAndCache = fetch(request.clone()).then(async res => {
    if (res.ok) {
      const cloned = res.clone();
      const headers = new Headers(cloned.headers);
      // TTL bilgisini custom header ile sakla
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
    // TTL kontrolü: süresi dolmuşsa arka planda yenile ama hemen cache'i dön
    const cachedAt = parseInt(cached.headers.get('x-sw-cached-at') || '0');
    if (Date.now() - cachedAt < INIT_TTL_MS) {
      // Taze — hemen dön, arka planda yenile
      fetchAndCache;
      return cached;
    }
    // Süresi dolmuş — network'i bekle ama hata olursa cache'i kullan
    const fresh = await fetchAndCache;
    return fresh || cached;
  }

  // Cache yok — network'ten al
  const fresh = await fetchAndCache;
  return fresh || new Response('{}', { status: 503 });
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

// ── Network-First (HTML) ─────────────────────────────────────────────
async function networkFirstHtml(request) {
  const cache = await caches.open(STATIC_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request) || await cache.match('/');
    if (cached) return cached;
    return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  }
}
