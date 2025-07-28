import type { Currency } from '@/contexts/TenantContext';

export function formatPrice(amount: number | string, currency: Currency): string {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(numAmount)) {
    return currency === 'KM' ? '0.00 KM' : '€0.00';
  }
  
  if (currency === 'KM') {
    return `${numAmount.toFixed(2)} KM`;
  } else {
    return `€${numAmount.toFixed(2)}`;
  }
}

export function parsePrice(priceString: string): number {
  if (!priceString) return 0;
  
  // Remove currency symbols and parse as float
  const cleanPrice = priceString.toString().replace(/[€KM\s]/g, '');
  const parsed = parseFloat(cleanPrice);
  
  return isNaN(parsed) ? 0 : parsed;
}

export function getCurrencySymbol(currency: Currency): string {
  switch (currency) {
    case 'EUR': return '€';
    case 'KM': return 'KM';
    default: return '€';
  }
}

export function getTenantPriceField(currency: Currency): string {
  return currency === 'KM' ? 'priceKm' : 'price';
}

// Convert EUR to KM (assuming 1 EUR = 1.96 KM - Bosnia Herzegovina rate)
export function convertEurToKm(eurAmount: number): number {
  return eurAmount * 1.96;
}

// Convert KM to EUR
export function convertKmToEur(kmAmount: number): number {
  return kmAmount / 1.96;
}