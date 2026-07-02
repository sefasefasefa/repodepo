/**
 * perf-utils.ts — Mobile & visibility-aware performance helpers
 */

/** True on touch-primary devices (phones, tablets) */
export const isMobile = (): boolean =>
  typeof navigator !== "undefined" &&
  (navigator.maxTouchPoints > 0 || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) &&
  typeof window !== "undefined" &&
  window.innerWidth < 1024;

/**
 * Returns the right interval ms:
 *   desktop → desktopMs
 *   mobile  → mobileMs (defaults to 3× desktop)
 */
export const adaptiveInterval = (desktopMs: number, mobileMs?: number): number =>
  isMobile() ? (mobileMs ?? desktopMs * 3) : desktopMs;

/**
 * Like setInterval but automatically pauses while the document is hidden
 * (user switched tabs / app in background on mobile).
 * Returns a cleanup function.
 */
export function visibilityInterval(fn: () => void, ms: number): () => void {
  let id: ReturnType<typeof setInterval> | null = null;

  const start = () => {
    if (id !== null) return;
    id = setInterval(fn, ms);
  };
  const pause = () => {
    if (id === null) return;
    clearInterval(id);
    id = null;
  };

  const onVisibility = () => (document.hidden ? pause() : start());

  start();
  document.addEventListener("visibilitychange", onVisibility);

  return () => {
    pause();
    document.removeEventListener("visibilitychange", onVisibility);
  };
}
