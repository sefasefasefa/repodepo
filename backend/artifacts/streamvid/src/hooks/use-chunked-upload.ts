import { useState, useRef, useCallback } from "react";
import { useAuth } from "@/lib/auth";

export const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB

export type UploadStatus =
  | "idle"
  | "initializing"
  | "uploading"
  | "paused"
  | "assembling"
  | "done"
  | "error"
  | "canceled";

export interface ChunkUploadState {
  status: UploadStatus;
  file: File | null;
  progress: number;
  uploadedBytes: number;
  totalBytes: number;
  speed: number;
  eta: number;
  currentChunk: number;
  totalChunks: number;
  uploadId: string | null;
  videoId: number | null;
  error: string | null;
}

export interface UploadMeta {
  title?: string;
  description?: string;
  categoryId?: number;
  isPremium?: boolean;
  isAdult?: boolean;
  type?: "video" | "short";
  scheduledPublishAt?: string | null;
  crosspostSiteIds?: number[];
}

const INITIAL: ChunkUploadState = {
  status: "idle",
  file: null,
  progress: 0,
  uploadedBytes: 0,
  totalBytes: 0,
  speed: 0,
  eta: 0,
  currentChunk: 0,
  totalChunks: 0,
  uploadId: null,
  videoId: null,
  error: null,
};

