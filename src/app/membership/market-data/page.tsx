"use client";

import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Clock,
  Globe,
  Coins,
  BarChart3,
  AlertCircle
} from 'lucide-react';
import { exchangeRateService } from '@/lib/services/exchangeRateService';
import { currencyService, Currency } from '@/lib/services/currencyService';
import { auth } from '@/lib/cf-client';
import { useCountUp } from '@/lib/hooks/useCountUp';

interface CryptoData {
  id: string;
  name: string;
  symbol: string;
  current_price: number;
  price_change_percentage_24h: number;
  icon: string;
}

interface ExchangeRate {
  from: string;
  to: string;
  rate: number;
}

interface ForexRate {
  pair: string;
  label: string;
  rate: number;
}

interface GoldData {
  price_usd: number;
  price_idr: number;
  change_24h: number;
}

// Kode mata uang kripto yang bisa dikenali & dipetakan ke ID CoinGecko.
const CRYPTO_ID_MAP: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  BNB: 'binancecoin',
  ADA: 'cardano',
  XRP: 'ripple',
  DOT: 'polkadot',
  DOGE: 'dogecoin',
};
const CRYPTO_NAME_MAP: Record<string, string> = {
  bitcoin: 'Bitcoin', ethereum: 'Ethereum', solana: 'Solana', binancecoin: 'BNB',
  cardano: 'Cardano', ripple: 'XRP', polkadot: 'Polkadot', dogecoin: 'Dogecoin',
};
const CRYPTO_SYMBOL_MAP: Record<string, string> = {
  bitcoin: 'BTC/USD', ethereum: 'ETH/USD', solana: 'SOL/USD', binancecoin: 'BNB/USD',
  cardano: 'ADA/USD', ripple: 'XRP/USD', polkadot: 'DOT/USD', dogecoin: 'DOGE/USD',
};
const CRYPTO_ICON_MAP: Record<string, string> = {
  bitcoin: 'BTC', ethereum: 'ETH', solana: 'SOL', binancecoin: 'BNB',
  cardano: 'ADA', ripple: 'XRP', polkadot: 'DOT', dogecoin: 'DOGE',
};

// currencyService.getUserCurrencies tidak selalu memanggil balik saat gagal (shim
// menelan error jika tidak ada onError), jadi promise pembungkusnya bisa
// menggantung selamanya. Beri batas waktu agar halaman tidak macet loading.
const withTimeout = <T,>(promise: Promise<T>, ms: number, fallback: T): Promise<T> =>
  Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);

