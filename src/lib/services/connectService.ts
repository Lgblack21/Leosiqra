import { cloudflareApi } from '../cloudflare-api';
import { notifyCollectionChanged } from '../cf-firestore';

// Aplikasi terhubung (link rahasia), Kotak masuk, dan Peta — Worker fase 5
// (tabel ap_tokens, ib_drafts, pt_places).

export type ConnectPurpose = 'inbox' | 'calendar' | 'sheets';
export interface ConnectLink { purpose: ConnectPurpose; created_at: string; last_used_at: string | null }

export const connectService = {
  async list() {
    return (await cloudflareApi<{ items: ConnectLink[] }>('/api/member/connect')).items;
  },
  /** Buat / buat ulang — URL hanya dikembalikan sekali. */
  async create(purpose: ConnectPurpose) {
    return (await cloudflareApi<{ ok: boolean; url: string }>(`/api/member/connect/${purpose}`, { method: 'POST' })).url;
  },
  async revoke(purpose: ConnectPurpose) {
    await cloudflareApi(`/api/member/connect/${purpose}`, { method: 'DELETE' });
  },
};

export interface InboxDraft { id: string; source: 'shortcut' | 'paste'; raw_text: string; created_at: string }

export const inboxService = {
  async list() {
    return (await cloudflareApi<{ items: InboxDraft[] }>('/api/member/inbox')).items;
  },
  async paste(text: string) {
    const r = await cloudflareApi<{ ok: boolean; added: number }>('/api/member/inbox', { method: 'POST', json: { text } });
    notifyCollectionChanged('inbox');
    return r.added;
  },
  async remove(id: string) {
    await cloudflareApi(`/api/member/inbox/${id}`, { method: 'DELETE' });
    notifyCollectionChanged('inbox');
  },
};

export interface Place {
  transaction_id: string;
  name: string | null;
  lat: number;
  lng: number;
  created_at: string;
  date: string;
  type: string;
  category: string;
  note: string | null;
  amount_idr: number;
}

export const placeService = {
  async list() {
    return (await cloudflareApi<{ items: Place[] }>('/api/member/places')).items;
  },
  async set(transactionId: string, data: { lat: number; lng: number; name?: string }) {
    await cloudflareApi(`/api/member/places/${transactionId}`, { method: 'PUT', json: data });
    notifyCollectionChanged('places');
  },
  async remove(transactionId: string) {
    await cloudflareApi(`/api/member/places/${transactionId}`, { method: 'DELETE' });
    notifyCollectionChanged('places');
  },
};
