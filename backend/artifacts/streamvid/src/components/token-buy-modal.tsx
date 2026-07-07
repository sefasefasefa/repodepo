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
  { id: -1, name: "Başlangıç",  tokens: 100,  priceUsd: "1.00",  bonus: 0,   isPopular: false, icon: "Zap"    },
  { id: -2, name: "Standart",   tokens: 500,  priceUsd: "4.50",  bonus: 50,  isPopular: false, icon: "Star"   },
  { id: -3, name: "Popüler",    tokens: 1000, priceUsd: "8.00",  bonus: 150, isPopular: true,  icon: "Crown"  },
  { id: -4, name: "Premium",    tokens: 5000, priceUsd: "35.00", bonus: 1000,isPopular: false, icon: "Gift"   },
];

const ICONS: Record<string, any> = { Zap, Star, Crown, Gift, Coins };

interface Props { onClose: () => void; onPurchased?: (tokens: number) => void; }

export function TokenBuyModal({ onClose, onPurchased }: Props) {
  const { toast } = useToast();
  const [packages, setPackages] = useState<any[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [buying, setBuying]     = useState(false);
  const [success, setSuccess]   = useState<{ tokens: number; pkg: string } | null>(null);
  const [couponCode] = useState("");

  useEffect(() => {
    apiFetch("/tokens/packages")
      .then(d => {
        const pkgs = d.packages?.length ? d.packages : FALLBACK_PACKAGES;
        setPackages(pkgs);
        const popular = pkgs.find((p: any) => p.isPopular) || pkgs[1];
        if (popular) setSelected(popular.id);
      })
      .catch(() => {
        setPackages(FALLBACK_PACKAGES);
        setSelected(-3);
      });
  }, []);

  const handleBuy = async () => {
    if (!selected) return;
    const pkg = packages.find(p => p.id === selected);
    if (!pkg) return;
    setBuying(true);
    try {
      const d = await apiFetch("/tokens/purchase", {
        method: "POST",
        body: JSON.stringify({ packageId: selected, couponCode: couponCode.trim() || undefined }),
      });
      setSuccess({ tokens: d.tokens, pkg: pkg.name });
      onPurchased?.(d.tokens);
      setTimeout(onClose, 2500);
    } catch (e: any) {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
    } finally {
      setBuying(false);
    }
  };

  const selectedPkg = packages.find(p => p.id === selected);

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Mobilde bottom sheet, masaüstünde ortalanmış kart */}
      <div className={cn(
        "bg-[#1a1a1a] border border-[#2a2a2a] w-full sm:max-w-sm shadow-2xl flex flex-col",
        "rounded-t-2xl sm:rounded-2xl",
        "max-h-[85dvh] sm:max-h-[80vh]"
      )}>

        {/* Başlık — sabit */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-[#242424] flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-yellow-500/15 rounded-lg">
              <Coins className="h-4 w-4 text-yellow-400" />
            </div>
            <span className="font-bold text-sm">Token Satın Al</span>
          </div>
          <button onClick={onClose} className="text-[#555] hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* İçerik — kaydırılabilir */}
        {success ? (
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-2 px-5 py-8 overflow-y-auto">
            <div className="w-14 h-14 bg-yellow-500/15 border-2 border-yellow-500/30 rounded-full flex items-center justify-center">
              <Check className="h-6 w-6 text-yellow-400" />
            </div>
            <p className="text-base font-bold mt-1">Satın Alındı!</p>
            <p className="text-sm text-[#888]">
              <span className="text-yellow-400 font-bold">{success.tokens.toLocaleString("tr")} 🪙</span> hesabına eklendi.
            </p>
          </div>
        ) : (
          <>
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-3 space-y-3">
              <p className="text-[11px] text-[#666] text-center">
                1 Token = $0.01 · Creator'lar %80 alır
              </p>

              {/* Paket listesi — yatay kompakt kartlar */}
              <div className="space-y-2">
                {packages.map(pkg => {
                  const totalTokens = pkg.tokens + (pkg.bonus || 0);
                  const isSelected  = selected === pkg.id;
                  const IconComp    = ICONS[pkg.icon] ?? Coins;
                  return (
                    <button
                      key={pkg.id}
                      onClick={() => setSelected(pkg.id)}
                      className={cn(
                        "relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left",
                        isSelected
                          ? "border-yellow-500/60 bg-yellow-500/8 shadow-sm shadow-yellow-500/10"
                          : "border-[#2a2a2a] bg-[#1e1e1e] hover:border-[#3a3a3a]"
                      )}
                    >
                      {/* İkon */}
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                        isSelected ? "bg-yellow-500/20" : "bg-[#252525]"
                      )}>
                        <IconComp className={cn("h-4 w-4", isSelected ? "text-yellow-400" : "text-[#666]")} />
                      </div>

                      {/* İsim + bonus */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-white">{pkg.name}</span>
                          {pkg.isPopular && (
                            <span className="bg-primary text-primary-foreground text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                              Popüler
                            </span>
                          )}
                        </div>
                        <p className={cn("text-xs mt-0.5", isSelected ? "text-yellow-400" : "text-[#888]")}>
                          {totalTokens.toLocaleString("tr")} 🪙
                          {pkg.bonus > 0 && <span className="text-green-400 ml-1">+{pkg.bonus} bonus</span>}
                        </p>
                      </div>

                      {/* Fiyat */}
                      <div className="shrink-0 text-right">
                        <p className={cn("text-sm font-bold", isSelected ? "text-yellow-400" : "text-white")}>
                          ${parseFloat(pkg.priceUsd).toFixed(2)}
                        </p>
                      </div>

                      {/* Seçim işareti */}
                      {isSelected && (
                        <div className="absolute top-2 right-2 w-3.5 h-3.5 bg-yellow-500 rounded-full flex items-center justify-center">
                          <Check className="h-2 w-2 text-black" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Seçilen paketin özeti */}
              {selectedPkg && (
                <div className="bg-[#111] border border-[#222] rounded-xl px-3 py-2 text-[11px] space-y-1">
                  <div className="flex justify-between text-[#888]">
                    <span>Alacaksın</span>
                    <span className="text-yellow-400 font-bold">{(selectedPkg.tokens + (selectedPkg.bonus || 0)).toLocaleString("tr")} 🪙</span>
                  </div>
                  {selectedPkg.bonus > 0 && (
                    <div className="flex justify-between text-[#888]">
                      <span>Bonus</span>
                      <span className="text-green-400 font-semibold">+{selectedPkg.bonus} ücretsiz</span>
                    </div>
                  )}
                  <div className="flex justify-between text-[#888]">
                    <span>Ödenecek</span>
                    <span className="text-white font-bold">${parseFloat(selectedPkg.priceUsd).toFixed(2)}</span>
                  </div>
                </div>
              )}

              <p className="text-[10px] text-[#3a3a3a] text-center pb-1">
                Demo mod · gerçek ödeme alınmaz
              </p>
            </div>

            {/* Butonlar — sabit altta */}
            <div className="flex gap-2 px-4 py-3 border-t border-[#242424] flex-shrink-0">
              <Button variant="outline" onClick={onClose} className="flex-1 border-[#333] text-[#888] hover:text-white h-9 text-sm">
                İptal
              </Button>
              <Button
                onClick={handleBuy}
                disabled={!selected || buying}
                className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-black font-bold gap-1.5 h-9 text-sm"
              >
                {buying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Coins className="h-3.5 w-3.5" />}
                Satın Al
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
