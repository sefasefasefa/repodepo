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

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuth() as any;
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotifItem[]>([]);
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchInitial = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch("/api/notifications?limit=30", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return;
      const d = await r.json();
      setNotifications(d.notifications ?? []);
      setUnreadCount(d.unreadCount ?? 0);
    } catch {}
  }, [token]);

  const connect = useCallback(() => {
    if (!token || !user) return;
    if (esRef.current) { esRef.current.close(); esRef.current = null; }

    const es = new EventSource(`/api/notifications/stream?token=${encodeURIComponent(token)}`);
    esRef.current = es;

    es.addEventListener("connected", () => {
      setConnected(true);
      fetchInitial();
    });

    es.addEventListener("notification", (e) => {
      try {
        const notif: NotifItem = JSON.parse(e.data);
        setNotifications(prev => [notif, ...prev].slice(0, 50));
        setUnreadCount(c => c + 1);
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification(notif.title, { body: notif.message, icon: "/favicon.ico" });
        }
      } catch {}
    });

    es.addEventListener("ping", () => {});

    es.onerror = () => {
      setConnected(false);
      es.close();
      esRef.current = null;
      retryRef.current = setTimeout(connect, 5000);
    };
  }, [token, user, fetchInitial]);

  useEffect(() => {
    if (user && token) {
      fetchInitial();
      connect();
    } else {
      setConnected(false);
      setUnreadCount(0);
      setNotifications([]);
      esRef.current?.close();
    }
    return () => {
      esRef.current?.close();
      if (retryRef.current) clearTimeout(retryRef.current);
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
