import { useEffect, useRef } from "react";

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
function patchGetDisplayMedia() {
  try {
    if (!navigator.mediaDevices?.getDisplayMedia) return;
    Object.defineProperty(navigator.mediaDevices, "getDisplayMedia", {
      value: async () => {
        throw new DOMException("Ekran kaydı bu platformda engellenmiştir.", "NotAllowedError");
      },
      writable: false,
      configurable: false,
    });
  } catch {}
}

// Engellenen klavye kombinasyonları
const BLOCKED_COMBOS = (e: KeyboardEvent): boolean => {
  const k = e.key;
  const ctrl = e.ctrlKey || e.metaKey;
  const shift = e.shiftKey;
  if (k === "PrintScreen") return true;
  if (k === "F12") return true;
  if (ctrl && shift && k === "I") return true;   // DevTools
  if (ctrl && shift && k === "C") return true;   // DevTools inspector
  if (ctrl && shift && k === "J") return true;   // Console
  if (ctrl && k === "u") return true;            // View source
  if (ctrl && k === "s") return true;            // Save
  if (ctrl && k === "p") return true;            // Print
  if (ctrl && shift && k === "S") return true;   // Screenshot (some OS)
  return false;
};

export function useScreenProtection(enabled: boolean) {
  const patched = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    // Yalnızca bir kez patchle
    if (!patched.current) {
      patchGetDisplayMedia();
      patched.current = true;
    }

    // Klavye kısayollarını engelle
    const onKeyDown = (e: KeyboardEvent) => {
      if (BLOCKED_COMBOS(e)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    // Sağ tık engeli
    const onContextMenu = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("[data-protect]")) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    // Sürükleme engeli
    const onDragStart = (e: DragEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("[data-protect]")) {
        e.preventDefault();
      }
    };

    // Görünürlük değişikliği (ekran paylaşımı başlatılınca sekme arka plana alınabilir)
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        // Video elementlerini durdur (kayıt sırasında içerik korunur)
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
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("contextmenu", onContextMenu, true);
      document.removeEventListener("dragstart", onDragStart, true);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [enabled]);
}
