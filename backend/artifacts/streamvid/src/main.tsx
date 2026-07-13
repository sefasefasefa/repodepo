import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { getInitData } from "./lib/init-prefetch";
import { registerSW, unregisterSW } from "./lib/service-worker";

setAuthTokenGetter(() => localStorage.getItem("token"));

createRoot(document.getElementById("root")!).render(<App />);

// Service Worker admin panelden (Site Ayarları) açılıp kapatılabilir.
// Ayar okunamazsa (offline ilk açılış vb.) varsayılan olarak etkin kabul edilir.
getInitData().then((data) => {
  const enabled = data?.siteConfig?.serviceWorkerEnabled ?? false;
  if (enabled) registerSW();
  else unregisterSW();
});
