import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";

/**
 * Sidebar badge: pending + running crosspost görev sayısını döner.
 * Creator/admin değilse ya da token yoksa 0 döner.
 * Aktif görev varken 8 saniyede bir, yokken 30 saniyede bir yoklar.
 */
export function useCrosspostBadge(): number {
  const { token, user } = useAuth() as any;
  const [count, setCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isCreator = user?.role === "creator" || user?.role === "admin";

  const poll = async () => {
    if (!token || !isCreator) { setCount(0); return; }
    try {
      const res = await fetch("/api/cross-post/jobs", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const d = await res.json();
      const active = (d.jobs ?? []).filter(
        (j: { status: string }) => j.status === "pending" || j.status === "running"
      ).length;
      setCount(active);
    } catch {
      // sessizce geç
    }
  };

  useEffect(() => {
    if (!token || !isCreator) { setCount(0); return; }

    poll();

    const schedule = () => {
      if (timerRef.current) clearInterval(timerRef.current);
      // aktif görev varsa daha sık, yoksa daha seyrek
      const interval = count > 0 ? 8000 : 30000;
      timerRef.current = setInterval(poll, interval);
    };

    schedule();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isCreator, count]);

  return count;
}
