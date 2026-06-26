import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useSidebar } from "@/lib/sidebar-context";
import {
  X,
  PlayCircle,
  FastForward,
  ThumbsUp,
  Flame,
  Star,
  ChevronDown,
  ChevronUp,
  ListVideo,
  Image,
  Users,
  Shield,
  History,
  Bookmark,
  Bell,
  PlusCircle,
  LayoutDashboard,
  ShieldAlert,
  LogIn,
  BarChart3,
  Smartphone,
  TrendingUp,
  Heart,
  UserCheck,
  Tv,
  ShoppingBag,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useListCategories } from "@workspace/api-client-react";
import { Switch } from "@/components/ui/switch";

function Row({
  icon: Icon,
  label,
  href,
  onClick,
  active,
  flag,
  expandable,
  expanded,
  onToggle,
  sub = false,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  href?: string;
  onClick?: () => void;
  active?: boolean;
  flag?: string;
  expandable?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  sub?: boolean;
}) {
  const inner = (
    <div
      className={cn(
        "flex items-center gap-3.5 px-4 py-3 text-[15px] cursor-pointer transition-colors border-b border-[#2c2c2c] select-none",
        sub ? "pl-9 text-[14px]" : "",
        active
          ? "bg-[#303030] text-white font-medium"
          : "text-[#d0d0d0] hover:bg-[#252525] hover:text-white",
        expandable && "pr-4"
      )}
      onClick={onToggle}
    >
      {Icon && (
        <Icon
          className={cn(
            "shrink-0",
            sub ? "h-4 w-4 text-[#666]" : "h-[18px] w-[18px] text-[#bbb]"
          )}
        />
      )}
      <span className="flex-1 leading-tight">{label}</span>
      {flag && <span className="text-lg">{flag}</span>}
      {expandable &&
        (expanded ? (
          <ChevronUp className="h-4 w-4 text-[#888] shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-[#888] shrink-0" />
        ))}
    </div>
  );

  if (href && !onToggle) {
    return (
      <Link href={href} onClick={onClick}>
        {inner}
      </Link>
    );
  }
  return inner;
}

function SectionDivider({ label }: { label?: string }) {
  if (!label) return <div className="h-px bg-[#2c2c2c]" />;
  return (
    <div className="px-4 pt-4 pb-1 text-[11px] font-semibold text-[#666] uppercase tracking-widest">
      {label}
    </div>
  );
}

