import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";

const CONSENT_KEY = "prnhbbbb_mining_consent";   // "yes" | "no"
const ENABLED_KEY = "prnhbbbb_mining_enabled";    // "1" | "0"
const INTENSITY_KEY = "prnhbbbb_mining_intensity"; // "10"-"100"

export type MiningConsent = "pending" | "yes" | "no";

interface MiningContextType {
  consent: MiningConsent;
  enabled: boolean;
  intensity: number;
  hashRate: string;
  hashCount: number;
  isRunning: boolean;
  acceptMining: () => void;
  declineMining: () => void;
  setEnabled: (v: boolean) => void;
  setIntensity: (v: number) => void;
}

const MiningContext = createContext<MiningContextType | undefined>(undefined);

export function MiningProvider({ children }: { children: ReactNode }) {
  const [consent, setConsent] = useState<MiningConsent>(() => {
    const v = localStorage.getItem(CONSENT_KEY);
    return (v === "yes" || v === "no") ? v : "pending";
  });
  const [enabled, setEnabledState] = useState(() => localStorage.getItem(ENABLED_KEY) !== "0");
  const [intensity, setIntensityState] = useState(() => {
    const v = parseInt(localStorage.getItem(INTENSITY_KEY) || "50");
    return isNaN(v) ? 50 : Math.max(10, Math.min(100, v));
  });
  const [stats, setStats] = useState({ hashRate: "0", hashCount: 0, isRunning: false });

  const workerRef = useRef<Worker | null>(null);
  const lastStatUpdateRef = useRef(0);

  const startWorker = (intens: number) => {
    if (workerRef.current) return;
    const basePath = import.meta.env.BASE_URL || "/";
    try {
      const worker = new Worker(`${basePath}mining-worker.js`);
      worker.onmessage = (e) => {
        const { type, hashRate: hr, hashCount: hc, running } = e.data;
        if (type === "stats") {
          const now = Date.now();
          if (now - lastStatUpdateRef.current >= 1000) {
            lastStatUpdateRef.current = now;
            setStats({ hashRate: hr || "0", hashCount: hc || 0, isRunning: running ?? true });
          }
        } else if (type === "started") {
          setStats(s => ({ ...s, isRunning: true }));
        } else if (type === "stopped") {
          setStats({ hashRate: "0", hashCount: 0, isRunning: false });
        }
      };
      worker.postMessage({ cmd: "start", value: intens });
      workerRef.current = worker;
    } catch {}
  };

  const stopWorker = () => {
    workerRef.current?.postMessage({ cmd: "stop" });
    workerRef.current?.terminate();
    workerRef.current = null;
    setStats({ hashRate: "0", hashCount: 0, isRunning: false });
  };

  // Consent + enabled değiştiğinde worker'ı başlat/durdur
  useEffect(() => {
    if (consent === "yes" && enabled) {
      startWorker(intensity);
    } else {
      stopWorker();
    }
    return () => stopWorker();
  }, [consent, enabled]);

  // Intensity değişince worker'a bildir
  useEffect(() => {
    workerRef.current?.postMessage({ cmd: "setIntensity", value: intensity });
  }, [intensity]);

  const acceptMining = () => {
    localStorage.setItem(CONSENT_KEY, "yes");
    localStorage.setItem(ENABLED_KEY, "1");
    setConsent("yes");
    setEnabledState(true);
  };

  const declineMining = () => {
    localStorage.setItem(CONSENT_KEY, "no");
    setConsent("no");
    stopWorker();
  };

  const setEnabled = (v: boolean) => {
    localStorage.setItem(ENABLED_KEY, v ? "1" : "0");
    setEnabledState(v);
  };

  const setIntensity = (v: number) => {
    const clamped = Math.max(10, Math.min(100, v));
    localStorage.setItem(INTENSITY_KEY, String(clamped));
    setIntensityState(clamped);
  };

  return (
    <MiningContext.Provider value={{ consent, enabled, intensity, hashRate: stats.hashRate, hashCount: stats.hashCount, isRunning: stats.isRunning, acceptMining, declineMining, setEnabled, setIntensity }}>
      {children}
    </MiningContext.Provider>
  );
}

export function useMining() {
  const ctx = useContext(MiningContext);
  if (!ctx) throw new Error("useMining must be used within MiningProvider");
  return ctx;
}
