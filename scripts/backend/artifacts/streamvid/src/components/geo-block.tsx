import { useEffect, useState } from "react";
import { Globe, ShieldX } from "lucide-react";
import { getInitData } from "@/lib/init-prefetch";

interface GeoCheckResult {
  blocked: boolean;
  country: string | null;
  enabled: boolean;
  message?: string;
  redirectUrl?: string;
}

interface GeoGuardProps {
  children: React.ReactNode;
}

/**
 * Uygulama kök bileşenini sarar.
 * /api/init'ten gelen geo verisini kullanır — ayrı istek atmaz.
 * Engel yoksa (enabled=false veya blocked=false) anında geçer.
 */
export function GeoGuard({ children }: GeoGuardProps) {
  const [status, setStatus] = useState<"loading" | "ok" | "blocked">("ok");
  const [result, setResult] = useState<GeoCheckResult | null>(null);

  useEffect(() => {
    getInitData().then((init) => {
      if (!init?.geo) return;
      const geo = init.geo as GeoCheckResult;
      if (geo.blocked) {
        setResult(geo);
        setStatus("blocked");
      }
    });
  }, []);

  if (status === "blocked" && result) {
    if (result.redirectUrl) {
      window.location.href = result.redirectUrl;
      return null;
    }
    return <GeoBlockScreen result={result} />;
  }

  return <>{children}</>;
}

function GeoBlockScreen({ result }: { result: GeoCheckResult }) {
  return (
    <div className="fixed inset-0 bg-[#0a0a0a] flex items-center justify-center z-[9999] p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-red-950/40 border border-red-800/30 flex items-center justify-center">
              <Globe className="h-10 w-10 text-red-500" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-red-600 flex items-center justify-center border-2 border-[#0a0a0a]">
              <ShieldX className="h-4 w-4 text-white" />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-white">Erişim Engellendi</h1>
          <p className="text-[#888] text-sm leading-relaxed">
            {result.message || "Bu içerik bulunduğunuz ülkede kullanılamaz."}
          </p>
        </div>

        {result.country && result.country !== "XX" && result.country !== "LOCAL" && (
          <div className="inline-flex items-center gap-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-full px-4 py-1.5">
            <Globe className="h-3.5 w-3.5 text-[#555]" />
            <span className="text-xs text-[#666]">Konumunuz:</span>
            <span className="text-xs font-bold text-[#aaa]">{result.country}</span>
          </div>
        )}

        <p className="text-[11px] text-[#444]">
          Prnhbbbb — 18+ Platform
        </p>
      </div>
    </div>
  );
}
