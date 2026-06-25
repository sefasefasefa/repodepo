import { AppLayout } from "@/components/layout/app-layout";
import { useState } from "react";
import { Trophy, Star, Zap, Clock, Crown, Heart, Medal } from "lucide-react";
import { cn } from "@/lib/utils";

const MOCK_USERS = [
  { rank: 1, username: "ali_fan_01", displayName: "Ali Yılmaz", points: 12_840, streak: 14, badges: ["🔥", "👑"], level: "Efsane" },
  { rank: 2, username: "zeynep_k", displayName: "Zeynep K.", points: 9_450, streak: 7, badges: ["💎", "⭐"], level: "Platinum" },
  { rank: 3, username: "mert_92", displayName: "Mert Aydın", points: 7_210, streak: 3, badges: ["🔥"], level: "Gold" },
  { rank: 4, username: "selin_d", displayName: "Selin D.", points: 5_880, streak: 12, badges: ["⭐"], level: "Gold" },
  { rank: 5, username: "hasan_y", displayName: "Hasan Y.", points: 4_430, streak: 1, badges: [], level: "Silver" },
  { rank: 6, username: "ayse_m", displayName: "Ayşe M.", points: 3_940, streak: 5, badges: ["💜"], level: "Silver" },
  { rank: 7, username: "burak_g", displayName: "Burak G.", points: 2_700, streak: 0, badges: [], level: "Bronze" },
  { rank: 8, username: "fatma_c", displayName: "Fatma C.", points: 1_950, streak: 2, badges: [], level: "Bronze" },
];

const PERIODS = [
  { id: "weekly", label: "Bu Hafta" },
  { id: "monthly", label: "Bu Ay" },
  { id: "alltime", label: "Tüm Zamanlar" },
];

const LEVEL_STYLES: Record<string, string> = {
  "Efsane": "text-fuchsia-400 bg-fuchsia-900/20 border-fuchsia-500/30",
  "Platinum": "text-cyan-400 bg-cyan-900/20 border-cyan-500/30",
  "Gold": "text-amber-400 bg-amber-900/20 border-amber-500/30",
  "Silver": "text-slate-300 bg-slate-700/20 border-slate-500/30",
  "Bronze": "text-orange-600 bg-orange-900/10 border-orange-700/20",
};

const POINT_SOURCES = [
  { icon: "👁️", label: "Video izleme", points: "+2 puan / video" },
  { icon: "❤️", label: "Beğeni", points: "+1 puan / beğeni" },
  { icon: "💬", label: "Yorum", points: "+3 puan / yorum" },
  { icon: "🎁", label: "Hediye gönderme", points: "+10 puan / hediye" },
  { icon: "🔥", label: "Günlük giriş serisi", points: "+5 puan / gün" },
  { icon: "⭐", label: "Premium üyelik", points: "+50 puan / ay" },
];

