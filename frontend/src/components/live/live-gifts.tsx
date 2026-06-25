import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

export const GIFT_ITEMS = [
  { id: "rose", emoji: "🌹", name: "Gül", tokens: 1, color: "from-pink-500/20 to-rose-500/10" },
  { id: "heart", emoji: "💜", name: "Kalp", tokens: 5, color: "from-purple-500/20 to-purple-600/10" },
  { id: "fire", emoji: "🔥", name: "Ateş", tokens: 10, color: "from-orange-500/20 to-red-500/10" },
  { id: "diamond", emoji: "💎", name: "Elmas", tokens: 50, color: "from-cyan-500/20 to-blue-500/10" },
  { id: "crown", emoji: "👑", name: "Taç", tokens: 100, color: "from-amber-500/20 to-yellow-500/10" },
  { id: "rocket", emoji: "🚀", name: "Roket", tokens: 200, color: "from-indigo-500/20 to-blue-600/10" },
  { id: "unicorn", emoji: "🦄", name: "Unicorn", tokens: 500, color: "from-fuchsia-500/20 to-pink-600/10" },
  { id: "galaxy", emoji: "🌌", name: "Galaksi", tokens: 1000, color: "from-violet-600/20 to-indigo-600/10" },
];

export interface GiftEvent {
  id: string;
  senderName: string;
  gift: typeof GIFT_ITEMS[0];
  count: number;
  timestamp: number;
}

interface LiveGiftPickerProps {
  onSend: (gift: typeof GIFT_ITEMS[0], count: number) => void;
  tokenBalance: number;
  open: boolean;
  onClose: () => void;
}

export function LiveGiftPicker({ onSend, tokenBalance, open, onClose }: LiveGiftPickerProps) {
  const [selected, setSelected] = useState(GIFT_ITEMS[0]);
  const [count, setCount] = useState(1);
  const [sending, setSending] = useState(false);

  const totalCost = selected.tokens * count;
  const canAfford = tokenBalance >= totalCost;

  const send = async () => {
    if (!canAfford) return;
    setSending(true);
    await new Promise(r => setTimeout(r, 400));
    onSend(selected, count);
    setSending(false);
    onClose();
    setCount(1);
  };

  if (!open) return null;

  return (
    <div className="absolute bottom-16 right-0 w-80 bg-[#111] border border-[#2a2a2a] rounded-2xl shadow-2xl z-50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e1e1e]">
        <p className="text-sm font-semibold text-white">Hediye Gönder</p>
        <div className="flex items-center gap-2">
          <span className="text-xs text-amber-400 font-mono font-bold">{tokenBalance.toLocaleString()} 🪙</span>
          <button onClick={onClose} className="text-[#555] hover:text-white transition-colors text-lg leading-none">&times;</button>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-1.5 p-3">
        {GIFT_ITEMS.map(g => (
          <button key={g.id} onClick={() => setSelected(g)}
            className={cn(
              "flex flex-col items-center gap-1 p-2 rounded-xl border transition-all",
              selected.id === g.id ? "border-primary/50 bg-primary/10" : "border-transparent bg-[#1a1a1a] hover:bg-[#222]"
            )}>
            <span className="text-2xl">{g.emoji}</span>
            <span className="text-[10px] text-[#888]">{g.name}</span>
            <span className="text-[10px] text-amber-400 font-mono font-bold">{g.tokens}🪙</span>
          </button>
        ))}
      </div>
      <div className="px-3 pb-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-1.5">
            <button onClick={() => setCount(Math.max(1, count - 1))} className="text-[#666] hover:text-white w-5 text-center font-bold">-</button>
            <span className="text-sm text-white font-mono w-6 text-center">{count}</span>
            <button onClick={() => setCount(count + 1)} className="text-[#666] hover:text-white w-5 text-center font-bold">+</button>
          </div>
          <div className="flex gap-1.5">
            {[1, 5, 10, 99].map(n => (
              <button key={n} onClick={() => setCount(n)}
                className={cn("text-[10px] px-2 py-1.5 rounded-lg border transition-all font-medium",
                  count === n ? "border-primary/40 bg-primary/10 text-primary" : "border-[#222] text-[#666] hover:text-white")}>
                ×{n}
              </button>
            ))}
          </div>
        </div>
        <button onClick={send} disabled={!canAfford || sending}
          className={cn(
            "w-full py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2",
            canAfford ? "bg-primary hover:bg-primary/90 text-white" : "bg-[#222] text-[#555] cursor-not-allowed"
          )}>
          {sending ? "Gönderiliyor..." : canAfford
            ? <>{selected.emoji} {count > 1 ? `${count}x ` : ""}{selected.name} Gönder · {totalCost}🪙</>
            : `Yetersiz bakiye (${totalCost}🪙 gerekli)`}
        </button>
      </div>
    </div>
  );
}

interface GiftToastProps {
  events: GiftEvent[];
}

export function GiftToastStack({ events }: GiftToastProps) {
  return (
    <div className="absolute left-3 bottom-20 space-y-2 z-40 pointer-events-none">
      {events.map(ev => (
        <div key={ev.id}
          className="flex items-center gap-2.5 bg-black/70 backdrop-blur border border-white/10 rounded-2xl px-3 py-2 animate-in slide-in-from-left-4 duration-300">
          <span className="text-2xl">{ev.gift.emoji}</span>
          <div>
            <p className="text-xs font-bold text-white leading-tight">{ev.senderName}</p>
            <p className="text-[11px] text-[#aaa]">
              {ev.count > 1 ? `${ev.count}× ` : ""}{ev.gift.name} gönderdi
              <span className="text-amber-400 font-mono ml-1">+{ev.gift.tokens * ev.count}🪙</span>
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

interface LiveLeaderboardProps {
  entries: { rank: number; username: string; totalTokens: number; topGift: string }[];
}

export function LiveLeaderboard({ entries }: LiveLeaderboardProps) {
  const RANK_COLORS = ["text-amber-400", "text-slate-300", "text-amber-600"];
  const RANK_EMOJIS = ["🥇", "🥈", "🥉"];

  return (
    <div className="bg-[#111] border border-[#222] rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-[#1e1e1e]">
        <p className="text-sm font-bold text-white flex items-center gap-2">🏆 Sıralama</p>
      </div>
      <div className="divide-y divide-[#1a1a1a]">
        {entries.length === 0 && (
          <p className="text-center text-xs text-[#555] py-6">Henüz hediye gönderilmedi.</p>
        )}
        {entries.map(e => (
          <div key={e.rank} className="flex items-center gap-3 px-4 py-2.5">
            <span className="text-sm w-6 text-center">{RANK_EMOJIS[e.rank - 1] ?? e.rank}</span>
            <span className="flex-1 text-sm text-white font-medium truncate">{e.username}</span>
            <span className="text-[11px] text-amber-400 font-mono">{e.totalTokens.toLocaleString()}🪙</span>
          </div>
        ))}
      </div>
    </div>
  );
}
