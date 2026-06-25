import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CreditCard, BadgePercent, Clock3, Copy, Check, ChevronDown, ChevronUp, Shield, RefreshCw } from "lucide-react";
import { useLocation } from "wouter";
import { useSubscribe } from "@workspace/api-client-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const CRYPTOS = [
  { id: "btc",   symbol: "BTC",   name: "Bitcoin",    color: "text-orange-400", bg: "bg-orange-900/20", border: "border-orange-700/40", icon: "₿",  network: "Bitcoin Network" },
  { id: "eth",   symbol: "ETH",   name: "Ethereum",   color: "text-blue-400",   bg: "bg-blue-900/20",   border: "border-blue-700/40",   icon: "Ξ",  network: "ERC-20" },
  { id: "usdt",  symbol: "USDT",  name: "Tether",     color: "text-green-400",  bg: "bg-green-900/20",  border: "border-green-700/40",  icon: "₮",  network: "TRC-20 / ERC-20" },
  { id: "usdc",  symbol: "USDC",  name: "USD Coin",   color: "text-blue-300",   bg: "bg-blue-900/15",   border: "border-blue-600/30",   icon: "$",  network: "ERC-20 / SOL" },
  { id: "bnb",   symbol: "BNB",   name: "BNB",        color: "text-yellow-400", bg: "bg-yellow-900/20", border: "border-yellow-700/40", icon: "⬡",  network: "BEP-20" },
  { id: "sol",   symbol: "SOL",   name: "Solana",     color: "text-purple-400", bg: "bg-purple-900/20", border: "border-purple-700/40", icon: "◎",  network: "Solana Network" },
  { id: "xmr",   symbol: "XMR",   name: "Monero",     color: "text-orange-300", bg: "bg-orange-900/15", border: "border-orange-600/30", icon: "ɱ",  network: "Monero (Gizli)" },
  { id: "ltc",   symbol: "LTC",   name: "Litecoin",   color: "text-gray-300",   bg: "bg-gray-800/30",   border: "border-gray-600/40",   icon: "Ł",  network: "Litecoin Network" },
  { id: "ada",   symbol: "ADA",   name: "Cardano",    color: "text-sky-400",    bg: "bg-sky-900/15",    border: "border-sky-700/30",    icon: "₳",  network: "Cardano Network" },
  { id: "doge",  symbol: "DOGE",  name: "Dogecoin",   color: "text-yellow-300", bg: "bg-yellow-900/10", border: "border-yellow-600/30", icon: "Ð",  network: "Dogecoin Network" },
  { id: "trx",   symbol: "TRX",   name: "TRON",       color: "text-red-400",    bg: "bg-red-900/20",    border: "border-red-700/40",    icon: "T",  network: "TRC-20" },
  { id: "matic", symbol: "MATIC", name: "Polygon",    color: "text-violet-400", bg: "bg-violet-900/20", border: "border-violet-700/40", icon: "⬟",  network: "Polygon Network" },
  { id: "dot",   symbol: "DOT",   name: "Polkadot",   color: "text-pink-400",   bg: "bg-pink-900/20",   border: "border-pink-700/40",   icon: "●",  network: "Polkadot Network" },
  { id: "avax",  symbol: "AVAX",  name: "Avalanche",  color: "text-red-300",    bg: "bg-red-900/15",    border: "border-red-600/30",    icon: "▲",  network: "C-Chain" },
  { id: "link",  symbol: "LINK",  name: "Chainlink",  color: "text-blue-500",   bg: "bg-blue-900/20",   border: "border-blue-800/40",   icon: "⬡",  network: "ERC-20" },
];

