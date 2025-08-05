// TIER 1 ENTERPRISE OPTIMIZATION: Performance Middleware
// Implements response caching, compression, and request optimization

import { Request, Response, NextFunction } from 'express';
import compression from 'compression';
import { redisCache } from '../cache/redis';
import { performanceService } from '../services/performance.service';
import { logger } from '../lib/logger';

interface CacheConfig {
  ttl: number;
  varyBy?: string[];
  condition?: (req: Request) => boolean;
  keyGenerator?: (req: Request) => string;
}

/**
 * Response caching middleware with intelligent cache keys
 */
export function cacheMiddleware(config: CacheConfig) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip caching for non-GET requests or if condition fails
    if (req.method !== 'GET' || (config.condition && !config.condition(req))) {
      return next();
    }

    const timingId = performanceService.startTiming('cache-middleware');
    
    try {
      // Generate cache key
      const cacheKey = config.keyGenerator 
        ? config.keyGenerator(req) 
        : generateDefaultCacheKey(req, config.varyBy);

      // Check cache
      const cached = await redisCache.get(cacheKey);
      if (cached) {
        logger.debug('Cache hit for request', {
          category: 'performance',
          path: req.path,
          cacheKey: cacheKey.substring(0, 50) + '...'
        });
        
        res.set('X-Cache', 'HIT');
        res.set('Content-Type', cached.contentType || 'application/json');
        return res.status(cached.statusCode || 200).send(cached.data);
      }

      // Cache miss - intercept response
      const originalSend = res.send.bind(res);
      const originalJson = res.json.bind(res);

      res.send = function(data: any) {
        // Cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const cacheData = {
            data,
            statusCode: res.statusCode,
            contentType: res.get('Content-Type')
          };
          
          redisCache.set(cacheKey, cacheData, config.ttl).catch(err => {
            logger.warn('Failed to cache response', {
              category: 'performance',
              error: err.message,
              cacheKey: cacheKey.substring(0, 50) + '...'
            });
          });
        }
        
        res.set('X-Cache', 'MISS');
        return originalSend(data);
      };

      res.json = function(data: any) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const cacheData = {
            data,
            statusCode: res.statusCode,
            contentType: 'application/json'
          };
          
          redisCache.set(cacheKey, cacheData, config.ttl).catch(err => {
            logger.warn('Failed to cache JSON response', {
              category: 'performance',
              error: err.message
            });
          });
        }
        
        res.set('X-Cache', 'MISS');
        return originalJson(data);
      };

      next();
    } catch (error) {
      logger.error('Cache middleware error', {
        category: 'performance',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      next(); // Continue without caching on error
    } finally {
      performanceService.endTiming(timingId);
    }
  };
}

/**
 * Compression middleware with intelligent content-type detection
 */
export function compressionMiddleware() {
  return compression({
    filter: (req, res) => {
      // Don't compress if the request includes a cache-control: no-transform directive
      if (req.headers['cache-control'] && req.headers['cache-control'].includes('no-transform')) {
        return false;
      }
      
      // Use compression for JSON, HTML, CSS, JS, and text content
      const contentType = res.get('Content-Type') || '';
      return compression.filter(req, res) || 
             contentType.includes('application/json') ||
             contentType.includes('text/') ||
             contentType.includes('application/javascript');
    },
    level: 6, // Good balance between compression ratio and speed
    threshold: 1024, // Only compress responses larger than 1KB
  });
}

/**
 * Request batching middleware for API optimization
 */
