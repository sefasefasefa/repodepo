import { AppLayout } from "@/components/layout/app-layout";
import { useListUsers } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link } from "wouter";
import { Users, Search, BadgeCheck, Play, Heart } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

function CreatorSkeleton() {
  return (
    <div className="bg-[#1a1a1a] border border-[#242424] rounded-2xl overflow-hidden">
      <Skeleton className="h-24 w-full" />
      <div className="flex flex-col items-center -mt-8 px-4 pb-5 gap-3">
        <Skeleton className="h-16 w-16 rounded-full border-4 border-[#1a1a1a]" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-3 w-20" />
        <div className="flex gap-4 w-full justify-center">
          <Skeleton className="h-8 w-20 rounded-lg" />
          <Skeleton className="h-8 w-20 rounded-lg" />
        </div>
        <Skeleton className="h-9 w-full rounded-xl" />
      </div>
    </div>
  );
}

function formatNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n ?? 0);
}

export default function Creators() {
  const { data, isLoading, isError } = useListUsers({ role: "creator", limit: 50 } as any);
  const [search, setSearch] = useState("");

  const creators = (data?.users ?? []).filter((c: any) =>
    !search ||
    (c.displayName || c.username).toLowerCase().includes(search.toLowerCase()) ||
    c.username.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <Users className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">İçerik Üreticileri</h1>
              <p className="text-xs text-[#666] mt-0.5">
                {isLoading ? "Yükleniyor…" : `${data?.total ?? 0} creator`}
              </p>
            </div>
          </div>

          {/* Arama */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#555] pointer-events-none" />
            <input
              type="text"
              placeholder="Creator ara…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full h-9 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl pl-9 pr-3 text-sm text-white placeholder:text-[#555] outline-none focus:border-[#444] transition-colors"
            />
          </div>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => <CreatorSkeleton key={i} />)}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center py-20 gap-3 text-center">
            <div className="w-16 h-16 rounded-2xl bg-red-900/20 border border-red-800/30 flex items-center justify-center">
              <Users className="h-7 w-7 text-red-400" />
            </div>
            <p className="text-white font-semibold">İçerik üreticileri yüklenemedi</p>
            <p className="text-[#555] text-sm">Lütfen sayfayı yenileyerek tekrar deneyin.</p>
          </div>
        ) : creators.length === 0 ? (
          <div className="flex flex-col items-center py-20 gap-3 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#1a1a1a] border border-[#242424] flex items-center justify-center">
              <Users className="h-7 w-7 text-[#444]" />
            </div>
            <p className="text-white font-semibold">
              {search ? "Eşleşen creator bulunamadı" : "Henüz creator yok"}
            </p>
            <p className="text-[#555] text-sm">
              {search ? `"${search}" araması sonuç döndürmedi.` : "Yakında içerik üreticileri burada görünecek."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {creators.map((creator: any) => (
              <CreatorCard key={creator.id} creator={creator} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function CreatorCard({ creator }: { creator: any }) {
  const bannerColors = [
    "from-purple-900/60 to-pink-900/60",
    "from-blue-900/60 to-cyan-900/60",
    "from-orange-900/60 to-red-900/60",
    "from-green-900/60 to-emerald-900/60",
    "from-indigo-900/60 to-violet-900/60",
    "from-teal-900/60 to-green-900/60",
  ];
  const gradient = bannerColors[creator.id % bannerColors.length];

  return (
    <Link href={`/creators/${creator.id}`}>
      <div className="group bg-[#1a1a1a] border border-[#242424] hover:border-[#333] rounded-2xl overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:shadow-black/30 hover:-translate-y-0.5">
        {/* Banner */}
        <div className={cn("h-20 bg-gradient-to-br relative", gradient)}>
          {creator.bannerUrl && (
            <img
              src={creator.bannerUrl}
              alt=""
              className="w-full h-full object-cover opacity-60"
              loading="lazy"
            />
          )}
        </div>

        {/* Avatar + info */}
        <div className="flex flex-col items-center -mt-8 px-4 pb-5 gap-2.5">
          <div className="relative">
            <Avatar className="h-16 w-16 border-4 border-[#1a1a1a] shadow-lg">
              <AvatarImage src={creator.avatarUrl || ""} alt={creator.username} />
              <AvatarFallback className="bg-[#2a2a2a] text-white text-xl font-bold">
                {(creator.displayName || creator.username).substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {creator.isVerified && (
              <div className="absolute -bottom-0.5 -right-0.5 bg-primary rounded-full w-5 h-5 flex items-center justify-center border-2 border-[#1a1a1a]">
                <BadgeCheck className="h-3 w-3 text-white" />
              </div>
            )}
          </div>

          {/* İsim */}
          <div className="text-center">
            <p className="font-bold text-white text-sm leading-tight group-hover:text-primary transition-colors">
              {creator.displayName || creator.username}
            </p>
            <p className="text-[11px] text-[#555] mt-0.5">@{creator.username}</p>
          </div>

          {/* Bio */}
          {creator.bio && (
            <p className="text-[11px] text-[#666] text-center line-clamp-2 leading-relaxed">
              {creator.bio}
            </p>
          )}

          {/* İstatistikler */}
          <div className="flex items-center gap-4 text-xs text-[#555]">
            <div className="flex items-center gap-1">
              <Heart className="h-3.5 w-3.5 text-[#444]" />
              <span><strong className="text-[#aaa]">{formatNum(creator.followerCount ?? 0)}</strong> takipçi</span>
            </div>
            <div className="flex items-center gap-1">
              <Play className="h-3.5 w-3.5 text-[#444]" />
              <span><strong className="text-[#aaa]">{formatNum(creator.videoCount ?? 0)}</strong> video</span>
            </div>
          </div>

          {/* Profili Görüntüle butonu */}
          <div className="w-full mt-1 py-2 rounded-xl bg-[#222] hover:bg-primary group-hover:bg-primary border border-[#2a2a2a] group-hover:border-primary transition-all text-center text-xs font-semibold text-[#888] group-hover:text-white">
            Profili Görüntüle
          </div>
        </div>
      </div>
    </Link>
  );
}
