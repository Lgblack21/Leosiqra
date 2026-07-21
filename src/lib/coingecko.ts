export interface CoinOption {
  id: string;
  name: string;
  symbol: string;
  logoUrl: string;
}

// Koin populer ditampilkan sebagai daftar default saat kolom pencarian masih
// kosong. Nama & logo asli tetap diambil live (bukan di-hardcode) supaya
// tidak salah/kadaluarsa.
const POPULAR_IDS = [
  'bitcoin', 'ethereum', 'solana', 'binancecoin', 'ripple', 'cardano',
  'dogecoin', 'polkadot', 'tron', 'litecoin', 'matic-network', 'chainlink',
  'avalanche-2', 'holotoken', 'tether', 'usd-coin',
];

// Cache di level modul supaya tiap kali panel dibuka/ditutup tidak memicu
// fetch baru ke CoinGecko — cukup sekali per sesi browser.
let popularCache: CoinOption[] | null = null;
let popularPromise: Promise<CoinOption[]> | null = null;

export async function loadPopularCoins(): Promise<CoinOption[]> {
  if (popularCache) return popularCache;
  if (popularPromise) return popularPromise;

  popularPromise = (async () => {
    try {
      const res = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${POPULAR_IDS.join(',')}`);
      if (!res.ok) throw new Error(`CoinGecko fetch gagal: ${res.status}`);
      const rows = await res.json() as Array<{ id: string; name: string; symbol: string; image: string }>;
      const byId = new Map(rows.map(r => [r.id, r]));
      const options = POPULAR_IDS.map(id => {
        const row = byId.get(id);
        return {
          id,
          name: row?.name || id,
          symbol: row?.symbol?.toUpperCase() || id.toUpperCase(),
          logoUrl: row?.image || '',
        };
      });
      popularCache = options;
      return options;
    } catch (e) {
      console.error('Gagal memuat daftar koin populer dari CoinGecko:', e);
      // Tetap bisa dipilih (nama saja, tanpa logo) walau API sedang gagal/rate-limit.
      return POPULAR_IDS.map(id => ({ id, name: id, symbol: id.toUpperCase(), logoUrl: '' }));
    } finally {
      popularPromise = null;
    }
  })();

  return popularPromise;
}

// Pencarian bebas mencakup ribuan koin di CoinGecko (bukan cuma daftar
// populer di atas).
const searchCache = new Map<string, CoinOption[]>();

export async function searchCoins(query: string): Promise<CoinOption[]> {
  const key = query.trim().toLowerCase();
  if (!key) return loadPopularCoins();

  const cached = searchCache.get(key);
  if (cached) return cached;

  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(key)}`);
    if (!res.ok) throw new Error(`CoinGecko search gagal: ${res.status}`);
    const data = await res.json() as {
      coins?: Array<{ id: string; name: string; symbol: string; thumb?: string; large?: string; market_cap_rank?: number | null }>;
    };
    const coins = (data.coins || [])
      .sort((a, b) => (a.market_cap_rank ?? Infinity) - (b.market_cap_rank ?? Infinity))
      .slice(0, 25);
    const options: CoinOption[] = coins.map(c => ({
      id: c.id,
      name: c.name,
      symbol: c.symbol.toUpperCase(),
      logoUrl: c.large || c.thumb || '',
    }));
    searchCache.set(key, options);
    return options;
  } catch (e) {
    console.error('Gagal mencari koin di CoinGecko:', e);
    return [];
  }
}
