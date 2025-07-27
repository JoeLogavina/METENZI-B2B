import { Request, Response, NextFunction } from 'express';
import { redisCache } from '../cache/redis';

interface CacheOptions {
  ttl?: number; // Time to live in seconds
  keyPrefix?: string;
  skipCache?: boolean;
  skipCacheCondition?: (req: Request) => boolean;
}

export function cacheMiddleware(options: CacheOptions = {}) {
  const {
    ttl = 300, // 5 minutes default
    keyPrefix = 'api',
    skipCache = false,
    skipCacheCondition
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip caching for non-GET requests or when explicitly disabled
    if (req.method !== 'GET' || skipCache || (skipCacheCondition && skipCacheCondition(req))) {
      return next();
    }

    // Generate cache key from URL and query parameters
    const cacheKey = generateCacheKey(keyPrefix, req.originalUrl, req.query);
    
    try {
      // Try to get cached response
      const cachedResponse = await redisCache.get(cacheKey);
      
      if (cachedResponse) {
        console.log(`📦 Cache HIT: ${req.originalUrl}`);
        
        // Set cache headers
        res.set({
          'X-Cache': 'HIT',
          'X-Cache-Key': cacheKey,
          'Cache-Control': `public, max-age=${ttl}`
        });
        
        return res.json(cachedResponse);
      }

      console.log(`🔍 Cache MISS: ${req.originalUrl}`);
      
      // Store original json method
      const originalJson = res.json.bind(res);
      
      // Override json method to cache the response
      res.json = function(data: any) {
        // Cache the response asynchronously
        redisCache.set(cacheKey, data, ttl).catch(error => {
          console.warn('Failed to cache response:', error);
        });
        
        // Set cache headers
        res.set({
          'X-Cache': 'MISS',
          'X-Cache-Key': cacheKey,
          'Cache-Control': `public, max-age=${ttl}`
        });
        
        // Call original json method
        return originalJson(data);
      };
      
      next();
    } catch (error) {
      console.warn('Cache middleware error:', error);
      next(); // Continue without caching
    }
  };
}

export function invalidateCacheMiddleware(pattern: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Store original json method
    const originalJson = res.json.bind(res);
    
    // Override json method to invalidate cache after successful response
    res.json = function(data: any) {
      // Invalidate cache pattern asynchronously
      redisCache.invalidatePattern(pattern).catch(error => {
        console.warn('Failed to invalidate cache:', error);
      });
      
      return originalJson(data);
    };
    
    next();
  };
}

function generateCacheKey(prefix: string, url: string, query: any): string {
  const queryString = Object.keys(query).length > 0 ? JSON.stringify(query) : '';
  const keyData = `${url}:${queryString}`;
  return `${prefix}:${Buffer.from(keyData).toString('base64')}`;
}

// Specialized cache middleware for different endpoints
export const productsCacheMiddleware = cacheMiddleware({
  ttl: 300, // 5 minutes
  keyPrefix: 'products',
  skipCacheCondition: (req) => {
    // Skip cache if user is admin (they might see different data)
    return (req.user as any)?.role === 'admin' || (req.user as any)?.role === 'super_admin';
  }
});

export const walletCacheMiddleware = cacheMiddleware({
  ttl: 120, // 2 minutes for financial data
  keyPrefix: 'wallet'
});

export const userCacheMiddleware = cacheMiddleware({
  ttl: 600, // 10 minutes
  keyPrefix: 'user'
});

export const categoriesCacheMiddleware = cacheMiddleware({
  ttl: 900, // 15 minutes (categories change rarely)
  keyPrefix: 'categories'
});

export const ordersCacheMiddleware = cacheMiddleware({
  ttl: 300, // 5 minutes for orders (frequently updated)
  keyPrefix: 'orders',
  skipCacheCondition: (req) => {
    // Skip cache for admin users (they might see different data)
    return (req.user as any)?.role === 'admin' || (req.user as any)?.role === 'super_admin';
  }
});