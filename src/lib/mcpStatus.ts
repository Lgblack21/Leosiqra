'use client';

import { useEffect, useState } from 'react';
import { cloudflareApi } from './cloudflare-api';

// Status "AI-mu tersambung ke Leosiqra (MCP)" dari /api/member/mcp/tokens (token manual
// + koneksi OAuth Claude/ChatGPT yang masih aktif). Dibagi antar komponen; dimuat ulang
// saat tab kembali aktif (mis. habis menghubungkan di claude.ai).
export type McpStatus = { state: 'loading' | 'none' | 'read' | 'write' | 'error'; names: string[] };
type Row = { name: string; scopes: string[] };

let cache: { at: number; value: McpStatus } | null = null;
let inflight: Promise<McpStatus> | null = null;
const listeners = new Set<(s: McpStatus) => void>();

const fetchStatus = (force = false): Promise<McpStatus> => {
  if (!force && cache && Date.now() - cache.at < 30_000) return Promise.resolve(cache.value);
  if (inflight) return inflight;
  inflight = cloudflareApi<{ items: Row[] }>('/api/member/mcp/tokens')
    .then((r) => {
      const items = r.items ?? [];
      const writers = items.filter((t) => t.scopes.includes('write'));
      const value: McpStatus = {
        state: writers.length ? 'write' : items.length ? 'read' : 'none',
        names: [...new Set((writers.length ? writers : items).map((t) => t.name))].slice(0, 3),
      };
      cache = { at: Date.now(), value };
      listeners.forEach((l) => l(value));
      return value;
    })
    .catch(() => ({ state: 'error' as const, names: [] }))
    .finally(() => {
      inflight = null;
    });
  return inflight;
};

export function useMcpStatus(): McpStatus {
  const [s, setS] = useState<McpStatus>(cache?.value ?? { state: 'loading', names: [] });
  useEffect(() => {
    let alive = true;
    const set = (v: McpStatus) => {
      if (alive) setS(v);
    };
    listeners.add(set);
    void fetchStatus().then(set);
    const onVis = () => {
      if (document.visibilityState === 'visible') void fetchStatus(true);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      alive = false;
      listeners.delete(set);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);
  return s;
}

/** Panggil setelah token dibuat/dicabut supaya kartu lain ikut berubah. */
export const refreshMcpStatus = () => {
  void fetchStatus(true);
};
