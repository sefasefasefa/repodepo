import { AppLayout } from "@/components/layout/app-layout";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { CheckCheck, Bell, Heart, UserPlus, MessageSquare, Star, Video, DollarSign } from "lucide-react";
import { useNotifications } from "@/lib/use-notifications";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

const TYPE_CONFIG: Record<string, { icon: any; color: string; bg: string }> = {
  like:         { icon: Heart,        color: "text-red-400",    bg: "bg-red-900/20" },
  follow:       { icon: UserPlus,     color: "text-blue-400",   bg: "bg-blue-900/20" },
  comment:      { icon: MessageSquare,color: "text-green-400",  bg: "bg-green-900/20" },
  subscription: { icon: Star,         color: "text-yellow-400", bg: "bg-yellow-900/20" },
  upload:       { icon: Video,        color: "text-primary",    bg: "bg-primary/10" },
  payment:      { icon: DollarSign,   color: "text-emerald-400",bg: "bg-emerald-900/20" },
  default:      { icon: Bell,         color: "text-[#888]",     bg: "bg-[#252525]" },
};

export default function Notifications() {
  const { notifications, unreadCount, markRead, markAllRead, connected } = useNotifications();

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Bell className="h-5 w-5" /> Bildirimler
            </h1>
            {unreadCount > 0 && (
              <span className="bg-primary text-white text-xs font-bold px-2 py-0.5 rounded-full">{unreadCount}</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className={cn("flex items-center gap-1.5 text-xs", connected ? "text-green-400" : "text-[#555]")}>
              <div className={cn("w-1.5 h-1.5 rounded-full", connected ? "bg-green-400 animate-pulse" : "bg-[#444]")} />
              {connected ? "Canlı" : "Bağlı değil"}
            </div>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="flex items-center gap-1.5 text-xs text-[#888] hover:text-white px-3 py-1.5 rounded-lg bg-[#1e1e1e] border border-[#2a2a2a] hover:border-[#444] transition-colors">
                <CheckCheck className="h-3.5 w-3.5" /> Tümünü okundu say
              </button>
            )}
          </div>
        </div>

        {notifications.length === 0 ? (
          <div className="text-center py-16 text-[#555]">
            <Bell className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p className="font-medium text-[#aaa]">Henüz bildirim yok</p>
            <p className="text-sm mt-1">Yeni takipçi, yorum veya beğenilerde burada görünür</p>
          </div>
        ) : (
          <div className="space-y-1">
            {notifications.map(notif => {
              const cfg = TYPE_CONFIG[notif.type] ?? TYPE_CONFIG.default;
              const Icon = cfg.icon;
              return (
                <div
                  key={notif.id}
                  onClick={() => { if (!notif.isRead) markRead(notif.id); }}
                  className={cn(
                    "flex items-start gap-3 p-4 rounded-xl border transition-all cursor-pointer",
                    notif.isRead ? "bg-[#161616] border-transparent hover:border-[#2a2a2a]" : "bg-primary/5 border-primary/20 hover:bg-primary/8"
                  )}
                >
                  <div className={cn("p-2 rounded-lg shrink-0 mt-0.5", cfg.bg)}>
                    <Icon className={cn("h-4 w-4", cfg.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2">
                      {notif.actor && (
                        <Avatar className="h-7 w-7 shrink-0">
                          <AvatarImage src={notif.actor.avatarUrl || ""} />
                          <AvatarFallback className="text-[10px]">{notif.actor.username?.substring(0,2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[#ddd] leading-snug">
                          {notif.actor && <span className="font-semibold">@{notif.actor.username} </span>}
                          {notif.message}
                        </p>
                        <p className="text-xs text-[#555] mt-0.5">
                          {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    {notif.actionUrl && (
                      <Link href={notif.actionUrl} onClick={e => e.stopPropagation()}>
                        <span className="text-xs text-primary hover:underline mt-1 inline-block">Görüntüle →</span>
                      </Link>
                    )}
                  </div>
                  {!notif.isRead && <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0 animate-pulse" />}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}