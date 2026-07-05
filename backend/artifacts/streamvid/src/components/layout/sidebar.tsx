import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useSidebar } from "@/lib/sidebar-context";
import { useNotifications } from "@/lib/use-notifications";
import { useSiteConfig } from "@/lib/use-site-config";
import { usePublicSiteSettings } from "@/lib/use-public-site-settings";
import {
  X, PlayCircle, FastForward, ThumbsUp, Flame, Star,
  ChevronDown, ChevronUp, ChevronRight, ListVideo, Image, Users, Shield,
  History, Bookmark, Bell, PlusCircle, LayoutDashboard,
  ShieldAlert, LogIn, BarChart3, Smartphone, TrendingUp,
  Heart, UserCheck, Tv, ShoppingBag, BookOpen, Settings2, Radio, Download,
  Trophy, MessageSquare, Crown, Share2, Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useListCategories } from "@workspace/api-client-react";
import { useCrosspostBadge } from "@/hooks/use-crosspost-badge";
import { useFeatureState } from "@/lib/feature-flags";
import { toast } from "sonner";

function Row({
  icon: Icon, label, href, onClick, active, flag, badge,
  expandable, expanded, onToggle, sub = false, featureKey,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string; href?: string; onClick?: () => void;
  active?: boolean; flag?: string; badge?: number; expandable?: boolean;
  expanded?: boolean; onToggle?: () => void; sub?: boolean; featureKey?: string;
}) {
  const ffState = featureKey ? useFeatureState(featureKey) : "enabled";
  if (ffState === "disabled") return null;
  const isMaint = ffState === "maintenance";

  const handleClick = isMaint
    ? (e: React.MouseEvent) => { e.preventDefault(); toast("Bu bölüm şu anda bakımda 🔧"); }
    : onToggle;

  const inner = (
    <div className={cn(
      "flex items-center gap-3.5 px-4 py-3 text-[15px] cursor-pointer transition-colors border-b border-[#2c2c2c] select-none",
      sub ? "pl-9 text-[14px]" : "",
      isMaint ? "opacity-50" : active ? "bg-[#303030] text-white font-medium" : "text-[#d0d0d0] hover:bg-[#252525] hover:text-white",
      expandable && "pr-4"
    )} onClick={handleClick}>
      {Icon && <Icon className={cn("shrink-0", sub ? "h-4 w-4 text-[#666]" : "h-[18px] w-[18px] text-[#bbb]")} />}
      <span className="flex-1 leading-tight">{label}</span>
      {isMaint && <Wrench className="h-3.5 w-3.5 text-yellow-500/60 shrink-0" />}
      {!isMaint && badge != null && badge > 0 && (
        <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-white text-[11px] font-bold flex items-center justify-center leading-none shrink-0 animate-pulse">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
      {flag && <span className="text-lg">{flag}</span>}
      {expandable && (expanded
        ? <ChevronUp className="h-4 w-4 text-[#888] shrink-0" />
        : <ChevronDown className="h-4 w-4 text-[#888] shrink-0" />)}
    </div>
  );
  if (isMaint) return inner;
  if (href && !onToggle) return <Link href={href} onClick={onClick}>{inner}</Link>;
  return inner;
}

function SectionDivider({ label }: { label?: string }) {
  if (!label) return <div className="h-px bg-[#2c2c2c]" />;
  return <div className="px-4 pt-4 pb-1 text-[11px] font-semibold text-[#666] uppercase tracking-widest">{label}</div>;
}

function CommunityGrid({ items, onClose }: { items: { icon: React.ComponentType<{ className?: string }>; label: string; href: string }[]; onClose: () => void }) {
  return (
    <div className="grid grid-cols-2 gap-px bg-[#2c2c2c] border-b border-[#2c2c2c]">
      {items.map((item) => (
        <Link key={item.label} href={item.href} onClick={onClose}>
          <div className="flex flex-col items-start gap-2 px-4 py-3.5 bg-[#1b1b1b] hover:bg-[#252525] transition-colors cursor-pointer">
            <item.icon className="h-5 w-5 text-[#aaa]" />
            <span className="text-[13px] text-[#ccc] leading-tight">{item.label}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}

export function Sidebar() {
  const { open, close: onClose } = useSidebar();
  const [location] = useLocation();
  const { user } = useAuth();
  const { config } = useSiteConfig();
  const { settings: siteSettings } = usePublicSiteSettings();
  const siteName = siteSettings.siteName || "Prnhbbbb";

  const ffVideos = useFeatureState("videos");
  const ffShorts = useFeatureState("shorts");
  const ffCreators = useFeatureState("creators");
  const ffCategories = useFeatureState("categories");
  const ffPlaylists = useFeatureState("playlists");
  const ffStories = useFeatureState("stories");
  const ffLive = useFeatureState("live_streams");
  const ffLeaderboard = useFeatureState("leaderboard");
  const ffMatch = useFeatureState("match");
  const ffHistory = useFeatureState("history");
  const ffBookmarks = useFeatureState("bookmarks");
  const ffNotifications = useFeatureState("notifications");
  const ffDownloads = useFeatureState("downloads");
  const ffUpload = useFeatureState("upload");
  const ffCreatorDash = useFeatureState("creator_dashboard");
  const ffDm = useFeatureState("dm_messages");
  const ffSearch = useFeatureState("search");

  const [modelsExpanded, setModelsExpanded] = useState(false);
  const [topCatsExpanded, setTopCatsExpanded] = useState(false);
  const [communityExpanded, setCommunityExpanded] = useState(false);

  const { data: categoriesData } = useListCategories();
  const categories: any[] = Array.isArray(categoriesData) ? categoriesData : (categoriesData as any)?.categories ?? [];

  const isCreator = user?.role === "creator";
  const isAdmin = user?.role === "admin";
  const crosspostBadge = useCrosspostBadge();

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // helper: check nav item enabled
  const nav = (id: string) => config.nav[id] ?? { label: "", enabled: true };
  const sec = (id: string) => config.sections[id] ?? { label: "", enabled: true };

  const modelTypes = [
    { label: "Podyum & Runway", href: "/search?q=podyum" },
    { label: "Haute Couture", href: "/search?q=haute+couture" },
    { label: "Lingerie", href: "/search?q=lingerie" },
    { label: "Swimwear", href: "/search?q=swimwear" },
    { label: "Editorial", href: "/search?q=editorial" },
    { label: "Streetwear", href: "/search?q=streetwear" },
  ];

  const topCategories = [...categories].sort((a, b) => (b.videoCount ?? 0) - (a.videoCount ?? 0)).slice(0, 12);

  const communityItems = [
    { icon: Shield, label: "Güven & Güvenlik", href: "/help" },
    { icon: UserCheck, label: "Creator Merkezi", href: "/creators" },
    { icon: BookOpen, label: "Blog", href: "/blog" },
    { icon: BarChart3, label: "İstatistikler", href: "/creator/dashboard" },
    { icon: Heart, label: "Sağlık & Wellness", href: "/categories" },
    { icon: ShoppingBag, label: "Mağaza", href: "/pricing" },
  ];

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/75" onClick={onClose} />}

      <aside className={cn(
        "fixed left-0 top-0 z-50 h-full w-[300px] max-w-[88vw] bg-[#1b1b1b] flex flex-col shadow-2xl transition-transform duration-250 ease-out",
        open ? "translate-x-0" : "-translate-x-full"
      )} style={{ willChange: "transform" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#2c2c2c] shrink-0">
          <Link href="/" onClick={onClose}>
            <div className="flex items-center gap-1 cursor-pointer">
              {siteSettings.logoUrl ? (
                <img src={siteSettings.logoUrl} alt={siteName} className="h-7 object-contain" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
              ) : (
                <>
                  <div className="bg-primary text-white px-1.5 py-0.5 rounded text-[17px] font-black leading-none">{siteName[0]}</div>
                  <span className="text-[17px] font-black text-white tracking-tight">{siteName.slice(1)}</span>
                </>
              )}
            </div>
          </Link>
          <button className="text-white w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 transition-colors" onClick={onClose}>
            <X className="h-5 w-5 text-[#f90]" />
          </button>
        </div>

        {/* PWA Banner */}
        {nav("pwa-banner").enabled && (
          <div className="mx-3 my-3 p-3 bg-[#252525] rounded-lg border border-[#333] flex gap-3 items-start shrink-0">
            <div className="bg-primary rounded p-1.5 shrink-0">
              <Smartphone className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] text-[#ccc] leading-snug">
                Uygulamayı telefonuna yükle!{" "}
                <span className="font-bold text-white">Gizli, ücretsiz, güvenli.</span>
              </p>
              <div className="flex gap-2 mt-2">
                <button className="text-[11px] border border-[#f90] text-[#f90] rounded px-3 py-1 hover:bg-[#f90]/10 transition-colors font-medium">Yükle</button>
                <button className="text-[11px] text-[#888] hover:text-white transition-colors">Daha Sonra</button>
              </div>
            </div>
          </div>
        )}

        {/* Scrollable nav */}
        <div className="flex-1 overflow-y-auto overscroll-contain">

          {nav("videos").enabled && (
            <Row icon={PlayCircle} label={nav("videos").label} href="/videos?sort=trending" onClick={onClose} active={location === "/videos"} featureKey="videos" />
          )}
          {nav("shorts").enabled && (
            <Row icon={FastForward} label={nav("shorts").label} href="/shorts" onClick={onClose} active={location === "/shorts"} featureKey="shorts" />
          )}
          {nav("recommended").enabled && (
            <Row icon={ThumbsUp} label={nav("recommended").label} href="/videos?sort=most_liked" onClick={onClose} featureKey="videos" />
          )}
          {nav("trending").enabled && (
            <Row icon={Flame} label={nav("trending").label} href="/videos?sort=trending" onClick={onClose} flag="🇹🇷" featureKey="videos" />
          )}

          {nav("models").enabled && (
            <Row icon={Star} label={nav("models").label} expandable expanded={modelsExpanded} onToggle={() => setModelsExpanded(p => !p)} featureKey="creators" />
          )}
          {nav("models").enabled && modelsExpanded && ffCreators !== "disabled" && (
            <div className="bg-[#161616]">
              {modelTypes.map(m => (
                <Row key={m.label} icon={PlayCircle} label={m.label} href={m.href} onClick={onClose} sub active={location === m.href} featureKey="creators" />
              ))}
            </div>
          )}

          {nav("channels").enabled && (
            <Row icon={Tv} label={nav("channels").label} href="/creators" onClick={onClose} featureKey="creators" />
          )}

          {nav("top-cats").enabled && (
            <Row icon={TrendingUp} label={nav("top-cats").label} expandable expanded={topCatsExpanded} onToggle={() => setTopCatsExpanded(p => !p)} featureKey="categories" />
          )}
          {nav("top-cats").enabled && topCatsExpanded && ffCategories !== "disabled" && (
            <div className="bg-[#161616]">
              {topCategories.length === 0 ? (
                <div className="px-9 py-3 text-[13px] text-[#555]">Kategori yok</div>
              ) : (
                topCategories.map((cat: any) => (
                  <Row key={cat.id} icon={TrendingUp} label={`${cat.name}${cat.videoCount > 0 ? ` (${cat.videoCount})` : ''}`} href={`/categories/${cat.id}`} onClick={onClose} sub featureKey="categories" />
                ))
              )}
              <Link href="/categories" onClick={onClose}>
                <div className="flex items-center justify-center gap-1.5 py-3 border-b border-[#2c2c2c] text-[12px] text-[#555] hover:text-[#888] transition-colors">
                  <ChevronDown className="h-4 w-4" /> Tümünü Gör
                </div>
              </Link>
            </div>
          )}

          {nav("all-categories").enabled && ffCategories !== "disabled" && (
            <Link href="/categories" onClick={onClose}>
              <div className="mx-4 my-3 py-2.5 bg-[#2a2a2a] hover:bg-[#333] transition-colors rounded text-center text-sm text-[#ccc] font-medium border border-[#383838] cursor-pointer">
                {nav("all-categories").label}
              </div>
            </Link>
          )}

          {nav("playlists").enabled && (
            <Row icon={ListVideo} label={nav("playlists").label} href="/playlists" onClick={onClose} active={location === "/playlists"} featureKey="playlists" />
          )}
          {nav("stories").enabled && (
            <Row icon={Image} label={nav("stories").label} href="/stories" onClick={onClose} active={location === "/stories"} featureKey="stories" />
          )}
          <Row icon={Radio} label="Canlı Yayınlar" href="/live" onClick={onClose} active={location === "/live"} flag="🔴" featureKey="live_streams" />
          <Row icon={Trophy} label="Sadakat Sıralaması" href="/leaderboard" onClick={onClose} active={location === "/leaderboard"} featureKey="leaderboard" />
          <Row icon={MessageSquare} label="Rastgele Eşleşme" href="/match" onClick={onClose} active={location === "/match"} featureKey="match" />
          {nav("photos").enabled && (
            <Row icon={Image} label={nav("photos").label} href="/videos" onClick={onClose} featureKey="videos" />
          )}

          {nav("community").enabled && (
            <>
              <Row icon={Users} label={nav("community").label} expandable expanded={communityExpanded} onToggle={() => setCommunityExpanded(p => !p)} />
              {communityExpanded && <CommunityGrid items={communityItems} onClose={onClose} />}
            </>
          )}

          {/* Hesabım */}
          {user && sec("section-account").enabled && (
            <>
              <SectionDivider label={sec("section-account").label} />
              {nav("history").enabled && <Row icon={History} label={nav("history").label} href="/history" onClick={onClose} active={location === "/history"} featureKey="history" />}
              {nav("bookmarks").enabled && <Row icon={Bookmark} label={nav("bookmarks").label} href="/bookmarks" onClick={onClose} active={location === "/bookmarks"} featureKey="bookmarks" />}
              {nav("notifications").enabled && <Row icon={Bell} label={nav("notifications").label} href="/notifications" onClick={onClose} active={location === "/notifications"} featureKey="notifications" />}
              <Row icon={Download} label="İndirilenler" href="/downloads" onClick={onClose} active={location === "/downloads"} featureKey="downloads" />
              {ffDm !== "disabled" && <Row icon={MessageSquare} label="Mesajlar" href="/messages" onClick={onClose} active={location.startsWith("/messages")} featureKey="dm_messages" />}
            </>
          )}

          {/* Creator Ol CTA — sadece normal kullanıcılara */}
          {user && !isCreator && (
            <div className="px-3 pt-1 pb-2">
              <Link href="/become-creator" onClick={onClose}>
                <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-primary/10 border border-primary/20 hover:bg-primary/15 transition-colors cursor-pointer group">
                  <Crown className="h-4 w-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-primary leading-tight">Creator Ol</p>
                    <p className="text-[10px] text-primary/60 mt-0.5">İçerik üret, gelir kazan</p>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-primary/50 group-hover:text-primary transition-colors" />
                </div>
              </Link>
            </div>
          )}

          {/* Creator */}
          {isCreator && sec("section-creator").enabled && (
            <>
              <SectionDivider label={sec("section-creator").label} />
              {nav("upload").enabled && <Row icon={PlusCircle} label={nav("upload").label} href="/upload" onClick={onClose} featureKey="upload" />}
              {nav("creator-dash").enabled && <Row icon={LayoutDashboard} label={nav("creator-dash").label} href="/creator/dashboard" onClick={onClose} featureKey="creator_dashboard" />}
            </>
          )}

          {/* Admin */}
          {isAdmin && sec("section-admin").enabled && (
            <>
              <SectionDivider label={sec("section-admin").label} />
              {nav("admin-panel").enabled && <Row icon={ShieldAlert} label={nav("admin-panel").label} href="/admin" onClick={onClose} />}
              <Row icon={Share2} label="Crosspost Görevleri" href="/crosspost-jobs" onClick={onClose} badge={crosspostBadge} />
            </>
          )}


          {/* Login CTA */}
          {!user && (
            <div className="px-4 pb-6 pt-2 space-y-2 border-t border-[#2c2c2c]">
              <p className="text-[13px] text-[#777] mb-3">Beğenmek, yorum yapmak ve abone olmak için giriş yap.</p>
              <Link href="/login" onClick={onClose}>
                <div className="w-full py-2.5 bg-primary hover:bg-primary/90 transition-colors rounded text-center text-sm text-white font-semibold flex items-center justify-center gap-2 cursor-pointer">
                  <LogIn className="h-4 w-4" /> Giriş Yap
                </div>
              </Link>
              <Link href="/register" onClick={onClose}>
                <div className="w-full py-2.5 bg-transparent hover:bg-white/5 border border-[#444] transition-colors rounded text-center text-sm text-[#ccc] font-medium cursor-pointer mt-2">
                  Üye Ol
                </div>
              </Link>
            </div>
          )}

          <div className="h-6" />
        </div>
      </aside>
    </>
  );
}
