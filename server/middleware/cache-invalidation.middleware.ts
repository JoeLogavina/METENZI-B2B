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
      
      return originalJson.call(this, data);
    };
    
    next();
  };
}

// Convenience middleware for common cache invalidation patterns
export const invalidateOrdersCache = cacheInvalidationMiddleware({
  patterns: ['orders:*', 'wallet:*'],
  onSuccess: true
});

export const invalidateWalletCache = cacheInvalidationMiddleware({
  patterns: ['wallet:*'],
  onSuccess: true
});

export const invalidateProductsCache = cacheInvalidationMiddleware({
  patterns: ['products:*'],
  onSuccess: true
});

export const invalidateCartCache = cacheInvalidationMiddleware({
  patterns: ['cart:*'],
  onSuccess: true
});