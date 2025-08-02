// TIER 1 ENTERPRISE OPTIMIZATION: Smart Response Caching Service
// Implements intelligent caching with automatic invalidation and performance tracking

import { redisCache } from '../cache/redis';
import { performanceService } from './performance.service';
import { logger } from '../lib/logger';

interface CacheOptions {
  ttl: number;
  tags?: string[];
  varyBy?: string[];
  condition?: () => boolean;
}

interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalQueries: number;
}

class ResponseCachingService {
  private static instance: ResponseCachingService;
  private stats = { hits: 0, misses: 0 };

  static getInstance(): ResponseCachingService {
    if (!ResponseCachingService.instance) {
      ResponseCachingService.instance = new ResponseCachingService();
    }
    return ResponseCachingService.instance;
  }

  /**
   * Cache API response with smart key generation
   */
  async cacheResponse<T>(
    endpoint: string,
    params: any,
    data: T,
    options: CacheOptions
  ): Promise<void> {
    const timingId = performanceService.startTiming('cache-set');
    
    try {
      if (options.condition && !options.condition()) {
        return;
      }

      const cacheKey = this.generateCacheKey(endpoint, params, options.varyBy);
      await redisCache.set(cacheKey, data, options.ttl);

      // Store cache tags for invalidation
      if (options.tags) {
        for (const tag of options.tags) {
          await redisCache.set(`tag:${tag}:${cacheKey}`, true, options.ttl);
        }
      }

      logger.debug('Response cached successfully', {
        category: 'performance',
        endpoint,
        cacheKey: cacheKey.substring(0, 50) + '...',
        ttl: options.ttl
      });
    } catch (error) {
      logger.warn('Response caching failed', {
        category: 'performance',
        endpoint,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      performanceService.endTiming(timingId);
    }
  }

  /**
   * Get cached response
   */
  async getCachedResponse<T>(
    endpoint: string,
    params: any,
    varyBy?: string[]
  ): Promise<T | null> {
    const timingId = performanceService.startTiming('cache-get');
    
    try {
      const cacheKey = this.generateCacheKey(endpoint, params, varyBy);
      const cached = await redisCache.get<T>(cacheKey);
      
      if (cached) {
        this.stats.hits++;
        logger.debug('Cache hit', {
          category: 'performance',
          endpoint,
          cacheKey: cacheKey.substring(0, 50) + '...'
        });
        return cached;
      } else {
        this.stats.misses++;
        return null;
      }
    } catch (error) {
      this.stats.misses++;
      return null;
    } finally {
      performanceService.endTiming(timingId);
    }
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateByTags(tags: string[]): Promise<void> {
    const timingId = performanceService.startTiming('cache-invalidate');
    
    try {
      for (const tag of tags) {
        // This is a simplified approach - in production you'd want a more sophisticated tag system
        await redisCache.del(`tag:${tag}:*`);
      }
      
      logger.info('Cache invalidated by tags', {
        category: 'performance',
        tags
      });
    } catch (error) {
      logger.error('Cache invalidation failed', {
        category: 'performance',
        error: error instanceof Error ? error.message : 'Unknown error',
        tags
      });
    } finally {
      performanceService.endTiming(timingId);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalQueries = this.stats.hits + this.stats.misses;
    const hitRate = totalQueries > 0 ? this.stats.hits / totalQueries : 0;
    
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate,
      totalQueries
    };
  }

  /**
   * Cached products endpoint
   */
  async getProductsCached(filters: any, userId?: string): Promise<any[] | null> {
    return this.getCachedResponse(
      'products',
      { ...filters, userId },
      ['user-id', 'tenant-id']
    );
  }

  async setProductsCache(filters: any, products: any[], userId?: string): Promise<void> {
    await this.cacheResponse(
      'products',
      { ...filters, userId },
      products,
      {
        ttl: 300, // 5 minutes
        tags: ['products', 'inventory'],
        condition: () => !filters.search // Don't cache search results
      }
    );
  }

  /**
   * Cached orders endpoint
   */
  async getOrdersCached(userId?: string): Promise<any[] | null> {
    return this.getCachedResponse(
      'orders',
      { userId },
      ['user-id']
    );
  }

  async setOrdersCache(orders: any[], userId?: string): Promise<void> {
    await this.cacheResponse(
      'orders',
      { userId },
      orders,
      {
        ttl: 120, // 2 minutes
        tags: ['orders', userId ? `user:${userId}` : 'all-orders']
      }
    );
  }

  /**
   * Cached cart endpoint
   */
  async getCartCached(userId: string): Promise<any[] | null> {
    return this.getCachedResponse(
      'cart',
      { userId },
      ['user-id']
    );
  }

  async setCartCache(cartItems: any[], userId: string): Promise<void> {
    await this.cacheResponse(
      'cart',
      { userId },
      cartItems,
      {
        ttl: 30, // 30 seconds - cart changes frequently
        tags: [`cart:${userId}`, 'products']
      }
    );
  }

  /**
   * Clear all cached data for a user
   */
  async clearUserCache(userId: string): Promise<void> {
    await this.invalidateByTags([`user:${userId}`, `cart:${userId}`]);
  }

  private generateCacheKey(endpoint: string, params: any, varyBy?: string[]): string {
    const parts = [endpoint];
    
    // Add parameters
    if (params && Object.keys(params).length > 0) {
      const sortedParams = Object.keys(params)
        .sort()
        .map(key => `${key}=${params[key]}`)
        .join('&');
      parts.push(sortedParams);
    }
    
    // Add vary-by fields
    if (varyBy) {
      parts.push(...varyBy.map(field => `vary:${field}`));
    }
    
    return Buffer.from(parts.join('|')).toString('base64');
  }
}

export const responseCaching = ResponseCachingService.getInstance();