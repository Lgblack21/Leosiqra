import { cloudflareApi } from '@/lib/cloudflare-api';
import type { TemplateId } from '@/lib/kanvas/templates';

export type NoteColor = 'kuning' | 'hijau' | 'biru' | 'pink' | 'ungu';
export type CanvasState = {
  v: 1;
  answers: Record<string, string>;
  done: Record<string, true>;
  nums: Record<string, number>;
  pos: Record<string, [number, number]>;
  notes: { id: string; text: string; x: number; y: number; color: NoteColor }[];
};
export type CanvasMeta = { id: string; template: TemplateId; title: string; rev: number; updated_at: string };
export type Canvas = CanvasMeta & { state: CanvasState };

export const emptyState = (): CanvasState => ({ v: 1, answers: {}, done: {}, nums: {}, pos: {}, notes: [] });

// Migrasi 0041 belum jalan (server menjawab ready:false / 503) → kanvas disimpan di perangkat ini.
const LOCAL_KEY = 'leosiqra-kanvas-v1';
type LocalStore = Record<string, Canvas>;
const readLocal = (): LocalStore => {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}') as LocalStore;
  } catch {
    return {};
  }
};
const writeLocal = (s: LocalStore) => {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(s));
  } catch {
    /* penyimpanan penuh/diblokir */
  }
};

let mode: 'server' | 'local' = 'server';
export const canvasMode = () => mode;

export const canvasService = {
  async list(): Promise<CanvasMeta[]> {
    const r = await cloudflareApi<{ items: CanvasMeta[]; ready: boolean }>('/api/member/canvas', { cache: 'no-store' });
    mode = r.ready ? 'server' : 'local';
    if (r.ready) return r.items;
    return Object.values(readLocal())
      .map((c) => ({ id: c.id, template: c.template, title: c.title, rev: c.rev, updated_at: c.updated_at }))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  },
  async create(id: string, template: TemplateId, title: string) {
    if (mode === 'local') {
      const s = readLocal();
      s[id] = { id, template, title, rev: 0, updated_at: new Date().toISOString(), state: emptyState() };
      writeLocal(s);
      return;
    }
    await cloudflareApi('/api/member/canvas', { method: 'POST', json: { id, template, title } });
  },
  async get(id: string): Promise<Canvas | null> {
    if (mode === 'server') {
      try {
        const r = await cloudflareApi<{ canvas: Canvas }>(`/api/member/canvas/${id}`, { cache: 'no-store' });
        return r.canvas;
      } catch (e) {
        // Dibuka langsung dari tautan sebelum daftar dimuat: cek dulu apakah server sudah siap.
        await canvasService.list().catch(() => null);
        if (canvasMode() !== 'local') throw e;
      }
    }
    return readLocal()[id] ?? null;
  },
  // Mengembalikan rev baru. Gagal → pemanggil memuat ulang & membandingkan rev (409 = diubah perangkat lain).
  async save(id: string, rev: number, state: CanvasState, title?: string): Promise<number> {
    if (mode === 'local') {
      const s = readLocal();
      if (!s[id]) throw new Error('Kanvas tidak ditemukan.');
      s[id] = { ...s[id], state, title: title || s[id].title, rev: rev + 1, updated_at: new Date().toISOString() };
      writeLocal(s);
      return rev + 1;
    }
    const r = await cloudflareApi<{ rev: number }>(`/api/member/canvas/${id}`, {
      method: 'PUT',
      json: { rev, state, ...(title ? { title } : {}) },
    });
    return r.rev;
  },
  async remove(id: string) {
    if (mode === 'local') {
      const s = readLocal();
      delete s[id];
      writeLocal(s);
      return;
    }
    await cloudflareApi(`/api/member/canvas/${id}`, { method: 'DELETE' });
  },
};
