import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "prnhbbbb_screen_protection_enabled";

export function isScreenProtectionEnabled(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) === "true"; } catch { return false; }
}

export function setScreenProtectionEnabled(v: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(v));
    window.dispatchEvent(new CustomEvent("screen-protection-change", { detail: v }));
  } catch {}
}

// getDisplayMedia API'sini kapat (tab/ekran kaydı)
// Prototype override kullanılır — Object.defineProperty modern Chrome'da sessizce başarısız olur
let _displayMediaPatched = false;
function patchGetDisplayMedia() {
  if (_displayMediaPatched) return;
  try {
    // Önce MediaDevices.prototype override (en güvenilir yol)
    if (typeof MediaDevices !== "undefined" && typeof MediaDevices.prototype.getDisplayMedia === "function") {
      MediaDevices.prototype.getDisplayMedia = async function () {
        throw new DOMException("Ekran kaydı bu platformda engellenmiştir.", "NotAllowedError");
      };
      _displayMediaPatched = true;
      return;
    }
  } catch {}
  try {
    // Fallback: instance override
    if (navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === "function") {
      (navigator.mediaDevices as any).getDisplayMedia = async () => {
        throw new DOMException("Ekran kaydı bu platformda engellenmiştir.", "NotAllowedError");
      };
      _displayMediaPatched = true;
    }
  } catch {}
}

function unpatchGetDisplayMedia() {
  // Prototype'ı restore etmek güvenilir değil; sayfa reload gerekir.
  // Bunun yerine flag kontrolü ile tüm çağrıları yönetiriz.
}

// Engellenen klavye kombinasyonları
const BLOCKED_COMBOS = (e: KeyboardEvent): boolean => {
  const k = e.key;
  const ctrl = e.ctrlKey || e.metaKey;
  const shift = e.shiftKey;
  if (k === "PrintScreen") return true;
  if (k === "F12") return true;
  if (ctrl && shift && k === "I") return true;
  if (ctrl && shift && k === "C") return true;
  if (ctrl && shift && k === "J") return true;
  if (ctrl && k === "u") return true;
  if (ctrl && k === "s") return true;
  if (ctrl && k === "p") return true;
  if (ctrl && shift && k === "S") return true;
  return false;
};

export function useScreenProtection(enabled: boolean) {
  const patched = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    if (!patched.current) {
      patchGetDisplayMedia();
      patched.current = true;
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (BLOCKED_COMBOS(e)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const onContextMenu = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("[data-protect]")) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const onDragStart = (e: DragEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("[data-protect]")) e.preventDefault();
    };

    // Copy/cut engeli
    const onCopy = (e: ClipboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("[data-protect]")) e.preventDefault();
    };

    // Ekran paylaşımı başlatılınca sekme gizlenebilir → video durdur
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        document.querySelectorAll<HTMLVideoElement>("video[data-protected]").forEach(v => {
          if (!v.paused) {
            v.dataset.wasPlaying = "true";
            v.pause();
          }
        });
      } else {
        document.querySelectorAll<HTMLVideoElement>("video[data-protected]").forEach(v => {
          if (v.dataset.wasPlaying === "true") {
            delete v.dataset.wasPlaying;
            v.play().catch(() => {});
          }
        });
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("contextmenu", onContextMenu, true);
    document.addEventListener("dragstart", onDragStart, true);
    document.addEventListener("copy", onCopy, true);
    document.addEventListener("cut", onCopy, true);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("contextmenu", onContextMenu, true);
      document.removeEventListener("dragstart", onDragStart, true);
      document.removeEventListener("copy", onCopy, true);
      document.removeEventListener("cut", onCopy, true);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [enabled]);
}

/**
 * Ayar değişikliklerini gerçek zamanlı izleyen hook.
 * localStorage'ı bir kez okur, sonra 'screen-protection-change' eventini dinler.
 */
export function useScreenProtectionState(): boolean {
  const [enabled, setEnabled] = useState(isScreenProtectionEnabled);
  useEffect(() => {
    const handler = (e: Event) => setEnabled((e as CustomEvent).detail as boolean);
    window.addEventListener("screen-protection-change", handler);
    return () => window.removeEventListener("screen-protection-change", handler);
  }, []);
  return enabled;
}
