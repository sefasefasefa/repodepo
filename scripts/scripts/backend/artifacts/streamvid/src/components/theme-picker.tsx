import { useState } from "react";
import { Palette, Check, X } from "lucide-react";
import { useTheme, THEMES } from "@/lib/use-theme";
import { cn } from "@/lib/utils";

export function ThemePicker() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const current = THEMES.find(t => t.id === theme) ?? THEMES[0];

  return (
    <>
      {/* Floating trigger */}
      <button
        onClick={() => setOpen(p => !p)}
        className="fixed bottom-5 right-5 z-50 w-11 h-11 rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95 border-2 border-white/20"
        style={{ backgroundColor: current.primary }}
        title="Tema Değiştir"
      >
        <Palette className="h-5 w-5 text-white" />
      </button>

      {/* Panel */}
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="fixed bottom-20 right-5 z-50 w-72 rounded-2xl shadow-2xl overflow-hidden theme-picker-panel"
            style={{ border: "1px solid rgba(255,255,255,0.1)" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 theme-picker-header">
              <span className="font-semibold text-sm">Tema Seç</span>
              <button onClick={() => setOpen(false)} className="opacity-50 hover:opacity-100 transition-opacity">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Themes grid */}
            <div className="p-3 grid grid-cols-2 gap-2">
              {THEMES.map(t => (
                <button
                  key={t.id}
                  onClick={() => { setTheme(t.id); setOpen(false); }}
                  className={cn(
                    "relative flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all text-left",
                    "border hover:scale-[1.02] active:scale-[0.98]",
                    theme === t.id
                      ? "border-white/30 scale-[1.02]"
                      : "border-transparent hover:border-white/10"
                  )}
                  style={{
                    background: t.isLight
                      ? theme === t.id ? "#f0f0f0" : "#e8e8e8"
                      : theme === t.id
                        ? `${t.bg}dd`
                        : `${t.bg}99`,
                  }}
                >
                  {/* Color swatch */}
                  <div
                    className="w-7 h-7 rounded-full shrink-0 shadow-md flex items-center justify-center"
                    style={{ backgroundColor: t.primary }}
                  >
                    {theme === t.id && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
                  </div>

                  <div className="min-w-0">
                    <p className={cn(
                      "text-xs font-semibold truncate",
                      t.isLight ? "text-[#222]" : "text-white"
                    )}>
                      {t.label}
                    </p>
                    {theme === t.id && (
                      <p className={cn("text-[10px]", t.isLight ? "text-[#666]" : "text-white/50")}>Aktif</p>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Footer */}
            <div className="px-4 pb-3 pt-1">
              <p className="text-[11px] opacity-40 text-center">
                Tercih tarayıcıya kaydedilir
              </p>
            </div>
          </div>
        </>
      )}
    </>
  );
}
