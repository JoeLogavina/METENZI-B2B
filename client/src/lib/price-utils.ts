// TIER 1 ENTERPRISE OPTIMIZATION: Price Utility Functions
// Centralized price handling to prevent type conversion errors

/**
 * Safely converts a price value to a number
 * Handles both string and number inputs from database
 * @param price - Price value from database (can be string or number)
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
 * Formats a price for display with EUR currency
 * @param price - Price to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted price string
 */
export function formatPrice(price: string | number | null | undefined, decimals: number = 2): string {
  const numericPrice = parsePrice(price);
  return `€${numericPrice.toFixed(decimals)}`;
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