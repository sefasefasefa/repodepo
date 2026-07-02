import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { getInitData, getInitDataSync, invalidateInitCache } from "./init-prefetch";

export type FeatureState = "enabled" | "disabled" | "maintenance";
export type FeatureFlags = Record<string, FeatureState>;

type FeatureFlagsCtx = {
  flags: FeatureFlags;
  loading: boolean;
  refetch: () => void;
};

const Ctx = createContext<FeatureFlagsCtx>({ flags: {}, loading: true, refetch: () => {} });

export function FeatureFlagsProvider({ children }: { children: ReactNode }) {
  // Senkron başlangıç — inline/cache varsa ilk render'da flagler hazır, skeleton yok
  const [flags, setFlags] = useState<FeatureFlags>(() => {
    const sync = getInitDataSync();
    return (sync?.features?.flags as FeatureFlags) ?? {};
  });
  const [loading, setLoading] = useState(() => !getInitDataSync()?.features?.flags);

  const fetchFlags = async () => {
    invalidateInitCache();
    const init = await getInitData();
    if (init?.features?.flags) {
      setFlags(init.features.flags as FeatureFlags);
    }
    setLoading(false);
  };

  useEffect(() => {
    // Senkron veri yoksa (ilk ziyaret) async fetch yap
    if (loading) {
      getInitData().then((init) => {
        if (init?.features?.flags) setFlags(init.features.flags as FeatureFlags);
        setLoading(false);
      });
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
