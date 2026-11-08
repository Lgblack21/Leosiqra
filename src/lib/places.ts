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
  /** Waktu transaksi dicatat (ISO) — untuk urutan & jam di Jejak. */
  created_at?: string | null;
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
  removeAll: () => cloudflareApi<{ ok: true; deleted: number }>('/api/member/places', { method: 'DELETE' }),
  // Pencarian dikirim hanya saat user menekan Cari (kebijakan Nominatim melarang autocomplete).
  search: (q: string) => cloudflareApi<{ items: SearchHit[] }>(`/api/member/places/search?q=${encodeURIComponent(q)}`),
};

// GPS satu kali (bukan pelacakan). Ditolak / tidak didukung → error dengan pesan yang jelas.
export type GpsFix = { lat: number; lng: number; accuracy: number };
export const currentPosition = () =>
  new Promise<GpsFix>((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation)
      return reject(new Error('Perangkat ini tidak mendukung lokasi.'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy ?? 9999 }),
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

// ── Setelan lokasi di PERANGKAT INI (localStorage) — tidak pernah dikirim ke server. ──
// Zona privat: transaksi yang ditandai otomatis di dalam radius zona tidak menyimpan koordinat.
export type PrivateZone = { id: 'rumah' | 'kantor'; lat: number; lng: number; radius: number };
export const ZONE_META: Record<PrivateZone['id'], { label: string; emoji: string }> = {
  rumah: { label: 'Rumah', emoji: '🏠' },
  kantor: { label: 'Kantor', emoji: '🏢' },
};
export const ZONE_RADII = [100, 200, 500] as const;
/** Akurasi GPS terburuk yang masih boleh ditempel otomatis (meter). */
export const MAX_AUTO_ACCURACY = 100;
const ZONE_KEY = 'leosiqra-peta-zona';
const AUTO_KEY = 'leosiqra-peta-otomatis';
const store = {
  get(k: string) {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k: string, v: string | null) {
    try {
      if (v === null) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    } catch {
      /* mode privat / penyimpanan diblokir — setelan cukup berlaku sesi ini */
    }
  },
};
export const placePrefs = {
  zones(): PrivateZone[] {
    try {
      const v = JSON.parse(store.get(ZONE_KEY) ?? '[]');
      return Array.isArray(v)
        ? v.filter(
            (z) =>
              (z?.id === 'rumah' || z?.id === 'kantor') &&
              Number.isFinite(z.lat) &&
              Number.isFinite(z.lng) &&
              Number.isFinite(z.radius),
          )
        : [];
    } catch {
      return [];
    }
  },
  setZone(z: PrivateZone) {
    store.set(ZONE_KEY, JSON.stringify([...placePrefs.zones().filter((x) => x.id !== z.id), z]));
  },
  removeZone(id: PrivateZone['id']) {
    store.set(ZONE_KEY, JSON.stringify(placePrefs.zones().filter((x) => x.id !== id)));
  },
  auto: () => store.get(AUTO_KEY) === '1',
  setAuto: (on: boolean) => store.set(AUTO_KEY, on ? '1' : null),
};
/** Zona privat yang memuat titik ini (memperhitungkan ketidakpastian GPS), atau null. */
export const zoneAt = (p: { lat: number; lng: number; accuracy?: number }) =>
  placePrefs.zones().find((z) => distanceKm(z, p) * 1000 <= z.radius + Math.min(p.accuracy ?? 0, 100)) ?? null;

// Tempat yang pernah kamu tandai (dimuat sekali per sesi) — untuk menyarankan nama tempat terdekat.
let known: Promise<PlacedTx[]> | null = null;
export const knownPlaces = (fresh = false) => {
  if (!known || fresh)
    known = placeService
      .list(365)
      .then((r) => r.items)
      .catch(() => {
        known = null;
        return [];
      });
  return known;
};
export const nearestKnown = async (p: { lat: number; lng: number }, maxM = 60) => {
  let best: { name: string; d: number; address: string | null } | null = null;
  for (const t of await knownPlaces()) {
    if (!t.name) continue;
    const d = distanceKm(p, t) * 1000;
    if (d <= maxM && (!best || d < best.d)) best = { name: t.name, d, address: t.address };
  }
  return best;
};

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

// ── Jejak: perjalanan belanja satu hari ─────────────────────────────────────
export type Stop = PlacedTx & { label: string; time: string | null; order: number };
export type Leg = { km: number; mode: 'jalan' | 'kendaraan'; minutes: number };
const localDay = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const hhmm = (iso: string) =>
  new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }).replace(':', '.');
/** Hari-hari yang punya belanja berlokasi (terbaru dulu) beserta perhentiannya, urut jam dicatat. */
export function dayTrips(items: PlacedTx[]) {
  const days = new Map<string, PlacedTx[]>();
  for (const t of items) {
    if (t.type !== 'pengeluaran' || isInvestmentFlow({ type: t.type, category: t.category })) continue;
    const day = String(t.date).slice(0, 10);
    days.set(day, [...(days.get(day) ?? []), t]);
  }
  return [...days.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([day, list]) => {
      const all: Stop[] = [...list]
        .sort((a, b) => String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')))
        .map((t) => ({
          ...t,
          label: (t.name || t.note || t.category || 'Tempat').trim(),
          // Jam hanya bisa dipercaya kalau transaksi dicatat di hari yang sama.
          time: t.created_at && localDay(t.created_at) === day ? hhmm(t.created_at) : null,
          order: 0,
        }));
      // Rute hanya dari perhentian yang jamnya jelas; yang dicatat di hari lain urutannya tidak diketahui.
      const timed = all.filter((s) => s.time);
      const route = timed.length >= 2 ? timed : all;
      const stops = route.map((s, i) => ({ ...s, order: i + 1 }));
      const extra = timed.length >= 2 ? all.filter((s) => !s.time) : [];
      const legs: Leg[] = stops.slice(1).map((s, i) => {
        const km = distanceKm(stops[i], s);
        // Perkiraan kasar dari jarak garis lurus: ≤1,2 km jalan kaki (5 km/j), selebihnya kendaraan (±22 km/j di kota).
        const mode = km <= 1.2 ? 'jalan' : 'kendaraan';
        return { km, mode, minutes: Math.max(1, Math.round((km / (mode === 'jalan' ? 5 : 22)) * 60)) };
      });
      return {
        day,
        stops,
        extra,
        legs,
        total: all.reduce((a, s) => a + idrOf(s), 0),
        km: legs.reduce((a, l) => a + l.km, 0),
      };
    });
}
export type DayTrip = ReturnType<typeof dayTrips>[number];
