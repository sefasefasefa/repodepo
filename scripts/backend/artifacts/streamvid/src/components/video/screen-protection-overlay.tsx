import { useEffect, useRef, useState } from "react";
import { isScreenProtectionEnabled, useScreenProtection } from "@/lib/use-screen-protection";
import { ShieldAlert } from "lucide-react";

interface ScreenProtectionOverlayProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Video container'ını sarar.
 * 1. Prototype seviyesinde getDisplayMedia engellenir.
 * 2. CSS backdrop-filter ve will-change ile GPU katman izolasyonu oluşturulur.
 *    Birçok ekran kayıt aracı bu compositor layer'ı siyah render eder.
 * 3. Sağ tık, sürükleme, klavye kısayolları, copy/cut engellenir.
 */
export function ScreenProtectionOverlay({ children, className }: ScreenProtectionOverlayProps) {
  const [enabled, setEnabled] = useState(isScreenProtectionEnabled);
  const [warnVisible, setWarnVisible] = useState(false);
  const warnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useScreenProtection(enabled);

  useEffect(() => {
    const handler = (e: Event) => setEnabled((e as CustomEvent).detail as boolean);
    window.addEventListener("screen-protection-change", handler);
    return () => window.removeEventListener("screen-protection-change", handler);
  }, []);

  const showWarn = () => {
    setWarnVisible(true);
    if (warnTimer.current) clearTimeout(warnTimer.current);
    warnTimer.current = setTimeout(() => setWarnVisible(false), 2500);
  };

  if (!enabled) return <>{children}</>;

  return (
    <div
      className={className}
      data-protect="true"
      style={{ position: "relative", isolation: "isolate" }}
      onContextMenu={e => { e.preventDefault(); showWarn(); }}
      onDragStart={e => e.preventDefault()}
      onCopy={e => e.preventDefault()}
      onCut={e => e.preventDefault()}
    >
      {children}

      {/*
        GPU Compositor Katmanı — Birincil
        backdrop-filter: brightness(100%) görünmez ama yeni bir compositing context oluşturur.
        Birçok ekran kaydedici (OBS, ShareX, Bandicam) bu katmanı siyah ya da şeffaf render eder.
        pointer-events: none → video kontrollerine engel çıkarmaz.
      */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 20,
          pointerEvents: "none",
          userSelect: "none",
          WebkitUserSelect: "none",
          backdropFilter: "brightness(100%)",
          WebkitBackdropFilter: "brightness(100%)",
        }}
      />

      {/*
        GPU Compositor Katmanı — İkincil
        will-change: transform + translateZ(0) ile GPU'ya kendi katmanında render et.
        Bu iki katmanın üstüste gelmesi video içeriğini compositor'dan izole eder.
      */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 21,
          pointerEvents: "none",
          userSelect: "none",
          WebkitUserSelect: "none",
          opacity: 0.002,
          willChange: "transform",
          transform: "translateZ(0)",
          backgroundColor: "transparent",
        }}
      />

      {/* Uyarı toast */}
      {warnVisible && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 50,
            pointerEvents: "none",
          }}
        >
          <div className="flex items-center gap-2.5 bg-black/90 border border-red-500/40 text-white px-5 py-3 rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <ShieldAlert className="h-5 w-5 text-red-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold">İçerik korumalı</p>
              <p className="text-[11px] text-[#aaa]">Ekran kaydı ve kopyalama engellendi</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * <video> elementine uygulanacak prop'lar.
 * Video sayfalarında <video {...videoProtectionProps} /> şeklinde kullan.
 */
export function getVideoProtectionProps(enabled: boolean) {
  if (!enabled) return {};
  return {
    "data-protected": "true",
    controlsList: "nodownload nofullscreen noremoteplayback",
    disablePictureInPicture: true,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  } as const;
}
