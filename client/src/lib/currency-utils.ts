// Multi-Currency Utility Functions
// Supports EUR (B2B shop) and KM (Bosnian Mark) for future tenant

export type SupportedCurrency = 'EUR' | 'KM';

export interface CurrencyConfig {
  code: SupportedCurrency;
  symbol: string;
  name: string;
  locale: string;
  decimals: number;
}

export const CURRENCY_CONFIGS: Record<SupportedCurrency, CurrencyConfig> = {
  EUR: {
    code: 'EUR',
    symbol: '€',
    name: 'Euro',
    locale: 'de-DE',
    decimals: 2
  },
  KM: {
    code: 'KM',
    symbol: 'KM',
    name: 'Bosnia and Herzegovina Convertible Mark',
    locale: 'bs-BA',
    decimals: 2
  }
};

/**
 * Safely converts a price value to a number
 * @param price - Price value (can be string or number)
 * @returns Parsed price as number, or 0 if invalid
 */
export function parsePrice(price: string | number | null | undefined): number {
  if (price === null || price === undefined) {
    return 0;
  }
  
  if (typeof price === 'number') {
    return isNaN(price) ? 0 : price;
  }
  
  if (typeof price === 'string') {
    const parsed = parseFloat(price);
    return isNaN(parsed) ? 0 : parsed;
  }
  
  return 0;
}

/**
 * Formats a price for display with specified currency
 * @param price - Price to format
 * @param currency - Currency code (EUR or KM)
 * @param decimals - Number of decimal places (optional, uses currency default)
 * @returns Formatted price string
 */
export function formatPrice(
  price: string | number | null | undefined, 
  currency: SupportedCurrency = 'EUR',
  decimals?: number
): string {
  const numericPrice = parsePrice(price);
  const config = CURRENCY_CONFIGS[currency];
  const decimalPlaces = decimals ?? config.decimals;
  
  if (currency === 'KM') {
    // KM is typically displayed as "123.45 KM"
    return `${numericPrice.toFixed(decimalPlaces)} ${config.symbol}`;
  } else {
    // EUR is displayed as "€123.45"
    return `${config.symbol}${numericPrice.toFixed(decimalPlaces)}`;
  }
}

/**
 * Formats price for admin panel display (showing both currencies)
 * @param priceEur - EUR price
 * @param priceKm - KM price (optional)
 * @returns Formatted price string with both currencies
 */
export function formatAdminPrice(
  priceEur: string | number | null | undefined,
  priceKm?: string | number | null | undefined
): string {
  const eurFormatted = formatPrice(priceEur, 'EUR');
  
  if (priceKm !== null && priceKm !== undefined && parsePrice(priceKm) > 0) {
    const kmFormatted = formatPrice(priceKm, 'KM');
    return `${eurFormatted} / ${kmFormatted}`;
  }
  
  return eurFormatted;
}

/**
 * Calculates total price with quantity
 * @param price - Unit price
 * @param quantity - Quantity
 * @returns Total price as number
 */
export function calculateTotal(price: string | number | null | undefined, quantity: number): number {
  const numericPrice = parsePrice(price);
  return numericPrice * (quantity || 0);
}

/**
 * Converts EUR to KM using approximate exchange rate
 * 1 EUR ≈ 1.96 KM (fixed rate, Bosnia uses currency board)
 * @param eurAmount - Amount in EUR
 * @returns Equivalent amount in KM
 */
export function convertEurToKm(eurAmount: number): number {
  const EXCHANGE_RATE = 1.96; // 1 EUR = 1.96 KM (approximate)
  return Math.round((eurAmount * EXCHANGE_RATE) * 100) / 100; // Round to 2 decimals
}

/**
 * Converts KM to EUR using approximate exchange rate
 * @param kmAmount - Amount in KM
 * @returns Equivalent amount in EUR
 */
export function convertKmToEur(kmAmount: number): number {
  const EXCHANGE_RATE = 1.96; // 1 EUR = 1.96 KM
  return Math.round((kmAmount / EXCHANGE_RATE) * 100) / 100; // Round to 2 decimals
}

// Legacy compatibility - keep existing EUR-only functions working
export { formatPrice as formatPriceEur };