/**
 * React mount olmadan önce /api/init'i tek seferde çeker.
 * Provider'lar bu promise'i bekleyerek ayrı ayrı fetch yapmaktan kurtulur.
 * homeData anonim kullanıcılar için /api/home verisini de içerir.
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
}

const INIT_CACHE_KEY = "app_init_v2";
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
  return fetch("/api/init", { credentials: "same-origin" })
    .then((r) => {
      if (!r.ok) return null;
      return r.json() as Promise<InitData>;
    })
    .then((data) => {
      if (data) saveInitCache(data);
      return data;
    })
    .catch(() => null);
}

const cached = loadInitCache();
if (cached) {
  _promise = Promise.resolve(cached);
  startPrefetch();
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
