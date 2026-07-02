import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "./auth";

interface NotifItem {
  id: number;
  type: string;
  title: string;
  message: string;
  actionUrl?: string;
  actorId?: number;
  isRead: boolean;
  createdAt: string;
  actor?: { username: string; avatarUrl?: string };
}

interface NotifCtx {
  unreadCount: number;
  notifications: NotifItem[];
  markRead: (id: number) => void;
  markAllRead: () => void;
  connected: boolean;
}

const Ctx = createContext<NotifCtx>({ unreadCount: 0, notifications: [], markRead: () => {}, markAllRead: () => {}, connected: false });

// Mobile: 2 min, desktop: 30 s
const POLL_INTERVAL = typeof window !== "undefined" && window.innerWidth < 1024 ? 120_000 : 30_000;

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuth() as any;
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotifItem[]>([]);
  const [connected, setConnected] = useState(false);
  const lastIdRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch("/api/notifications?limit=30", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) { setConnected(false); return; }
      const d = await r.json();
      const items: NotifItem[] = d.notifications ?? [];
      setNotifications(items);
      setUnreadCount(d.unreadCount ?? 0);
      setConnected(true);

      const maxId = items.reduce((m, n) => Math.max(m, n.id), 0);
      if (maxId > lastIdRef.current) {
        if (lastIdRef.current > 0) {
          const newItems = items.filter(n => n.id > lastIdRef.current);
          newItems.forEach(n => {
            if ("Notification" in window && Notification.permission === "granted") {
              new Notification(n.title, { body: n.message, icon: "/favicon.ico" });
            }
          });
        }
        lastIdRef.current = maxId;
      }
    } catch {
      setConnected(false);
    }
  }, [token]);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    if (user && token) {
      // Mobilde 12s, masaüstünde 3s gecikme — kritik sayfa yükü bitmeden istek yok
      const isMob = typeof window !== "undefined" && window.innerWidth < 1024;
      const startDelay = setTimeout(() => {
        fetchNotifications();
        timerRef.current = setInterval(fetchNotifications, POLL_INTERVAL);
      }, isMob ? 12_000 : 3_000);
      const onVis = () => {
        if (document.hidden) {
          if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        } else {
          if (!timerRef.current) { fetchNotifications(); timerRef.current = setInterval(fetchNotifications, POLL_INTERVAL); }
        }
      };
      document.addEventListener("visibilitychange", onVis);
      return () => {
        clearTimeout(startDelay);
        if (timerRef.current) clearInterval(timerRef.current);
        document.removeEventListener("visibilitychange", onVis);
      };
    } else {
      setConnected(false);
      setUnreadCount(0);
      setNotifications([]);
      lastIdRef.current = 0;
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [user?.id, token]);

  const markRead = useCallback(async (id: number) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    setUnreadCount(c => Math.max(0, c - 1));
    await fetch(`/api/notifications/${id}/read`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
  }, [token]);

  const markAllRead = useCallback(async () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnreadCount(0);
    await fetch("/api/notifications/read-all", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
  }, [token]);

  return <Ctx.Provider value={{ unreadCount, notifications, markRead, markAllRead, connected }}>{children}</Ctx.Provider>;
}

export const useNotifications = () => useContext(Ctx);
