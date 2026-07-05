import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useSidebar } from "@/lib/sidebar-context";
import { useNotifications } from "@/lib/use-notifications";
import { useFeatureState } from "@/lib/feature-flags";
import { usePublicSiteSettings } from "@/lib/use-public-site-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Menu, Bell, Plus, X, CheckCheck, Coins, MessageCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { MiningStatus } from "@/components/mining-status";
import { TokenBuyModal } from "@/components/token-buy-modal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { FriendTag } from "@/components/friends/friend-badges";
import { getPresence } from "@/lib/presence";
import { toast } from "sonner";

export function Navbar() {
  const { settings: siteSettings } = usePublicSiteSettings();
  const siteName = siteSettings.siteName || "Prnhbbbb";
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [notifOpen, setNotifOpen] = useState(false);
  const [showTokenBuy, setShowTokenBuy] = useState(false);
  const [tokenBalance, setTokenBalance] = useState<number | null>(null);
  const [dmUnread, setDmUnread] = useState(0);
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const { toggle } = useSidebar();
  const { unreadCount, notifications, markRead, markAllRead, connected } = useNotifications();
  const dmState = useFeatureState("dm_messages");
  const uploadState = useFeatureState("upload");
  const searchState = useFeatureState("search");
  const presence = getPresence();

  useEffect(() => {
    if (!user) return;
    const isMob = typeof window !== "undefined" && window.innerWidth < 1024;
    // Mobilde 5dk, masaüstünde 60s — sekme arka plandayken durdur
    const ms = isMob ? 300_000 : 60_000;
    // Mobilde ilk fetch'i 10s geciktir (sayfa yükü bitmeden istek yok)
    const initDelay = isMob ? 10_000 : 0;
    const load = () =>
      fetch("/api/tokens/balance", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
      })
        .then((r) => r.json())
        .then((d) => setTokenBalance(d.balance ?? 0))
        .catch(() => {});
    let id: ReturnType<typeof setInterval> | null = null;
    const start = () => { if (!id) { load(); id = setInterval(load, ms); } };
    const pause = () => { if (id) { clearInterval(id); id = null; } };
    const onVis = () => document.hidden ? pause() : start();
    const initTimer = setTimeout(start, initDelay);
    document.addEventListener("visibilitychange", onVis);
    return () => { clearTimeout(initTimer); pause(); document.removeEventListener("visibilitychange", onVis); };
  }, [user]);

  useEffect(() => {
    if (!user || dmState === "disabled") return;
    const isMob = typeof window !== "undefined" && window.innerWidth < 1024;
    // Mobilde 90s, masaüstünde 10s — sekme arka plandayken durdur
    const ms = isMob ? 90_000 : 10_000;
    // Mobilde ilk fetch'i 15s geciktir
    const initDelay = isMob ? 15_000 : 0;
    const loadDm = () =>
      fetch("/api/messages/unread-count", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
      })
        .then((r) => r.json())
        .then((d) => setDmUnread(d.count ?? 0))
        .catch(() => {});
    let id: ReturnType<typeof setInterval> | null = null;
    const start = () => { if (!id) { loadDm(); id = setInterval(loadDm, ms); } };
    const pause = () => { if (id) { clearInterval(id); id = null; } };
    const onVis = () => document.hidden ? pause() : start();
    const initTimer = setTimeout(start, initDelay);
    document.addEventListener("visibilitychange", onVis);
    return () => { clearTimeout(initTimer); pause(); document.removeEventListener("visibilitychange", onVis); };
  }, [user, dmState]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchState === "maintenance") return toast("Bu özellik bakımdadır");
    if (searchQuery.trim()) {
      setLocation(`/search?q=${encodeURIComponent(searchQuery)}`);
      setSearchOpen(false);
    }
  };

  return (
    <>
      <nav className="fixed top-0 z-50 w-full bg-[#1b1b1b] border-b border-[#333]">
        <div className="flex h-14 items-center px-3 gap-2">
          {/* Hamburger */}
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 text-white hover:bg-white/10"
            onClick={toggle}
          >
            <Menu className="h-6 w-6" />
          </Button>

          {/* Logo */}
          <Link href="/">
            <div className="flex items-center gap-1 cursor-pointer">
              {siteSettings.logoUrl ? (
                <img
                  src={siteSettings.logoUrl}
                  alt={siteName}
                  className="h-7 object-contain"
                  loading="eager"
                  decoding="async"
                  onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              ) : (
                <>
                  <div className="bg-primary text-primary-foreground px-2 py-0.5 rounded font-black text-lg leading-none">
                    {siteName[0]}
                  </div>
                  <span className="font-black text-lg tracking-tight text-white hidden sm:block">
                    {siteName.slice(1)}
                  </span>
                </>
              )}
            </div>
          </Link>

          {/* Desktop search */}
          {!searchOpen && searchState !== "disabled" && (
            <form onSubmit={handleSearch} className="hidden sm:flex flex-1 mx-4 max-w-xl">
              <Input
                type="search"
                placeholder="Video ara..."
                className="rounded-r-none border-[#444] bg-[#111] text-white placeholder:text-[#777] focus-visible:ring-0 focus-visible:ring-offset-0 h-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Button
                type="submit"
                className="rounded-l-none bg-[#444] hover:bg-[#555] h-9 px-4 border border-[#444] border-l-0"
              >
                <Search className="h-4 w-4 text-white" />
              </Button>
            </form>
          )}

          {/* Mobile search expanded */}
          {searchOpen && searchState !== "disabled" && (
            <form onSubmit={handleSearch} className="flex flex-1 items-center gap-2">
              <Input
                autoFocus
                type="search"
                placeholder="Video ara..."
                className="flex-1 border-[#444] bg-[#111] text-white placeholder:text-[#777] focus-visible:ring-0 focus-visible:ring-offset-0 h-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-white"
                onClick={() => setSearchOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </form>
          )}

          {/* Mobile search icon */}
          {!searchOpen && searchState !== "disabled" && (
            <Button
              variant="ghost"
              size="icon"
              className="sm:hidden text-white hover:bg-white/10"
              onClick={() => setSearchOpen(true)}
            >
              <Search className="h-5 w-5" />
            </Button>
          )}

          {/* Right side — authenticated */}
          {user ? (
            <>
              {/* Friend tag desktop */}
              <div className="hidden md:flex items-center gap-2 mr-2">
                <FriendTag label="Arkadaşlar" />
              </div>

              {/* Mining */}
              <MiningStatus />

              {/* Token balance */}
              <button
                onClick={() => setShowTokenBuy(true)}
                className="flex items-center gap-1.5 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/20 hover:border-yellow-500/40 text-yellow-400 rounded-full px-2.5 py-1.5 text-xs font-bold transition-all"
              >
                <Coins className="h-3.5 w-3.5" />
                {tokenBalance === null ? "…" : tokenBalance.toLocaleString("tr")}
              </button>

              {/* DM */}
              {dmState !== "disabled" && (
                <button
                  onClick={() =>
                    dmState === "maintenance"
                      ? toast("Bu özellik bakımdadır")
                      : setLocation("/messages")
                  }
                  className="text-white hover:bg-white/10 relative rounded-md p-2"
                >
                  <MessageCircle className="h-5 w-5" />
                  {dmUnread > 0 && (
                    <span className="absolute top-1 right-1 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-blue-500 text-white text-[10px] font-bold px-1 leading-none">
                      {dmUnread > 99 ? "99+" : dmUnread}
                    </span>
                  )}
                </button>
              )}

              {/* Upload */}
              {uploadState !== "disabled" && user && (user.role === "admin" || user.role === "creator" || user.role === "moderator") && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="hidden sm:flex text-white hover:bg-white/10"
                  onClick={() =>
                    uploadState === "maintenance"
                      ? toast("Bu özellik bakımdadır")
                      : setLocation("/upload")
                  }
                >
                  <Plus className="h-5 w-5" />
                </Button>
              )}

              {/* Notifications dropdown */}
              <DropdownMenu open={notifOpen} onOpenChange={setNotifOpen}>
                <DropdownMenuTrigger asChild>
                  <button className="relative text-white hover:bg-white/10 rounded-md p-2">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                      <span className="absolute top-1 right-1 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-primary text-white text-[10px] font-bold px-1 leading-none">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-80 bg-[#1e1e1e] border-[#333] text-white p-0 max-h-[480px] overflow-y-auto"
                >
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a]">
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4 text-primary" />
                      <span className="font-semibold text-sm">Bildirimler</span>
                      {unreadCount > 0 && (
                        <span className="bg-primary text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                          {unreadCount}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          connected ? "bg-green-400 animate-pulse" : "bg-[#444]"
                        )}
                      />
                      {unreadCount > 0 && (
                        <button
                          onClick={markAllRead}
                          className="flex items-center gap-1 text-[#888] hover:text-white text-xs transition-colors"
                        >
                          <CheckCheck className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {notifications.length === 0 ? (
                    <div className="py-10 text-center text-[#555]">
                      <Bell className="h-8 w-8 mx-auto mb-2 opacity-20" />
                      <p className="text-xs">Henüz bildirim yok</p>
                    </div>
                  ) : (
                    <div>
                      {notifications.slice(0, 10).map((notif) => (
                        <div
                          key={notif.id}
                          onClick={() => {
                            if (!notif.isRead) markRead(notif.id);
                            if (notif.actionUrl) setLocation(notif.actionUrl);
                            setNotifOpen(false);
                          }}
                          className={cn(
                            "flex items-start gap-3 px-4 py-3 cursor-pointer border-b border-[#1a1a1a] last:border-0 transition-colors",
                            notif.isRead
                              ? "hover:bg-[#252525]"
                              : "bg-primary/5 hover:bg-primary/10"
                          )}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-[#ddd] leading-snug line-clamp-2">
                              {notif.actor && (
                                <span className="font-semibold">@{notif.actor.username} </span>
                              )}
                              {notif.message}
                            </p>
                            <p className="text-[11px] text-[#555] mt-0.5">
                              {formatDistanceToNow(new Date(notif.createdAt), {
                                addSuffix: true,
                              })}
                            </p>
                          </div>
                          {!notif.isRead && (
                            <div className="w-2 h-2 rounded-full bg-primary mt-1 shrink-0" />
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="p-2 border-t border-[#2a2a2a]">
                    <Link href="/notifications">
                      <button
                        onClick={() => setNotifOpen(false)}
                        className="w-full text-center text-xs text-primary hover:text-primary/80 py-1.5 transition-colors"
                      >
                        Tüm bildirimleri gör
                      </button>
                    </Link>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* User avatar dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                    <Avatar className="h-8 w-8 border border-[#444]">
                      <AvatarImage src={user.avatarUrl || ""} />
                      <AvatarFallback className="bg-[#333] text-white text-xs">
                        {(user.displayName || user.username).substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-52 bg-[#1e1e1e] border-[#333] text-white"
                >
                  <DropdownMenuLabel className="flex flex-col gap-0.5">
                    <span className="font-semibold text-sm truncate">
                      {user.displayName || user.username}
                    </span>
                    <span className="text-[#666] text-xs font-normal">@{user.username}</span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-[#2a2a2a]" />
                  <DropdownMenuItem
                    onClick={() => setLocation("/profile")}
                    className="cursor-pointer hover:bg-[#2a2a2a] focus:bg-[#2a2a2a]"
                  >
                    Profilim
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setLocation("/creator/dashboard")}
                    className="cursor-pointer hover:bg-[#2a2a2a] focus:bg-[#2a2a2a]"
                  >
                    İçerik Paneli
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setLocation("/subscriptions")}
                    className="cursor-pointer hover:bg-[#2a2a2a] focus:bg-[#2a2a2a]"
                  >
                    Aboneliğim
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setLocation("/bookmarks")}
                    className="cursor-pointer hover:bg-[#2a2a2a] focus:bg-[#2a2a2a]"
                  >
                    Kaydedilenler
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setLocation("/history")}
                    className="cursor-pointer hover:bg-[#2a2a2a] focus:bg-[#2a2a2a]"
                  >
                    İzleme Geçmişi
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-[#2a2a2a]" />
                  {user.role === "admin" && (
                    <DropdownMenuItem
                      onClick={() => setLocation("/admin")}
                      className="cursor-pointer text-primary hover:bg-primary/10 focus:bg-primary/10"
                    >
                      Admin Paneli
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onClick={logout}
                    className="cursor-pointer text-red-400 hover:bg-red-900/20 focus:bg-red-900/20"
                  >
                    Çıkış Yap
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <div className="flex gap-2 ml-auto">
              <Link href="/login">
                <Button
                  variant="ghost"
                  className="text-white hover:bg-white/10 h-8 px-3 text-sm"
                >
                  Giriş
                </Button>
              </Link>
              <Link href="/register">
                <Button className="h-8 px-3 text-sm bg-primary hover:bg-primary/90">
                  Üye Ol
                </Button>
              </Link>
            </div>
          )}
        </div>
      </nav>

      {showTokenBuy && (
        <TokenBuyModal
          onClose={() => setShowTokenBuy(false)}
          onPurchased={(tokens) => setTokenBalance((b) => (b ?? 0) + tokens)}
        />
      )}
    </>
  );
}
