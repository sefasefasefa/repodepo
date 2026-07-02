/**
 * Sayfa yükleme optimizasyonu:
 * 1. Önce Django'nun HTML'e gömdüğü __HP_INIT__ script tag'ini okur (0ms)
 * 2. Yoksa localStorage cache'ini kontrol eder (0ms)
 * 3. Hiçbiri yoksa /api/init fetch yapar (network round-trip)
 *
 * Anonim kullanıcılar için skeleton süresi sıfıra yaklaşır.
 */

export interface HomeData {
  trending: unknown[];
  newest: unknown[];
  most_viewed: unknown[];
  most_liked: unknown[];
  shorts: unknown[];
  premium: unknown[];
  categories: unknown[];
  creators: unknown[];
  home_filters: unknown[];
}

export interface InitData {
  siteConfig: {
    siteName: string;
    siteDescription: string;
    logoUrl: string | null;
    faviconUrl: string | null;
    primaryColor: string;
    registrationEnabled: boolean;
    maintenanceMode: boolean;
  };
  features: {
    flags: Record<string, string>;
    details: Array<{ key: string; state: string; label: string; description: string; group: string }>;
  };
  geo: {
    blocked: boolean;
    country: string | null;
    enabled: boolean;
    mode?: string;
    message?: string;
    redirectUrl?: string;
  } | null;
  homeData: HomeData | null;
  me: Record<string, unknown> | null;
}

const INIT_CACHE_KEY = "app_init_v4";
const INIT_CACHE_TTL = 2 * 60 * 1000;

// ── 1. DOM'daki gömülü veri (en hızlı — sıfır network) ───────────────────────
function readInlineInit(): InitData | null {
  try {
    const el = document.getElementById("__HP_INIT__");
    if (!el) return null;
    const data = JSON.parse(el.textContent || "");
    el.remove(); // DOM'dan temizle, hafızayı boşalt
    return data as InitData;
  } catch {
    return null;
  }
}

// ── 2. localStorage cache ────────────────────────────────────────────────────
function loadCache(): InitData | null {
  try {
    const raw = localStorage.getItem(INIT_CACHE_KEY);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts < INIT_CACHE_TTL) return data as InitData;
  } catch {}
  return null;
}

function saveCache(data: InitData) {
  try {
    // me verisini cache'leme (hassas + token'a bağlı)
    localStorage.setItem(INIT_CACHE_KEY, JSON.stringify({ data: { ...data, me: null }, ts: Date.now() }));
  } catch {}
}

// ── 3. Network fetch ─────────────────────────────────────────────────────────
function fetchInit(): Promise<InitData | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);

  const token = localStorage.getItem("token");
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  return fetch("/api/init", {
    credentials: "same-origin",
    signal: controller.signal,
    headers,
  })
    .then((r) => {
      clearTimeout(timeout);
      if (!r.ok) return null;
      return r.json() as Promise<InitData>;
    })
    .then((data) => {
      if (data) saveCache(data);
      return data;
    })
    .catch(() => {
      clearTimeout(timeout);
      return null;
    });
}

let _promise: Promise<InitData | null>;
// Senkron erişim için — modül yüklendiğinde hemen mevcut olan veri
let _syncData: InitData | null = null;

// Önce inline, sonra window.__HP_INIT_PROMISE__ (erken fetch), sonra cache, sonra fetch
const inline = readInlineInit();
if (inline) {
  _syncData = inline;
  _promise = Promise.resolve(inline);
  saveCache(inline);
  if (localStorage.getItem("token")) {
    fetchInit().then((fresh) => {
      if (fresh) { _syncData = fresh; _promise = Promise.resolve(fresh); }
    });
  }
} else {
  const cached = loadCache();
  if (cached) {
    // localStorage cache var — hemen kullan, arka planda tazele
    _syncData = cached;
    _promise = Promise.resolve(cached);
    // Erken fetch zaten başladıysa onu kullan, yoksa yeni fetch başlat
    const earlyP = (window as any).__HP_INIT_PROMISE__;
    (earlyP || fetchInit()).then((fresh: InitData | null) => {
      if (fresh) { _syncData = fresh; _promise = Promise.resolve(fresh); saveCache(fresh); }
    });
  } else {
    // Cache yok — erken fetch varsa onu bekle (duplicate istek olmaz)
    const earlyP = (window as any).__HP_INIT_PROMISE__;
    if (earlyP) {
      _promise = Promise.resolve(earlyP).then((data: InitData | null) => {
        if (data) { _syncData = data; saveCache(data); }
        return data;
      }).catch(() => fetchInit().then((f) => { if (f) _syncData = f; return f; }));
    } else {
      _promise = fetchInit().then((fresh) => {
        if (fresh) _syncData = fresh;
        return fresh;
      });
    }
  }
}

export function getInitData(): Promise<InitData | null> {
  return _promise;
}

/** Senkron — Promise döndürmez. Inline veya cache varsa anında döner, yoksa null. */
export function getInitDataSync(): InitData | null {
  return _syncData;
}

export function invalidateInitCache() {
  try { localStorage.removeItem(INIT_CACHE_KEY); } catch {}
  _promise = fetchInit();
}

export function getHomeDataFromInit(): Promise<HomeData | null> {
  return getInitData().then(d => d?.homeData ?? null);
}

export function getMeFromInit(): Promise<Record<string, unknown> | null> {
  return getInitData().then(d => d?.me ?? null);
}
