import { AppLayout } from "@/components/layout/app-layout";
import { useParams, useLocation } from "wouter";
import { useGetUser, getGetUserQueryKey, useGetUserVideos } from "@workspace/api-client-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { VideoCard } from "@/components/video/video-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CustomRequestModal } from "@/components/custom-request-modal";
import { useAuth } from "@/lib/auth";
import { useState, useEffect } from "react";
import { FileText, MessageCircle, ShieldAlert, Ban, UserRoundMinus, Crown, Lock } from "lucide-react";
import { BadgeDisplay, BadgeList } from "@/components/badges/badge-display";

export default function CreatorProfile() {
  const params = useParams();
  const userId = parseInt(params.id || "0");
  const { user: currentUser } = useAuth();
  const [, setLocation] = useLocation();
  const [showRequest, setShowRequest] = useState(false);
  const [tokenBalance, setTokenBalance] = useState(0);
  const [startingConv, setStartingConv] = useState(false);
  const [adminBusy, setAdminBusy] = useState<string | null>(null);
  const [subscribing, setSubscribing] = useState(false);
  const isAdmin = ["admin", "moderator"].includes((currentUser as any)?.role);

  useEffect(() => {
    const t = localStorage.getItem("token");
    if (!t) return;
    fetch("/api/tokens/balance", { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.json()).then(d => setTokenBalance(d.balance ?? 0)).catch(() => {});
  }, [currentUser]);

  const { data: user, isLoading: userLoading } = useGetUser(userId, { query: { enabled: !!userId, queryKey: getGetUserQueryKey(userId) } });
  const { data: videosData, isLoading: videosLoading } = useGetUserVideos(userId, { enabled: !!userId } as any);

  const openDm = async () => {
    if (!currentUser) { setLocation("/login"); return; }
    setStartingConv(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ userId }),
      });
      const d = await res.json();
      if (d.conversation?.id) {
        setLocation(`/messages`);
      }
    } catch {}
    setStartingConv(false);
  };

  const openSubscription = async () => {
    if (!currentUser) {
      setLocation("/login");
      return;
    }
    setSubscribing(true);
    try {
      setLocation("/subscriptions");
    } finally {
      setSubscribing(false);
    }
  };

  const adminAction = async (action: "mute" | "ban" | "restrict") => {
    if (!isAdmin) return;
    setAdminBusy(action);
    try {
      const token = localStorage.getItem("token");
      await fetch(`/api/admin/users/${userId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ reason: "Profil moderasyonu" }),
      });
    } catch {}
    setAdminBusy(null);
  };

  if (userLoading) {
    return (
      <AppLayout>
        <div className="w-full h-48 bg-muted animate-pulse"></div>
        <div className="container mx-auto p-4 md:p-6 max-w-7xl -mt-16">
          <Skeleton className="h-32 w-32 rounded-full border-4 border-background" />
          <Skeleton className="h-8 w-48 mt-4" />
        </div>
      </AppLayout>
    );
  }

  if (!user) return <AppLayout><div className="p-8">Creator not found</div></AppLayout>;

  return (
    <AppLayout>
      <div className="w-full h-48 md:h-64 bg-secondary relative">
        {user.bannerUrl && (
          <img src={user.bannerUrl} alt="Banner" className="w-full h-full object-cover" />
        )}
      </div>
      
      <div className="container mx-auto p-4 md:p-6 max-w-7xl">
        <div className="flex flex-col md:flex-row gap-6 items-start md:items-end -mt-16 mb-8 relative z-10">
          <Avatar className="h-32 w-32 border-4 border-background bg-muted">
            <AvatarImage src={user.avatarUrl || ""} />
            <AvatarFallback className="text-4xl">{user.username.substring(0, 2)}</AvatarFallback>
          </Avatar>
          
          <div className="flex-1">
            <h1 className="text-3xl font-bold flex items-center gap-2">
              {user.displayName || user.username}
              {user.isVerified && <span className="text-primary text-xl">✓</span>}
            </h1>
            <p className="text-muted-foreground mt-1">@{user.username}</p>
            <p className="text-sm mt-2 flex gap-4">
              <span><strong className="text-foreground">{user.followerCount}</strong> followers</span>
              <span><strong className="text-foreground">{user.videoCount}</strong> videos</span>
            </p>
            <BadgeDisplay userId={userId} size="md" maxVisible={6} className="mt-2" />
          </div>
          
          <div className="flex gap-2 flex-wrap w-full md:w-auto">
            <Button className="rounded-full">Follow</Button>
            {user.subscriptionPrice && (
              <Button
                onClick={openSubscription}
                disabled={subscribing}
                variant="secondary"
                className="rounded-full border border-primary/50 text-primary gap-1.5"
              >
                <Crown className="h-4 w-4" />
                Aylık Üyelik ${user.subscriptionPrice}/mo
              </Button>
            )}
            {currentUser && currentUser.id !== userId && (
              <>
                <Button
                  onClick={openDm}
                  disabled={startingConv}
                  variant="secondary"
                  className="rounded-full border border-[#2a2a2a] text-[#aaa] hover:border-blue-500/40 hover:text-blue-400 gap-1.5"
                >
                  <MessageCircle className="h-4 w-4" /> Mesaj
                </Button>
                <Button
                  onClick={() => setShowRequest(true)}
                  variant="secondary"
                  className="rounded-full border border-[#2a2a2a] text-[#aaa] hover:border-primary/40 hover:text-primary gap-1.5"
                >
                  <FileText className="h-4 w-4" /> Özel İstek
                </Button>
              </>
            )}
            {isAdmin && currentUser?.id !== userId && (
              <div className="w-full md:w-auto flex gap-2 flex-wrap">
                <Button onClick={() => adminAction("mute")} variant="secondary" className="rounded-full gap-1.5" disabled={adminBusy === "mute"}>
                  <ShieldAlert className="h-4 w-4" /> Sustur
                </Button>
                <Button onClick={() => adminAction("ban")} variant="secondary" className="rounded-full gap-1.5" disabled={adminBusy === "ban"}>
                  <Ban className="h-4 w-4" /> Banla
                </Button>
                <Button onClick={() => adminAction("restrict")} variant="secondary" className="rounded-full gap-1.5" disabled={adminBusy === "restrict"}>
                  <UserRoundMinus className="h-4 w-4" /> Kısıtla
                </Button>
              </div>
            )}
          </div>
        </div>

        {user.subscriptionPrice && (
          <div className="mb-8 max-w-3xl rounded-2xl border border-primary/30 bg-primary/5 p-4 md:p-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Crown className="h-4 w-4 text-primary" />
                  <p className="font-semibold">Creator Monthly Membership</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  Özel içerikler, üyelere açık videolar ve creator ayrıcalıkları için aylık üyelik.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="rounded-full border border-primary/30 px-3 py-1 text-sm font-semibold text-primary">
                  ${user.subscriptionPrice}/mo
                </div>
                <Button onClick={openSubscription} disabled={subscribing} className="rounded-full gap-1.5">
                  <Lock className="h-4 w-4" />
                  Katıl
                </Button>
              </div>
            </div>
          </div>
        )}

        {user.bio && (
          <div className="mb-8 max-w-3xl">
            <p className="whitespace-pre-wrap text-sm text-muted-foreground leading-relaxed">{user.bio}</p>
          </div>
        )}

        <Tabs defaultValue="videos" className="w-full">
          <TabsList className="bg-transparent border-b border-border w-full justify-start rounded-none h-12 p-0 space-x-6">
            <TabsTrigger value="videos" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 h-full">Videos</TabsTrigger>
            <TabsTrigger value="shorts" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 h-full">Shorts</TabsTrigger>
            <TabsTrigger value="premium" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 h-full text-primary">Premium</TabsTrigger>
          </TabsList>
          
          <TabsContent value="videos" className="pt-6">
            {videosLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-video w-full rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8">
                {videosData?.videos.map(video => (
                  <VideoCard key={video.id} video={video} />
                ))}
                {videosData?.videos.length === 0 && <p className="col-span-full text-center py-10 text-muted-foreground">No videos yet</p>}
              </div>
            )}
          </TabsContent>
          <TabsContent value="shorts" className="pt-6">
            <p className="text-muted-foreground text-center py-10">Shorts coming soon</p>
          </TabsContent>
          <TabsContent value="premium" className="pt-6">
            <p className="text-muted-foreground text-center py-10">Subscribe to unlock premium content</p>
          </TabsContent>
        </Tabs>
      </div>
      {showRequest && user && (
        <CustomRequestModal
          creator={{ id: user.id, username: user.username, displayName: (user as any).displayName, avatarUrl: (user as any).avatarUrl }}
          currentBalance={tokenBalance}
          onClose={() => setShowRequest(false)}
          onSent={() => setShowRequest(false)}
        />
      )}
    </AppLayout>
  );
}
