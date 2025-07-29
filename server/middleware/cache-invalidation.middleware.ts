import { Request, Response, NextFunction } from 'express';
import { cacheHelpers } from '../cache/redis';

export interface CacheInvalidationOptions {
  patterns: string[];
  onSuccess?: boolean;
  onError?: boolean;
}

/**
 * CACHE-ASIDE PATTERN: Enterprise-grade cache invalidation middleware
 * Immediately invalidates cache on successful operations without read caching
 */
export function cacheInvalidationMiddleware(options: CacheInvalidationOptions) {
  return (req: Request, res: Response, next: NextFunction) => {
    const originalSend = res.send;
    const originalJson = res.json;
    
    // Function to perform cache invalidation
    const performInvalidation = () => {
      const isSuccessful = res.statusCode >= 200 && res.statusCode < 300;
      const shouldInvalidate = (isSuccessful && options.onSuccess !== false) || 
                              (!isSuccessful && options.onError === true);
      
      if (shouldInvalidate) {

        
        // CACHE-ASIDE PATTERN: Fire invalidation immediately (don't wait)
        const invalidationPromises = options.patterns.map(async (pattern) => {
          try {
            if (pattern.includes('orders')) {
              const userId = (req as any).user?.id;
              const tenantId = (req as any).user?.tenantId;
              await cacheHelpers.invalidateOrdersData(userId);
            } else if (pattern.includes('wallet')) {
              const userId = (req as any).user?.id;
              if (userId) {
                await cacheHelpers.invalidateWalletData(userId);
              }
            } else if (pattern.includes('products')) {
              await cacheHelpers.invalidateProducts();
            } else if (pattern.includes('categories')) {
              await cacheHelpers.invalidateCategoriesData();
            } else if (pattern.includes('cart')) {
              const userId = (req as any).user?.id;
              if (userId) {
                await cacheHelpers.invalidateCartData(userId);
              }
            }
          } catch (error) {
            console.warn(`Cache invalidation failed for pattern ${pattern}:`, error);
          }
        });
        
        // Execute invalidations immediately but don't block response
        Promise.all(invalidationPromises).catch(error => {
          console.warn('Cache invalidation error:', error);
        });
      }
    };
    
    // Override res.send to trigger invalidation
    res.send = function(data: any) {
      performInvalidation();
      return originalSend.call(this, data);
    };
    
    // Override res.json to trigger invalidation
    res.json = function(data: any) {
      performInvalidation();
      return originalJson.call(this, data);
    };
    
    next();
  };
}

// Tenant-aware cache invalidation middleware
export function invalidateOrdersCache(req: any, res: any, next: any) {
  const user = req.user as any;
  const tenantId = user?.tenantId || 'eur';
  const userRole = user?.role || 'b2b_user';
  
  // Create tenant-specific invalidation patterns
  const tenantPatterns = [
    `orders:*${tenantId}:*`,
    `wallet:*${tenantId}:*`
  ];
  
  return cacheInvalidationMiddleware({
    patterns: tenantPatterns,
    onSuccess: true
  })(req, res, next);
}

export function invalidateWalletCache(req: any, res: any, next: any) {
  const user = req.user as any;
  const tenantId = user?.tenantId || 'eur';
  
  const tenantPatterns = [`wallet:*${tenantId}:*`];
  
  return cacheInvalidationMiddleware({
    patterns: tenantPatterns,
    onSuccess: true
  })(req, res, next);
}

export function invalidateProductsCache(req: any, res: any, next: any) {
  const user = req.user as any;
  const tenantId = user?.tenantId || 'eur';
  
  // For products, invalidate both tenant caches since product changes affect both
  const patterns = [
    `products:*eur:*`,
    `products:*km:*`
  ];
  
  return cacheInvalidationMiddleware({
    patterns: patterns,
    onSuccess: true
  })(req, res, next);
}

export function invalidateCartCache(req: any, res: any, next: any) {
  const user = req.user as any;
  const tenantId = user?.tenantId || 'eur';
  
  const tenantPatterns = [`cart:*${tenantId}:*`];
  
  return cacheInvalidationMiddleware({
    patterns: tenantPatterns,
    onSuccess: true
  })(req, res, next);
}