export default function LeaderboardPage() {
  const [period, setPeriod] = useState("weekly");
  const [tab, setTab] = useState<"general" | "gifts" | "streak">("general");

  const sorted = [...MOCK_USERS].sort((a, b) => {
    if (tab === "streak") return b.streak - a.streak;
    return b.points - a.points;
  });

  const top3 = sorted.slice(0, 3);
  const rest = sorted.slice(3);

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
            <Trophy className="h-7 w-7 text-amber-400" /> Sadakat Sıralaması
          </h1>
          <p className="text-[#666] text-sm">İzle, etkileşime geç, hediye gönder — puan kazan!</p>
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex gap-1 p-1 bg-[#161616] border border-[#222] rounded-xl">
            {PERIODS.map(p => (
              <button key={p.id} onClick={() => setPeriod(p.id)}
                className={cn("px-3 py-1.5 rounded-lg text-sm transition-all font-medium",
                  period === p.id ? "bg-primary text-white" : "text-[#777] hover:text-white")}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex gap-1 p-1 bg-[#161616] border border-[#222] rounded-xl">
            {[
              { id: "general", label: "Genel", icon: Trophy },
              { id: "gifts", label: "Hediyeler", icon: Heart },
              { id: "streak", label: "Seri", icon: Zap },
            ].map(t => {
              const Icon = t.icon;
              return (
                <button key={t.id} onClick={() => setTab(t.id as any)}
                  className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all font-medium",
                    tab === t.id ? "bg-primary text-white" : "text-[#777] hover:text-white")}>
                  <Icon className="h-3.5 w-3.5" /> {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Top 3 Podiyum */}
        <div className="flex items-end justify-center gap-3 pt-4">
          {[top3[1], top3[0], top3[2]].map((u, i) => {
            if (!u) return <div key={i} className="w-24" />;
            const isFirst = i === 1;
            const podiumColors = ["bg-slate-400/20 border-slate-400/30", "bg-amber-400/20 border-amber-400/40", "bg-orange-600/20 border-orange-600/30"];
            const podiumH = ["h-24", "h-32", "h-20"];
            const medals = ["🥈", "🥇", "🥉"];
            return (
              <div key={u.username} className={cn("flex flex-col items-center gap-2", isFirst ? "scale-110" : "")}>
                <div className="text-xl">{u.badges[0] ?? "👤"}</div>
                <div className="text-center">
                  <p className={cn("font-bold text-sm", isFirst ? "text-amber-400" : "text-[#ccc]")}>{u.displayName}</p>
                  <p className="text-[11px] text-[#555]">{u.points.toLocaleString()} puan</p>
                </div>
                <div className={cn("w-24 rounded-t-xl border flex items-center justify-center text-2xl", podiumColors[i], podiumH[i])}>
                  {medals[i]}
                </div>
              </div>
            );
          })}
        </div>

        {/* Liste */}
        <div className="bg-[#1a1a1a] border border-[#222] rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1e1e1e] flex items-center justify-between">
            <p className="text-sm font-semibold text-white">Tam Sıralama</p>
            <p className="text-xs text-[#555]">{MOCK_USERS.length} kullanıcı</p>
          </div>
          <div className="divide-y divide-[#1a1a1a]">
            {sorted.map((u) => (
              <div key={u.username} className="flex items-center gap-3 px-4 py-3 hover:bg-[#1e1e1e] transition-colors">
                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0",
                  u.rank === 1 ? "bg-amber-400/20 text-amber-400" :
                  u.rank === 2 ? "bg-slate-400/20 text-slate-300" :
                  u.rank === 3 ? "bg-orange-600/20 text-orange-500" :
                  "bg-[#222] text-[#666]")}>
                  {u.rank <= 3 ? ["🥇","🥈","🥉"][u.rank-1] : u.rank}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-white truncate">{u.displayName}</p>
                    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", LEVEL_STYLES[u.level])}>
                      {u.level}
                    </span>
                    {u.badges.map((b, i) => <span key={i} className="text-sm">{b}</span>)}
                  </div>
                  <p className="text-[11px] text-[#555]">@{u.username}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-primary">{u.points.toLocaleString()}</p>
                  <div className="flex items-center gap-1 justify-end">
                    {u.streak > 0 && (
                      <span className="text-[10px] text-orange-400 flex items-center gap-0.5">
                        <Zap className="h-3 w-3" />{u.streak} gün
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Puan Kaynakları */}
        <div className="bg-[#1a1a1a] border border-[#222] rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-400" /> Nasıl Puan Kazanılır?
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {POINT_SOURCES.map(s => (
              <div key={s.label} className="flex items-center gap-2.5 bg-[#111] rounded-xl px-3 py-2.5">
                <span className="text-base">{s.icon}</span>
                <div>
                  <p className="text-xs text-[#ccc] font-medium">{s.label}</p>
                  <p className="text-[11px] text-primary font-mono">{s.points}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
