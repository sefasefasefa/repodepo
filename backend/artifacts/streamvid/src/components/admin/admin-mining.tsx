import { useState } from "react";
import { Bitcoin, Save, Zap, Activity, Settings2, Info, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

const MINING_ACTIVE_KEY    = "prnhbbbb_mining_site_active";
const SITE_INTENSITY_KEY   = "prnhbbbb_mining_site_intensity";
const THREADS_KEY          = "prnhbbbb_mining_threads";
const COINS_KEY            = "prnhbbbb_mining_coins";
const ACTIVE_COIN_KEY      = "prnhbbbb_mining_active_coin";

// ── Desteklenen coin algoritmaları ─────────────────────────────
const ALGORITHMS = [
  { id: "cn",         label: "CryptoNight (XMR)",      coin: "Monero",      symbol: "XMR",  color: "text-orange-400", bg: "bg-orange-900/20",  icon: "🪙" },
  { id: "cn-lite",    label: "CryptoNight Lite",        coin: "Aeon",        symbol: "AEON", color: "text-yellow-400", bg: "bg-yellow-900/20",  icon: "🔆" },
  { id: "rx",         label: "RandomX (XMR v2)",        coin: "Monero",      symbol: "XMR",  color: "text-orange-400", bg: "bg-orange-900/20",  icon: "🪙" },
  { id: "ethash",     label: "Ethash (ETH fork)",       coin: "Ethereum",    symbol: "ETH",  color: "text-blue-400",   bg: "bg-blue-900/20",    icon: "💎" },
  { id: "kawpow",     label: "KawPow",                  coin: "Ravencoin",   symbol: "RVN",  color: "text-purple-400", bg: "bg-purple-900/20",  icon: "🐦" },
  { id: "ghostrider", label: "GhostRider",              coin: "Raptoreum",   symbol: "RTM",  color: "text-green-400",  bg: "bg-green-900/20",   icon: "👻" },
  { id: "argon2",     label: "Argon2id",                coin: "WOWNERO",     symbol: "WOW",  color: "text-pink-400",   bg: "bg-pink-900/20",    icon: "🐸" },
  { id: "yescrypt",   label: "Yescrypt",                coin: "Yenten",      symbol: "YTN",  color: "text-teal-400",   bg: "bg-teal-900/20",    icon: "⚙️" },
  { id: "custom",     label: "Özel Algoritma",          coin: "Custom",      symbol: "—",    color: "text-gray-400",   bg: "bg-gray-900/20",    icon: "🔧" },
];

// Popüler pool önerileri coin bazlı
const POOL_SUGGESTIONS: Record<string, { label: string; url: string }[]> = {
  cn:         [{ label: "SupportXMR",  url: "pool.supportxmr.com:3333" }, { label: "MoneroOcean", url: "moneroocean.stream:10008" }, { label: "MineXMR", url: "pool.minexmr.com:4444" }],
  rx:         [{ label: "SupportXMR",  url: "pool.supportxmr.com:3333" }, { label: "MoneroOcean", url: "moneroocean.stream:10008" }],
  "cn-lite":  [{ label: "MinerGate",   url: "xmr.pool.minergate.com:45700" }],
  ethash:     [{ label: "Ethermine",   url: "eu1.ethermine.org:4444" }, { label: "2Miners",    url: "eth.2miners.com:2020" }],
  kawpow:     [{ label: "2Miners RVN", url: "rvn.2miners.com:6060" }, { label: "Flypool RVN", url: "ravencoin.flypool.org:3333" }],
  ghostrider: [{ label: "Raptoreum",   url: "rtm.suprnova.cc:7777" }],
  argon2:     [{ label: "WOW Pool",    url: "pool.wownero.com:3333" }],
  yescrypt:   [{ label: "Zpool",       url: "yescrypt.mine.zpool.ca:6233" }],
  custom:     [],
};

interface CoinConfig {
  id: string;
  algorithm: string;
  wallet: string;
  pool: string;
  worker: string;
  enabled: boolean;
}

const DEFAULT_COIN: CoinConfig = {
  id: "coin_1",
  algorithm: "cn",
  wallet: "",
  pool: "pool.supportxmr.com:3333",
  worker: "prnhbbbb",
  enabled: true,
};

function loadCoins(): CoinConfig[] {
  try {
    const raw = localStorage.getItem(COINS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [{ ...DEFAULT_COIN }];
}

function getIntensityLabel(v: number) {
  if (v <= 20) return { label: "Çok Düşük", cls: "text-green-400 bg-green-900/30" };
  if (v <= 40) return { label: "Düşük",    cls: "text-green-400 bg-green-900/30" };
  if (v <= 60) return { label: "Orta",     cls: "text-yellow-400 bg-yellow-900/30" };
  if (v <= 80) return { label: "Yüksek",   cls: "text-orange-400 bg-orange-900/30" };
  return              { label: "Maksimum", cls: "text-red-400 bg-red-900/30" };
}

export default function AdminMining() {
  const [siteActive, setSiteActive]       = useState(() => localStorage.getItem(MINING_ACTIVE_KEY) !== "0");
  const [intensity, setIntensity]         = useState(() => parseInt(localStorage.getItem(SITE_INTENSITY_KEY) || "50"));
  const [threads, setThreads]             = useState(() => parseInt(localStorage.getItem(THREADS_KEY) || "2"));
  const [threadsInput, setThreadsInput]   = useState(() => localStorage.getItem(THREADS_KEY) || "2");
  const [coins, setCoins]                 = useState<CoinConfig[]>(loadCoins);
  const [activeCoinId, setActiveCoinId]   = useState(() => localStorage.getItem(ACTIVE_COIN_KEY) || "coin_1");
  const [expandedCoin, setExpandedCoin]   = useState<string | null>("coin_1");
  const [saved, setSaved]                 = useState(false);

  const intensityInfo = getIntensityLabel(intensity);

  // Thread sayısı: slider + text input senkron
  const handleThreadSlider = (v: number) => {
    setThreads(v);
    setThreadsInput(String(v));
  };
  const handleThreadInput = (raw: string) => {
    setThreadsInput(raw);
    const n = parseInt(raw);
    if (!isNaN(n) && n >= 1) setThreads(n);
  };

  const addCoin = () => {
    const id = `coin_${Date.now()}`;
    const newCoin: CoinConfig = { ...DEFAULT_COIN, id, enabled: true };
    setCoins((p) => [...p, newCoin]);
    setExpandedCoin(id);
  };

  const removeCoin = (id: string) => {
    setCoins((p) => p.filter((c) => c.id !== id));
    if (activeCoinId === id) setActiveCoinId(coins[0]?.id ?? "");
  };

  const updateCoin = (id: string, patch: Partial<CoinConfig>) => {
    setCoins((p) => p.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  const save = () => {
    localStorage.setItem(MINING_ACTIVE_KEY, siteActive ? "1" : "0");
    localStorage.setItem(SITE_INTENSITY_KEY, String(intensity));
    localStorage.setItem(THREADS_KEY, String(threads));
    localStorage.setItem(COINS_KEY, JSON.stringify(coins));
    localStorage.setItem(ACTIVE_COIN_KEY, activeCoinId);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-3xl">

      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-orange-900/30 p-2.5 rounded-xl">
            <Bitcoin className="h-5 w-5 text-orange-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Tarayıcı Madenciliği</h2>
            <p className="text-[#666] text-xs mt-0.5">Kullanıcı onaylı, çoklu coin madencilik sistemi</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-[#555]">Site Geneli</span>
          <button
            onClick={() => setSiteActive((v) => !v)}
            className={cn("w-12 h-6 rounded-full transition-all relative", siteActive ? "bg-orange-600" : "bg-[#333]")}
          >
            <span className={cn("absolute top-1 w-4 h-4 rounded-full bg-white transition-all", siteActive ? "left-7" : "left-1")} />
          </button>
        </div>
      </div>

      {/* Bilgi */}
      <div className="bg-blue-900/10 border border-blue-800/20 rounded-xl p-4 flex gap-3">
        <Info className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
        <p className="text-xs text-[#888] leading-relaxed">
          Kullanıcılar onay verdiklerinde seçili coin ile madencilik başlar. Aktif coin'i
          değiştirebilir, birden fazla coin profili kaydedebilirsin. Thread sayısı için üst limit yok —
          dikkatli kullan.
        </p>
      </div>

      {/* ── Thread & Yoğunluk ── */}
      <div className="bg-[#111] border border-[#222] rounded-xl p-5 space-y-5">
        <p className="text-xs font-bold text-[#666] uppercase tracking-widest">Performans Ayarları</p>

        {/* Thread */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-[#ccc]">Thread Sayısı</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                value={threadsInput}
                onChange={(e) => handleThreadInput(e.target.value)}
                onBlur={() => { if (!threadsInput || parseInt(threadsInput) < 1) { setThreadsInput("1"); setThreads(1); } }}
                className="w-20 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-2 py-1.5 text-center text-sm font-bold text-orange-400 focus:outline-none focus:border-orange-600"
              />
              <span className="text-xs text-[#555]">thread</span>
            </div>
          </div>
          {/* Slider — max görsel olarak 64, ama input ile daha yüksek değer girilebilir */}
          <input
            type="range"
            min={1}
            max={Math.max(64, threads)}
            step={1}
            value={Math.min(threads, Math.max(64, threads))}
            onChange={(e) => handleThreadSlider(parseInt(e.target.value))}
            className="w-full accent-orange-500"
          />
          <div className="flex justify-between text-[10px] text-[#555] mt-1">
            <span>1</span><span>16</span><span>32</span><span>48</span><span>64+</span>
          </div>
          <p className="text-[10px] text-[#555] mt-1.5">
            Sağdaki kutuya istediğin sayıyı yazabilirsin. Yüksek değerler daha fazla hash üretir.
            {typeof navigator !== "undefined" && navigator.hardwareConcurrency && (
              <> Bu tarayıcı: <span className="text-orange-400">{navigator.hardwareConcurrency} çekirdek</span>.</>
            )}
          </p>
        </div>

        {/* Yoğunluk */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-[#ccc]">Varsayılan Yoğunluk</label>
            <span className={cn("text-[11px] px-2 py-0.5 rounded-md font-bold", intensityInfo.cls)}>
              {intensityInfo.label} — %{intensity}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#555]">%10</span>
            <input
              type="range"
              min={10} max={100} step={5}
              value={intensity}
              onChange={(e) => setIntensity(parseInt(e.target.value))}
              className="flex-1 accent-orange-500"
            />
            <span className="text-xs text-[#555]">%100</span>
          </div>
        </div>
      </div>

      {/* ── Coin Profilleri ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-[#666] uppercase tracking-widest">Coin Profilleri</p>
          <button
            onClick={addCoin}
            className="flex items-center gap-1.5 text-xs bg-orange-900/30 hover:bg-orange-900/50 text-orange-400 px-3 py-1.5 rounded-lg transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Coin Ekle
          </button>
        </div>

        {coins.length === 0 && (
          <div className="text-center py-8 text-[#555] text-sm border border-dashed border-[#333] rounded-xl">
            Henüz coin profili yok. "Coin Ekle" butonuna tıkla.
          </div>
        )}

        {coins.map((coin) => {
          const algo = ALGORITHMS.find((a) => a.id === coin.algorithm) ?? ALGORITHMS[0];
          const isExpanded = expandedCoin === coin.id;
          const isActive = activeCoinId === coin.id;
          const suggestions = POOL_SUGGESTIONS[coin.algorithm] ?? [];

          return (
            <div
              key={coin.id}
              className={cn(
                "border rounded-xl overflow-hidden transition-all",
                isActive ? "border-orange-600/50" : "border-[#222]",
                "bg-[#111]"
              )}
            >
              {/* Coin başlık satırı */}
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                onClick={() => setExpandedCoin(isExpanded ? null : coin.id)}
              >
                <span className="text-xl">{algo.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn("text-sm font-semibold", algo.color)}>{algo.coin}</span>
                    <span className="text-[10px] text-[#555]">{algo.symbol}</span>
                    <span className="text-[10px] text-[#444] font-mono">{algo.label}</span>
                    {isActive && (
                      <span className="text-[10px] bg-orange-900/40 text-orange-400 px-1.5 py-0.5 rounded-full font-bold">AKTİF</span>
                    )}
                    {!coin.enabled && (
                      <span className="text-[10px] bg-[#2a2a2a] text-[#555] px-1.5 py-0.5 rounded-full">Devre dışı</span>
                    )}
                  </div>
                  {coin.wallet && (
                    <p className="text-[10px] text-[#444] font-mono mt-0.5 truncate">{coin.wallet.slice(0, 24)}…</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!isActive && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setActiveCoinId(coin.id); }}
                      className="text-[10px] px-2.5 py-1 bg-[#1a1a1a] hover:bg-orange-900/30 text-[#888] hover:text-orange-400 rounded-lg transition-colors border border-[#2a2a2a]"
                    >
                      Aktif Et
                    </button>
                  )}
                  {coins.length > 1 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); removeCoin(coin.id); }}
                      className="p-1 rounded hover:bg-red-900/30 text-[#555] hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {isExpanded
                    ? <ChevronUp className="h-4 w-4 text-[#555]" />
                    : <ChevronDown className="h-4 w-4 text-[#555]" />}
                </div>
              </div>

              {/* Expanded form */}
              {isExpanded && (
                <div className="px-4 pb-4 space-y-3 border-t border-[#1a1a1a] pt-4">

                  {/* Algoritma seçimi */}
                  <div>
                    <label className="text-[11px] font-semibold text-[#666] uppercase tracking-wider block mb-1.5">Algoritma / Coin</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                      {ALGORITHMS.map((a) => (
                        <button
                          key={a.id}
                          onClick={() => updateCoin(coin.id, {
                            algorithm: a.id,
                            pool: POOL_SUGGESTIONS[a.id]?.[0]?.url ?? "",
                          })}
                          className={cn(
                            "flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-xs transition-all",
                            coin.algorithm === a.id
                              ? `${a.bg} ${a.color} border-current/40`
                              : "bg-[#1a1a1a] border-[#2a2a2a] text-[#666] hover:text-[#aaa] hover:border-[#333]"
                          )}
                        >
                          <span>{a.icon}</span>
                          <span className="leading-tight">
                            <span className="font-medium">{a.symbol}</span>
                            <br />
                            <span className="text-[9px] opacity-70">{a.label.split(" ")[0]}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Cüzdan */}
                  <div>
                    <label className="text-[11px] font-semibold text-[#666] uppercase tracking-wider block mb-1.5">
                      Cüzdan Adresi
                    </label>
                    <input
                      value={coin.wallet}
                      onChange={(e) => updateCoin(coin.id, { wallet: e.target.value })}
                      placeholder={`${algo.coin} cüzdan adresiniz...`}
                      className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#444] focus:outline-none focus:border-orange-600 font-mono text-xs"
                    />
                  </div>

                  {/* Pool */}
                  <div>
                    <label className="text-[11px] font-semibold text-[#666] uppercase tracking-wider block mb-1.5">
                      Mining Pool URL
                    </label>
                    <input
                      value={coin.pool}
                      onChange={(e) => updateCoin(coin.id, { pool: e.target.value })}
                      placeholder="pool.example.com:3333"
                      className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#444] focus:outline-none focus:border-orange-600 font-mono text-xs"
                    />
                    {suggestions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {suggestions.map((s) => (
                          <button
                            key={s.url}
                            onClick={() => updateCoin(coin.id, { pool: s.url })}
                            className={cn(
                              "text-[10px] px-2 py-0.5 rounded-md border transition-colors font-mono",
                              coin.pool === s.url
                                ? "border-orange-700 text-orange-400 bg-orange-900/20"
                                : "bg-[#1a1a1a] border-[#2a2a2a] text-[#555] hover:text-orange-400 hover:border-orange-800"
                            )}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Worker adı */}
                  <div>
                    <label className="text-[11px] font-semibold text-[#666] uppercase tracking-wider block mb-1.5">
                      Worker Adı
                    </label>
                    <input
                      value={coin.worker}
                      onChange={(e) => updateCoin(coin.id, { worker: e.target.value })}
                      placeholder="prnhbbbb"
                      className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#444] focus:outline-none focus:border-orange-600 font-mono text-xs"
                    />
                  </div>

                  {/* Etkinleştir toggle */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-sm text-[#888]">Bu profili etkinleştir</span>
                    <button
                      onClick={() => updateCoin(coin.id, { enabled: !coin.enabled })}
                      className={cn("w-10 h-5 rounded-full transition-all relative", coin.enabled ? "bg-orange-600" : "bg-[#333]")}
                    >
                      <span className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all", coin.enabled ? "left-5" : "left-0.5")} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* İstatistikler */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: Activity, label: "Aktif Madenci", value: "—", color: "text-orange-400" },
          { icon: Zap,      label: "Toplam Hash",   value: "—", color: "text-yellow-400" },
          { icon: Settings2, label: "Kabul Oranı",  value: "—", color: "text-green-400" },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="bg-[#111] border border-[#222] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Icon className={cn("h-4 w-4", color)} />
              <span className="text-[#555] text-xs">{label}</span>
            </div>
            <p className="text-2xl font-bold text-[#444]">{value}</p>
            <p className="text-[10px] text-[#444] mt-0.5">Yakında</p>
          </div>
        ))}
      </div>

      {/* Kaydet */}
      <div className="flex items-center gap-4">
        <button
          onClick={save}
          className={cn(
            "flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all",
            saved ? "bg-green-700 text-white" : "bg-orange-600 hover:bg-orange-500 text-white"
          )}
        >
          <Save className="h-4 w-4" />
          {saved ? "Kaydedildi ✓" : "Ayarları Kaydet"}
        </button>
        <p className="text-[11px] text-[#555]">Ayarlar yeni oturum açan kullanıcılara uygulanır.</p>
      </div>
    </div>
  );
}
