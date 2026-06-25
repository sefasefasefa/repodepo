import { useState, useEffect, useRef } from "react";
import { AlertTriangle, X, RefreshCw } from "lucide-react";

type DetectorStatus = "idle" | "detected" | "dismissed";
const DISMISS_KEY = "prnhbbbb_adblock_dismissed";

function detectAdBlocker(): Promise<boolean> {
  return new Promise((resolve) => {
    // 1. Honeypot element: ad blockers gizler
    const bait = document.createElement("div");
    bait.className =
      "ads ad adsbox ad-placement carbon-ads pub_300x250 pub_300x250m pub_728x90 text-ad textAd text_ad text_ads banner_ad ad-block";
    bait.style.cssText =
      "width:1px;height:1px;position:absolute;left:-9999px;top:-9999px;opacity:0;pointer-events:none;";
    document.body.appendChild(bait);

    // 2. Sahte reklam script yükleme girişimi
    const scriptBait = document.createElement("script");
    let scriptBlocked = false;
    scriptBait.src =
      "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js";
    scriptBait.onerror = () => { scriptBlocked = true; };

    setTimeout(() => {
      // Honeypot gizlenmiş mi?
      const baitBlocked =
        bait.offsetHeight === 0 ||
        bait.offsetWidth === 0 ||
        bait.clientHeight === 0 ||
        bait.clientWidth === 0 ||
        getComputedStyle(bait).display === "none" ||
        getComputedStyle(bait).visibility === "hidden";

      document.body.removeChild(bait);
      scriptBait.remove();

      resolve(baitBlocked || scriptBlocked);
    }, 150);

    document.head.appendChild(scriptBait);
  });
}

export function AdBlockDetector() {
  const [status, setStatus] = useState<DetectorStatus>("idle");
  const checked = useRef(false);

  useEffect(() => {
    if (checked.current) return;
    checked.current = true;

    // Önceki oturumda kalıcı kapatma yoksa kontrol et
    if (sessionStorage.getItem(DISMISS_KEY)) return;

    const run = async () => {
      const found = await detectAdBlocker();
      if (found) setStatus("detected");
    };

    // Sayfa tam yüklendikten 2sn sonra kontrol et
    const timer = setTimeout(run, 2000);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = (permanent = false) => {
    if (permanent) sessionStorage.setItem(DISMISS_KEY, "1");
    setStatus("dismissed");
  };

  const handleReload = () => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    window.location.reload();
  };

  if (status !== "detected") return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9998] p-4 md:p-6 pointer-events-none flex justify-center">
      <div className="bg-[#181818] border border-amber-600/50 rounded-2xl shadow-2xl shadow-black/60 max-w-lg w-full pointer-events-auto overflow-hidden">
        {/* Üst renkli çizgi */}
        <div className="h-1 bg-gradient-to-r from-amber-500 via-orange-400 to-red-500" />

        <div className="p-5">
          <div className="flex items-start gap-4">
            <div className="bg-amber-900/30 rounded-xl p-2.5 shrink-0">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-bold text-white text-sm leading-tight">
                  Reklam Engelleyici Tespit Edildi
                </h3>
                <button
                  onClick={() => handleDismiss(false)}
                  className="text-[#555] hover:text-white transition-colors shrink-0 -mt-0.5"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <p className="text-[#999] text-xs mt-1.5 leading-relaxed">
                Tarayıcınızda reklam engelleyici aktif görünüyor. Sitemiz <strong className="text-[#ccc]">tamamen ücretsiz</strong> sunulabilmesi için reklam gelirlerine ihtiyaç duymaktadır. Reklamlar içeriğimizi desteklemenin en kolay yoludur.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={handleReload}
                  className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Kapattım, sayfayı yenile
                </button>
                <button
                  onClick={() => handleDismiss(true)}
                  className="text-[#666] hover:text-[#999] text-xs px-3 py-2 rounded-lg transition-colors border border-[#2a2a2a] hover:border-[#444]"
                >
                  Şimdilik geç
                </button>
              </div>
            </div>
          </div>

          {/* Nasıl kapatılır mini kılavuz */}
          <div className="mt-4 bg-[#111] rounded-xl p-3 border border-[#2a2a2a]">
            <p className="text-[#666] text-[11px] font-medium mb-2">Reklam engelleyiciyi nasıl kapatırım?</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[
                { name: "uBlock Origin", step: "Sağ üst simge → Bu site için durdur" },
                { name: "AdBlock Plus", step: "Sağ üst simge → Bu sitede devre dışı bırak" },
                { name: "Brave Shield", step: "Adres çubuğu → Kalkan simgesi → Kapat" },
              ].map(item => (
                <div key={item.name} className="bg-[#1a1a1a] rounded-lg px-2.5 py-2">
                  <p className="text-[#aaa] text-[11px] font-semibold">{item.name}</p>
                  <p className="text-[#555] text-[10px] mt-0.5 leading-tight">{item.step}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
