import { AppLayout } from "@/components/layout/app-layout";
import { useAuth } from "@/lib/auth";
import { useState, useEffect, lazy, Suspense } from "react";
import { useGetAdminDashboard } from "@workspace/api-client-react";

const AdminVideos              = lazy(() => import("@/components/admin/admin-videos").then(m => ({ default: m.AdminVideos })));
const AdminUsers               = lazy(() => import("@/components/admin/admin-users").then(m => ({ default: m.AdminUsers })));
const AdminAds                 = lazy(() => import("@/components/admin/admin-ads").then(m => ({ default: m.AdminAds })));
const AdminReports             = lazy(() => import("@/components/admin/admin-reports").then(m => ({ default: m.AdminReports })));
const AdminSubscriptions       = lazy(() => import("@/components/admin/admin-subscriptions").then(m => ({ default: m.AdminSubscriptions })));
const AdminCDN                 = lazy(() => import("@/components/admin/admin-cdn").then(m => ({ default: m.AdminCDN })));
const AdminIntegrations        = lazy(() => import("@/components/admin/admin-integrations").then(m => ({ default: m.AdminIntegrations })));
const AdminPayments            = lazy(() => import("@/components/admin/admin-payments").then(m => ({ default: m.AdminPayments })));
const AdminSecurity            = lazy(() => import("@/components/admin/admin-security").then(m => ({ default: m.AdminSecurity })));
const AdminSiteSettings        = lazy(() => import("@/components/admin/admin-site-settings"));
const AdminCreators            = lazy(() => import("@/components/admin/admin-creators").then(m => ({ default: m.AdminCreators })));
const AdminCreatorApplications = lazy(() => import("@/components/admin/admin-creator-applications").then(m => ({ default: m.AdminCreatorApplications })));
const AdminApiEndpoints        = lazy(() => import("@/components/admin/admin-api-endpoints").then(m => ({ default: m.AdminApiEndpoints })));
const AdminAffiliate           = lazy(() => import("@/components/admin/admin-affiliate").then(m => ({ default: m.AdminAffiliate })));
const AdminBadges              = lazy(() => import("@/components/admin/admin-badges").then(m => ({ default: m.AdminBadges })));
const AdminCustomPages         = lazy(() => import("@/components/admin/admin-custom-pages"));
const AdminVisitorMap          = lazy(() => import("@/components/admin/admin-visitor-map"));
const AdminABTests             = lazy(() => import("@/components/admin/admin-ab-tests"));
const AdminRevenueProjection   = lazy(() => import("@/components/admin/admin-revenue-projection"));
const AdminEmailCampaigns      = lazy(() => import("@/components/admin/admin-email-campaigns"));
const AdminGiftSubscriptions   = lazy(() => import("@/components/admin/admin-gift-subscriptions"));
const AdminHomeFilters         = lazy(() => import("@/components/admin/admin-home-filters"));
const AdminFeatureFlags        = lazy(() => import("@/components/admin/admin-feature-flags").then(m => ({ default: m.AdminFeatureFlags })));
const AdminCrosspostMonitor    = lazy(() => import("@/components/admin/admin-crosspost-monitor"));
const AdminModeration          = lazy(() => import("@/components/admin/admin-moderation"));
const AdminWithdrawals         = lazy(() => import("@/components/admin/admin-withdrawals"));
const AdminWatchInsights       = lazy(() => import("@/components/admin/admin-watch-insights"));
const AdminVideoDashboard      = lazy(() => import("@/components/admin/admin-video-dashboard"));
import { Users, Video, AlertTriangle, DollarSign, LayoutDashboard, Megaphone, CreditCard, TrendingUp, HardDrive, Link2, Shield, Settings2, Crown, Code2, Share2, Award, LayoutTemplate, Globe, FlaskConical, HeartPulse, Mail, Gift, ToggleLeft, RadioTower, SlidersHorizontal, ShieldCheck, Wallet, Search, ChevronDown, Film, UsersRound, Megaphone as MegaphoneIcon, Wallet as WalletIcon, ShieldAlert, Wrench, Eye, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

async function pulseFetch(path: string) {
  const token = localStorage.getItem("token");
  const res = await fetch(`/api${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

function usePendingCounts() {
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const results = await Promise.allSettled([
        pulseFetch("/admin/moderation/stats").then(d => ["moderation", d.pending ?? 0] as const),
        pulseFetch("/admin/withdrawals").then(d => ["withdrawals", (d.requests ?? []).filter((r: any) => r.status === "pending").length] as const),
        pulseFetch("/admin/creator-applications").then(d => ["applications", (d.applications ?? []).filter((a: any) => a.status === "pending").length] as const),
      ]);
      if (cancelled) return;
      const next: Record<string, number> = {};
      for (const r of results) {
        if (r.status === "fulfilled") {
          const [key, value] = r.value;
          next[key] = value;
        }
      }
      setCounts(next);
    };
    load();
    const interval = setInterval(load, 60000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  return counts;
}

function CountBadge({ count }: { count?: number }) {
  if (!count) return null;
  return (
    <span className="ml-auto shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500/90 text-white text-[10px] font-bold flex items-center justify-center">
      {count > 99 ? "99+" : count}
    </span>
  );
}

const GROUPS = [
  {
    id: "overview",
    label: "Genel Bakış",
    icon: LayoutDashboard,
    tabs: [
      { id: "dashboard", label: "Genel Bakış", icon: LayoutDashboard },
      { id: "health",    label: "Sağlık Monitörü", icon: HeartPulse },
    ],
  },
  {
    id: "content",
    label: "İçerik Yönetimi",
    icon: Film,
    tabs: [
      { id: "videos",       label: "Videolar", icon: Video },
      { id: "moderation",   label: "Video Moderasyon", icon: ShieldCheck },
      { id: "home-filters", label: "Anasayfa Filtreleri", icon: SlidersHorizontal },
      { id: "pages",        label: "Özel Sayfalar", icon: LayoutTemplate },
      { id: "watch-insights",    label: "İzleme Analitiği",   icon: Eye },
      { id: "video-dashboard",   label: "Video Analitik",     icon: BarChart3 },
    ],
  },
  {
    id: "community",
    label: "Kullanıcılar & Topluluk",
    icon: UsersRound,
    tabs: [
      { id: "users",        label: "Kullanıcılar", icon: Users },
      { id: "creators",     label: "Yükleyici Limitleri", icon: Crown },
      { id: "applications", label: "Creator Başvuruları", icon: Crown },
      { id: "badges",       label: "Rozetler", icon: Award },
      { id: "reports",      label: "Raporlar", icon: AlertTriangle },
    ],
  },
  {
    id: "marketing",
    label: "Reklam & Pazarlama",
    icon: MegaphoneIcon,
    tabs: [
      { id: "ads",      label: "Reklamlar", icon: Megaphone },
      { id: "email",    label: "E-posta Kampanya", icon: Mail },
      { id: "ab-tests", label: "A/B Testleri", icon: FlaskConical },
      { id: "affiliate", label: "Affiliate", icon: Share2 },
      { id: "crosspost-monitor", label: "Crosspost İzleme", icon: RadioTower },
      { id: "visitors", label: "Ziyaretçi Haritası", icon: Globe },
    ],
  },
  {
    id: "revenue",
    label: "Gelir & Ödemeler",
    icon: WalletIcon,
    tabs: [
      { id: "subscriptions", label: "Üyelikler", icon: CreditCard },
      { id: "gifts",         label: "Hediye Abonelik", icon: Gift },
      { id: "payments",      label: "Ödemeler", icon: DollarSign },
      { id: "withdrawals",   label: "Para Çekme Talepleri", icon: Wallet },
      { id: "revenue-proj",  label: "Gelir Projeksiyonu", icon: TrendingUp },
    ],
  },
  {
    id: "security",
    label: "Güvenlik",
    icon: ShieldAlert,
    tabs: [
      { id: "security", label: "Güvenlik", icon: Shield },
    ],
  },
  {
    id: "system",
    label: "Sistem & Entegrasyon",
    icon: Wrench,
    tabs: [
      { id: "site",          label: "Site Ayarları", icon: Settings2 },
      { id: "cdn",           label: "CDN & Depolama", icon: HardDrive },
      { id: "integrations",  label: "Entegrasyonlar", icon: Link2 },
      { id: "api-endpoints", label: "API Endpoint'ler", icon: Code2 },
      { id: "features",      label: "Özellikler", icon: ToggleLeft },
    ],
  },
];

const TABS = GROUPS.flatMap(g => g.tabs);

function StatCard({ label, value, sub, icon: Icon, color }: { label: string; value: any; sub?: string; icon: any; color?: string }) {
  return (
    <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[13px] text-[#888] mb-1">{label}</p>
          <p className={cn("text-2xl font-bold", color || "text-white")}>{value ?? "—"}</p>
          {sub && <p className="text-xs text-[#666] mt-1">{sub}</p>}
        </div>
        <div className="p-2.5 rounded-lg bg-[#2a2a2a]">
          <Icon className={cn("h-5 w-5", color || "text-[#aaa]")} />
        </div>
      </div>
    </div>
  );
}

export default function Admin() {
  const { user } = useAuth();
  const [tab, setTab] = useState("dashboard");
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const { data: dashboard } = useGetAdminDashboard();
  const pendingCounts = usePendingCounts();
  const counts: Record<string, number> = { ...pendingCounts, reports: dashboard?.pendingReports ?? 0 };

  const activeGroupId = GROUPS.find(g => g.tabs.some(t => t.id === tab))?.id;

  useEffect(() => {
    const handler = (e: Event) => {
      const target = (e as CustomEvent).detail;
      if (target) setTab(target);
    };
    window.addEventListener("admin:goto", handler);
    return () => window.removeEventListener("admin:goto", handler);
  }, []);

  const q = search.trim().toLocaleLowerCase("tr");
  const filteredGroups = GROUPS.map(g => ({
    ...g,
    tabs: q ? g.tabs.filter(t => t.label.toLocaleLowerCase("tr").includes(q)) : g.tabs,
  })).filter(g => g.tabs.length > 0);

  const isGroupOpen = (groupId: string) => {
    if (q) return true;
    if (collapsed[groupId] === undefined) return groupId === activeGroupId || groupId === "overview";
    return !collapsed[groupId];
  };

  if (!user || (user.role !== "admin" && user.role !== "moderator")) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-96 gap-4">
          <AlertTriangle className="h-12 w-12 text-destructive" />
          <p className="text-lg font-semibold">Erişim Yok</p>
          <p className="text-muted-foreground text-sm">Bu sayfaya yalnızca adminler erişebilir.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#111] flex flex-col">
        <div className="md:hidden overflow-x-auto flex border-b border-[#222] bg-[#161616] shrink-0">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={cn("flex items-center gap-2 px-4 py-3 text-sm whitespace-nowrap transition-colors border-b-2", tab === t.id ? "border-primary text-primary font-semibold" : "border-transparent text-[#888] hover:text-white")}>
              <t.icon className="h-4 w-4" />{t.label}
              {!!counts[t.id] && <span className="min-w-[16px] h-[16px] px-1 rounded-full bg-red-500/90 text-white text-[9px] font-bold flex items-center justify-center">{counts[t.id] > 99 ? "99+" : counts[t.id]}</span>}
            </button>
          ))}
        </div>
        <div className="flex flex-1">
          <aside className="w-64 min-h-screen bg-[#161616] border-r border-[#222] pt-6 shrink-0 hidden md:flex md:flex-col">
            <div className="px-4 mb-4">
              <div className="text-[11px] font-bold text-[#555] uppercase tracking-widest mb-1">Admin Panel</div>
              <div className="text-sm text-[#888]">@{user.username}</div>
            </div>
            <div className="px-3 mb-3 relative">
              <Search className="absolute left-5.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#555] pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Sekme ara…"
                className="w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder:text-[#555] focus:outline-none focus:border-primary/50"
              />
            </div>
            <nav className="space-y-1 px-2 overflow-y-auto flex-1 pb-6">
              {filteredGroups.length === 0 && (
                <p className="text-xs text-[#555] px-3 py-4 text-center">Sonuç bulunamadı</p>
              )}
              {filteredGroups.map((g) => {
                const open = isGroupOpen(g.id);
                const groupCount = g.tabs.reduce((sum, t) => sum + (counts[t.id] || 0), 0);
                return (
                  <div key={g.id} className="mb-1">
                    <button
                      onClick={() => setCollapsed(c => ({ ...c, [g.id]: !open }))}
                      className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wide text-[#666] hover:text-[#999] transition-colors"
                    >
                      <g.icon className="h-3.5 w-3.5 shrink-0" />
                      <span className="flex-1 text-left">{g.label}</span>
                      <CountBadge count={groupCount} />
                      <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open ? "rotate-0" : "-rotate-90")} />
                    </button>
                    {open && (
                      <div className="space-y-0.5 mt-0.5">
                        {g.tabs.map((t) => (
                          <button key={t.id} onClick={() => setTab(t.id)} className={cn("w-full flex items-center gap-3 pl-8 pr-3 py-2 rounded-lg text-sm transition-colors text-left", tab === t.id ? "bg-primary/15 text-primary font-semibold" : "text-[#aaa] hover:bg-[#222] hover:text-white")}>
                            <t.icon className="h-4 w-4 shrink-0" />
                            <span className="flex-1">{t.label}</span>
                            <CountBadge count={counts[t.id]} />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          </aside>
          <main className="flex-1 p-4 md:p-6">
            <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>}>
            {tab === "dashboard" && (
              <div className="space-y-6 max-w-5xl">
                <h1 className="text-2xl font-bold">Genel Bakış</h1>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard label="Toplam Kullanıcı" value={dashboard?.totalUsers} sub={`+${dashboard?.newUsersThisWeek ?? 0} bu hafta`} icon={Users} />
                  <StatCard label="Toplam Video" value={dashboard?.totalVideos} sub={`+${dashboard?.newVideosThisWeek ?? 0} bu hafta`} icon={Video} />
                  <StatCard label="Bekleyen Rapor" value={dashboard?.pendingReports} icon={AlertTriangle} color="text-red-400" />
                  <StatCard label="Toplam Gelir" value={`$${Number(dashboard?.totalRevenue ?? 0).toFixed(2)}`} icon={DollarSign} color="text-primary" />
                </div>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl p-5">
                    <h2 className="font-bold mb-4 flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-red-400" /> Son Raporlar</h2>
                    {dashboard?.recentReports?.length ? (
                      <div className="space-y-3">
                        {dashboard.recentReports.map(r => (
                          <div key={r.id} className="flex items-center justify-between p-3 bg-[#252525] rounded-lg text-sm">
                            <div>
                              <p className="font-medium text-[#ddd]">{r.reason}</p>
                              <p className="text-xs text-[#666] mt-0.5">@{r.reporter?.username} • {r.status}</p>
                            </div>
                            <span className={cn("text-xs px-2 py-0.5 rounded-full", r.status === "pending" ? "bg-red-900/50 text-red-400" : "bg-green-900/50 text-green-400")}>{r.status}</span>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-[#555] text-sm text-center py-6">Rapor yok</p>}
                  </div>
                  <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl p-5">
                    <h2 className="font-bold mb-4 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> Top Yaratıcılar</h2>
                    {dashboard?.topCreators?.length ? (
                      <div className="space-y-3">
                        {dashboard.topCreators.map((c, i) => (
                          <div key={c.id} className="flex items-center gap-3">
                            <span className="text-[#555] text-sm w-5">{i + 1}</span>
                            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">{c.username?.substring(0,2).toUpperCase()}</div>
                            <div className="flex-1"><p className="text-sm font-medium">{c.displayName || c.username}</p><p className="text-xs text-[#666]">{c.followerCount} takipçi</p></div>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-[#555] text-sm text-center py-6">Veri yok</p>}
                  </div>
                </div>
              </div>
            )}
            {tab === "videos" && <AdminVideos />}
            {tab === "users" && <AdminUsers />}
            {tab === "creators" && <AdminCreators />}
            {tab === "applications" && <AdminCreatorApplications />}
            {tab === "ads" && <AdminAds />}
            {tab === "reports" && <AdminReports />}
            {tab === "subscriptions" && <AdminSubscriptions />}
            {tab === "cdn" && <AdminCDN />}
            {tab === "integrations" && <AdminIntegrations />}
            {tab === "payments" && <AdminPayments />}
            {tab === "security" && <AdminSecurity />}
            {tab === "site" && <AdminSiteSettings />}
            {tab === "api-endpoints" && <AdminApiEndpoints />}
            {tab === "affiliate" && <AdminAffiliate />}
            {tab === "badges" && <AdminBadges />}
            {tab === "pages" && <AdminCustomPages />}
            {tab === "watch-insights" && <AdminWatchInsights />}
            {tab === "video-dashboard" && <AdminVideoDashboard />}
            {tab === "visitors" && <AdminVisitorMap />}
            {tab === "ab-tests" && <AdminABTests />}
            {tab === "revenue-proj" && <AdminRevenueProjection />}
            {tab === "email" && <AdminEmailCampaigns />}
            {tab === "gifts" && <AdminGiftSubscriptions />}
            {tab === "features" && <AdminFeatureFlags />}
            {tab === "crosspost-monitor" && <AdminCrosspostMonitor />}
            {tab === "home-filters" && <AdminHomeFilters />}
            {tab === "moderation" && <AdminModeration />}
            {tab === "withdrawals" && <AdminWithdrawals />}
            {tab === "health" && (
              <div className="space-y-6 max-w-5xl">
                <h1 className="text-2xl font-bold">Sağlık Monitörü</h1>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard label="API Durumu" value="OK" sub="Son kontrol: şimdi" icon={HeartPulse} color="text-green-400" />
                  <StatCard label="Yeni Kullanıcı" value={dashboard?.newUsersThisWeek ?? 0} sub="Son 7 gün" icon={Users} />
                  <StatCard label="Yeni Video" value={dashboard?.newVideosThisWeek ?? 0} sub="Son 7 gün" icon={Video} />
                  <StatCard label="Açık Uyarı" value={dashboard?.pendingReports ?? 0} sub="Bekleyen raporlar" icon={AlertTriangle} color={dashboard?.pendingReports ? "text-red-400" : "text-green-400"} />
                </div>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl p-5 space-y-3">
                    <h2 className="font-bold flex items-center gap-2"><HeartPulse className="h-4 w-4 text-green-400" /> Genel Durum</h2>
                    <div className="flex items-center justify-between text-sm py-1.5 border-b border-[#252525]">
                      <span className="text-[#888]">Toplam kullanıcı</span><span className="font-medium">{dashboard?.totalUsers ?? "—"}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm py-1.5 border-b border-[#252525]">
                      <span className="text-[#888]">Toplam video</span><span className="font-medium">{dashboard?.totalVideos ?? "—"}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm py-1.5 border-b border-[#252525]">
                      <span className="text-[#888]">Toplam gelir</span><span className="font-medium text-primary">${Number(dashboard?.totalRevenue ?? 0).toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm py-1.5">
                      <span className="text-[#888]">Bekleyen rapor</span>
                      <span className={cn("font-medium", dashboard?.pendingReports ? "text-red-400" : "text-green-400")}>{dashboard?.pendingReports ?? 0}</span>
                    </div>
                  </div>
                  <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl p-5">
                    <h2 className="font-bold mb-3 flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-400" /> Dikkat Gerektirenler</h2>
                    {(dashboard?.pendingReports ?? 0) > 0 ? (
                      <button onClick={() => setTab("reports")} className="w-full text-left text-sm bg-red-900/20 border border-red-900/30 rounded-lg p-3 hover:bg-red-900/30 transition-colors">
                        {dashboard?.pendingReports} bekleyen rapor var — incelemek için tıkla
                      </button>
                    ) : (
                      <p className="text-sm text-[#555] py-4 text-center">Bekleyen bir sorun yok, sistem sağlıklı.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
            </Suspense>
          </main>
        </div>
      </div>
    </AppLayout>
  );
}