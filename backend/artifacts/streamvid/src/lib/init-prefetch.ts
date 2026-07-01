/**
 * React mount olmadan önce /api/init'i tek seferde çeker.
 * Token varsa Authorization header'ı ile gönderir → backend me verisini de döner.
 * Bu sayede frontend ayrıca /api/me çağırmak zorunda kalmaz.
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
  };
  homeData: HomeData | null;
  me: Record<string, unknown> | null;
}

const INIT_CACHE_KEY = "app_init_v4";
const INIT_CACHE_TTL = 2 * 60 * 1000;

function loadInitCache(): InitData | null {
  try {
    const raw = localStorage.getItem(INIT_CACHE_KEY);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts < INIT_CACHE_TTL) return data as InitData;
  } catch {}
  return null;
}

function saveInitCache(data: InitData) {
  try {
    localStorage.setItem(INIT_CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
  } catch {}
}

let _promise: Promise<InitData | null> | null = null;

function startPrefetch(): Promise<InitData | null> {
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
      if (data) {
        // Token varsa me verisini localStorage'a yazma — hassas veri
        // Sadece bellekte tutar, auth.tsx bunu okur
        saveInitCache({ ...data, me: null }); // me'yi cache'leme
      }
      return data;
    })
    .catch(() => {
      clearTimeout(timeout);
      return null;
    });
}

const cached = loadInitCache();
if (cached) {
  _promise = Promise.resolve(cached);
  startPrefetch(); // Arka planda tazele
} else {
  _promise = startPrefetch();
}

export function getInitData(): Promise<InitData | null> {
  return _promise!;
}

export function invalidateInitCache() {
  try { localStorage.removeItem(INIT_CACHE_KEY); } catch {}
  _promise = startPrefetch();
}

export function getHomeDataFromInit(): Promise<HomeData | null> {
  return getInitData().then(d => d?.homeData ?? null);
}

export function getMeFromInit(): Promise<Record<string, unknown> | null> {
  return getInitData().then(d => d?.me ?? null);
}
