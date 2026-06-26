import { useState, useEffect } from "react";
import { Shield, AlertTriangle, X } from "lucide-react";
import { usePublicSiteSettings } from "@/lib/use-public-site-settings";

const AGE_KEY = "prnhbbbb_age_verified";
const DENIED_KEY = "prnhbbbb_age_denied";

const BYPASS_PATHS = ["/login", "/register"];

export function AgeGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<"loading" | "pending" | "verified" | "denied">("loading");
  const { settings } = usePublicSiteSettings();
  const siteName = settings.siteName || "Prnhbbbb";

  useEffect(() => {
    const path = window.location.pathname;
    if (BYPASS_PATHS.some(p => path === p || path.startsWith(p + "?"))) {
      setStatus("verified");
      return;
    }
    const verified = localStorage.getItem(AGE_KEY);
    const denied = localStorage.getItem(DENIED_KEY);
    if (verified === "1") setStatus("verified");
    else if (denied === "1") setStatus("denied");
    else setStatus("pending");
  }, []);

  const handleConfirm = () => {
    localStorage.setItem(AGE_KEY, "1");
    localStorage.removeItem(DENIED_KEY);
    setStatus("verified");
  };

  const handleDeny = () => {
    localStorage.setItem(DENIED_KEY, "1");
    setStatus("denied");
  };

  if (status === "loading") return null;

  if (status === "denied") {
    return (
      <div className="fixed inset-0 z-[9999] bg-[#0a0a0a] flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-5">
            <X className="h-8 w-8 text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Erişim Kısıtlandı</h2>
          <p className="text-[#888] text-sm mb-6 leading-relaxed">
            Bu platform yalnızca 18 yaş ve üzeri kişilere yöneliktir. Bu siteye erişim hakkınız bulunmamaktadır.
          </p>
          <button onClick={() => { localStorage.removeItem(DENIED_KEY); setStatus("pending"); }} className="text-xs text-[#555] hover:text-[#888] underline transition-colors">
            Yaşımı yanlış girdim, tekrar dene
          </button>
        </div>
      </div>
    );
  }

  if (status === "pending") {
    return (
      <div className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-sm flex items-center justify-center p-6">
        <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl max-w-md w-full p-8 shadow-2xl">
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Shield className="h-7 w-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight mb-1">{siteName}</h1>
            <p className="text-[#666] text-xs uppercase tracking-widest font-medium">18+ Platform</p>
          </div>

          <div className="bg-amber-900/20 border border-amber-800/40 rounded-xl p-4 mb-6 flex gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-amber-200 text-sm font-semibold mb-1">Yetişkin İçerik Uyarısı</p>
              <p className="text-amber-200/70 text-xs leading-relaxed">
                Bu platform, 18 yaş ve üzeri yetişkinlere yönelik içerikler barındırmaktadır. Devam etmeden önce yaşınızı doğrulamanız gerekmektedir.
              </p>
            </div>
          </div>

          <p className="text-center text-white font-semibold text-lg mb-6">
            18 yaşında veya daha büyük müsünüz?
          </p>

          <div className="grid grid-cols-2 gap-3 mb-6">
            <button onClick={handleConfirm} className="bg-primary hover:bg-primary/90 text-white font-bold py-3.5 rounded-xl transition-all active:scale-95 text-sm">
              Evet, 18 yaşındayım veya daha büyüğüm
            </button>
            <button onClick={handleDeny} className="bg-[#1e1e1e] hover:bg-[#252525] border border-[#333] text-[#aaa] hover:text-white font-medium py-3.5 rounded-xl transition-all active:scale-95 text-sm">
              Hayır, 18 yaşından küçüğüm
            </button>
          </div>

          <div className="text-center space-y-2 pt-4 border-t border-[#222]">
            <p className="text-[#555] text-[11px] leading-relaxed">
              Giriş yaparak bu sitenin <span className="text-[#777]">Kullanım Koşulları</span>'nı ve <span className="text-[#777]">Gizlilik Politikası</span>'nı okuduğunuzu ve kabul ettiğinizi onaylıyorsunuz.
            </p>
            <p className="text-[#444] text-[10px] leading-relaxed">
              Bu platformda yazılı mesajlar, sesli mesajlar, arama kayıtları ve yüklenen medya içerikleri sunucuda saklanabilir; kalite ve depolama amacıyla otomatik sıkıştırma/optimizasyon uygulanabilir. Bu kayıtlar daha sonra güvenlik, hizmet geliştirme ve yapay zeka modeli eğitimi için kullanılabilir.
            </p>
            <p className="text-[#444] text-[10px]">
              © 2025 {siteName}. Tüm hakları saklıdır. 18+ Platform.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
