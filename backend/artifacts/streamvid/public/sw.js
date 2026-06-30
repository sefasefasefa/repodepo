/**
 * Soci Service Worker
 * - Hash'li /assets/ dosyaları: cache-first (immutable, sonsuza kadar geçerli)
 * - HTML: network-first, fallback cache
 * - API: SW'ye düşmez (fetch listener'da atlanır)
 * - İlk yüklemede kritik chunk'ları arka planda önceden indirir
 */

const CACHE_NAME = "soci-static-v1";
const MAX_CACHE_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 gün

// Hash içeren asset URL'leri — içerikleri hiç değişmez
const IMMUTABLE_RE = /\/assets\/[^/]+\.(js|css|woff2?)$/;

// İlk kurulumda önceden indirilecek kritik dosyalar
const PRECACHE_URLS = [
  "/",
];

// ─── Install ──────────────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Ana sayfayı al, içindeki <script> ve <link> etiketlerinden asset URL'lerini çek
      try {
        const resp = await fetch("/", { credentials: "same-origin" });
        if (!resp.ok) return;
        await cache.put("/", resp.clone());

        const html = await resp.text();
        const assetUrls = [];

        // modulepreload ve stylesheet linkleri
        const linkRe = /href="(\/assets\/[^"]+)"/g;
        let m;
        while ((m = linkRe.exec(html)) !== null) assetUrls.push(m[1]);

        // script src
        const scriptRe = /src="(\/assets\/[^"]+)"/g;
        while ((m = scriptRe.exec(html)) !== null) assetUrls.push(m[1]);

        // Hepsini arka planda paralel indir
        await Promise.allSettled(
          assetUrls.map((url) =>
            fetch(url, { credentials: "same-origin" }).then((r) => {
              if (r.ok) cache.put(url, r);
            })
          )
        );
      } catch (_) {}
    })
  );
  // Eski SW'yi bekletme — hemen devral
  self.skipWaiting();
});

// ─── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ─── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Sadece kendi origin'imizden GET isteklerini işle
  if (req.method !== "GET" || url.origin !== self.location.origin) return;

  // API isteklerine dokunma — her zaman taze veri gelsin
  if (url.pathname.startsWith("/api/")) return;

  // media (video/fotoğraf) dosyaları — SW'ye yük bindirme
  if (url.pathname.startsWith("/media/")) return;

  // ── Hash'li immutable asset'ler: cache-first ──────────────────────────────
  if (IMMUTABLE_RE.test(url.pathname)) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(req).then((cached) => {
          if (cached) return cached;
          return fetch(req).then((resp) => {
            if (resp.ok) cache.put(req, resp.clone());
            return resp;
          });
        })
      )
    );
    return;
  }

  // ── Diğer statik dosyalar (favicon, opengraph vb.): stale-while-revalidate
  if (url.pathname.match(/\.(svg|png|jpg|webp|ico|woff2?)$/)) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(req).then((cached) => {
          const networkFetch = fetch(req).then((resp) => {
            if (resp.ok) cache.put(req, resp.clone());
            return resp;
          }).catch(() => cached);
          return cached || networkFetch;
        })
      )
    );
    return;
  }

  // ── HTML (SPA rotaları): network-first, cache fallback ───────────────────
  if (req.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(req)
        .then((resp) => {
          if (resp.ok) {
            caches.open(CACHE_NAME).then((c) => c.put(req, resp.clone()));
          }
          return resp;
        })
        .catch(() =>
          caches.match(req).then((c) => c || caches.match("/"))
        )
    );
    return;
  }
});

// ─── Periyodik cache temizliği (30 günden eski girişler) ──────────────────────
self.addEventListener("message", (event) => {
  if (event.data === "CLEAN_OLD_CACHE") {
    caches.open(CACHE_NAME).then(async (cache) => {
      const keys = await cache.keys();
      const now = Date.now();
      for (const req of keys) {
        const resp = await cache.match(req);
        if (!resp) continue;
        const dateHeader = resp.headers.get("date");
        if (!dateHeader) continue;
        if (now - new Date(dateHeader).getTime() > MAX_CACHE_AGE_MS) {
          cache.delete(req);
        }
      }
    });
  }
});
