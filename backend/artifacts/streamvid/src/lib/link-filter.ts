const URL_REGEX = /(?:https?:\/\/|www\.)[^\s<>'"(){}|\\^[\]`\x00-\x20\x7f]+/gi;

export function containsLink(text: string): boolean {
  return URL_REGEX.test(text);
}

export function maskLinks(text: string): string {
  return text.replace(URL_REGEX, "[🔗 link gizlendi — admin onayı bekleniyor]");
}

export interface PendingLink {
  id: string;
  originalText: string;
  url: string;
  sender: string;
  context: "chat" | "match" | "comment" | "story";
  roomId?: string;
  timestamp: number;
  status: "pending" | "approved" | "rejected";
}

const STORAGE_KEY = "prnhbbbb_pending_links";

export function logPendingLink(
  url: string,
  originalText: string,
  sender: string,
  context: PendingLink["context"],
  roomId?: string
): string {
  const id = `link_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const entry: PendingLink = {
    id,
    originalText,
    url,
    sender,
    context,
    roomId,
    timestamp: Date.now(),
    status: "pending",
  };
  try {
    const existing = getPendingLinks();
    existing.push(entry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing.slice(-500)));
  } catch {}
  return id;
}

export function getPendingLinks(): PendingLink[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function updateLinkStatus(id: string, status: "approved" | "rejected") {
  try {
    const links = getPendingLinks().map(l => l.id === id ? { ...l, status } : l);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(links));
  } catch {}
}

export function extractUrls(text: string): string[] {
  return Array.from(text.matchAll(URL_REGEX)).map(m => m[0]);
}

export function processMessage(
  text: string,
  sender: string,
  context: PendingLink["context"],
  roomId?: string
): { filtered: string; hadLinks: boolean } {
  const hadLinks = containsLink(text);
  if (!hadLinks) return { filtered: text, hadLinks: false };
  const urls = extractUrls(text);
  urls.forEach(url => logPendingLink(url, text, sender, context, roomId));
  return { filtered: maskLinks(text), hadLinks: true };
}
