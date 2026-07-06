/**
 * Route prefetch map — call preload(path) on link hover to warm the JS chunk
 * before the user clicks. React.lazy caches the promise so there's no duplicate
 * network request.
 */

const routeMap: Record<string, () => Promise<unknown>> = {
  "/":                  () => import("@/pages/home"),
  "/videos":            () => import("@/pages/videos"),
  "/shorts":            () => import("@/pages/shorts"),
  "/search":            () => import("@/pages/search"),
  "/categories":        () => import("@/pages/categories"),
  "/creators":          () => import("@/pages/creators"),         // listing page
  "/creators/:id":      () => import("@/pages/creator-profile"),  // detail page
  "/categories/:id":    () => import("@/pages/category-detail"),
  "/videos/:id":        () => import("@/pages/video-watch"),
  "/profile/:username": () => import("@/pages/public-profile"),
  "/playlists/:id":     () => import("@/pages/playlist-detail"),
  "/messages/:convId":  () => import("@/pages/messages"),
  "/live/:id":          () => import("@/pages/live-watch"),
  "/login":             () => import("@/pages/login"),
  "/register":          () => import("@/pages/register"),
  "/profile":           () => import("@/pages/profile"),
  "/notifications":     () => import("@/pages/notifications"),
  "/playlists":         () => import("@/pages/playlists"),
  "/history":           () => import("@/pages/history"),
  "/bookmarks":         () => import("@/pages/bookmarks"),
  "/subscriptions":     () => import("@/pages/subscriptions"),
  "/pricing":           () => import("@/pages/pricing"),
  "/creator/dashboard": () => import("@/pages/creator-dashboard"),
  "/upload":            () => import("@/pages/upload"),
  "/messages":          () => import("@/pages/messages"),
  "/live":              () => import("@/pages/live-streams"),
  "/leaderboard":       () => import("@/pages/leaderboard"),
  "/match":             () => import("@/pages/match-rooms"),
  "/stories":           () => import("@/pages/stories"),
  "/affiliate":         () => import("@/pages/affiliate"),
  "/downloads":         () => import("@/pages/downloads"),
};

// Param-route patterns: map a regex to a routeMap key
const paramPatterns: Array<[RegExp, string]> = [
  [/^\/creators\/[^/]+$/, "/creators/:id"],
  [/^\/categories\/[^/]+$/, "/categories/:id"],
  [/^\/videos\/[^/]+$/, "/videos/:id"],
  [/^\/profile\/[^/]+$/, "/profile/:username"],
  [/^\/playlists\/[^/]+$/, "/playlists/:id"],
  [/^\/messages\/[^/]+$/, "/messages/:convId"],
  [/^\/live\/[^/]+$/, "/live/:id"],
];

/** Warm the JS chunk for a given path. Safe to call multiple times — cached. */
export function preloadRoute(href: string) {
  // strip query string / hash to match the map
  const path = href.split("?")[0].split("#")[0];
  // try exact match first
  const exact = routeMap[path];
  if (exact) { exact().catch(() => {}); return; }
  // fall back to param-route patterns
  for (const [re, key] of paramPatterns) {
    if (re.test(path)) { routeMap[key]?.().catch(() => {}); return; }
  }
}

/** Eagerly preload the most-visited routes during browser idle time. */
export function preloadCommonRoutes() {
  const common = ["/", "/videos", "/shorts", "/search", "/creators", "/categories"];
  const schedule = (list: string[], idx = 0) => {
    if (idx >= list.length) return;
    const fn = typeof requestIdleCallback !== "undefined"
      ? (cb: () => void) => requestIdleCallback(cb, { timeout: 2000 })
      : (cb: () => void) => setTimeout(cb, 800 + idx * 400);
    fn(() => {
      preloadRoute(list[idx]);
      schedule(list, idx + 1);
    });
  };
  schedule(common);
}
