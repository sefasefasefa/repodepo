import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

async function fetchBadges(userId: number) {
  const res = await fetch(`/api/badges/user/${userId}`);
  if (!res.ok) return [];
  const d = await res.json();
  return d.badges || [];
}

interface BadgeDisplayProps {
  userId: number;
  size?: "sm" | "md" | "lg";
  maxVisible?: number;
  className?: string;
}

export function BadgeDisplay({ userId, size = "md", maxVisible = 5, className }: BadgeDisplayProps) {
  const [badges, setBadges] = useState<any[]>([]);
  const [hovered, setHovered] = useState<number | null>(null);

  useEffect(() => {
    fetchBadges(userId).then(setBadges);
  }, [userId]);

  if (!badges.length) return null;

  const visible = badges.slice(0, maxVisible);
  const extra = badges.length - maxVisible;

  const sizeClass = {
    sm: "w-5 h-5 text-[11px]",
    md: "w-7 h-7 text-[15px]",
    lg: "w-9 h-9 text-[18px]",
  }[size];

  return (
    <div className={cn("flex flex-wrap gap-1 items-center", className)}>
      {visible.map((ub: any) => (
        <div key={ub.id} className="relative"
          onMouseEnter={() => setHovered(ub.id)}
          onMouseLeave={() => setHovered(null)}>
          <div
            className={cn(
              "flex items-center justify-center rounded-full border-2 shadow-sm cursor-default transition-transform hover:scale-110",
              sizeClass
            )}
            style={{
              backgroundColor: ub.badge.color + "20",
              borderColor: ub.badge.color + "60",
            }}
          >
            {ub.badge.icon}
          </div>

          {/* Tooltip */}
          {hovered === ub.id && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none">
              <div className="bg-[#1e1e1e] border border-[#333] rounded-xl px-3 py-2 shadow-2xl whitespace-nowrap min-w-[130px] text-center">
                <p className="text-xs font-bold text-white">{ub.badge.icon} {ub.badge.name}</p>
                <p className="text-[10px] text-[#888] mt-0.5 leading-snug">{ub.badge.description}</p>
                <p className="text-[9px] text-[#555] mt-1">
                  {formatDistanceToNow(new Date(ub.earnedAt), { addSuffix: true })} kazanıldı
                </p>
              </div>
              {/* Küçük ok */}
              <div className="w-2 h-2 bg-[#1e1e1e] border-r border-b border-[#333] rotate-45 mx-auto -mt-1" />
            </div>
          )}
        </div>
      ))}
      {extra > 0 && (
        <span className="text-xs text-[#555] font-medium">+{extra}</span>
      )}
    </div>
  );
}

export function BadgeList({ userId }: { userId: number }) {
  const [badges, setBadges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBadges(userId).then(b => { setBadges(b); setLoading(false); });
  }, [userId]);

  if (loading || !badges.length) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-bold text-[#555] uppercase tracking-wider">Rozetler</p>
      <div className="flex flex-wrap gap-2">
        {badges.map((ub: any) => (
          <div key={ub.id}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium"
            style={{
              backgroundColor: ub.badge.color + "15",
              borderColor: ub.badge.color + "40",
              color: ub.badge.color,
            }}>
            <span>{ub.badge.icon}</span>
            <span>{ub.badge.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
