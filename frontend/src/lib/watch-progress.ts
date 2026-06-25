const STORAGE_PREFIX = "prnhbbbb_watch_progress:";
const HISTORY_PREFIX = "prnhbbbb_watch_history:";
const EXPIRY_DAYS = 180;

function key(videoId: number) {
  return `${STORAGE_PREFIX}${videoId}`;
}

function historyKey(videoId: number) {
  return `${HISTORY_PREFIX}${videoId}`;
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
