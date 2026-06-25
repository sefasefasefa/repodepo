import { useMining } from "@/lib/use-mining";
import { useAuth } from "@/lib/auth";
import { Bitcoin, ZapOff } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function MiningStatus() {
  const { user } = useAuth();
  const { consent, isRunning, hashRate, enabled, setEnabled } = useMining();
  const [show, setShow] = useState(false);

  if (!user || consent !== "yes") return null;

  return (
    <div className="relative">
      <button
        onClick={() => setShow(s => !s)}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-all",
          isRunning
            ? "bg-orange-900/20 border-orange-800/40 text-orange-400 hover:bg-orange-900/30"
            : "bg-[#1a1a1a] border-[#2a2a2a] text-[#555] hover:border-[#444]"
        )}
        title="Madencilik durumu"
      >
        <Bitcoin className={cn("h-3.5 w-3.5", isRunning && "animate-pulse")} />
        {isRunning ? `${hashRate} H/s` : "Durduruldu"}
      </button>

      {show && (
        <div className="absolute top-full right-0 mt-2 w-56 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl shadow-xl z-50 p-3">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-[#aaa]">Madencilik</span>
            <button
              onClick={() => setEnabled(!enabled)}
              className={cn("text-[10px] px-2.5 py-1 rounded-lg font-medium transition-colors",
                enabled ? "bg-orange-900/30 text-orange-400 hover:bg-red-900/30 hover:text-red-400" : "bg-green-900/20 text-green-400")}
            >
              {enabled ? "Durdur" : "Başlat"}
            </button>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px]">
              <span className="text-[#555]">Durum</span>
              <span className={cn("font-medium", isRunning ? "text-orange-400" : "text-[#555]")}>{isRunning ? "Çalışıyor" : "Durduruldu"}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-[#555]">Hız</span>
              <span className="text-white font-mono">{hashRate} H/s</span>
            </div>
          </div>
          <p className="text-[10px] text-[#444] mt-3">Profil → Ayarlar'dan detaylı yönetim yapabilirsiniz.</p>
        </div>
      )}
    </div>
  );
}
