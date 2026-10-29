"use client";

import { useCallback, useEffect, useState } from 'react';
import { exchangeRateService } from '@/lib/services/exchangeRateService';
import { currencyService, Currency } from '@/lib/services/currencyService';
import { auth } from '@/lib/cf-client';
import { CoinOption } from '@/lib/coingecko';
import { MAX_WATCHLIST_COINS } from '@/components/modals/CryptoWatchlistModal';

// Data pasar live (kurs, kripto, emas) — dipindah dari halaman Data Pasar lama
// supaya dipakai halaman Investasiku. Refresh otomatis tiap 60 detik.

// Watchlist koin custom (maks. 10) disimpan per browser di localStorage —
// preferensi tampilan, bukan data finansial, jadi tidak perlu tabel D1 baru.
const WATCHLIST_STORAGE_KEY = 'leosiqra:crypto-watchlist';

const loadStoredWatchlist = (): string[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(WATCHLIST_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string').slice(0, MAX_WATCHLIST_COINS) : [];
  } catch {
    return [];
  }
};

export interface CryptoData {
  id: string;
  name: string;
  symbol: string;
  current_price: number;
  price_change_percentage_24h: number;
  icon: string;
  logoUrl: string;
}

export interface ExchangeRate {
  from: string;
  to: string;
  rate: number;
}

export interface ForexRate {
  pair: string;
  label: string;
  rate: number;
}

export interface GoldData {
  price_usd: number;
  price_idr: number;
  change_24h: number;
  logoUrl: string;
}

// Kode mata uang kripto yang bisa dikenali & dipetakan ke ID CoinGecko.
// Catatan: ID CoinGecko untuk Holochain (HOT) adalah 'holotoken', bukan 'holochain'.
const CRYPTO_ID_MAP: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  BNB: 'binancecoin',
  ADA: 'cardano',
  XRP: 'ripple',
  DOT: 'polkadot',
  DOGE: 'dogecoin',
  HOT: 'holotoken',
};
const CRYPTO_NAME_MAP: Record<string, string> = {
  bitcoin: 'Bitcoin', ethereum: 'Ethereum', solana: 'Solana', binancecoin: 'BNB',
  cardano: 'Cardano', ripple: 'XRP', polkadot: 'Polkadot', dogecoin: 'Dogecoin', holotoken: 'Holochain',
};
const CRYPTO_SYMBOL_MAP: Record<string, string> = {
  bitcoin: 'BTC/USD', ethereum: 'ETH/USD', solana: 'SOL/USD', binancecoin: 'BNB/USD',
  cardano: 'ADA/USD', ripple: 'XRP/USD', polkadot: 'DOT/USD', dogecoin: 'DOGE/USD', holotoken: 'HOT/USD',
};
const CRYPTO_ICON_MAP: Record<string, string> = {
  bitcoin: 'BTC', ethereum: 'ETH', solana: 'SOL', binancecoin: 'BNB',
  cardano: 'ADA', ripple: 'XRP', polkadot: 'DOT', dogecoin: 'DOGE', holotoken: 'HOT',
};

// currencyService.getUserCurrencies tidak selalu memanggil balik saat gagal (shim
// menelan error jika tidak ada onError), jadi promise pembungkusnya bisa
// menggantung selamanya. Beri batas waktu agar halaman tidak macet loading.
const withTimeout = <T,>(promise: Promise<T>, ms: number, fallback: T): Promise<T> =>
  Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);

