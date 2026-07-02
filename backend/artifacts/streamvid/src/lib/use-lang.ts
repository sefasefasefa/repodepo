/**
 * Minimal multi-language helper.
 * Detects browser language and falls back to TR.
 * Supported: tr, de, en (+ any others default to en)
 */

export type Lang = "tr" | "de" | "en";

let _cached: Lang | null = null;

export function detectLang(): Lang {
  if (_cached) return _cached;
  try {
    const raw = (navigator.language || navigator.languages?.[0] || "tr")
      .toLowerCase()
      .slice(0, 2);
    if (raw === "de") return (_cached = "de");
    if (raw === "tr") return (_cached = "tr");
    return (_cached = "en");
  } catch {
    return (_cached = "tr");
  }
}

/** Pick the value for the current browser language from a TR/DE/EN map. */
export function t(map: Record<Lang, string>): string {
  return map[detectLang()] ?? map["en"];
}
