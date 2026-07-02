const STORAGE_PREFIX = "prnhbbbb_watch_progress:";
const HISTORY_PREFIX = "prnhbbbb_watch_history:";
const EXPIRY_DAYS = 180;
const BACKEND_SYNC_INTERVAL = 30_000; // 30 saniyede bir backend'e kaydet

function key(videoId: number) {
  return `${STORAGE_PREFIX}${videoId}`;
}

function historyKey(videoId: number) {
  return `${HISTORY_PREFIX}${videoId}`;
}

// Backend sync — son gönderim zamanlarını tutar
const lastSyncAt: Record<number, number> = {};

function getToken(): string | null {
  try { return localStorage.getItem("token"); } catch { return null; }
}

function syncToBackend(videoId: number, currentTime: number, duration: number, force = false) {
  if (typeof window === "undefined" || !videoId || !duration || duration <= 0) return;
  const now = Date.now();
  if (!force && lastSyncAt[videoId] && now - lastSyncAt[videoId] < BACKEND_SYNC_INTERVAL) return;
  lastSyncAt[videoId] = now;

  const completionRate = Math.min(100, Math.round((currentTime / duration) * 100));
  const token = getToken();
  if (!token) return; // Giriş yapılmamışsa backend'e gönderme

  const headers: Record<string, string> = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
  fetch(`/api/videos/${videoId}/view`, {
    method: "POST",
    headers,
    body: JSON.stringify({ watchTime: Math.round(currentTime), completionRate }),
    keepalive: true,
  }).catch(() => {/* sessizce yoksay */});
}

export function saveWatchProgress(videoId: number, currentTime: number, duration: number) {
  if (typeof window === "undefined" || !videoId || !duration || Number.isNaN(currentTime)) return;
  const payload = {
    currentTime,
    duration,
    updatedAt: Date.now(),
    expiresAt: Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  };
  localStorage.setItem(key(videoId), JSON.stringify(payload));

  // Backend'e periyodik kayıt
  syncToBackend(videoId, currentTime, duration);
}

export function loadWatchProgress(videoId: number) {
  if (typeof window === "undefined" || !videoId) return null;
  const raw = localStorage.getItem(key(videoId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { currentTime: number; duration: number; updatedAt: number; expiresAt: number };
    if (parsed.expiresAt && parsed.expiresAt < Date.now()) {
      localStorage.removeItem(key(videoId));
      return null;
    }
    return parsed;
  } catch {
    localStorage.removeItem(key(videoId));
    return null;
  }
}

export function clearWatchProgress(videoId: number) {
  if (typeof window === "undefined" || !videoId) return;
  localStorage.removeItem(key(videoId));
}

// Video bittiğinde çağır — completion_rate=100 olarak kaydeder
export function markVideoFinished(videoId: number, duration: number) {
  clearWatchProgress(videoId);
  syncToBackend(videoId, duration, duration, true);
}

export function touchWatchHistory(videoId: number, title: string, thumbnailUrl?: string | null, creatorName?: string | null) {
  if (typeof window === "undefined" || !videoId) return;
  localStorage.setItem(historyKey(videoId), JSON.stringify({
    videoId,
    title,
    thumbnailUrl: thumbnailUrl || null,
    creatorName: creatorName || null,
    lastViewedAt: Date.now(),
  }));
}

export function getLocalWatchHistory() {
  if (typeof window === "undefined") return [] as Array<{ videoId: number; title: string; thumbnailUrl: string | null; creatorName: string | null; lastViewedAt: number }>;
  return Object.keys(localStorage)
    .filter((k) => k.startsWith(HISTORY_PREFIX))
    .map((k) => {
      try {
        return JSON.parse(localStorage.getItem(k) || "null");
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.lastViewedAt - a.lastViewedAt);
}
