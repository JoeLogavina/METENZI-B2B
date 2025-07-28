import { Request, Response, NextFunction } from 'express';
import { cacheHelpers } from '../cache/redis';

interface CacheInvalidationOptions {
  patterns: string[];
  onSuccess?: boolean;
  onError?: boolean;
}

/**
 * Enterprise-grade cache invalidation middleware
 * Automatically invalidates specified cache patterns after successful operations
 */
export function cacheInvalidationMiddleware(options: CacheInvalidationOptions) {
  return (req: Request, res: Response, next: NextFunction) => {
    const originalSend = res.send;
    const originalJson = res.json;
    
    // Override res.send to detect response completion
    res.send = function(data: any) {
      const isSuccessful = res.statusCode >= 200 && res.statusCode < 300;
      const shouldInvalidate = (isSuccessful && options.onSuccess !== false) || 
                              (!isSuccessful && options.onError === true);
      
      if (shouldInvalidate) {
        // Perform cache invalidation asynchronously
        Promise.all(
          options.patterns.map(async (pattern) => {
            try {
              if (pattern.includes('orders')) {
                const userId = (req as any).user?.id;
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
          })
        ).catch(error => {
          console.warn('Cache invalidation error:', error);
        });
      }
      
      return originalSend.call(this, data);
    };
    
    // Override res.json as well
    res.json = function(data: any) {
      const isSuccessful = res.statusCode >= 200 && res.statusCode < 300;
      const shouldInvalidate = (isSuccessful && options.onSuccess !== false) || 
                              (!isSuccessful && options.onError === true);
      
      if (shouldInvalidate) {
        console.log(`🔄 Cache invalidation triggered for patterns: ${options.patterns.join(', ')}`);
        // Perform cache invalidation asynchronously
        Promise.all(
          options.patterns.map(async (pattern) => {
            try {
              if (pattern.includes('orders')) {
                const userId = (req as any).user?.id;
                console.log(`📧 Invalidating orders cache for user: ${userId}`);
                await cacheHelpers.invalidateOrdersData(userId);
                console.log(`✅ Orders cache invalidated successfully for user: ${userId}`);
              } else if (pattern.includes('wallet')) {
                const userId = (req as any).user?.id;
                if (userId) {
                  console.log(`💰 Invalidating wallet cache for user: ${userId}`);
                  await cacheHelpers.invalidateWalletData(userId);
                }
              } else if (pattern.includes('products')) {
                await cacheHelpers.invalidateProducts();
              } else if (pattern.includes('categories')) {
                await cacheHelpers.invalidateCategoriesData();
              } else if (pattern.includes('cart')) {
                const userId = (req as any).user?.id;
                if (userId) {
                  console.log(`🛒 Invalidating cart cache for user: ${userId}`);
                  await cacheHelpers.invalidateCartData(userId);
                }
              }
            } catch (error) {
              console.warn(`Cache invalidation failed for pattern ${pattern}:`, error);
            }
          })
        ).catch(error => {
          console.warn('Cache invalidation error:', error);
        });
      }
      
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