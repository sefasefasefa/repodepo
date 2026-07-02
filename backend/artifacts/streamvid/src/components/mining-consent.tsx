import { useMining } from "@/lib/use-mining";
import { Bitcoin, Zap, X, ChevronDown, ChevronUp, Server, Heart } from "lucide-react";
import { useState } from "react";

const AUTH_PATHS = ["/login", "/register"];

export function MiningConsent() {
  const { consent, acceptMining, declineMining } = useMining();
  const [expanded, setExpanded] = useState(false);

  if (consent !== "pending") return null;
  if (AUTH_PATHS.includes(window.location.pathname)) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9990] p-3 md:p-4 pointer-events-none flex justify-center">
      <div className="bg-[#1a1a1a] border border-[#333] rounded-2xl shadow-2xl shadow-black/60 max-w-lg w-full pointer-events-auto overflow-hidden">
        <div className="h-0.5 bg-gradient-to-r from-orange-500 via-yellow-400 to-orange-500" />

        <div className="p-4 md:p-5">
          <div className="flex items-start gap-3">
            <div className="bg-orange-900/30 rounded-xl p-2.5 shrink-0">
              <Bitcoin className="h-5 w-5 text-orange-400" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-bold text-white text-sm">Bize Destek Olur musun?</h3>
                <button onClick={declineMining} className="text-[#555] hover:text-white transition-colors shrink-0">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Sunucu masrafı vurgusu */}
              <div className="flex items-start gap-2 mt-2 bg-orange-950/30 border border-orange-900/30 rounded-xl px-3 py-2.5">
                <Server className="h-3.5 w-3.5 text-orange-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-orange-200/80 leading-relaxed">
                  Bu platform tamamen <strong className="text-orange-300">reklamsız ve ücretsiz</strong> çalışmaktadır.
                  Sunucu masraflarını karşılayabilmek için tarayıcını kullanarak bize destek olabilirsin.
                </p>
              </div>

              <p className="text-[#999] text-xs mt-2.5 leading-relaxed">
                <strong className="text-[#ccc]">Nasıl?</strong> Tarayıcının boşta kalan CPU gücünü kullanarak
                küçük miktarda kripto madenciliği yapılır. Kişisel verine dokunulmaz,
                istediğin zaman kapatabilirsin.
              </p>

              <div className="flex items-center gap-1.5 mt-2">
                <Heart className="h-3 w-3 text-pink-500" />
                <p className="text-[11px] text-[#666]">
                  Kabul edersen siteyi ayakta tutmamıza doğrudan yardımcı olursun. Teşekkürler! 🙏
                </p>
              </div>

              {/* Detay alanı */}
              <button
                onClick={() => setExpanded(e => !e)}
                className="flex items-center gap-1 text-[11px] text-[#666] hover:text-[#aaa] mt-2.5 transition-colors"
              >
                {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                Teknik detaylar
              </button>

              {expanded && (
                <div className="mt-3 bg-[#111] rounded-xl p-3 space-y-1.5 text-[11px] text-[#666]">
                  <p>• <span className="text-[#888]">CPU kullanımı:</span> Mobilde %20, masaüstünde %50 varsayılan yoğunluk</p>
                  <p>• <span className="text-[#888]">Veri:</span> Hiçbir kişisel veriniz kullanılmaz veya paylaşılmaz</p>
                  <p>• <span className="text-[#888]">Madenci:</span> Tarayıcıda çalışan WebAssembly tabanlı işlem</p>
                  <p>• <span className="text-[#888]">Kapatma:</span> Profil → Ayarlar → Madencilik bölümünden her zaman kapatılabilir</p>
                  <p>• <span className="text-[#888]">Şeffaflık:</span> Hangi sayfada olursanız olun madencilik durumunu görebilirsiniz</p>
                </div>
              )}

              <div className="flex gap-2 mt-4">
                <button
                  onClick={acceptMining}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold px-3 py-2.5 rounded-xl transition-colors"
                >
                  <Zap className="h-3.5 w-3.5" /> Evet, destek olmak istiyorum!
                </button>
                <button
                  onClick={declineMining}
                  className="flex-1 text-[#666] hover:text-[#999] text-xs px-3 py-2.5 rounded-xl transition-colors border border-[#2a2a2a] hover:border-[#444]"
                >
                  Hayır, teşekkürler
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