export default function MarketDataPage() {
  const [cryptoData, setCryptoData] = useState<CryptoData[]>([]);
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([]);
  const [forexRates, setForexRates] = useState<ForexRate[]>([]);
  const [usdIdrRate, setUsdIdrRate] = useState<number>(0);
  const [gold, setGold] = useState<GoldData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        // Mencoba mendeteksi jika user punya mata uang crypto di list-nya
        const userCryptos = currentCurs.filter(c => CRYPTO_ID_MAP[c.code.toUpperCase()]);

        // Tetap gunakan top crypto sebagai default jika user tidak punya
        const targetIds = userCryptos.length > 0
          ? userCryptos.map(c => CRYPTO_ID_MAP[c.code.toUpperCase()])
          : ['bitcoin', 'ethereum', 'solana'];

        // 2. Fetch crypto + emas (PAX Gold, dipatok 1:1 ke harga emas spot) sekaligus.
        const cryptoRes = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${[...targetIds, 'pax-gold'].join(',')}&vs_currencies=usd&include_24hr_change=true`
        );
        if (cryptoRes.ok) {
          const data = await cryptoRes.json();
          const mappedCrypto: CryptoData[] = targetIds.map(id => ({
            id,
            name: CRYPTO_NAME_MAP[id] || id,
            symbol: CRYPTO_SYMBOL_MAP[id] || id.toUpperCase(),
            current_price: data[id]?.usd || 0,
            price_change_percentage_24h: data[id]?.usd_24h_change || 0,
            icon: CRYPTO_ICON_MAP[id] || 'C'
          }));
          setCryptoData(mappedCrypto);

          const goldUsd = data['pax-gold']?.usd || 0;
          if (goldUsd > 0) {
            setGold({
              price_usd: goldUsd,
              price_idr: goldUsd * idrRate,
              change_24h: data['pax-gold']?.usd_24h_change || 0,
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
  }, []);

  useEffect(() => {
    fetchMarketData();
    // Auto-refresh setiap 60 detik
    const interval = setInterval(fetchMarketData, 60000);
    return () => clearInterval(interval);
  }, [fetchMarketData]);

  const formatPrice = (price: number, decimals = 2) => {
    if (price >= 1000) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return price.toFixed(decimals);
  };

  const formatIDR = (rate: number) => rate.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const formatTime = (d: Date) => d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  // Angka ringkasan dianimasikan naik/turun secara halus tiap kali data diperbarui.
  const animatedUsdIdr = useCountUp(usdIdrRate);
  const animatedBtc = useCountUp(cryptoData[0]?.current_price ?? 0);
  const animatedGoldIdr = useCountUp(gold?.price_idr ?? 0);

  return (
    <div className="space-y-6 md:space-y-10 animate-in fade-in duration-700 max-w-[1240px] mb-20">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-br from-white to-indigo-50/40 p-6 rounded-[24px] border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex w-12 h-12 rounded-2xl bg-gradient-to-br from-navy to-indigo-700 text-white items-center justify-center shadow-lg shadow-indigo-600/20 shrink-0">
            <Globe size={22} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-serif font-black text-slate-900 tracking-tight leading-tight">Market Data</h1>
            <p className="text-[11px] md:text-sm font-medium text-slate-500 mt-1 leading-relaxed">Kurs, kripto, dan emas — diperbarui otomatis setiap menit.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
              <Clock size={12} />
              Diperbarui: {formatTime(lastUpdated)}
            </div>
          )}
          <button onClick={fetchMarketData} disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-100 rounded-xl text-[11px] font-black text-slate-600 hover:bg-slate-50 hover:shadow-sm transition-all shadow-sm active:scale-95 disabled:opacity-50">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-rose-50 border border-rose-100 rounded-2xl p-4 text-sm font-medium text-rose-600">
          <AlertCircle size={18} className="shrink-0" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 items-start">
        
        {/* LEFT: Status Card */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white p-5 md:p-6 rounded-[20px] md:rounded-[32px] border border-slate-50 shadow-sm space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                <Globe size={18} />
              </div>
              <h2 className="text-sm font-black text-slate-900 leading-tight">Status Data Live</h2>
            </div>
            <div className="space-y-3">
              {[
                { label: 'CoinGecko Crypto API', status: cryptoData.length > 0 },
                { label: 'Open Exchange Rates', status: exchangeRates.length > 0 },
                { label: 'Harga Emas (PAX Gold)', status: gold !== null },
                { label: 'Auto-refresh (60s)', status: true },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-600">{item.label}</span>
                  <span className={`w-2 h-2 rounded-full ${item.status ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                </div>
              ))}
            </div>
          </div>

          {/* Ringkasan Live */}
          <div className="bg-gradient-to-br from-slate-900 to-navy p-5 md:p-6 rounded-[20px] md:rounded-[32px] shadow-xl space-y-4 text-white">
            <div className="flex items-center gap-2">
              <Coins size={16} className="text-amber-400" />
              <h3 className="text-[11px] font-black uppercase tracking-widest text-white/60">Ringkasan Live</h3>
            </div>
            {loading && !lastUpdated ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <div key={i} className="h-6 bg-white/10 rounded-lg animate-pulse" />)}
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <p className="text-[9px] font-black text-white/40 uppercase tracking-widest">USD/IDR</p>
                  <p className="text-xl font-black tracking-tight tabular-nums">
                    {usdIdrRate ? formatIDR(animatedUsdIdr) : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-white/40 uppercase tracking-widest">BTC/USD</p>
                  <p className="text-xl font-black tracking-tight tabular-nums">
                    ${cryptoData[0] ? formatPrice(animatedBtc) : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-amber-400/70 uppercase tracking-widest">Emas · XAU/IDR (/gram)</p>
                  <p className="text-xl font-black tracking-tight tabular-nums text-amber-300">
                    {gold ? formatIDR(animatedGoldIdr / 31.1035) : '-'}
                  </p>
                  {gold && (
                    <p className={`text-[10px] font-bold mt-0.5 flex items-center gap-1 ${gold.change_24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {gold.change_24h >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                      {gold.change_24h >= 0 ? '+' : ''}{gold.change_24h.toFixed(2)}% (24j)
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Data Tables */}
        <div className="lg:col-span-9 space-y-6 md:space-y-8">

          {/* Exchange Rate Table */}
          <div className="bg-white rounded-[20px] md:rounded-[32px] border border-slate-50 shadow-sm overflow-hidden">
            <div className="p-5 md:p-8 pb-4 flex flex-col xs:flex-row xs:items-center justify-between gap-3 border-b border-slate-50">
              <h2 className="text-sm md:text-base font-black text-slate-900 tracking-tight">Exchange Rate Table</h2>
              <span className="w-fit px-3 py-1 bg-cyan-50 text-cyan-600 text-[9px] font-black rounded-full uppercase tracking-widest flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-pulse" />
                Live
              </span>
            </div>
            <div className="px-5 md:px-8 pb-4 overflow-x-auto custom-scrollbar">
              <table className="w-full text-left min-w-[500px] md:min-w-0">
                <thead>
                  <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50">
                    <th className="py-5 font-black">Dari</th>
                    <th className="py-5 font-black text-center">-&gt;</th>
                    <th className="py-5 font-black text-center">Ke</th>
                    <th className="py-5 font-black text-right">Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loading && !lastUpdated ? (
                    [1, 2, 3].map(i => (
                      <tr key={i}>
                        <td colSpan={4} className="py-5"><div className="h-5 bg-slate-100 rounded-lg animate-pulse" /></td>
                      </tr>
                    ))
                  ) : exchangeRates.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-10 text-center text-xs font-bold text-slate-400">Data kurs tidak tersedia saat ini.</td>
                    </tr>
                  ) : exchangeRates.map((curr, i) => (
                    <tr key={i} className="hover:bg-indigo-50/30 transition-colors tabular-nums">
                      <td className="py-4 md:py-5 text-[12px] md:text-[13px] font-bold text-slate-900">{curr.from}</td>
                      <td className="py-4 md:py-5 text-center text-indigo-500"><ArrowRight size={14} className="mx-auto" /></td>
                      <td className="py-4 md:py-5 text-center text-[12px] md:text-[13px] font-bold text-slate-900">{curr.to}</td>
                      <td className="py-4 md:py-5 text-right text-[13px] md:text-[14px] font-black text-slate-900">
                        {formatIDR(curr.rate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            {/* Forex */}
            <div className="bg-white p-5 md:p-8 rounded-[20px] md:rounded-[32px] border border-slate-50 shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-900">Foreign Exchange</h3>
                <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400">
                  <BarChart3 size={10} />
                  Live rate
                </div>
              </div>
              <div className="space-y-5">
                {loading && !lastUpdated ? (
                  [1, 2, 3, 4].map(i => <div key={i} className="h-10 bg-slate-100 rounded-xl animate-pulse" />)
                ) : forexRates.length === 0 ? (
                  <p className="text-xs font-bold text-slate-400 text-center py-6">Data forex tidak tersedia saat ini.</p>
                ) : forexRates.map((item, i) => (
                  <div key={i} className="flex items-center justify-between hover:-translate-y-0.5 transition-transform">
                    <div>
                      <h4 className="text-[13px] font-black text-slate-900 tracking-tight">{item.pair}</h4>
                      <p className="text-[10px] font-medium text-slate-400">{item.label}</p>
                    </div>
                    <p className="text-[13px] font-black text-slate-900 tabular-nums">
                      {item.pair.includes('IDR') ? formatIDR(item.rate) : formatPrice(item.rate, 4)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Cryptocurrency */}
            <div className="bg-white p-5 md:p-8 rounded-[20px] md:rounded-[32px] border border-slate-50 shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-900">Cryptocurrency</h3>
                <span className="text-[9px] font-bold text-emerald-500 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  CoinGecko
                </span>
              </div>
              <div className="space-y-5">
                {loading && !lastUpdated ? (
                  [1, 2, 3].map(i => <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />)
                ) : cryptoData.length === 0 ? (
                  <p className="text-xs font-bold text-slate-400 text-center py-6">Data kripto tidak tersedia saat ini.</p>
                ) : cryptoData.map((item, i) => (
                  <div key={i} className="flex items-center justify-between group cursor-default hover:-translate-y-0.5 transition-transform">
                    <div className="flex items-center gap-3 md:gap-4">
                      <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-500 font-black text-[14px] border border-slate-100 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all">
                        {item.icon}
                      </div>
                      <div>
                        <h4 className="text-[13px] font-black text-slate-900">{item.name}</h4>
                        <p className="text-[10px] font-medium text-slate-400 uppercase">{item.symbol}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[13px] font-black text-slate-900 tabular-nums">${formatPrice(item.current_price)}</p>
                      <p className={`text-[10px] font-bold flex items-center justify-end gap-0.5 mt-0.5 tabular-nums ${item.price_change_percentage_24h >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {item.price_change_percentage_24h >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                        {item.price_change_percentage_24h.toFixed(2)}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}



