import { Request, Response, NextFunction } from 'express';

export type Currency = 'EUR' | 'KM';
export type TenantType = 'admin' | 'eur-shop' | 'km-shop';

export interface TenantContext {
  type: TenantType;
  currency: Currency;
  isAdmin: boolean;
  isShop: boolean;
}

// Extend Express Request to include tenant context
declare global {
  namespace Express {
    interface Request {
      tenant: TenantContext;
    }
  }
}

export function tenantResolutionMiddleware(req: Request, res: Response, next: NextFunction) {
  const path = req.path;
  const host = req.get('host') || '';
  
  let tenant: TenantContext;
  
  // URL-based tenant resolution
  if (path.startsWith('/admin')) {
    tenant = {
      type: 'admin',
      currency: 'EUR', // Default for admin, can switch dynamically
      isAdmin: true,
      isShop: false
    };
  } else if (path.startsWith('/shop/eur') || path.startsWith('/eur')) {
    tenant = {
      type: 'eur-shop',
      currency: 'EUR',
      isAdmin: false,
      isShop: true
    };
  } else if (path.startsWith('/shop/km') || path.startsWith('/km')) {
    tenant = {
      type: 'km-shop',
      currency: 'KM',
      isAdmin: false,
      isShop: true
    };
  } else {
    // Default to EUR shop for root paths
    tenant = {
      type: 'eur-shop',
      currency: 'EUR',
      isAdmin: false,
      isShop: true
    };
  }
  
  req.tenant = tenant;
  
  // Add tenant info to response headers for debugging
  res.setHeader('X-Tenant-Type', tenant.type);
  res.setHeader('X-Tenant-Currency', tenant.currency);
  
  next();
}

export function requireTenantType(allowedTypes: TenantType[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.tenant || !allowedTypes.includes(req.tenant.type)) {
      return res.status(403).json({ 
        message: 'Access denied for this tenant type',
        allowedTypes,
        currentType: req.tenant?.type 
      });
    }
    next();
  };
}

export function getCurrencySymbol(currency: Currency): string {
  switch (currency) {
    case 'EUR': return '€';
    case 'KM': return 'KM';
    default: return '€';
  }
}

export function formatPrice(amount: number | string, currency: Currency): string {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  const symbol = getCurrencySymbol(currency);
  
  if (currency === 'KM') {
    return `${numAmount.toFixed(2)} ${symbol}`;
  } else {
    return `${symbol}${numAmount.toFixed(2)}`;
  }
}