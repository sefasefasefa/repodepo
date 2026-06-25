import { useEffect, useRef, useState } from "react";
import { isScreenProtectionEnabled, useScreenProtection } from "@/lib/use-screen-protection";
import { ShieldAlert } from "lucide-react";

interface ScreenProtectionOverlayProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Video container'ını sarar.
 * 1. CSS backdrop-filter katmanı — bazı ekran kayıt araçları bu compositor layer'ı
 *    siyah render eder (Windows DWM / Chrome compositor katman izolasyonu).
 * 2. getDisplayMedia API'si hook tarafından engellenir.
 * 3. Sağ tık, sürükleme, klavye kısayolları engellenir.
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
    >
      {children}

      {/*
        Compositor katman overlay:
        backdrop-filter GPU'da yeni bir katman oluşturur.
        Bazı ekran kaydediciler bu katmanı kararttır/atlar.
        pointer-events: none ile video kontrollerine dokunmaz.
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
          backdropFilter: "blur(0.001px)",
          WebkitBackdropFilter: "blur(0.001px)",
          // mix-blend-mode: normal ile compositing context zorlar
          mixBlendMode: "normal",
        }}
      />

      {/* İkinci katman — video içeriğini kompozitten izole eder */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 21,
          pointerEvents: "none",
          userSelect: "none",
          WebkitUserSelect: "none",
          // Hafif opacity + willChange: GPU katmanını kesinleştirir
          opacity: 0.001,
          willChange: "transform",
          transform: "translateZ(0)",
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
