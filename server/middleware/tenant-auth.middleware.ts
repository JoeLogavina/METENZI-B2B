import { Request, Response, NextFunction } from 'express';
import type { TenantContext } from './tenant.middleware';

export function tenantAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  // Only apply tenant auth to B2B user routes, not admin routes
  if (req.path.startsWith('/api/admin')) {
    return next();
  }

  const user = req.user as any;
  if (!user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  // For B2B users, check tenant access
  const userTenantId = user.tenantId || 'eur';

  // Extract tenant from URL path
  let urlTenant: 'eur' | 'km' | null = null;
  if (req.path.includes('/shop/eur') || req.originalUrl.includes('/shop/eur')) {
    urlTenant = 'eur';
  } else if (req.path.includes('/shop/km') || req.originalUrl.includes('/shop/km')) {
    urlTenant = 'km';
  } else if (req.originalUrl.includes('/eur')) {
    urlTenant = 'eur';
  } else if (req.originalUrl.includes('/km')) {
    urlTenant = 'km';
  }

  // For admins, allow access to any tenant
  if (user.role === 'admin' || user.role === 'super_admin') {
    req.tenant = {
      type: 'admin',
      currency: urlTenant === 'km' ? 'KM' : 'EUR',
      tenantId: urlTenant || userTenantId || 'eur',
      isAdmin: true,
      isShop: false
    };
    return next();
  }

  // If accessing a specific tenant URL, verify user belongs to that tenant
  if (urlTenant && urlTenant !== userTenantId) {
    return res.status(403).json({ 
      message: 'Access denied. You do not have permission to access this tenant panel.',
      userTenant: userTenantId,
      requestedTenant: urlTenant
    });
  }

  // Set tenant context based on user's tenant
  req.tenant = {
    type: userTenantId === 'km' ? 'km-shop' : 'eur-shop',
    currency: userTenantId === 'km' ? 'KM' : 'EUR',
    tenantId: userTenantId,
    isAdmin: false,
    isShop: true
  };

  next();
}

export function requireTenant(tenantId: 'eur' | 'km') {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as any;
    
    // Allow admins to access any tenant
    if (user?.role === 'admin' || user?.role === 'super_admin') {
      req.tenant = {
        type: 'admin',
        currency: tenantId === 'km' ? 'KM' : 'EUR',
        tenantId: tenantId,
        isAdmin: true,
        isShop: false
      };
      return next();
    }

    // Check if user belongs to required tenant
    if (!user || user.tenantId !== tenantId) {
      return res.status(403).json({ 
        message: `Access denied. This endpoint requires ${tenantId.toUpperCase()} tenant access.`,
        userTenant: user?.tenantId || 'none',
        requiredTenant: tenantId
      });
    }

    req.tenant = {
      type: tenantId === 'km' ? 'km-shop' : 'eur-shop',
      currency: tenantId === 'km' ? 'KM' : 'EUR',
      tenantId: tenantId,
      isAdmin: false,
      isShop: true
    };

    next();
  };
}