export function useMarketData() {
  const [cryptoData, setCryptoData] = useState<CryptoData[]>([]);
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([]);
  const [forexRates, setForexRates] = useState<ForexRate[]>([]);
  const [usdIdrRate, setUsdIdrRate] = useState<number>(0);
  const [gold, setGold] = useState<GoldData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [watchlistIds, setWatchlistIds] = useState<string[]>(() => loadStoredWatchlist());
  const [showWatchlistModal, setShowWatchlistModal] = useState(false);

  const handleSaveWatchlist = (coins: CoinOption[]) => {
    const ids = coins.map(c => c.id);
    setWatchlistIds(ids);
    try {
      window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(ids));
    } catch (e) {
      console.error('Gagal menyimpan watchlist koin:', e);
    }
  };

  const fetchMarketData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 0. Get User Currencies (dibatasi waktu — lihat catatan withTimeout di atas)
      const currentUser = auth.currentUser;
      let currentCurs: Currency[] = [];
      if (currentUser) {
        currentCurs = await withTimeout(
          new Promise<Currency[]>((resolve) => {
            const unsub = currencyService.getUserCurrencies(currentUser.uid, (data) => {
              unsub();
              resolve(data);
            });
          }),
          6000,
          []
        );
      }

      // 1. Fetch Exchange Rates using our new service
      const rates = await exchangeRateService.getLatestRates();

      if (Object.keys(rates).length > 0) {
        const idrRate = rates.IDR || 1;

        // --- DINAMISASI EXCHANGE RATE TABLE ---
        const mappedExchange: ExchangeRate[] = currentCurs
          .filter(c => c.code !== 'IDR')
          .map(c => ({
            from: `${c.name} (${c.code})`,
            to: 'Indonesian Rupiah (IDR)',
            rate: idrRate / (rates[c.code] || 1)
          }));

        if (mappedExchange.length === 0) {
          mappedExchange.push(
            { from: 'United States Dollar (USD)', to: 'Indonesian Rupiah (IDR)', rate: idrRate },
            { from: 'Euro (EUR)', to: 'Indonesian Rupiah (IDR)', rate: idrRate / (rates.EUR || 1) },
            { from: 'Singapore Dollar (SGD)', to: 'Indonesian Rupiah (IDR)', rate: idrRate / (rates.SGD || 1) }
          );
        }
        setExchangeRates(mappedExchange);
        setUsdIdrRate(idrRate);

        // --- DINAMISASI FOREIGN EXCHANGE CARD ---
        // Filter: exclude IDR (base currency) dan exclude USD (karena semua pair vs USD)
        const mappedForex: ForexRate[] = currentCurs
          .filter(c => c.code !== 'IDR' && c.code !== 'USD')
          .slice(0, 5)
          .map(c => ({
            pair: `${c.code}/USD`,
            label: `${c.name} / US Dollar`,
            rate: 1 / (rates[c.code] || 1)
          }));

        if (mappedForex.length === 0) {
          mappedForex.push(
            { pair: 'EUR/USD', label: 'Euro / US Dollar', rate: 1 / (rates.EUR || 1) },
            { pair: 'GBP/USD', label: 'Pound / US Dollar', rate: 1 / (rates.GBP || 1) },
            { pair: 'AUD/USD', label: 'Aussie / US Dollar', rate: 1 / (rates.AUD || 1) },
          );
        }
        // Always add USD/IDR as a reference
        mappedForex.push({ pair: 'USD/IDR', label: 'US Dollar / Rupiah', rate: idrRate });
        setForexRates(mappedForex);

        // --- DINAMISASI CRYPTOCURRENCY CARD ---
        // Prioritas: watchlist custom user (maks 10, dipilih manual) > mata uang
        // crypto yang sudah ada di daftar mata uangnya > default top crypto.
        const userCryptos = currentCurs.filter(c => CRYPTO_ID_MAP[c.code.toUpperCase()]);

        const targetIds = watchlistIds.length > 0
          ? watchlistIds
          : userCryptos.length > 0
            ? userCryptos.map(c => CRYPTO_ID_MAP[c.code.toUpperCase()])
            : ['bitcoin', 'ethereum', 'solana', 'holotoken'];

        // 2. Fetch crypto + emas (PAX Gold, dipatok 1:1 ke harga emas spot) sekaligus,
        // termasuk logo resmi tiap koin (endpoint /coins/markets menyertakan `image`).
        const marketIds = [...targetIds, 'pax-gold'];
        const cryptoRes = await fetch(
          `/api/market/coingecko/coins/markets?vs_currency=usd&ids=${marketIds.join(',')}&price_change_percentage=24h`
        );
        if (cryptoRes.ok) {
          const rows = (await cryptoRes.json()) as Array<{
            id: string;
            name?: string;
            symbol?: string;
            image?: string;
            current_price?: number;
            price_change_percentage_24h?: number;
          }>;
          const byId = new Map(rows.map((r) => [r.id, r]));

          // Koin dari watchlist custom mungkin tidak ada di peta statis di atas
          // (yang cuma mencakup beberapa koin populer) — pakai nama/simbol asli
          // dari respons API sebagai fallback supaya tetap tampil benar.
          const mappedCrypto: CryptoData[] = targetIds.map(id => {
            const row = byId.get(id);
            return {
              id,
              name: CRYPTO_NAME_MAP[id] || row?.name || id,
              symbol: CRYPTO_SYMBOL_MAP[id] || (row?.symbol ? `${row.symbol.toUpperCase()}/USD` : id.toUpperCase()),
              current_price: row?.current_price || 0,
              price_change_percentage_24h: row?.price_change_percentage_24h || 0,
              icon: CRYPTO_ICON_MAP[id] || row?.symbol?.toUpperCase() || 'C',
              logoUrl: row?.image || '',
            };
          });
          setCryptoData(mappedCrypto);

          const goldRow = byId.get('pax-gold');
          const goldUsd = goldRow?.current_price || 0;
          if (goldUsd > 0) {
            setGold({
              price_usd: goldUsd,
              price_idr: goldUsd * idrRate,
              change_24h: goldRow?.price_change_percentage_24h || 0,
              logoUrl: goldRow?.image || '',
            });
          }
        }
      }

      setLastUpdated(new Date());
    } catch (e) {
      setError('Gagal memuat data pasar. Periksa koneksi internet Anda.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [watchlistIds]);

  useEffect(() => {
    fetchMarketData();
    // Auto-refresh setiap 60 detik
    const interval = setInterval(fetchMarketData, 60000);
    return () => clearInterval(interval);
  }, [fetchMarketData]);

  return { cryptoData, exchangeRates, forexRates, usdIdrRate, gold, loading, lastUpdated, error, refresh: fetchMarketData, showWatchlistModal, setShowWatchlistModal, handleSaveWatchlist };
}
