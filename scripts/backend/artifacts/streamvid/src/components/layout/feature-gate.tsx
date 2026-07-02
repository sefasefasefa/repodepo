import { useFeatureState } from "@/lib/feature-flags";
import { Wrench, Lock } from "lucide-react";
import { Link } from "wouter";

function BlockScreen({ type }: { type: "maintenance" | "disabled" }) {
  const isMaint = type === "maintenance";
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 ${isMaint ? "bg-yellow-900/20 border border-yellow-800/30" : "bg-red-900/20 border border-red-800/30"}`}>
          {isMaint
            ? <Wrench className="h-7 w-7 text-yellow-400" />
            : <Lock className="h-7 w-7 text-red-400" />}
        </div>
        <h2 className="text-xl font-bold text-white mb-2">
          {isMaint ? "Bakım Modu" : "Bu Bölüm Kapalı"}
        </h2>
        <p className="text-[#666] text-sm mb-6 leading-relaxed">
          {isMaint
            ? "Bu bölüm şu anda bakım çalışması nedeniyle geçici olarak kullanılamıyor. Yakında geri döneceğiz."
            : "Bu bölüm şu anda hizmet dışı. Daha fazla bilgi için yöneticinize başvurun."}
        </p>
        <Link href="/">
          <button className="bg-[#1e1e1e] hover:bg-[#252525] border border-[#2a2a2a] text-white rounded-xl px-6 py-2.5 text-sm transition-colors">
            Ana Sayfaya Dön
          </button>
        </Link>
      </div>
    </div>
  );
}

export function FeatureGate({ feature, children }: { feature: string; children: React.ReactNode }) {
  const state = useFeatureState(feature);
  if (state === "disabled") return <BlockScreen type="disabled" />;
  if (state === "maintenance") return <BlockScreen type="maintenance" />;
  return <>{children}</>;
}

export function gated(feature: string, Component: React.ComponentType<any>) {
  return function GatedPage(props: any) {
    return (
      <FeatureGate feature={feature}>
        <Component {...props} />
      </FeatureGate>
    );
  };
}
