import { AppLayout } from "@/components/layout/app-layout";
import { useSearch } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { VideoCard } from "@/components/video/video-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search as SearchIcon, SlidersHorizontal, X, Sparkles } from "lucide-react";

export default function Search() {
  const [location] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const q = searchParams.get("q") || "";
  const [sort, setSort] = useState(searchParams.get("sort") || "relevance");
  const [videoType, setVideoType] = useState(searchParams.get("videoType") || "");
  const [premium, setPremium] = useState(searchParams.get("premium") || "");
  const [tagText, setTagText] = useState(searchParams.get("tags") || "");
  const [minViews, setMinViews] = useState(searchParams.get("minViews") || "");
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "all");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSort(params.get("sort") || "relevance");
    setVideoType(params.get("videoType") || "");
    setPremium(params.get("premium") || "");
    setTagText(params.get("tags") || "");
    setMinViews(params.get("minViews") || "");
    setActiveTab(params.get("tab") || "all");
  }, [location]);

  const query = useMemo(() => ({
    q,
    type: "all",
    sort,
  }), [q, sort]);

  const { data, isLoading } = useSearch(query as any, { query: { enabled: !!q, queryKey: ["search", q, sort, videoType, premium, tagText, minViews, activeTab] as any } });

  const creatorResults = data?.users ?? [];
  const videoResults = data?.videos ?? [];

  const applyFilters = () => {
    const params = new URLSearchParams({ q, sort, tab: activeTab });
    if (videoType) params.set("videoType", videoType);
    if (premium !== "") params.set("premium", premium);
    if (tagText) params.set("tags", tagText);
    if (minViews) params.set("minViews", minViews);
    window.history.replaceState({}, "", `/search?${params.toString()}`);
  };

  return (
    <AppLayout>
      <div className="container mx-auto p-4 md:p-6 max-w-7xl space-y-6">
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-2xl font-bold">"{q}" için arama sonuçları</h1>
            <p className="text-sm text-[#888]">Daha iyi sonuçlar için filtre kullan.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex flex-1 gap-2">
              <Input value={q} readOnly className="bg-[#111] border-[#2a2a2a]" />
              <Button variant="secondary" onClick={() => setShowFilters((p) => !p)} className="shrink-0">
                <SlidersHorizontal className="h-4 w-4 mr-2" /> Filtreler
              </Button>
            </div>
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="h-10 rounded-md bg-[#111] border border-[#2a2a2a] px-3 text-sm">
              <option value="relevance">İlgililik</option>
              <option value="latest">En yeni</option>
              <option value="popular">En popüler</option>
            </select>
          </div>
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value)} className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-[#111] border border-[#2a2a2a]">
              <TabsTrigger value="all">Hepsi</TabsTrigger>
              <TabsTrigger value="videos">Videolar</TabsTrigger>
              <TabsTrigger value="creators">Yaratıcılar</TabsTrigger>
            </TabsList>
          </Tabs>
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-4 rounded-xl border border-[#222] bg-[#111]">
              <select value={videoType} onChange={(e) => setVideoType(e.target.value)} className="h-10 rounded-md bg-[#0f0f0f] border border-[#2a2a2a] px-3 text-sm">
                <option value="">Tüm türler</option>
                <option value="video">Video</option>
                <option value="short">Short</option>
              </select>
              <select value={premium} onChange={(e) => setPremium(e.target.value)} className="h-10 rounded-md bg-[#0f0f0f] border border-[#2a2a2a] px-3 text-sm">
                <option value="">Premium fark etmez</option>
                <option value="true">Sadece premium</option>
                <option value="false">Sadece ücretsiz</option>
              </select>
              <Input value={tagText} onChange={(e) => setTagText(e.target.value)} placeholder="Etiketler: tech,music" className="bg-[#0f0f0f] border-[#2a2a2a]" />
              <Input value={minViews} onChange={(e) => setMinViews(e.target.value)} placeholder="Min görüntülenme" type="number" className="bg-[#0f0f0f] border-[#2a2a2a]" />
              <div className="md:col-span-4 flex gap-2">
                <Button onClick={applyFilters} className="gap-2"><SearchIcon className="h-4 w-4" /> Uygula</Button>
                <Button variant="ghost" onClick={() => { setSort("relevance"); setVideoType(""); setPremium(""); setTagText(""); setMinViews(""); setActiveTab("all"); window.history.replaceState({}, "", `/search?q=${encodeURIComponent(q)}`); }} className="gap-2"><X className="h-4 w-4" /> Sıfırla</Button>
              </div>
            </div>
          )}
        </div>
        
        {isLoading ? (
          <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-2">
                  <Skeleton className="aspect-video w-full rounded-xl" />
                  <div className="flex gap-2 mt-2">
                    <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                    <div className="space-y-2 w-full">
                      <Skeleton className="h-4 w-[90%]" />
                      <Skeleton className="h-3 w-[60%]" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {(activeTab === "all" || activeTab === "videos") && (
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">Videolar</h2>
                <Badge variant="secondary">{videoResults.length}</Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8">
                {videoResults.map((video) => (
                  <VideoCard key={video.id} video={video} />
                ))}
                {videoResults.length === 0 && (
                  <div className="col-span-full flex flex-col items-center justify-center py-14 text-center rounded-2xl border border-dashed border-[#222] bg-[#111]">
                    <Sparkles className="h-9 w-9 text-primary mb-3" />
                    <p className="text-sm font-medium text-white">Video bulunamadı</p>
                    <p className="text-sm text-[#666] mt-1 max-w-md">Filtreleri kaldırıp daha geniş bir arama yapmayı dene.</p>
                  </div>
                )}
              </div>
            </section>
            )}

            {(activeTab === "all" || activeTab === "creators") && (
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">Yaratıcılar</h2>
                <Badge variant="secondary">{creatorResults.length}</Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {creatorResults.map((creator) => (
                  <a key={creator.id} href={`/creators/${creator.id}`} className="flex items-center gap-3 rounded-xl border border-[#222] bg-[#111] p-4 hover:border-primary/50 transition-colors">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={creator.avatarUrl || ""} alt={creator.username} />
                      <AvatarFallback>{creator.username.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{creator.displayName}</p>
                        {creator.isVerified && <Badge className="h-5 px-1.5">✓</Badge>}
                      </div>
                      <p className="text-sm text-[#888] truncate">@{creator.username}</p>
                    </div>
                  </a>
                ))}
                {creatorResults.length === 0 && (
                  <div className="col-span-full flex flex-col items-center justify-center py-14 text-center rounded-2xl border border-dashed border-[#222] bg-[#111]">
                    <Sparkles className="h-9 w-9 text-primary mb-3" />
                    <p className="text-sm font-medium text-white">Yaratıcı bulunamadı</p>
                    <p className="text-sm text-[#666] mt-1 max-w-md">Daha genel bir sorgu dene ya da filtreleri sıfırla.</p>
                  </div>
                )}
              </div>
            </section>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}