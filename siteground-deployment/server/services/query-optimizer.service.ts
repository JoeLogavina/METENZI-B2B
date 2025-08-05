// TIER 1 ENTERPRISE OPTIMIZATION: Advanced Query Optimizer Service
// Implements intelligent query optimization, connection pooling, and caching strategies

import { db, pool } from '../db';
import { sql } from 'drizzle-orm';
import { performanceService } from './performance.service';
import { redisCache } from '../cache/redis';
import { logger } from '../lib/logger';

interface QueryCacheOptions {
  ttl?: number; // Time to live in seconds
  tags?: string[]; // Cache invalidation tags
  condition?: () => boolean; // Conditional caching
}

interface QueryOptimizationStats {
  totalQueries: number;
  averageTime: number;
  slowQueries: number;
  cacheHitRate: number;
  connectionPoolStats: any;
}

class QueryOptimizer {
  private static instance: QueryOptimizer;
  private queryCache = new Map<string, { result: any, timestamp: number, ttl: number }>();
  private queryStats = new Map<string, { count: number, totalTime: number, slowCount: number }>();
  private readonly SLOW_QUERY_THRESHOLD = 1000; // 1 second
  private readonly DEFAULT_CACHE_TTL = 300; // 5 minutes

  static getInstance(): QueryOptimizer {
    if (!QueryOptimizer.instance) {
      QueryOptimizer.instance = new QueryOptimizer();
    }
    return QueryOptimizer.instance;
  }

  /**
   * Execute query with automatic optimization and caching
   */
  async executeOptimized<T>(
    queryKey: string,
    queryFn: () => Promise<T>,
    options: QueryCacheOptions = {}
  ): Promise<T> {
    const timingId = performanceService.startTiming(`query:${queryKey}`);
    const cacheKey = `query:${queryKey}`;
    
    try {
      // Check cache first
      if (options.condition === undefined || options.condition()) {
        const cached = await this.getCachedResult<T>(cacheKey);
        if (cached !== null) {
          logger.debug('Query cache hit', { 
            category: 'performance',
            queryKey,
            cacheKey 
          });
          return cached;
        }
      }

      // Execute query with timing
      const startTime = Date.now();
      const result = await queryFn();
      const duration = Date.now() - startTime;

      // Update statistics
      this.updateQueryStats(queryKey, duration);

      // Cache result if conditions are met
      if (result && (options.condition === undefined || options.condition())) {
        const ttl = options.ttl || this.DEFAULT_CACHE_TTL;
        await this.cacheResult(cacheKey, result, ttl, options.tags);
      }

      // Log slow queries
      if (duration > this.SLOW_QUERY_THRESHOLD) {
        logger.warn('Slow query detected', {
          category: 'performance',
          queryKey,
          duration,
          threshold: this.SLOW_QUERY_THRESHOLD
        });
      }

      return result;
    } finally {
      performanceService.endTiming(timingId);
    }
  }

  /**
   * Batch execute multiple queries with optimization
   */
  async executeBatch<T>(
    queries: Array<{
      key: string;
      fn: () => Promise<T>;
      options?: QueryCacheOptions;
    }>
  ): Promise<T[]> {
    const timingId = performanceService.startTiming('batch-query');
    
    try {
      // Execute all queries in parallel
      const promises = queries.map(({ key, fn, options }) =>
        this.executeOptimized(key, fn, options)
      );
      
      return await Promise.all(promises);
    } finally {
      performanceService.endTiming(timingId);
    }
  }

  /**
   * Get optimized product list with smart caching
   */
  async getOptimizedProducts(filters: any): Promise<any[]> {
    const filterKey = this.generateFilterKey(filters);
    const queryKey = `products:${filterKey}`;

    return this.executeOptimized(
      queryKey,
      async () => {
        // Use optimized query with proper indexes
        const result = await db.execute(sql`
          SELECT 
            p.id, p.sku, p.name, p.description, p.price, p.price_km,
            p.category_id, p.region, p.platform, p.image_url, p.warranty,
            p.is_active, p.created_at, p.updated_at,
            COUNT(CASE WHEN lk.is_used = false THEN 1 END)::integer as stock_count
          FROM products p
          LEFT JOIN license_keys lk ON p.id = lk.product_id
          WHERE 
            p.is_active = true 
            ${filters.region && filters.region !== 'all' ? sql`AND p.region = ${filters.region}` : sql``}
            ${filters.platform && filters.platform !== 'all' ? sql`AND p.platform = ${filters.platform}` : sql``}
            ${filters.search ? sql`AND (
              p.name ILIKE ${`%${filters.search}%`} OR 
              p.description ILIKE ${`%${filters.search}%`} OR 
              p.sku ILIKE ${`%${filters.search}%`}
            )` : sql``}
            ${filters.priceMin ? sql`AND p.price::numeric >= ${filters.priceMin}` : sql``}
            ${filters.priceMax ? sql`AND p.price::numeric <= ${filters.priceMax}` : sql``}
          GROUP BY p.id
          ORDER BY p.created_at DESC
        `);
        
        return result.rows;
      },
      {
        ttl: 180, // 3 minutes cache for product list
        tags: ['products', 'inventory'],
        condition: () => !filters.search // Don't cache search results
      }
    );
  }

