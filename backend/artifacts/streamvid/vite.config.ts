import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

const port = Number(process.env.PORT) || 5000;
const basePath = process.env.BASE_PATH || "/";

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    chunkSizeWarningLimit: 800,
    target: "es2020",
    cssCodeSplit: true,
    reportCompressedSize: false,
    rollupOptions: {
      output: {
        sanitizeFileName: (name) => name.replace(/[-_]+(?=\.[^.]+$)/, "x").replace(/[<>:"/\\|?*]/g, "_"),
        manualChunks: {
          "react-query":  ["@tanstack/react-query"],
          "charts":       ["recharts"],
          "icons":        ["lucide-react"],
          // Tooltip yalnızca TooltipProvider tarafından eager yükleniyor → ayrı küçük chunk
          "ui-tooltip":   ["@radix-ui/react-tooltip"],
          // Kalan Radix bileşenleri yalnızca lazy sayfalarda kullanılıyor → ilk yüklemede gelmez
          "ui-radix":     [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-select",
            "@radix-ui/react-tabs",
            "@radix-ui/react-switch",
            "@radix-ui/react-slider",
            "@radix-ui/react-avatar",
            "@radix-ui/react-label",
            "@radix-ui/react-checkbox",
            "@radix-ui/react-toast",
          ],
          "routing":      ["wouter"],
          "utils":        ["date-fns", "clsx", "tailwind-merge", "class-variance-authority"],
          "motion":       ["framer-motion"],
          "zod":          ["zod", "@hookform/resolvers", "react-hook-form"],
        },
      },
    },
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
    proxy: {
      "/api": {
        target: "http://127.0.0.1:5000",
        changeOrigin: true,
        secure: false,
      },
      "/media": {
        target: "http://127.0.0.1:5000",
        changeOrigin: true,
        secure: false,
      },
      "/django-admin": {
        target: "http://127.0.0.1:5000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
