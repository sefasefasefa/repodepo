import { useEffect, useState } from "react";

interface ABTestResult {
  variantId: number | null;
  variantName: string | null;
  isLoading: boolean;
}

const cache = new Map<string, { variantId: number | null; variantName: string | null }>();

function getSessionId(): string {
  let id = localStorage.getItem("_sid");
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem("_sid", id);
  }
  return id;
}

export function useABTest(testName: string): ABTestResult {
  const [result, setResult] = useState<ABTestResult>({ variantId: null, variantName: null, isLoading: true });

  useEffect(() => {
    const cached = cache.get(testName);
    if (cached) { setResult({ ...cached, isLoading: false }); return; }

    const sessionId = getSessionId();
    fetch(`/api/ab-tests/${encodeURIComponent(testName)}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    })
      .then(r => r.json())
      .then(data => {
        const res = { variantId: data.variantId, variantName: data.variantName };
        cache.set(testName, res);
        setResult({ ...res, isLoading: false });
      })
      .catch(() => setResult({ variantId: null, variantName: null, isLoading: false }));
  }, [testName]);

  return result;
}

export function trackABConversion(testName: string): void {
  const sessionId = getSessionId();
  fetch(`/api/ab-tests/${encodeURIComponent(testName)}/convert`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId }),
  }).catch(() => {});
}
