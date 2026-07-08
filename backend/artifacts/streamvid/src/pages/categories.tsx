import { AppLayout } from "@/components/layout/app-layout";
import { useListCategories } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Grid3x3, TrendingUp } from "lucide-react";

const CATEGORY_COLORS = [
  { from: "from-purple-700", to: "to-pink-600", border: "border-purple-700/50", text: "text-purple-200" },
  { from: "from-blue-700", to: "to-cyan-600", border: "border-blue-700/50", text: "text-blue-200" },
  { from: "from-orange-700", to: "to-amber-500", border: "border-orange-700/50", text: "text-orange-200" },
  { from: "from-green-700", to: "to-emerald-500", border: "border-green-700/50", text: "text-green-200" },
  { from: "from-rose-700", to: "to-red-500", border: "border-rose-700/50", text: "text-rose-200" },
  { from: "from-violet-700", to: "to-indigo-600", border: "border-violet-700/50", text: "text-violet-200" },
  { from: "from-teal-700", to: "to-cyan-500", border: "border-teal-700/50", text: "text-teal-200" },
  { from: "from-yellow-700", to: "to-orange-500", border: "border-yellow-700/50", text: "text-yellow-200" },
  { from: "from-fuchsia-700", to: "to-pink-500", border: "border-fuchsia-700/50", text: "text-fuchsia-200" },
  { from: "from-sky-700", to: "to-blue-500", border: "border-sky-700/50", text: "text-sky-200" },
];

const CATEGORY_EMOJIS: Record<string, string> = {
  "Amateur": "🎬", "Anal": "🔥", "Asian": "🌸", "BBW": "💋", "Big Ass": "🍑",
  "Big Tits": "💎", "Blonde": "👱", "Blowjob": "💦", "Brunette": "🌿", "Creampie": "🍦",
  "Cumshot": "💥", "Ebony": "🌙", "European": "🌍", "Fetish": "⛓️", "Gay": "🌈",
  "Group Sex": "🎭", "HD": "📺", "Hardcore": "💪", "Japanese": "🎌", "Latin": "💃",
  "Lesbian": "❤️", "MILF": "👩", "Mature": "🌹", "Orgasm": "⚡", "POV": "👁️",
  "Pornstar": "⭐", "Redhead": "🦊", "Solo": "🎯", "Squirt": "💧", "Teen": "🌱",
  "Turkish": "🇹🇷", "Webcam": "💻", "Vintage": "🎞️", "BDSM": "🖤", "Cartoon": "🎨",
};

export default function Categories() {
  const { data: rawData, isLoading } = useListCategories();
  const categories: any[] = Array.isArray(rawData) ? rawData : (rawData as any)?.categories ?? [];

  return (
    <AppLayout>
      <div className="container mx-auto p-4 md:p-6 max-w-7xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="bg-primary/15 p-2.5 rounded-xl">
            <Grid3x3 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Kategoriler</h1>
            <p className="text-sm text-muted-foreground">
              {categories ? `${categories.length} kategori` : "Tüm kategorilere göz at"}
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array.from({ length: 15 }).map((_, i) => (
              <Skeleton key={i} className="h-36 w-full rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
            {categories?.map((cat, i) => {
              const color = CATEGORY_COLORS[i % CATEGORY_COLORS.length];
              const emoji = CATEGORY_EMOJIS[cat.name] ?? "🎬";
              const coverImage: string | undefined = (cat as any).coverImage;
              return (
                <Link key={cat.id} href={`/categories/${cat.slug}`}>
                  <div
                    className={`group relative overflow-hidden rounded-2xl border-2 ${color.border} ${coverImage ? "bg-black" : `bg-gradient-to-br ${color.from} ${color.to}`} h-36 flex flex-col items-start justify-end p-4 cursor-pointer transition-all duration-300 hover:scale-[1.04] hover:shadow-2xl hover:shadow-black/60`}
                  >
                    {coverImage && (
                      <img
                        src={coverImage}
                        alt={cat.name}
                        className="absolute inset-0 w-full h-full object-cover opacity-70 group-hover:opacity-90 group-hover:scale-110 transition-all duration-300"
                        loading="lazy"
                      />
                    )}
                    <div className={`absolute inset-0 ${coverImage ? "bg-black/50 group-hover:bg-black/35" : "bg-black/40 group-hover:bg-black/20"} transition-colors duration-300`} />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    <div className="absolute top-3 right-3 text-4xl opacity-60 group-hover:opacity-90 group-hover:scale-125 group-hover:rotate-6 transition-all duration-300 drop-shadow-lg">
                      {emoji}
                    </div>
                    <div className="relative z-10">
                      <h2 className="font-bold text-white text-sm leading-tight drop-shadow-lg line-clamp-2">
                        {cat.name}
                      </h2>
                      <div className={`flex items-center gap-1 mt-1.5 text-xs ${color.text} font-medium`}>
                        <TrendingUp className="h-3 w-3" />
                        <span>{(cat as any).videoCount ?? 0} video</span>
                      </div>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/20 group-hover:bg-white/60 transition-colors duration-300" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {!isLoading && (!categories || categories.length === 0) && (
          <div className="text-center py-24 text-muted-foreground">
            <Grid3x3 className="h-16 w-16 mx-auto opacity-20 mb-4" />
            <p className="font-medium text-lg">Henüz kategori yok</p>
            <p className="text-sm mt-1">Kategoriler yönetici tarafından eklenebilir</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
