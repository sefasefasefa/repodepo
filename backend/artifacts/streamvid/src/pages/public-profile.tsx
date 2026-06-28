import { AppLayout } from "@/components/layout/app-layout";
import { useParams, useLocation } from "wouter";
import { useGetUserVideos } from "@workspace/api-client-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { VideoCard } from "@/components/video/video-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  MessageCircle, UserPlus, UserMinus, ShieldAlert, Ban,
  UserRoundMinus, Crown, Video, Users, Eye, BadgeCheck
} from "lucide-react";

interface UserProfile {
  id: number;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  bio: string | null;
  role: string;
  isVerified: boolean;
  isBanned: boolean;
  followerCount: number;
  followingCount: number;
  videoCount: number;
  totalViews: number;
  isFollowing: boolean;
  createdAt: string | null;
}

export default function PublicProfile() {
  const params = useParams<{ username: string }>();
  const username = params.username || "";
  const { user: currentUser } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [following, setFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [startingConv, setStartingConv] = useState(false);
  const [adminBusy, setAdminBusy] = useState<string | null>(null);

  const isAdmin = ["admin", "moderator"].includes((currentUser as any)?.role);
  const isOwnProfile = currentUser?.username === username;

  useEffect(() => {
    if (isOwnProfile) {
      setLocation("/profile");
      return;
    }
    if (!username) return;

    setLoading(true);
    setNotFound(false);
    const token = localStorage.getItem("token");
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    fetch(`/api/users/${username}`, { headers })
      .then(async (r) => {
        if (r.status === 404) { setNotFound(true); return; }
        const data = await r.json();
        setProfile(data);
        setFollowing(data.isFollowing ?? false);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [username, isOwnProfile]);

  const { data: videosData, isLoading: videosLoading } = useGetUserVideos(
    profile?.id ?? 0,
    { enabled: !!profile?.id } as any
  );

  const toggleFollow = async () => {
    if (!currentUser) { setLocation("/login"); return; }
    if (!profile) return;
    setFollowBusy(true);
    try {
      const token = localStorage.getItem("token");
      const method = following ? "DELETE" : "POST";
      await fetch(`/api/users/${profile.id}/follow`, {
        method,
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      setFollowing(!following);
      setProfile((p) =>
        p ? { ...p, followerCount: p.followerCount + (following ? -1 : 1) } : p
      );
    } catch {
      toast({ title: "Hata", description: "İşlem başarısız oldu.", variant: "destructive" });
    } finally {
      setFollowBusy(false);
    }
  };

  const openDm = async () => {
    if (!currentUser) { setLocation("/login"); return; }
    if (!profile) return;
    setStartingConv(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ userId: profile.id }),
      });
      const d = await res.json();
      if (d.conversation?.id) setLocation("/messages");
    } catch {}
    setStartingConv(false);
  };

  const adminAction = async (action: "mute" | "ban" | "restrict") => {
    if (!isAdmin || !profile) return;
    setAdminBusy(action);
    try {
      const token = localStorage.getItem("token");
      await fetch(`/api/admin/users/${profile.id}/${action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ reason: "Profil moderasyonu" }),
      });
      toast({ title: `Kullanıcı ${action} işlemi uygulandı` });
    } catch {
      toast({ title: "Hata", description: "İşlem başarısız oldu.", variant: "destructive" });
    }
    setAdminBusy(null);
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="w-full h-32 sm:h-48 md:h-64 bg-secondary animate-pulse" />
        <div className="container mx-auto px-3 sm:px-4 md:px-6 pb-8 max-w-7xl">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end -mt-12 sm:-mt-16 mb-6">
            <Skeleton className="h-24 w-24 sm:h-32 sm:w-32 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-2">
                <Skeleton className="aspect-video w-full rounded-xl" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-2.5 w-3/4" />
              </div>
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  if (notFound || !profile) {
    return (
      <AppLayout>
        <div className="container mx-auto p-6 flex flex-col items-center justify-center min-h-[50vh] gap-3">
          <Users className="h-12 w-12 text-muted-foreground opacity-40" />
          <h2 className="text-xl font-bold">Kullanıcı bulunamadı</h2>
          <p className="text-muted-foreground text-sm">@{username} adında bir kullanıcı yok.</p>
          <Button variant="outline" size="sm" onClick={() => setLocation("/")}>
            Ana Sayfaya Dön
          </Button>
        </div>
      </AppLayout>
    );
  }

  const displayName = profile.displayName || profile.username;
  const roleLabel =
    profile.role === "creator" ? "Creator" :
    profile.role === "admin" ? "Admin" :
    profile.role === "moderator" ? "Moderatör" : null;

  return (
    <AppLayout>
      {/* Banner */}
      <div className="w-full h-32 sm:h-48 md:h-64 bg-secondary relative">
        {profile.bannerUrl && (
          <img src={profile.bannerUrl} alt="Banner" className="w-full h-full object-cover" />
        )}
      </div>

      <div className="container mx-auto px-3 sm:px-4 md:px-6 pb-8 max-w-7xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end -mt-12 sm:-mt-16 mb-6 relative z-10">
          <Avatar className="h-24 w-24 sm:h-32 sm:w-32 border-4 border-background bg-muted shrink-0">
            <AvatarImage src={profile.avatarUrl || ""} />
            <AvatarFallback className="text-2xl sm:text-4xl">
              {profile.username.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-3xl font-bold truncate">{displayName}</h1>
              {profile.isVerified && (
                <BadgeCheck className="h-5 w-5 text-primary shrink-0" />
              )}
              {roleLabel && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/15 text-primary font-semibold">
                  {roleLabel}
                </span>
              )}
              {profile.isBanned && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-900/30 text-red-400 font-semibold">
                  Banlı
                </span>
              )}
            </div>
            <p className="text-muted-foreground text-sm">@{profile.username}</p>
            <p className="text-sm flex gap-4 flex-wrap text-muted-foreground">
              <span><strong className="text-foreground">{profile.followerCount.toLocaleString("tr")}</strong> takipçi</span>
              <span><strong className="text-foreground">{profile.followingCount.toLocaleString("tr")}</strong> takip</span>
              {profile.videoCount > 0 && (
                <span><strong className="text-foreground">{profile.videoCount.toLocaleString("tr")}</strong> video</span>
              )}
            </p>
          </div>

          {/* Eylem butonları */}
          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              onClick={toggleFollow}
              disabled={followBusy}
              variant={following ? "outline" : "default"}
              className="flex-1 sm:flex-none rounded-full text-sm"
            >
              {following
                ? <><UserMinus className="mr-2 h-4 w-4" /> Takibi Bırak</>
                : <><UserPlus className="mr-2 h-4 w-4" /> Takip Et</>
              }
            </Button>
            {currentUser && (
              <Button
                variant="outline"
                size="icon"
                className="rounded-full shrink-0"
                onClick={openDm}
                disabled={startingConv}
                title="Mesaj gönder"
              >
                <MessageCircle className="h-5 w-5" />
              </Button>
            )}
            {/* Admin araçları */}
            {isAdmin && (
              <div className="flex gap-1">
                <Button
                  variant="ghost" size="icon"
                  className="rounded-full text-yellow-500 hover:bg-yellow-900/30 shrink-0"
                  title="Sustur"
                  disabled={!!adminBusy}
                  onClick={() => adminAction("mute")}
                >
                  <UserRoundMinus className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost" size="icon"
                  className="rounded-full text-orange-500 hover:bg-orange-900/30 shrink-0"
                  title="Kısıtla"
                  disabled={!!adminBusy}
                  onClick={() => adminAction("restrict")}
                >
                  <ShieldAlert className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost" size="icon"
                  className="rounded-full text-red-500 hover:bg-red-900/30 shrink-0"
                  title="Banla"
                  disabled={!!adminBusy}
                  onClick={() => adminAction("ban")}
                >
                  <Ban className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Bio */}
        {profile.bio && (
          <div className="mb-6 max-w-3xl">
            <p className="whitespace-pre-wrap text-sm text-muted-foreground leading-relaxed">{profile.bio}</p>
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="videos" className="w-full">
          <TabsList className="bg-transparent border-b border-border w-full justify-start rounded-none h-11 p-0 overflow-x-auto scrollbar-hide gap-4 sm:gap-6">
            <TabsTrigger
              value="videos"
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-1 h-full shrink-0 text-sm"
            >
              Videolar
              {videosData?.videos && videosData.videos.length > 0 && (
                <span className="ml-1.5 text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-medium">
                  {videosData.videos.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="about"
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-1 h-full shrink-0 text-sm"
            >
              Hakkında
            </TabsTrigger>
          </TabsList>

          {/* Videos tab */}
          <TabsContent value="videos" className="pt-5">
            {videosLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex flex-col gap-2">
                    <Skeleton className="aspect-video w-full rounded-xl" />
                    <div className="flex gap-2">
                      <Skeleton className="h-7 w-7 rounded-full shrink-0" />
                      <div className="space-y-1.5 flex-1">
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-2.5 w-3/4" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : !videosData?.videos?.length ? (
              <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border border-dashed border-border bg-card/50">
                <Video className="h-10 w-10 text-muted-foreground mb-3 opacity-40" />
                <p className="font-semibold text-base">Henüz video yok</p>
                <p className="text-muted-foreground text-sm mt-1">
                  {displayName} henüz video yüklememiş.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 gap-y-6 sm:gap-y-8">
                {videosData.videos.map((video) => (
                  <VideoCard key={video.id} video={video} />
                ))}
              </div>
            )}
          </TabsContent>

          {/* About tab */}
          <TabsContent value="about" className="pt-5">
            <div className="max-w-lg grid grid-cols-2 gap-3">
              <div className="bg-card rounded-xl border border-border p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <Users className="h-3.5 w-3.5" /> Takipçi
                </div>
                <p className="text-2xl font-bold">{profile.followerCount.toLocaleString("tr")}</p>
              </div>
              <div className="bg-card rounded-xl border border-border p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <Video className="h-3.5 w-3.5" /> Video
                </div>
                <p className="text-2xl font-bold">{(videosData?.videos?.length ?? profile.videoCount).toLocaleString("tr")}</p>
              </div>
              <div className="bg-card rounded-xl border border-border p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <Eye className="h-3.5 w-3.5" /> Toplam İzlenme
                </div>
                <p className="text-2xl font-bold">{profile.totalViews.toLocaleString("tr")}</p>
              </div>
              <div className="bg-card rounded-xl border border-border p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <Crown className="h-3.5 w-3.5" /> Rol
                </div>
                <p className="text-2xl font-bold capitalize">{roleLabel || profile.role}</p>
              </div>
              {profile.createdAt && (
                <div className="col-span-2 bg-card rounded-xl border border-border p-4">
                  <p className="text-xs text-muted-foreground mb-1">Katılım tarihi</p>
                  <p className="font-semibold">
                    {new Date(profile.createdAt).toLocaleDateString("tr-TR", {
                      year: "numeric", month: "long", day: "numeric"
                    })}
                  </p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
