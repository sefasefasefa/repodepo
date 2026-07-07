import { useState, useEffect } from "react";
import { X, Coins, Check, Loader2, Zap, Star, Gift, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

async function apiFetch(path: string, opts: RequestInit = {}) {
  const token = localStorage.getItem("token");
  const res = await fetch(`/api${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || res.statusText);
  return res.json();
}

const FALLBACK_PACKAGES = [
  { id: -1, name: "Başlangıç", tokens: 100,  priceUsd: "1.00",  bonus: 0,    isPopular: false, icon: "Zap"   },
  { id: -2, name: "Standart",  tokens: 500,  priceUsd: "4.50",  bonus: 50,   isPopular: false, icon: "Star"  },
  { id: -3, name: "Popüler",   tokens: 1000, priceUsd: "8.00",  bonus: 150,  isPopular: true,  icon: "Crown" },
  { id: -4, name: "Premium",   tokens: 5000, priceUsd: "35.00", bonus: 1000, isPopular: false, icon: "Gift"  },
];

const ICONS: Record<string, React.ElementType> = { Zap, Star, Crown, Gift, Coins };

interface Props { onClose: () => void; onPurchased?: (tokens: number) => void; }

export function TokenBuyModal({ onClose, onPurchased }: Props) {
  const { toast } = useToast();
  const [packages, setPackages]   = useState<any[]>([]);
  const [selected, setSelected]   = useState<number | null>(null);
  const [buying, setBuying]       = useState(false);
  const [success, setSuccess]     = useState<{ tokens: number } | null>(null);

  useEffect(() => {
    apiFetch("/tokens/packages")
      .then(d => {
        const pkgs = d.packages?.length ? d.packages : FALLBACK_PACKAGES;
        setPackages(pkgs);
        const pop = pkgs.find((p: any) => p.isPopular) ?? pkgs[1];
        if (pop) setSelected(pop.id);
      })
      .catch(() => { setPackages(FALLBACK_PACKAGES); setSelected(-3); });
  }, []);

  const handleBuy = async () => {
    if (!selected) return;
    const pkg = packages.find(p => p.id === selected);
    if (!pkg) return;
    setBuying(true);
    try {
      const d = await apiFetch("/tokens/purchase", {
        method: "POST",
        body: JSON.stringify({ packageId: selected }),
      });
      setSuccess({ tokens: d.tokens });
      onPurchased?.(d.tokens);
      setTimeout(onClose, 2000);
    } catch (e: any) {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
    } finally {
      setBuying(false);
    }
  };

  const selectedPkg = packages.find(p => p.id === selected);

  return (
    <>
      {/* Mobilde yarı-saydam overlay, masaüstünde şeffaf tıklama yakalayıcı */}
      <div
        className="fixed inset-0 z-40 bg-black/60 sm:bg-transparent"
        onClick={onClose}
      />

      {/*
        Mobil  : ekranın altından açılan bottom-sheet (tam genişlik)
        Masaüstü: navbar altında sağ üstte açılan küçük panel (340px)
      */}
      <div className={cn(
        "fixed z-50 flex flex-col",
        "bg-[#1a1a1a] border border-[#2a2a2a] shadow-2xl",
        // Mobil: bottom-sheet
        "left-0 right-0 bottom-0 rounded-t-2xl max-h-[78dvh]",
        // Masaüstü: sağ üst panel
        "sm:left-auto sm:right-4 sm:bottom-auto sm:top-14",
        "sm:w-[340px] sm:rounded-2xl sm:max-h-[min(480px,calc(100vh-4.5rem))]",
      )}>

        {/* Başlık */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-[#242424] shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-yellow-500/15 rounded-lg">
              <Coins className="h-3.5 w-3.5 text-yellow-400" />
            </div>
            <span className="font-bold text-sm">Token Satın Al</span>
          </div>
          <button onClick={onClose} className="text-[#555] hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* İçerik */}
        {success ? (
          <div className="flex flex-col items-center justify-center gap-2 px-5 py-8">
            <div className="w-12 h-12 bg-yellow-500/15 border-2 border-yellow-500/30 rounded-full flex items-center justify-center">
              <Check className="h-5 w-5 text-yellow-400" />
            </div>
            <p className="font-bold text-sm mt-1">Satın Alındı!</p>
            <p className="text-xs text-[#888]">
              <span className="text-yellow-400 font-bold">{success.tokens.toLocaleString("tr")} 🪙</span> hesabına eklendi.
            </p>
          </div>
        ) : (
          <>
            {/* Kaydırılabilir içerik */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-3 space-y-2">
              <p className="text-[11px] text-[#666] text-center mb-1">
                1 Token = $0.01 · Creator'lar %80 alır
              </p>

              {/* Paket listesi — her biri yatay kompakt satır */}
              {packages.map(pkg => {
                const totalTokens = pkg.tokens + (pkg.bonus || 0);
                const isSelected  = selected === pkg.id;
                const IconComp    = ICONS[pkg.icon] ?? Coins;
                return (
                  <button
                    key={pkg.id}
                    onClick={() => setSelected(pkg.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left relative",
                      isSelected
                        ? "border-yellow-500/50 bg-yellow-500/8"
                        : "border-[#272727] bg-[#1e1e1e] hover:border-[#383838]"
                    )}
                  >
                    <div className={cn(
                      "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                      isSelected ? "bg-yellow-500/20" : "bg-[#252525]"
                    )}>
                      <IconComp className={cn("h-3.5 w-3.5", isSelected ? "text-yellow-400" : "text-[#555]")} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold">{pkg.name}</span>
                        {pkg.isPopular && (
                          <span className="bg-primary/90 text-primary-foreground text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                            Popüler
                          </span>
                        )}
                      </div>
                      <p className={cn("text-[11px] mt-0.5", isSelected ? "text-yellow-400" : "text-[#777]")}>
                        {totalTokens.toLocaleString("tr")} 🪙
                        {pkg.bonus > 0 && <span className="text-green-400 ml-1">+{pkg.bonus}</span>}
                      </p>
                    </div>

                    <p className={cn("text-sm font-bold shrink-0", isSelected ? "text-yellow-400" : "text-[#ccc]")}>
                      ${parseFloat(pkg.priceUsd).toFixed(2)}
                    </p>

                    {isSelected && (
                      <div className="absolute top-2 right-2 w-3 h-3 bg-yellow-500 rounded-full flex items-center justify-center">
                        <Check className="h-1.5 w-1.5 text-black" />
                      </div>
                    )}
                  </button>
                );
              })}

              {/* Seçili özet */}
              {selectedPkg && (
                <div className="bg-[#111] border border-[#222] rounded-xl px-3 py-2 text-[11px] space-y-1 mt-1">
                  <div className="flex justify-between">
                    <span className="text-[#777]">Alacaksın</span>
                    <span className="text-yellow-400 font-bold">
                      {(selectedPkg.tokens + (selectedPkg.bonus || 0)).toLocaleString("tr")} 🪙
                    </span>
                  </div>
                  {selectedPkg.bonus > 0 && (
                    <div className="flex justify-between">
                      <span className="text-[#777]">Bonus</span>
                      <span className="text-green-400">+{selectedPkg.bonus} ücretsiz</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-[#777]">Ödenecek</span>
                    <span className="font-bold">${parseFloat(selectedPkg.priceUsd).toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Butonlar — sabit altta */}
            <div className="shrink-0 flex gap-2 px-4 py-3 border-t border-[#242424]">
              <Button
                variant="outline"
                onClick={onClose}
                className="flex-1 h-9 text-xs border-[#333] text-[#888] hover:text-white"
              >
                İptal
              </Button>
              <Button
                onClick={handleBuy}
                disabled={!selected || buying}
                className="flex-1 h-9 text-xs bg-yellow-500 hover:bg-yellow-400 text-black font-bold gap-1.5"
              >
                {buying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Coins className="h-3.5 w-3.5" />}
                Satın Al
              </Button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
