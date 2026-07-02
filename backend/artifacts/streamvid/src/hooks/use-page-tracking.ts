import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";

function getOrCreateSessionId(): string {
  let id = localStorage.getItem("_sid");
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem("_sid", id);
  }
  return id;
}

export function usePageTracking() {
  const [location] = useLocation();
  const { user } = useAuth();
  const lastPage = useRef<string>("");

  useEffect(() => {
    if (location === lastPage.current) return;
    lastPage.current = location;

    const sessionId = getOrCreateSessionId();
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page: location, sessionId, userId: (user as any)?.id }),
    }).catch(() => {});
  }, [location, user]);

  useEffect(() => {
    const sessionId = getOrCreateSessionId();
    // Mobile: 5 min, desktop: 60 s
    const trackMs = typeof window !== "undefined" && window.innerWidth < 1024 ? 300_000 : 60_000;
    const interval = setInterval(() => {
      if (document.hidden) return; // skip while tab is backgrounded
      fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page: lastPage.current || "/", sessionId, userId: (user as any)?.id }),
      }).catch(() => {});
    }, trackMs);
    return () => clearInterval(interval);
  }, [user]);
}
