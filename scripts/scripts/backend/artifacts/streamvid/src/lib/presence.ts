export type PresenceStatus = "online" | "away" | "offline";

const KEY = "prnhbbbb_presence";

export function setPresence(status: PresenceStatus) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify({ status, at: Date.now() }));
}

export function getPresence(): PresenceStatus {
  if (typeof window === "undefined") return "offline";
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return navigator.onLine ? "online" : "offline";
    const parsed = JSON.parse(raw) as { status?: PresenceStatus; at?: number };
    if (parsed.status === "online" || parsed.status === "away" || parsed.status === "offline") return parsed.status;
  } catch {}
  return navigator.onLine ? "online" : "offline";
}