const DUMMY_WALLETS: Record<string, string> = {
  btc:   "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
  eth:   "0x742d35Cc6634C0532925a3b8D4C9b4d1Aa7b6e1",
  usdt:  "TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7",
  usdc:  "0x742d35Cc6634C0532925a3b8D4C9b4d1Aa7b6e1",
  bnb:   "bnb1grpf0955h0ykzq3ar5nmum7y6gdfl6lxfn46h2",
  sol:   "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  xmr:   "888tNkZrPN6JsEgekjMnABU4TBzc2Dt29EPAvkRxbANsAnjyPbb3iQ1YBRk1UXcdRsiKc9dhwMVgN5S9cQUiyoogDavup3H",
  ltc:   "LcGxPnFxuZAGzn3UQoUfW29rFrm4FqxBTr",
  ada:   "addr1qx2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3jcu5d8ps7zex2k2xt3uqxgjqnnj83ws8lhrn648jjxtwq2ytjqp",
  doge:  "DRpbCBgzYoB4NkZkW5PkjkQj2VFbPSZnTk",
  trx:   "TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7",
  matic: "0x742d35Cc6634C0532925a3b8D4C9b4d1Aa7b6e1",
  dot:   "1FRMM8PEiWXYax7QuErE7DmwEkBwRPKKHR",
  avax:  "X-avax1tzdcgj4ehsvhhgpl7zylwpzvmc3aly4t7pynwu",
  link:  "0x742d35Cc6634C0532925a3b8D4C9b4d1Aa7b6e1",
};

const DUMMY_RATES: Record<string, number> = {
  btc: 0.000015, eth: 0.00028,  usdt: 9.99,   usdc: 9.99,
  bnb: 0.0168,   sol: 0.088,    xmr: 0.059,   ltc: 0.13,
  ada: 28.5,     doge: 65.2,    trx: 85.4,    matic: 18.7,
  dot: 1.85,     avax: 0.42,    link: 0.68,
};

type PayMethod = "card" | "crypto";