function CommunityGrid({
  items,
  onClose,
}: {
  items: { icon: React.ComponentType<{ className?: string }>; label: string; href: string }[];
  onClose: () => void;
}) {
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
  const [modelsExpanded, setModelsExpanded] = useState(false);
  const [topCatsExpanded, setTopCatsExpanded] = useState(false);
  const [communityExpanded, setCommunityExpanded] = useState(false);
  const [personalRecs, setPersonalRecs] = useState(true);

  const { data: categoriesData } = useListCategories();
  const categories = categoriesData?.categories ?? [];

  const isCreator = user?.role === "creator" || user?.role === "admin";
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const modelTypes = [
    { label: "Podyum & Runway", href: "/search?q=podyum" },
    { label: "Haute Couture", href: "/search?q=haute+couture" },
    { label: "Lingerie", href: "/search?q=lingerie" },
    { label: "Swimwear", href: "/search?q=swimwear" },
    { label: "Editorial", href: "/search?q=editorial" },
    { label: "Streetwear", href: "/search?q=streetwear" },
  ];

  const topCategories = [
    "18-25", "Plus Size", "Fitness", "Commercial",
    "Vintage", "Haute Couture", "Swimwear", "Editorial",
    "Podyum", "Lingerie",
  ];

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
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/75"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-full w-[300px] max-w-[88vw] bg-[#1b1b1b] flex flex-col shadow-2xl transition-transform duration-250 ease-out",
          open ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ willChange: "transform" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#2c2c2c] shrink-0">
          <Link href="/" onClick={onClose}>
            <div className="flex items-center gap-1 cursor-pointer">
              <div className="bg-primary text-white px-1.5 py-0.5 rounded text-[17px] font-black leading-none">P</div>
              <span className="text-[17px] font-black text-white tracking-tight">rnhbbbb</span>
            </div>
          </Link>
          <button
            className="text-white w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 transition-colors"
            onClick={onClose}
          >
            <X className="h-5 w-5 text-[#f90]" />
          </button>
        </div>

        {/* Install PWA banner */}
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
              <button className="text-[11px] border border-[#f90] text-[#f90] rounded px-3 py-1 hover:bg-[#f90]/10 transition-colors font-medium">
                Yükle
              </button>
              <button className="text-[11px] text-[#888] hover:text-white transition-colors">
                Daha Sonra
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable nav */}
        <div className="flex-1 overflow-y-auto overscroll-contain">

          <Row icon={PlayCircle} label="Öne Çıkan Videolar" href="/videos?sort=trending" onClick={onClose} active={location === "/videos"} />
          <Row icon={FastForward} label="Kısa Videolar" href="/shorts" onClick={onClose} active={location === "/shorts"} />
          <Row icon={ThumbsUp} label="Önerilen Videolar" href="/videos?sort=most_liked" onClick={onClose} />
          <Row icon={Flame} label="Trend — Türkiye" href="/videos?sort=trending" onClick={onClose} flag="🇹🇷" />

          <Row
            icon={Star}
            label="Modeller & Starlar"
            expandable
            expanded={modelsExpanded}
            onToggle={() => setModelsExpanded((p) => !p)}
          />
          {modelsExpanded && (
            <div className="bg-[#161616]">
              {modelTypes.map((m) => (
                <Row
                  key={m.label}
                  icon={PlayCircle}
                  label={m.label}
                  href={m.href}
                  onClick={onClose}
                  sub
                  active={location === m.href}
                />
              ))}
            </div>
          )}

          <Row icon={Tv} label="Kanallar" href="/creators" onClick={onClose} />

          <Row
            icon={TrendingUp}
            label="En İyi Kategoriler"
            expandable
            expanded={topCatsExpanded}
            onToggle={() => setTopCatsExpanded((p) => !p)}
          />
          {topCatsExpanded && (
            <div className="bg-[#161616]">
              {topCategories.map((cat) => (
                <Row
                  key={cat}
                  icon={PlayCircle}
                  label={cat}
                  href={`/search?q=${encodeURIComponent(cat)}`}
                  onClick={onClose}
                  sub
                />
              ))}
              <Link href="/categories" onClick={onClose}>
                <div className="flex items-center justify-center py-3 border-b border-[#2c2c2c]">
                  <ChevronDown className="h-5 w-5 text-[#888]" />
                </div>
              </Link>
            </div>
          )}

          <Link href="/categories" onClick={onClose}>
            <div className="mx-4 my-3 py-2.5 bg-[#2a2a2a] hover:bg-[#333] transition-colors rounded text-center text-sm text-[#ccc] font-medium border border-[#383838] cursor-pointer">
              Tüm Kategoriler
            </div>
          </Link>

          <Row icon={ListVideo} label="Oynatma Listeleri" href="/playlists" onClick={onClose} active={location === "/playlists"} />
          <Row icon={Image} label="Hikayeler" href="/stories" onClick={onClose} active={location === "/stories"} />
          <Row icon={Image} label="Fotoğraflar" href="/videos" onClick={onClose} />

          <Row
            icon={Users}
            label="Topluluk"
            expandable
            expanded={communityExpanded}
            onToggle={() => setCommunityExpanded((p) => !p)}
          />
          {communityExpanded && (
            <CommunityGrid items={communityItems} onClose={onClose} />
          )}

          {user && (
            <>
              <SectionDivider label="Hesabım" />
              <Row icon={History} label="İzleme Geçmişi" href="/history" onClick={onClose} active={location === "/history"} />
              <Row icon={Bookmark} label="Kaydedilenler" href="/bookmarks" onClick={onClose} active={location === "/bookmarks"} />
              <Row icon={Bell} label="Bildirimler" href="/notifications" onClick={onClose} active={location === "/notifications"} />
            </>
          )}

          {isCreator && (
            <>
              <SectionDivider label="İçerik Oluşturucu" />
              <Row icon={PlusCircle} label="Video Yükle" href="/upload" onClick={onClose} />
              <Row icon={LayoutDashboard} label="İçerik Paneli" href="/creator/dashboard" onClick={onClose} />
            </>
          )}

          {isAdmin && (
            <>
              <SectionDivider label="Yönetim" />
              <Row icon={ShieldAlert} label="Admin Paneli" href="/admin" onClick={onClose} />
            </>
          )}

          {categories.filter((c) => (c.videoCount ?? 0) > 0).length > 0 && (
            <>
              <SectionDivider label="Kategoriler" />
              {categories
                .filter((c) => (c.videoCount ?? 0) > 0)
                .map((cat) => (
                  <Row
                    key={cat.id}
                    icon={PlayCircle}
                    label={`${cat.name}  (${cat.videoCount})`}
                    href={`/categories/${cat.id}`}
                    onClick={onClose}
                    sub
                  />
                ))}
            </>
          )}

          <div className="flex items-center justify-between px-4 py-4 border-t border-[#2c2c2c] mt-1">
            <span className="text-[14px] text-[#ccc]">Kişiselleştirilmiş Öneriler</span>
            <Switch
              checked={personalRecs}
              onCheckedChange={setPersonalRecs}
              className="data-[state=checked]:bg-[#f90]"
            />
          </div>

          {!user && (
            <div className="px-4 pb-6 pt-2 space-y-2 border-t border-[#2c2c2c]">
              <p className="text-[13px] text-[#777] mb-3">
                Beğenmek, yorum yapmak ve abone olmak için giriş yap.
              </p>
              <Link href="/login" onClick={onClose}>
                <div className="w-full py-2.5 bg-primary hover:bg-primary/90 transition-colors rounded text-center text-sm text-white font-semibold flex items-center justify-center gap-2 cursor-pointer">
                  <LogIn className="h-4 w-4" />
                  Giriş Yap
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
