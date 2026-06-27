import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type FeatureState = "enabled" | "disabled" | "maintenance";
export type FeatureFlags = Record<string, FeatureState>;

type FeatureFlagsCtx = {
  flags: FeatureFlags;
  loading: boolean;
  refetch: () => void;
};

const Ctx = createContext<FeatureFlagsCtx>({ flags: {}, loading: true, refetch: () => {} });

const LS_KEY = "ff_cache_v1";
const LS_TTL = 5 * 60 * 1000;

function loadCached(): FeatureFlags | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts < LS_TTL) return data;
  } catch {}
  return null;
}

function saveCache(flags: FeatureFlags) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ data: flags, ts: Date.now() }));
  } catch {}
}

export function FeatureFlagsProvider({ children }: { children: ReactNode }) {
  const [flags, setFlags] = useState<FeatureFlags>(() => loadCached() ?? {});
  const [loading, setLoading] = useState(() => loadCached() === null);

  const fetchFlags = async () => {
    try {
      const res = await fetch("/api/features");
      const data = await res.json();
      if (data.flags) {
        setFlags(data.flags);
        saveCache(data.flags);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    const cached = loadCached();
    if (cached) {
      setFlags(cached);
      setLoading(false);
      fetchFlags();
    } else {
      fetchFlags();
    }
  }, []);

  return <Ctx.Provider value={{ flags, loading, refetch: fetchFlags }}>{children}</Ctx.Provider>;
}

export function useFeatureFlags() {
  return useContext(Ctx);
}

export function useFeatureState(key: string) {
  const { flags } = useFeatureFlags();
  return flags[key] ?? "enabled";
}

export function isFeatureEnabled(state: FeatureState) {
  return state === "enabled";
}

export function isFeatureMaintenance(state: FeatureState) {
  return state === "maintenance";
}

export function isFeatureDisabled(state: FeatureState) {
  return state === "disabled";
}