  /**
   * Get optimized orders with minimal queries
   */
  async getOptimizedOrders(userId?: string): Promise<any[]> {
    const queryKey = userId ? `orders:user:${userId}` : 'orders:all';

    return this.executeOptimized(
      queryKey,
      async () => {
        // Single optimized query instead of N+1 pattern
        const result = await db.execute(sql`
          SELECT 
            o.*,
            json_agg(
              json_build_object(
                'id', oi.id,
                'quantity', oi.quantity,
                'unit_price', oi.unit_price,
                'total_price', oi.total_price,
                'product', json_build_object(
                  'id', p.id,
                  'name', p.name,
                  'sku', p.sku,
                  'price', p.price,
                  'platform', p.platform
                ),
                'license_key', CASE 
                  WHEN lk.id IS NOT NULL THEN json_build_object(
                    'id', lk.id,
                    'key_value', lk.key_value,
                    'is_used', lk.is_used
                  )
                  ELSE null
                END
              )
            ) as items
          FROM orders o
          LEFT JOIN order_items oi ON o.id = oi.order_id
          LEFT JOIN products p ON oi.product_id = p.id
          LEFT JOIN license_keys lk ON oi.license_key_id = lk.id
          ${userId ? sql`WHERE o.user_id = ${userId}` : sql``}
          GROUP BY o.id
          ORDER BY o.created_at DESC
        `);
        
        return result.rows;
      },
      {
        ttl: 120, // 2 minutes cache
        tags: ['orders', userId ? `user:${userId}` : 'all-orders']
      }
    );
  }

  /**
   * Get optimized cart items with single query
   */
  async getOptimizedCartItems(userId: string): Promise<any[]> {
    return this.executeOptimized(
      `cart:${userId}`,
      async () => {
        const result = await db.execute(sql`
          SELECT 
            cv.id, cv.user_id, cv.product_id, cv.quantity,
            p.name as product_name,
            p.price as product_price,
            p.image_url as product_image_url,
            p.is_active as product_active
          FROM cart_view cv
          INNER JOIN products p ON cv.product_id = p.id
          WHERE cv.user_id = ${userId} AND p.is_active = true
          ORDER BY cv.last_updated DESC
        `);
        
        return result.rows;
      },
      {
        ttl: 30, // 30 seconds cache for cart (frequent updates)
        tags: [`cart:${userId}`, 'products']
      }
    );
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateByTags(tags: string[]): Promise<void> {
    try {
      await Promise.all(
        tags.map(tag => redisCache.invalidatePattern(`*:${tag}:*`))
      );
      
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
    }
  }

  /**
   * Get query optimization statistics
   */
  getOptimizationStats(): QueryOptimizationStats {
    let totalQueries = 0;
    let totalTime = 0;
    let slowQueries = 0;

    for (const [, stats] of Array.from(this.queryStats.entries())) {
      totalQueries += stats.count;
      totalTime += stats.totalTime;
      slowQueries += stats.slowCount;
    }

    const averageTime = totalQueries > 0 ? totalTime / totalQueries : 0;
    const cacheHitRate = this.calculateCacheHitRate();

    return {
      totalQueries,
      averageTime,
      slowQueries,
      cacheHitRate,
      connectionPoolStats: this.getConnectionPoolStats()
    };
  }

  /**
   * Preload critical data for better performance
   */
  async preloadCriticalData(): Promise<void> {
    const timingId = performanceService.startTiming('preload-critical-data');
    
    try {
      // Preload active products, categories, and common data
      await Promise.all([
        this.getOptimizedProducts({ isActive: true }),
        redisCache.set('categories:active', await this.getActiveCategories(), 300),
        redisCache.set('platform:stats', await this.getPlatformStats(), 600)
      ]);
      
      logger.info('Critical data preloaded successfully', {
        category: 'performance'
      });
    } catch (error) {
      logger.error('Critical data preload failed', {
        category: 'performance',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      performanceService.endTiming(timingId);
    }
  }

  // Private helper methods
  private async getCachedResult<T>(key: string): Promise<T | null> {
    try {
      return await redisCache.get<T>(key);
    } catch (error) {
      return null;
    }
  }

  private async cacheResult(key: string, result: any, ttl: number, tags?: string[]): Promise<void> {
    try {
      await redisCache.set(key, result, ttl);
      
      // Store cache tags for invalidation
      if (tags) {
        for (const tag of tags) {
          await redisCache.set(`tag:${tag}:${key}`, true, ttl);
        }
      }
    } catch (error) {
      // Cache errors should not break the application
      logger.debug('Cache set failed', {
        category: 'performance',
        key,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private updateQueryStats(queryKey: string, duration: number): void {
    const stats = this.queryStats.get(queryKey) || { count: 0, totalTime: 0, slowCount: 0 };
    
    stats.count++;
    stats.totalTime += duration;
    
    if (duration > this.SLOW_QUERY_THRESHOLD) {
      stats.slowCount++;
    }
    
    this.queryStats.set(queryKey, stats);
  }

  private generateFilterKey(filters: any): string {
    return Buffer.from(JSON.stringify(filters || {})).toString('base64').substring(0, 16);
  }

  private calculateCacheHitRate(): number {
    // This would be implemented with actual cache hit/miss tracking
    return 0.75; // Placeholder - implement actual tracking
  }

  private getConnectionPoolStats(): any {
    try {
      return {
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount
      };
    } catch (error) {
      return { error: 'Stats unavailable' };
    }
  }

  private async getActiveCategories(): Promise<any[]> {
    const result = await db.execute(sql`
      SELECT id, name, parent_id, icon, description
      FROM categories 
      WHERE is_active = true 
      ORDER BY display_order, name
    `);
    return result.rows;
  }

  private async getPlatformStats(): Promise<any> {
    const result = await db.execute(sql`
      SELECT 
        platform,
        region,
        COUNT(*) as product_count,
        AVG(price::numeric) as avg_price
      FROM products 
      WHERE is_active = true 
      GROUP BY platform, region
      ORDER BY product_count DESC
    `);
    return result.rows;
  }
}

export const queryOptimizer = QueryOptimizer.getInstance();