import { useEffect, useState, useCallback } from "react";
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from "react-simple-maps";
import { useAuth } from "@/lib/auth";
import { Users, Globe, TrendingUp, RefreshCw, Wifi, MapPin, Clock, Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

interface Visitor {
  id: string;
  lat: number;
  lng: number;
  country: string;
  city: string;
  page: string;
  lastSeen: number;
}

interface VisitorData {
  total: number;
  uniqueSessions: number;
  mode: "live" | "historical";
  visitors: Visitor[];
  topCountries: { country: string; count: number }[];
  topPages: { page: string; count: number }[];
}

const COUNTRY_NAMES: Record<string, string> = {
  TR: "Türkiye", US: "ABD", GB: "Birleşik Krallık", DE: "Almanya",
  FR: "Fransa", JP: "Japonya", BR: "Brezilya", RU: "Rusya",
  AU: "Avustralya", IN: "Hindistan", CA: "Kanada", ES: "İspanya",
  IT: "İtalya", NL: "Hollanda", AE: "BAE", SG: "Singapur", MX: "Meksika",
};

const PAGE_LABELS: Record<string, string> = {
  "/": "Ana Sayfa", "/videos": "Videolar", "/shorts": "Shorts",
  "/login": "Giriş", "/register": "Kayıt", "/pricing": "Fiyatlar",
  "/admin": "Admin", "/downloads": "İndirilenler",
};

const PERIODS = [
  { value: "5min", label: "Canlı", sublabel: "Son 5 dk", color: "text-green-400", bg: "bg-green-400/10 border-green-500/30", live: true },
  { value: "1h",   label: "1 Saat",    sublabel: "Son 60 dk",  color: "text-blue-400",   bg: "bg-blue-400/10 border-blue-500/30" },
  { value: "24h",  label: "24 Saat",   sublabel: "Bugün",      color: "text-violet-400", bg: "bg-violet-400/10 border-violet-500/30" },
  { value: "7d",   label: "7 Gün",     sublabel: "Bu hafta",   color: "text-amber-400",  bg: "bg-amber-400/10 border-amber-500/30" },
  { value: "30d",  label: "30 Gün",    sublabel: "Bu ay",      color: "text-orange-400", bg: "bg-orange-400/10 border-orange-500/30" },
  { value: "all",  label: "Tüm Zamanlar", sublabel: "Genel",   color: "text-pink-400",   bg: "bg-pink-400/10 border-pink-500/30" },
];

function formatPage(page: string) {
  if (PAGE_LABELS[page]) return PAGE_LABELS[page];
  if (page.startsWith("/videos/")) return "Video İzleme";
  if (page.startsWith("/creator/")) return "Creator";
  if (page.startsWith("/categories/")) return "Kategori";
  return page;
}

function formatRelativeTime(ts: number) {
  const diff = Math.floor(Date.now() / 1000 - ts);
  if (diff < 60) return `${diff}s önce`;
  if (diff < 3600) return `${Math.floor(diff / 60)}dk önce`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}sa önce`;
  return `${Math.floor(diff / 86400)}g önce`;
}

function MapDot({ lat, lng, isNew, isHistorical }: { lat: number; lng: number; isNew: boolean; isHistorical: boolean }) {
  return (
    <Marker coordinates={[lng, lat]}>
      <g>
        <circle
          r={isNew ? 8 : isHistorical ? 4 : 5}
          fill={isNew ? "#f90" : isHistorical ? "#a78bfa" : "#ff4d4f"}
          fillOpacity={isHistorical ? 0.7 : 0.9}
          stroke="white"
          strokeWidth={1}
          style={{ animation: isNew ? "pulse 2s ease-out infinite" : undefined }}
        />
        {isNew && (
          <circle
            r={12}
            fill="transparent"
            stroke="#f90"
            strokeWidth={1.5}
            strokeOpacity={0.6}
            style={{ animation: "ripple 2s ease-out infinite" }}
          />
        )}
      </g>
    </Marker>
  );
}

export default function AdminVisitorMap() {
  const { user } = useAuth();
  const [data, setData] = useState<VisitorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const prevIds = useState<Set<string>>(new Set())[0];
  const [period, setPeriod] = useState("5min");
  const [countryFilter, setCountryFilter] = useState("");
  const [showCountryFilter, setShowCountryFilter] = useState(false);
  const token = localStorage.getItem("token") ?? "";

  const isLive = period === "5min";
  const activePeriod = PERIODS.find(p => p.value === period) ?? PERIODS[0];

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams({ period });
      if (countryFilter) params.set("country", countryFilter);
      const res = await fetch(`/api/admin/visitors?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json: VisitorData = await res.json();

      if (isLive) {
        const incoming = new Set(json.visitors.map(v => v.id));
        const fresh = new Set([...incoming].filter(id => !prevIds.has(id)));
        setNewIds(fresh);
        for (const id of incoming) prevIds.add(id);
        for (const id of [...prevIds].filter(id => !incoming.has(id))) prevIds.delete(id);
        setTimeout(() => setNewIds(new Set()), 3000);
      } else {
        setNewIds(new Set());
      }

      setData(json);
      setLastRefresh(new Date());
    } finally {
      setLoading(false);
    }
  }, [token, period, countryFilter, isLive]);

  useEffect(() => {
    setLoading(true);
    fetchData();
    if (isLive) {
      const interval = setInterval(fetchData, 5000);
      return () => clearInterval(interval);
    }
  }, [fetchData, isLive]);

  const availableCountries = data
    ? [...new Set(data.topCountries.map(c => c.country))].filter(Boolean)
    : [];

  return (
    <div className="space-y-5">
      <style>{`
        @keyframes pulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.3);opacity:0.7} }
        @keyframes ripple { 0%{r:8;opacity:0.8} 100%{r:22;opacity:0} }
      `}</style>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Ziyaretçi Haritası
          </h2>
          <p className="text-sm text-[#666] mt-0.5">
            {isLive ? "Son 5 dakikadaki aktif ziyaretçiler" : `${activePeriod.sublabel} ziyaretçi verileri`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isLive && (
            <div className="flex items-center gap-1.5 text-xs text-green-400">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              Canlı
            </div>
          )}
          {!isLive && countryFilter && (
            <button
              onClick={() => setCountryFilter("")}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/20 border border-primary/30 text-xs text-primary"
              style={{ touchAction: "manipulation" }}
            >
              {COUNTRY_NAMES[countryFilter] ?? countryFilter}
              <X className="h-3 w-3" />
            </button>
          )}
          <button
            onClick={fetchData}
            className="p-2 rounded-lg bg-[#2a2a2a] hover:bg-[#333] transition-colors text-[#888] hover:text-white"
            style={{ touchAction: "manipulation" }}
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Period filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {PERIODS.map(p => (
          <button
            key={p.value}
            onClick={() => { setPeriod(p.value); setCountryFilter(""); }}
            style={{ touchAction: "manipulation" }}
            className={cn(
              "flex-none flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all whitespace-nowrap",
              period === p.value
                ? `${p.bg} ${p.color} border-opacity-100`
                : "bg-[#1a1a1a] border-[#2a2a2a] text-[#666] hover:text-[#aaa] hover:border-[#444]"
            )}
          >
            {p.live && period === p.value && (
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            )}
            {p.label}
          </button>
        ))}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl p-4">
          <p className="text-xs text-[#666] mb-1">{isLive ? "Aktif Ziyaretçi" : "Toplam Ziyaret"}</p>
          <p className="text-2xl font-bold text-white">{data?.total ?? 0}</p>
        </div>
        <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl p-4">
          <p className="text-xs text-[#666] mb-1">Tekil Oturum</p>
          <p className="text-2xl font-bold text-white">{data?.uniqueSessions ?? 0}</p>
        </div>
        <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl p-4">
          <p className="text-xs text-[#666] mb-1">Ülke Sayısı</p>
          <p className="text-2xl font-bold text-white">{data?.topCountries.length ?? 0}</p>
        </div>
        <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl p-4">
          <p className="text-xs text-[#666] mb-1">Son Güncelleme</p>
          <p className="text-sm font-mono text-[#aaa] mt-1">{lastRefresh.toLocaleTimeString("tr-TR")}</p>
        </div>
      </div>

      {/* Map + sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Map */}
        <div className="lg:col-span-2 bg-[#0d1117] border border-[#1e1e1e] rounded-2xl overflow-hidden" style={{ minHeight: 380 }}>
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center z-10 bg-[#0d1117]/60 rounded-2xl">
              <RefreshCw className="h-6 w-6 text-primary animate-spin" />
            </div>
          )}
          <div className="relative">
            <ComposableMap
              projectionConfig={{ scale: 140, center: [20, 10] }}
              style={{ width: "100%", height: "100%" }}
            >
              <ZoomableGroup zoom={1} minZoom={1} maxZoom={4}>
                <Geographies geography={GEO_URL}>
                  {({ geographies }) =>
                    geographies.map(geo => (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill="#1a2332"
                        stroke="#243040"
                        strokeWidth={0.5}
                        style={{ default: { outline: "none" }, hover: { fill: "#253040", outline: "none" }, pressed: { outline: "none" } }}
                      />
                    ))
                  }
                </Geographies>

                {data?.visitors.map(v => (
                  <MapDot
                    key={v.id}
                    lat={v.lat}
                    lng={v.lng}
                    isNew={newIds.has(v.id)}
                    isHistorical={!isLive}
                  />
                ))}
              </ZoomableGroup>
            </ComposableMap>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 px-4 pb-3 -mt-1">
            {isLive ? (
              <>
                <div className="flex items-center gap-1.5 text-xs text-[#666]">
                  <div className="w-3 h-3 rounded-full bg-red-500" /> Aktif ziyaretçi
                </div>
                <div className="flex items-center gap-1.5 text-xs text-[#666]">
                  <div className="w-3 h-3 rounded-full bg-amber-400" /> Yeni gelen
                </div>
              </>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-[#666]">
                <div className="w-3 h-3 rounded-full bg-violet-400" /> Ziyaretçi konumu
              </div>
            )}
            <span className="ml-auto text-xs text-[#444]">
              {data?.visitors.length ?? 0} nokta gösteriliyor
            </span>
          </div>
        </div>

        {/* Sidebar stats */}
        <div className="space-y-3">

          {/* Top countries */}
          <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl p-4">
            <h3 className="text-sm font-semibold text-[#aaa] mb-3 flex items-center gap-2">
              <Globe className="h-4 w-4" /> En Fazla Ziyaretçi — Ülke
            </h3>
            {(!data || data.topCountries.length === 0) && (
              <p className="text-xs text-[#555]">Henüz ziyaretçi yok</p>
            )}
            <div className="space-y-2">
              {data?.topCountries.map(({ country, count }, i) => {
                const total = data.topCountries.reduce((s, c) => s + c.count, 0) || 1;
                return (
                  <button
                    key={country}
                    onClick={() => setCountryFilter(countryFilter === country ? "" : country)}
                    style={{ touchAction: "manipulation" }}
                    className={cn(
                      "w-full flex items-center gap-2 rounded-lg px-1 py-0.5 transition-colors text-left",
                      countryFilter === country ? "bg-primary/10" : "hover:bg-[#252525]"
                    )}
                  >
                    <span className="text-xs text-[#666] w-4 shrink-0">{i + 1}.</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className={cn("text-xs truncate", countryFilter === country ? "text-primary" : "text-[#ccc]")}>
                          {COUNTRY_NAMES[country] ?? country}
                        </span>
                        <span className="text-xs font-bold text-white ml-2">{count}</span>
                      </div>
                      <div className="h-1 bg-[#2a2a2a] rounded-full overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all duration-500", countryFilter === country ? "bg-primary" : "bg-primary/60")}
                          style={{ width: `${(count / total) * 100}%` }}
                        />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            {countryFilter && (
              <button
                onClick={() => setCountryFilter("")}
                style={{ touchAction: "manipulation" }}
                className="mt-2 w-full text-xs text-[#666] hover:text-white text-center py-1 rounded hover:bg-[#2a2a2a] transition-colors"
              >
                Filtreyi Kaldır
              </button>
            )}
          </div>

          {/* Top pages */}
          <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl p-4">
            <h3 className="text-sm font-semibold text-[#aaa] mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> En Çok Ziyaret Edilen Sayfa
            </h3>
            {(!data || data.topPages.length === 0) && (
              <p className="text-xs text-[#555]">Henüz veri yok</p>
            )}
            <div className="space-y-1.5">
              {data?.topPages.map(({ page, count }) => (
                <div key={page} className="flex items-center justify-between py-1 border-b border-[#232323] last:border-0">
                  <span className="text-xs text-[#aaa] truncate max-w-[140px]">{formatPage(page)}</span>
                  <span className="text-xs font-mono font-bold text-primary">{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Visitor list */}
          <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl p-4">
            <h3 className="text-sm font-semibold text-[#aaa] mb-3 flex items-center gap-2">
              <Wifi className="h-4 w-4" />
              {isLive ? "Anlık Ziyaretçiler" : "Son Ziyaretçiler"}
            </h3>
            {(!data || data.visitors.length === 0) && (
              <p className="text-xs text-[#555]">{isLive ? "Aktif ziyaretçi yok" : "Bu dönemde ziyaretçi yok"}</p>
            )}
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {data?.visitors.slice(0, 20).map(v => (
                <div key={v.id} className={cn(
                  "flex items-start gap-2 py-1.5 px-2 rounded-lg transition-colors",
                  newIds.has(v.id) ? "bg-amber-900/20 border border-amber-500/20" : "hover:bg-[#252525]"
                )}>
                  <MapPin className="h-3.5 w-3.5 text-[#555] mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-[#ccc] truncate">
                      {COUNTRY_NAMES[v.country] ?? v.country}
                      {v.city ? ` — ${v.city}` : ""}
                    </p>
                    <p className="text-[11px] text-[#555] truncate">{formatPage(v.page)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    {newIds.has(v.id)
                      ? <span className="text-[10px] text-amber-400 font-bold">YENİ</span>
                      : !isLive && v.lastSeen
                        ? <span className="text-[10px] text-[#555]">{formatRelativeTime(v.lastSeen)}</span>
                        : null
                    }
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