export function batchingMiddleware() {
  const pendingRequests = new Map<string, {
    promise: Promise<any>;
    resolve: (value: any) => void;
    reject: (error: any) => void;
    timestamp: number;
  }>();

  return (req: Request, res: Response, next: NextFunction) => {
    // Only batch GET requests to specific endpoints
    if (req.method !== 'GET' || !shouldBatchRequest(req.path)) {
      return next();
    }

    const batchKey = generateBatchKey(req);
    const existing = pendingRequests.get(batchKey);

    if (existing && (Date.now() - existing.timestamp) < 100) { // 100ms window
      // Reuse existing request
      existing.promise
        .then(data => res.json(data))
        .catch(error => res.status(500).json({ error: error.message }));
      return;
    }

    // Create new batched request
    let resolvePromise: (value: any) => void;
    let rejectPromise: (error: any) => void;

    const promise = new Promise((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;
    });

    pendingRequests.set(batchKey, {
      promise,
      resolve: resolvePromise!,
      reject: rejectPromise!,
      timestamp: Date.now()
    });

    // Override response methods to capture data
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);

    res.json = function(data: any) {
      const batchInfo = pendingRequests.get(batchKey);
      if (batchInfo) {
        batchInfo.resolve(data);
        pendingRequests.delete(batchKey);
      }
      return originalJson(data);
    };

    res.send = function(data: any) {
      const batchInfo = pendingRequests.get(batchKey);
      if (batchInfo) {
        batchInfo.resolve(data);
        pendingRequests.delete(batchKey);
      }
      return originalSend(data);
    };

    // Cleanup old requests
    setTimeout(() => {
      if (pendingRequests.has(batchKey)) {
        const batchInfo = pendingRequests.get(batchKey)!;
        batchInfo.reject(new Error('Batch request timeout'));
        pendingRequests.delete(batchKey);
      }
    }, 5000);

    next();
  };
}

/**
 * Query optimization middleware
 */
export function queryOptimizationMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const timingId = performanceService.startTiming(`api:${req.path}`);
    
    // Add query optimization context to request
    (req as any).queryOptimizer = {
      startTime: Date.now(),
      timingId,
      shouldCache: shouldCacheRequest(req),
      cacheKey: generateDefaultCacheKey(req)
    };

    // Cleanup on response finish
    res.on('finish', () => {
      const duration = performanceService.endTiming(timingId, (req as any).user?.id, {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        cached: res.get('X-Cache') === 'HIT'
      });

      // Log slow requests
      if (duration > 2000) { // 2 seconds
        logger.warn('Slow API request detected', {
          category: 'performance',
          method: req.method,
          path: req.path,
          duration,
          statusCode: res.statusCode,
          userId: (req as any).user?.id
        });
      }
    });

    next();
  };
}

// Helper functions
function generateDefaultCacheKey(req: Request, varyBy?: string[]): string {
  const parts = [req.path];
  
  // Add query parameters
  if (Object.keys(req.query).length > 0) {
    const sortedQuery = Object.keys(req.query)
      .sort()
      .map(key => `${key}=${req.query[key]}`)
      .join('&');
    parts.push(sortedQuery);
  }
  
  // Add vary-by headers
  if (varyBy) {
    varyBy.forEach(header => {
      const value = req.get(header);
      if (value) parts.push(`${header}:${value}`);
    });
  }
  
  // Add user context if available
  if ((req as any).user?.id) {
    parts.push(`user:${(req as any).user.id}`);
  }
  
  // Add tenant context if available
  if ((req as any).tenant?.id) {
    parts.push(`tenant:${(req as any).tenant.id}`);
  }
  
  return Buffer.from(parts.join('|')).toString('base64');
}

function generateBatchKey(req: Request): string {
  return `${req.method}:${req.path}:${JSON.stringify(req.query)}`;
}

function shouldBatchRequest(path: string): boolean {
  const batchableEndpoints = [
    '/api/products',
    '/api/categories',
    '/api/orders',
    '/api/wallet'
  ];
  
  return batchableEndpoints.some(endpoint => path.startsWith(endpoint));
}

function shouldCacheRequest(req: Request): boolean {
  // Don't cache POST, PUT, DELETE requests
  if (req.method !== 'GET') return false;
  
  // Don't cache requests with search parameters (they change frequently)
  if (req.query.search) return false;
  
  // Don't cache admin endpoints
  if (req.path.startsWith('/api/admin')) return false;
  
  return true;
}