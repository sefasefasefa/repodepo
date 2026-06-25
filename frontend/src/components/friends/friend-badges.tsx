import { cn } from "@/lib/utils";
import { CircleUser, Users, Clock3, Store } from "lucide-react";

export function PresenceDot({ status }: { status: "online" | "away" | "offline" }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold border", status === "online" ? "bg-green-500/10 text-green-400 border-green-500/20" : status === "away" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : "bg-red-500/10 text-red-400 border-red-500/20") }>
      <span className={cn("w-2 h-2 rounded-full", status === "online" ? "bg-green-400" : status === "away" ? "bg-amber-400" : "bg-red-400")} />
    </span>
  );
}

export function FriendTag({ label = "Arkadaş" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
      <Users className="h-3 w-3" />
    </span>
  );
}

export function ActivityTag({ text = "Aktif şimdi" }: { text?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20">
      <Clock3 className="h-3 w-3" />
      {text}
    </span>
  );
}

export function CreatorTag({ text = "Creator" }: { text?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
      <CircleUser className="h-3 w-3" />
      {text}
    </span>
  );
}

export function CreatorStoreTag({ text = "Mağaza yakında" }: { text?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
      <Store className="h-3 w-3" />
      {text}
    </span>
  );
}
