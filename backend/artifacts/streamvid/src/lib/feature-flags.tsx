import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { getInitData, invalidateInitCache } from "./init-prefetch";

export type FeatureState = "enabled" | "disabled" | "maintenance";
export type FeatureFlags = Record<string, FeatureState>;

type FeatureFlagsCtx = {
  flags: FeatureFlags;
  loading: boolean;
  refetch: () => void;
};

const Ctx = createContext<FeatureFlagsCtx>({ flags: {}, loading: true, refetch: () => {} });

export function FeatureFlagsProvider({ children }: { children: ReactNode }) {
  const [flags, setFlags] = useState<FeatureFlags>({});
  const [loading, setLoading] = useState(true);

  const fetchFlags = async () => {
    invalidateInitCache();
    const init = await getInitData();
    if (init?.features?.flags) {
      setFlags(init.features.flags as FeatureFlags);
    }
    setLoading(false);
  };

  useEffect(() => {
    getInitData().then((init) => {
      if (init?.features?.flags) {
        setFlags(init.features.flags as FeatureFlags);
        setLoading(false);
      } else {
        setLoading(false);
      }
    });
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
