import { useEffect } from "react";

declare global {
  interface Navigator {
    modelContext?: {
      provideContext: (ctx: WebMCPContext) => void;
    };
  }
}

interface WebMCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (params: Record<string, unknown>) => Promise<unknown>;
}

interface WebMCPContext {
  tools: WebMCPTool[];
}

const BASE_URL = "";

async function apiGet(path: string, params?: Record<string, string>) {
  const url = new URL(BASE_URL + path, window.location.origin);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = localStorage.getItem("token");
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url.toString(), { headers });
  if (!res.ok) throw new Error(`API error ${res.status}: ${res.statusText}`);
  return res.json();
}

async function apiPost(path: string, body: Record<string, unknown>) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = localStorage.getItem("token");
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(BASE_URL + path, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${res.statusText}`);
  return res.json();
}

const TOOLS: WebMCPTool[] = [
  {
    name: "search_videos",
    description:
      "Search and list public videos on Hotpulse. Supports keyword search, category filter, and sort order.",
    inputSchema: {
      type: "object",
      properties: {
        q: { type: "string", description: "Search keyword" },
        category: { type: "string", description: "Category slug to filter by" },
        ordering: {
          type: "string",
          enum: ["-created_at", "-view_count", "-like_count", "created_at"],
          description: "Sort order",
        },
        page: { type: "integer", description: "Page number (default 1)", default: 1 },
      },
    },
    execute: async (p) =>
      apiGet("/api/videos/", {
        ...(p.q ? { search: String(p.q) } : {}),
        ...(p.category ? { category: String(p.category) } : {}),
        ...(p.ordering ? { ordering: String(p.ordering) } : {}),
        ...(p.page ? { page: String(p.page) } : {}),
      }),
  },
  {
    name: "get_video",
    description: "Get full metadata (title, description, thumbnails, duration, view count) for a single video by its ID.",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: ["string", "integer"], description: "Video ID or slug" },
      },
    },
    execute: async (p) => apiGet(`/api/videos/${p.id}/`),
  },
  {
    name: "list_categories",
    description: "List all available video categories on the platform.",
    inputSchema: {
      type: "object",
      properties: {},
    },
    execute: async () => apiGet("/api/videos/categories/"),
  },
  {
    name: "get_user_profile",
    description: "Fetch a public user or creator profile by username, including follower count and video list.",
    inputSchema: {
      type: "object",
      required: ["username"],
      properties: {
        username: { type: "string", description: "Username to look up" },
      },
    },
    execute: async (p) => apiGet(`/api/users/${p.username}/`),
  },
  {
    name: "get_current_user",
    description:
      "Get the currently authenticated user's profile and subscription status. Returns an error if not logged in.",
    inputSchema: {
      type: "object",
      properties: {},
    },
    execute: async () => {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Not authenticated — user must log in first.");
      return apiGet("/api/accounts/me/");
    },
  },
  {
    name: "list_subscription_plans",
    description: "List all available subscription plans including standard and adult-specific tiers with pricing.",
    inputSchema: {
      type: "object",
      properties: {},
    },
    execute: async () => apiGet("/api/subscriptions/plans/"),
  },
  {
    name: "navigate",
    description:
      "Navigate the browser to a specific page within the Hotpulse platform (e.g. home, search, a video page, a user profile).",
    inputSchema: {
      type: "object",
      required: ["path"],
      properties: {
        path: {
          type: "string",
          description: "Relative URL path, e.g. /search?q=cats or /watch/42",
        },
      },
    },
    execute: async (p) => {
      const path = String(p.path);
      window.history.pushState({}, "", path);
      window.dispatchEvent(new PopStateEvent("popstate"));
      return { navigated: path };
    },
  },
  {
    name: "health_check",
    description: "Check whether the Hotpulse API is operational.",
    inputSchema: {
      type: "object",
      properties: {},
    },
    execute: async () => apiGet("/api/healthz"),
  },
];

export function useWebMCP() {
  useEffect(() => {
    if (!navigator.modelContext?.provideContext) return;

    try {
      navigator.modelContext.provideContext({ tools: TOOLS });
    } catch (e) {
      console.warn("[WebMCP] provideContext failed:", e);
    }
  }, []);
}
