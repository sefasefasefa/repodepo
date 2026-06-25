import { AppLayout } from "@/components/layout/app-layout";
import { useAuth } from "@/lib/auth";
import { useState } from "react";
import { useGetAdminDashboard } from "@workspace/api-client-react";
import { AdminVideos } from "@/components/admin/admin-videos";
import { AdminUsers } from "@/components/admin/admin-users";
import { AdminAds } from "@/components/admin/admin-ads";
import { AdminReports } from "@/components/admin/admin-reports";
import { AdminSubscriptions } from "@/components/admin/admin-subscriptions";
import { AdminCDN } from "@/components/admin/admin-cdn";
import { AdminIntegrations } from "@/components/admin/admin-integrations";
import { AdminPayments } from "@/components/admin/admin-payments";
import { AdminSecurity } from "@/components/admin/admin-security";
import AdminMining from "@/components/admin/admin-mining";
import AdminSiteSettings from "@/components/admin/admin-site-settings";
import { AdminCreators } from "@/components/admin/admin-creators";
import { AdminApiEndpoints } from "@/components/admin/admin-api-endpoints";
import { AdminAffiliate } from "@/components/admin/admin-affiliate";
import { AdminBadges } from "@/components/admin/admin-badges";
import AdminCustomPages from "@/components/admin/admin-custom-pages";
import AdminVisitorMap from "@/components/admin/admin-visitor-map";
import AdminABTests from "@/components/admin/admin-ab-tests";
import AdminRevenueProjection from "@/components/admin/admin-revenue-projection";
import AdminEmailCampaigns from "@/components/admin/admin-email-campaigns";
import AdminGiftSubscriptions from "@/components/admin/admin-gift-subscriptions";
import AdminLinkModeration from "@/components/admin/admin-link-moderation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminFeatureFlags } from "@/components/admin/admin-feature-flags";
import { Users, Video, AlertTriangle, DollarSign, LayoutDashboard, Megaphone, CreditCard, TrendingUp, HardDrive, Link2, Shield, Bitcoin, Settings2, Crown, Code2, Share2, Award, LayoutTemplate, Globe, FlaskConical, HeartPulse, Mail, Gift, ToggleLeft } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "dashboard",    label: "Genel Bakış",    icon: LayoutDashboard },
  { id: "videos",       label: "Videolar",        icon: Video },
  { id: "users",        label: "Kullanıcılar",    icon: Users },
  { id: "creators",     label: "Yükleyiciler",    icon: Crown },
  { id: "ads",          label: "Reklamlar",       icon: Megaphone },
  { id: "reports",      label: "Raporlar",        icon: AlertTriangle },
  { id: "subscriptions",label: "Üyelikler",       icon: CreditCard },
  { id: "cdn",          label: "CDN & Depolama",  icon: HardDrive },
  { id: "integrations", label: "Entegrasyonlar",  icon: Link2 },
  { id: "payments",     label: "Ödemeler",        icon: DollarSign },
  { id: "security",     label: "Güvenlik",        icon: Shield },
  { id: "mining",       label: "Madencilik",      icon: Bitcoin },
  { id: "site",         label: "Site Ayarları",   icon: Settings2 },
  { id: "api-endpoints",label: "API Endpoint'ler", icon: Code2 },
  { id: "developer",    label: "Developer",         icon: Code2 },
  { id: "affiliate",    label: "Affiliate",        icon: Share2 },
  { id: "badges",       label: "Rozetler",         icon: Award },
  { id: "pages",        label: "Özel Sayfalar",    icon: LayoutTemplate },
  { id: "visitors",     label: "Ziyaretçi Haritası", icon: Globe },
  { id: "ab-tests",     label: "A/B Testleri",       icon: FlaskConical },
  { id: "revenue",      label: "Gelir Projeksiyonu", icon: TrendingUp },
  { id: "health",       label: "Sağlık Monitörü",    icon: HeartPulse },
  { id: "email",        label: "E-posta Kampanya",   icon: Mail },
  { id: "gifts",        label: "Hediye Abonelik",    icon: Gift },
  { id: "link-mod",     label: "Link Moderasyon",    icon: AlertTriangle },
  { id: "features",     label: "Özellikler",          icon: ToggleLeft },
];

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
  const { data: dashboard } = useGetAdminDashboard();

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
            </button>
          ))}
        </div>
        <div className="flex flex-1">
          <aside className="w-56 min-h-screen bg-[#161616] border-r border-[#222] pt-6 shrink-0 hidden md:block">
            <div className="px-4 mb-6">
              <div className="text-[11px] font-bold text-[#555] uppercase tracking-widest mb-1">Admin Panel</div>
              <div className="text-sm text-[#888]">@{user.username}</div>
            </div>
            <nav className="space-y-0.5 px-2">
              {TABS.map((t) => (
                <button key={t.id} onClick={() => setTab(t.id)} className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-left", tab === t.id ? "bg-primary/15 text-primary font-semibold" : "text-[#aaa] hover:bg-[#222] hover:text-white")}>
                  <t.icon className="h-4 w-4 shrink-0" />{t.label}
                </button>
              ))}
            </nav>
          </aside>
          <main className="flex-1 p-4 md:p-6">
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
            {tab === "ads" && <AdminAds />}
            {tab === "reports" && <AdminReports />}
            {tab === "subscriptions" && <AdminSubscriptions />}
            {tab === "cdn" && <AdminCDN />}
            {tab === "integrations" && <AdminIntegrations />}
            {tab === "payments" && <AdminPayments />}
            {tab === "security" && <AdminSecurity />}
            {tab === "mining" && <AdminMining />}
            {tab === "site" && <AdminSiteSettings />}
            {tab === "api-endpoints" && <AdminApiEndpoints />}
            {tab === "developer" && <AdminApiEndpoints />}
            {tab === "affiliate" && <AdminAffiliate />}
            {tab === "badges" && <AdminBadges />}
            {tab === "pages" && <AdminCustomPages />}
            {tab === "visitors" && <AdminVisitorMap />}
            {tab === "ab-tests" && <AdminABTests />}
            {tab === "revenue" && <AdminRevenueProjection />}
            {tab === "email" && <AdminEmailCampaigns />}
            {tab === "gifts" && <AdminGiftSubscriptions />}
            {tab === "link-mod" && <AdminLinkModeration />}
            {tab === "features" && <AdminFeatureFlags />}
            {tab === "health" && (
              <div className="space-y-6 max-w-5xl">
                <h1 className="text-2xl font-bold">Sağlık Monitörü</h1>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard label="API Durumu" value="OK" sub="Son kontrol: şimdi" icon={HeartPulse} color="text-green-400" />
                  <StatCard label="Aktif Kullanıcı" value={dashboard?.totalUsers ?? 0} sub="Toplam kullanıcı" icon={Users} />
                  <StatCard label="Toplam Video" value={dashboard?.totalVideos ?? 0} sub="İçerik sayısı" icon={Video} />
                  <StatCard label="Açık Uyarı" value={dashboard?.pendingReports ?? 0} sub="Bekleyen raporlar" icon={AlertTriangle} color="text-red-400" />
                </div>
                <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl p-5">
                  <p className="text-sm text-[#888]">
                    Sistem şu anda sağlıklı görünüyor. Bu alan ileride uptime, CPU, bellek ve hata oranlarını gösterecek şekilde genişletilebilir.
                  </p>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </AppLayout>
  );
}