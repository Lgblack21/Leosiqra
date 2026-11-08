import { cloudflareApi } from '@/lib/cloudflare-api';
import { isInvestmentFlow } from '@/lib/utils';

// Peta Belanja: lokasi per transaksi (hanya dari tindakan user — GPS sekali, cari tempat, atau geser pin).
export type PlaceSource = 'gps' | 'cari' | 'pin' | 'struk';
export type PlacedTx = {
  tx_id: string;
  lat: number;
  lng: number;
  name: string | null;
  address: string | null;
  source: PlaceSource;
  date: string;
  type: string;
  amount: number;
  amount_idr: number;
  currency: string | null;
  category: string;
  sub_category: string | null;
  note: string | null;
};
export type SearchHit = { lat: number; lng: number; name: string | null; address: string | null };

export const placeService = {
  list: (days = 90) =>
    cloudflareApi<{ items: PlacedTx[]; ready: boolean }>(`/api/member/places?days=${days}`, { cache: 'no-store' }),
  set: (
    txId: string,
    p: { lat: number; lng: number; name?: string | null; address?: string | null; source: PlaceSource },
  ) => cloudflareApi<{ ok: true }>(`/api/member/places/${encodeURIComponent(txId)}`, { method: 'PUT', json: p }),
  remove: (txId: string) =>
    cloudflareApi<{ ok: true }>(`/api/member/places/${encodeURIComponent(txId)}`, { method: 'DELETE' }),
  // Pencarian dikirim hanya saat user menekan Cari (kebijakan Nominatim melarang autocomplete).
  search: (q: string) => cloudflareApi<{ items: SearchHit[] }>(`/api/member/places/search?q=${encodeURIComponent(q)}`),
};

// GPS satu kali (bukan pelacakan). Ditolak / tidak didukung → error dengan pesan yang jelas.
export const currentPosition = () =>
  new Promise<{ lat: number; lng: number }>((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation)
      return reject(new Error('Perangkat ini tidak mendukung lokasi.'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (e) =>
        reject(
          new Error(
            e.code === e.PERMISSION_DENIED
              ? 'Izin lokasi ditolak. Nyalakan di pengaturan browser/HP, atau cari tempatnya.'
              : 'Lokasi belum bisa didapat. Coba lagi atau cari tempatnya.',
          ),
        ),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  });

const R = 6371;
export const distanceKm = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};

export const idrOf = (t: { amount_idr: number; amount: number }) => Number(t.amount_idr) || Number(t.amount) || 0;

// Kelompokkan transaksi menjadi "tempat": nama sama dalam radius ±150 m, atau tanpa nama dalam ±40 m.
export type Place = {
  key: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  total: number;
  visits: number;
  category: string;
  last: string;
  first: string;
  txs: PlacedTx[];
};
export function groupPlaces(items: PlacedTx[]): Place[] {
  const places: Place[] = [];
  for (const t of items) {
    // Belanja saja: beli investasi & bayar utang bukan "tempat belanja".
    if (t.type !== 'pengeluaran' || isInvestmentFlow({ type: t.type, category: t.category })) continue;
    const label = (t.name || t.note || t.category || 'Tempat').trim();
    const hit = places.find(
      (p) =>
        distanceKm(p, t) <= (p.name.toLowerCase() === label.toLowerCase() ? 0.15 : 0.04) &&
        (p.name.toLowerCase() === label.toLowerCase() || !t.name),
    );
    if (hit) {
      hit.total += idrOf(t);
      hit.visits++;
      hit.txs.push(t);
      if (t.date > hit.last) hit.last = t.date;
      if (t.date < hit.first) hit.first = t.date;
    } else
      places.push({
        key: t.tx_id,
        name: label,
        address: t.address,
        lat: t.lat,
        lng: t.lng,
        total: idrOf(t),
        visits: 1,
        category: t.category,
        last: t.date,
        first: t.date,
        txs: [t],
      });
  }
  // Kategori tempat = kategori dengan belanja terbesar di tempat itu.
  for (const p of places) {
    const by = new Map<string, number>();
    p.txs.forEach((t) => by.set(t.category, (by.get(t.category) ?? 0) + idrOf(t)));
    p.category = [...by.entries()].sort((x, y) => y[1] - x[1])[0][0];
  }
  return places.sort((a, b) => b.total - a.total);
}