export default function Payment() {
  const searchParams = new URLSearchParams(window.location.search);
  const planId = parseInt(searchParams.get("plan") || "0");
  const billing = searchParams.get("billing") || "monthly";
  const planPrice = parseFloat(searchParams.get("price") || "9.99");

  const [, setLocation] = useLocation();
  const subscribeMutation = useSubscribe();
  const [loading, setLoading] = useState(false);
  const [method, setMethod] = useState<PayMethod>("card");
  const [selectedCrypto, setSelectedCrypto] = useState("btc");
  const [copied, setCopied] = useState<"addr" | "amt" | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [spinning, setSpinning] = useState(false);

  const crypto = CRYPTOS.find(c => c.id === selectedCrypto)!;
  const wallet = DUMMY_WALLETS[selectedCrypto] || "";
  const amount = (DUMMY_RATES[selectedCrypto] * planPrice).toFixed(8);
  const visibleCryptos = showAll ? CRYPTOS : CRYPTOS.slice(0, 8);

  const copy = (text: string, which: "addr" | "amt") => {
    navigator.clipboard.writeText(text);
    setCopied(which);
    toast.success(which === "addr" ? "Adres kopyalandı" : "Tutar kopyalandı");
    setTimeout(() => setCopied(null), 2000);
  };

  const refreshRate = () => {
    setSpinning(true);
    toast.info("Kur güncellendi");
    setTimeout(() => setSpinning(false), 1200);
  };

  const handleCardCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planId) return;
    setLoading(true);
    try {
      await subscribeMutation.mutateAsync({ data: { planId, paymentMethod: "pm_card_dummy" } });
      setLocation("/subscriptions");
    } catch {
      toast.error("Ödeme başarısız");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="container mx-auto p-4 md:p-6 max-w-2xl space-y-5">
        {/* Başlık */}
        <div className="flex items-center gap-3">
          <Shield className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Güvenli Ödeme</h1>
            <p className="text-sm text-muted-foreground">
              {billing === "yearly" ? "Yıllık" : "Aylık"} abonelik · Plan #{planId || "?"}
            </p>
          </div>
        </div>

        {/* Yöntem Seçimi */}
        <div className="grid grid-cols-2 gap-3">
          {(["card", "crypto"] as PayMethod[]).map(m => (
            <button
              key={m}
              onClick={() => setMethod(m)}
              className={cn(
                "flex items-center justify-center gap-2 p-4 rounded-xl border-2 font-semibold transition-all text-sm",
                method === m
                  ? "border-primary bg-primary/10 text-white"
                  : "border-[#2a2a2a] bg-[#111] text-[#888] hover:border-[#444]"
              )}
            >
              {m === "card"
                ? <><CreditCard className="h-5 w-5" /> Kredi / Banka Kartı</>
                : <><span className="text-lg font-bold">₿</span> Kripto Para ({CRYPTOS.length} coin)</>}
            </button>
          ))}
        </div>

        {/* ── KART ── */}
        {method === "card" && (
          <div className="bg-card border border-border p-6 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Kart Bilgileri</h2>
              <div className="flex gap-1.5 text-[10px] text-[#555]">
                {["VISA", "MC", "AMEX", "TROY"].map(b => (
                  <span key={b} className="bg-[#1a1a1a] border border-[#2a2a2a] px-2 py-0.5 rounded">{b}</span>
                ))}
              </div>
            </div>

            {billing === "yearly" && (
              <div className="flex items-center gap-2 text-xs rounded-lg bg-green-500/10 border border-green-500/20 px-3 py-2 text-green-400">
                <BadgePercent className="h-4 w-4" /> Yıllık ödemede %20 indirim uygulandı
              </div>
            )}

            <div className="rounded-xl border border-dashed border-[#2a2a2a] bg-[#0d0d0d] p-3 text-sm opacity-60">
              <div className="flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-[#777]" />
                <span className="font-semibold text-[#aaa]">Ücretsiz deneme</span>
                <span className="rounded-full bg-[#222] px-2 py-0.5 text-[10px] text-[#666] border border-[#333]">Pasif</span>
              </div>
            </div>

            {planId === 0 ? (
              <p className="text-destructive text-sm">Plan seçilmedi. Lütfen geri dönüp plan seçin.</p>
            ) : (
              <form onSubmit={handleCardCheckout} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#aaa]">Kart Numarası</label>
                  <Input placeholder="0000 0000 0000 0000" className="bg-[#111] font-mono" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[#aaa]">Son Kullanma</label>
                    <Input placeholder="AA/YY" className="bg-[#111]" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[#aaa]">CVC</label>
                    <Input placeholder="123" className="bg-[#111]" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#aaa]">Kart Sahibi</label>
                  <Input placeholder="AD SOYAD" className="bg-[#111]" />
                </div>
                <Button type="submit" className="w-full" size="lg" disabled={loading}>
                  {loading ? "İşleniyor..." : `Ödemeyi Tamamla — $${planPrice.toFixed(2)}`}
                </Button>
                <p className="text-center text-[10px] text-[#555]">256-bit SSL şifreleme · PCI-DSS uyumlu</p>
              </form>
            )}
          </div>
        )}

        {/* ── KRİPTO ── */}
        {method === "crypto" && (
          <div className="space-y-4">
            {/* Coin Grid */}
            <div className="bg-card border border-border p-5 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-sm">Coin Seçin</h2>
                <span className="text-xs text-[#555]">{CRYPTOS.length} desteklenen coin</span>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                {visibleCryptos.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCrypto(c.id)}
                    className={cn(
                      "flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 transition-all",
                      selectedCrypto === c.id
                        ? `${c.border} ${c.bg}`
                        : "border-[#222] bg-[#0d0d0d] hover:border-[#333]"
                    )}
                  >
                    <span className={cn("text-xl font-bold leading-none", c.color)}>{c.icon}</span>
                    <span className={cn("text-[11px] font-bold", selectedCrypto === c.id ? c.color : "text-[#666]")}>{c.symbol}</span>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowAll(!showAll)}
                className="flex items-center gap-1 text-xs text-[#555] hover:text-[#aaa] transition-colors mt-1"
              >
                {showAll
                  ? <><ChevronUp className="h-3.5 w-3.5" /> Daha az</>
                  : <><ChevronDown className="h-3.5 w-3.5" /> Tüm {CRYPTOS.length} coini göster</>}
              </button>
            </div>

            {/* Seçilen Coin Detay */}
            <div className={cn("border-2 rounded-xl p-5 space-y-4", crypto.border, crypto.bg)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={cn("text-4xl font-bold leading-none", crypto.color)}>{crypto.icon}</span>
                  <div>
                    <p className="font-bold text-lg">{crypto.name}</p>
                    <p className="text-xs text-[#666]">{crypto.network}</p>
                  </div>
                </div>
                <button onClick={refreshRate} className="flex items-center gap-1.5 text-xs text-[#555] hover:text-[#aaa] transition-colors bg-black/20 px-2.5 py-1.5 rounded-lg border border-[#2a2a2a]">
                  <RefreshCw className={cn("h-3.5 w-3.5", spinning && "animate-spin")} />
                  Kur güncelle
                </button>
              </div>

              {/* Tutar */}
              <div className="bg-black/30 rounded-xl p-4 space-y-3 border border-black/40">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#777]">Ödenecek Tutar</span>
                  <div className="flex items-center gap-2">
                    <span className={cn("font-bold text-xl font-mono", crypto.color)}>{amount} {crypto.symbol}</span>
                    <button
                      onClick={() => copy(amount, "amt")}
                      className={cn("p-1 rounded transition-colors", copied === "amt" ? "text-green-400" : "text-[#555] hover:text-white")}
                    >
                      {copied === "amt" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
                <div className="h-px bg-white/5" />
                <div className="flex items-center justify-between text-xs text-[#555]">
                  <span>USD karşılığı</span>
                  <span>${planPrice.toFixed(2)}</span>
                </div>
              </div>

              {/* Cüzdan */}
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-[#666] uppercase tracking-wider">Gönderim Adresi</p>
                <div className="flex items-start gap-2 bg-black/40 rounded-xl px-3 py-3 border border-[#2a2a2a]">
                  <p className="font-mono text-xs text-[#ccc] flex-1 break-all leading-relaxed">{wallet}</p>
                  <button
                    onClick={() => copy(wallet, "addr")}
                    className={cn("shrink-0 p-1.5 rounded-lg mt-0.5 transition-colors", copied === "addr" ? "bg-green-800/40 text-green-400" : "bg-[#222] text-[#666] hover:text-white")}
                  >
                    {copied === "addr" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Uyarı */}
              <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-xl px-4 py-3 text-xs text-yellow-400 space-y-1.5">
                <p className="font-semibold flex items-center gap-1.5">⚠️ Dikkat</p>
                <p>Yalnızca <strong>{crypto.network}</strong> üzerinden gönderin. Yanlış ağ seçimi durumunda transfer <strong>geri alınamaz</strong>.</p>
                <p>Ödeme <strong>30 dakika</strong> içinde onaylanmalıdır; aksi hâlde kur yeniden hesaplanır.</p>
              </div>

              {/* Bekleniyor */}
              <div className="flex items-center gap-2.5 text-xs text-[#555] bg-black/20 rounded-xl px-3 py-2.5 border border-[#1e1e1e]">
                <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse shrink-0" />
                Ödeme bekleniyor… Transfer sonrası bu sayfa otomatik yenilenir.
              </div>
            </div>

            {/* Tüm Desteklenen Coinler Etiketi */}
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="text-xs font-semibold text-[#555] uppercase tracking-wider mb-3">
                Desteklenen {CRYPTOS.length} Kripto
              </h3>
              <div className="flex flex-wrap gap-2">
                {CRYPTOS.map(c => (
                  <button
                    key={c.id}
                    onClick={() => { setSelectedCrypto(c.id); setShowAll(true); }}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all",
                      selectedCrypto === c.id
                        ? `${c.border} ${c.bg} ${c.color}`
                        : "border-[#222] bg-[#0d0d0d] text-[#555] hover:border-[#333] hover:text-[#aaa]"
                    )}
                  >
                    <span>{c.icon}</span> {c.symbol}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Alt Bilgi */}
        <div className="grid grid-cols-3 gap-3 text-xs text-center pb-4">
          {[
            { icon: "🔒", title: "SSL Şifreleme", desc: "256-bit güvenlik" },
            { icon: "⚡", title: "Anında Aktivasyon", desc: "Onay sonrası otomatik" },
            { icon: "🔄", title: "İade Garantisi", desc: "48 saat içinde" },
          ].map(item => (
            <div key={item.title} className="bg-[#0d0d0d] border border-[#1e1e1e] rounded-xl p-3 space-y-1">
              <div className="text-xl">{item.icon}</div>
              <p className="font-semibold text-[#ccc]">{item.title}</p>
              <p className="text-[#444]">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
