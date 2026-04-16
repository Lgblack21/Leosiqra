/**
 * Service to handle real-time exchange rates and currency conversion.
 * Uses a free public API for latest rates.
 */

const BASE_URL = 'https://open.er-api.com/v6/latest';

export interface ExchangeRates {
  [currencyCode: string]: number;
}

interface CacheData {
  rates: ExchangeRates;
  timestamp: number;
}

let ratesCache: CacheData | null = null;
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

export const exchangeRateService = {
  /**
   * Fetch latest rates from USD base
   */
  getLatestRates: async (base = 'USD'): Promise<ExchangeRates> => {
    // Return cache if it's still fresh
    if (ratesCache && (Date.now() - ratesCache.timestamp < CACHE_DURATION)) {
      return ratesCache.rates;
    }

    try {
      const response = await fetch(`${BASE_URL}/${base}`);
      if (!response.ok) throw new Error('Failed to fetch exchange rates');
      
      const data = await response.json();
      const rates = data.rates;
      
      // Update cache
      ratesCache = {
        rates,
        timestamp: Date.now()
      };
      
      return rates;
    } catch (error) {
      console.error('Error fetching rates:', error);
      // Return empty or previous cache if failed
      return ratesCache?.rates || {};
    }
  },

  /**
   * Convert amount from one currency to another
   */
  convert: (amount: number, from: string, to: string, rates: ExchangeRates): number => {
    if (from === to) return amount;
    if (!rates[from] || !rates[to]) return amount;

    // Standard formula: (Amount / Rate_From_to_USD) * Rate_To_to_USD
    // This assumes Rates are relative to USD
    const amountInUSD = amount / rates[from];
    const convertedAmount = amountInUSD * rates[to];
    
    return convertedAmount;
  },

  /**
   * Specifically convert to IDR for convenient usage
   */
  convertToIDR: async (amount: number, from: string): Promise<number> => {
    if (from === 'IDR') return amount;
    
    const rates = await exchangeRateService.getLatestRates();
    return exchangeRateService.convert(amount, from, 'IDR', rates);
  }
};
