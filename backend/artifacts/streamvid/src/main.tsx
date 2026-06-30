import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import "./lib/init-prefetch";

setAuthTokenGetter(() => localStorage.getItem("token"));

createRoot(document.getElementById("root")!).render(<App />);