export function useChunkedUpload() {
  const { token } = useAuth() as any;
  const [state, setState] = useState<ChunkUploadState>(INITIAL);
  const pausedRef = useRef(false);
  const canceledRef = useRef(false);
  const speedSamples = useRef<number[]>([]);
  const uploadIdRef = useRef<string | null>(null);

  const authHeaders = useCallback(
    (extra?: Record<string, string>) => ({
      Authorization: `Bearer ${token ?? ""}`,
      ...extra,
    }),
    [token]
  );

  const reset = useCallback(() => {
    pausedRef.current = false;
    canceledRef.current = false;
    speedSamples.current = [];
    uploadIdRef.current = null;
    setState(INITIAL);
  }, []);

  const pause = useCallback(() => {
    pausedRef.current = true;
    setState((s) => ({ ...s, status: "paused" }));
  }, []);

  const resume = useCallback(() => {
    pausedRef.current = false;
    setState((s) => ({ ...s, status: "uploading" }));
  }, []);

  const cancel = useCallback(async () => {
    canceledRef.current = true;
    const id = uploadIdRef.current;
    setState((s) => ({ ...s, status: "canceled" }));
    if (id) {
      try {
        await fetch(`/api/upload/chunk-cancel/${id}`, {
          method: "DELETE",
          headers: authHeaders(),
        });
      } catch { /* ignore */ }
    }
  }, [authHeaders]);

  const start = useCallback(
    async (file: File, meta: UploadMeta) => {
      reset();
      canceledRef.current = false;
      pausedRef.current = false;
      speedSamples.current = [];

      setState({
        ...INITIAL,
        status: "initializing",
        file,
        totalBytes: file.size,
      });

      // ── 1. Init session ──────────────────────────────────────────
      let uploadId: string;
      let totalChunks: number;
      try {
        const res = await fetch("/api/upload/chunk-init", {
          method: "POST",
          headers: authHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ filename: file.name, fileSize: file.size }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setState((s) => ({ ...s, status: "error", error: err.error ?? "Başlatma başarısız" }));
          return;
        }
        const data = await res.json();
        uploadId = data.uploadId;
        totalChunks = data.totalChunks;
      } catch (e: any) {
        setState((s) => ({ ...s, status: "error", error: e.message ?? "Ağ hatası" }));
        return;
      }

      uploadIdRef.current = uploadId;
      setState((s) => ({ ...s, status: "uploading", uploadId, totalChunks }));

      // ── 2. Upload chunks ─────────────────────────────────────────
      let uploadedBytes = 0;
      let lastSpeedTime = Date.now();
      let lastSpeedBytes = 0;

      for (let i = 0; i < totalChunks; i++) {
        if (canceledRef.current) return;

        // Wait while paused
        while (pausedRef.current && !canceledRef.current) {
          await new Promise((r) => setTimeout(r, 150));
        }
        if (canceledRef.current) return;

        const sliceStart = i * CHUNK_SIZE;
        const sliceEnd = Math.min(sliceStart + CHUNK_SIZE, file.size);
        const chunk = file.slice(sliceStart, sliceEnd);

        const fd = new FormData();
        fd.append("uploadId", uploadId);
        fd.append("chunkIndex", String(i));
        fd.append("chunk", chunk, `chunk_${i}`);

        // Retry up to 3 times
        let ok = false;
        for (let attempt = 0; attempt < 3 && !ok && !canceledRef.current; attempt++) {
          try {
            const res = await fetch("/api/upload/chunk-part", {
              method: "POST",
              headers: authHeaders(),
              body: fd,
            });
            if (res.ok) {
              ok = true;
            } else if (res.status >= 500) {
              await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
            } else {
              const err = await res.json().catch(() => ({}));
              setState((s) => ({ ...s, status: "error", error: err.error ?? "Chunk hatası" }));
              return;
            }
          } catch {
            await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
          }
        }

        if (!ok) {
          setState((s) => ({ ...s, status: "error", error: `Parça ${i + 1} yüklenemedi` }));
          return;
        }

        uploadedBytes += sliceEnd - sliceStart;

        // Speed & ETA calculation
        const now = Date.now();
        const elapsedSec = (now - lastSpeedTime) / 1000;
        if (elapsedSec >= 0.4) {
          const speed = (uploadedBytes - lastSpeedBytes) / elapsedSec;
          lastSpeedTime = now;
          lastSpeedBytes = uploadedBytes;
          speedSamples.current = [...speedSamples.current.slice(-6), speed];
        }
        const avgSpeed =
          speedSamples.current.length
            ? speedSamples.current.reduce((a, b) => a + b, 0) / speedSamples.current.length
            : 0;
        const remaining = file.size - uploadedBytes;
        const eta = avgSpeed > 0 ? remaining / avgSpeed : 0;

        setState((s) => ({
          ...s,
          uploadedBytes,
          progress: Math.min(99, Math.round((uploadedBytes / file.size) * 100)),
          currentChunk: i + 1,
          speed: avgSpeed,
          eta,
        }));
      }

      if (canceledRef.current) return;

      // ── 3. Complete ──────────────────────────────────────────────
      setState((s) => ({ ...s, status: "assembling", progress: 99 }));
      try {
        const res = await fetch("/api/upload/chunk-complete", {
          method: "POST",
          headers: authHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({
            uploadId,
            title: meta.title || file.name.replace(/\.[^.]+$/, ""),
            description: meta.description ?? "",
            categoryId: meta.categoryId,
            isPremium: meta.isPremium ?? false,
            isAdult: meta.isAdult ?? false,
            type: meta.type ?? "video",
            scheduledPublishAt: meta.scheduledPublishAt ?? null,
            crosspostSiteIds: meta.crosspostSiteIds ?? [],
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setState((s) => ({ ...s, status: "error", error: err.error ?? "Tamamlama başarısız" }));
          return;
        }
        const data = await res.json();
        setState((s) => ({
          ...s,
          status: "done",
          videoId: data.videoId,
          progress: 100,
        }));
      } catch (e: any) {
        setState((s) => ({ ...s, status: "error", error: e.message ?? "Ağ hatası" }));
      }
    },
    [authHeaders, reset]
  );

  return { state, start, pause, resume, cancel, reset };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

export function formatEta(sec: number): string {
  if (!isFinite(sec) || sec <= 0) return "--";
  if (sec < 60) return `${Math.round(sec)}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}dk ${Math.round(sec % 60)}s`;
  return `${Math.floor(sec / 3600)}sa ${Math.floor((sec % 3600) / 60)}dk`;
}
