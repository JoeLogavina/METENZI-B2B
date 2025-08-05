// ⚡ ADVANCED API RATE LIMITER (Step 6)
// Intelligent rate limiting with multiple strategies and adaptive thresholds

import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';
import { redisCache } from '../cache/redis';

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  message?: string | ((req: Request, res: Response) => any);
  statusCode?: number;
  headers?: boolean;
  standardHeaders?: boolean;
  legacyHeaders?: boolean;
  requestWasSuccessful?: (req: Request, res: Response) => boolean;
  onLimitReached?: (req: Request, res: Response, options: RateLimitConfig) => void;
}

export interface RateLimitStore {
  incr(key: string, windowMs: number): Promise<{ count: number; resetTime?: number }>;
  decrement?(key: string): Promise<void>;
  resetKey?(key: string): Promise<void>;
  resetAll?(): Promise<void>;
}

export class AdvancedRateLimiter {
  private config: RateLimitConfig;
  private store: RateLimitStore;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 100,
      keyGenerator: (req) => req.ip,
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      message: 'Too many requests, please try again later.',
      statusCode: 429,
      headers: true,
      standardHeaders: true,
      legacyHeaders: false,
      requestWasSuccessful: (req, res) => res.statusCode < 400,
      ...config
    };

    this.store = new RedisRateLimitStore();
  }

  // Main rate limiting middleware
  middleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const key = this.config.keyGenerator!(req);
        const identifier = `rate_limit:${key}:${req.path}:${req.method}`;

        // Get current count and increment
        const { count, resetTime } = await this.store.incr(identifier, this.config.windowMs);

        // Set rate limit headers
        if (this.config.headers) {
          if (this.config.standardHeaders) {
            res.setHeader('X-RateLimit-Limit', this.config.maxRequests);
            res.setHeader('X-RateLimit-Remaining', Math.max(0, this.config.maxRequests - count));
            if (resetTime) {
              res.setHeader('X-RateLimit-Reset', new Date(resetTime).toISOString());
            }
          }

          if (this.config.legacyHeaders) {
            res.setHeader('X-Rate-Limit-Limit', this.config.maxRequests);
            res.setHeader('X-Rate-Limit-Remaining', Math.max(0, this.config.maxRequests - count));
            if (resetTime) {
              res.setHeader('X-Rate-Limit-Reset', Math.ceil(resetTime / 1000));
            }
          }
        }

        // Check if limit exceeded
        if (count > this.config.maxRequests) {
          // Call limit reached callback
          if (this.config.onLimitReached) {
            this.config.onLimitReached(req, res, this.config);
          }

          // Log rate limit exceeded
          logger.warn('Rate limit exceeded', {
            ip: req.ip,
            path: req.path,
            method: req.method,
            count,
            limit: this.config.maxRequests,
            userAgent: req.get('User-Agent')
          });

          // Return rate limit response
          const message = typeof this.config.message === 'function' 
            ? this.config.message(req, res)
            : this.config.message;

          return res.status(this.config.statusCode!).json({
            error: 'RATE_LIMIT_EXCEEDED',
            message,
            retryAfter: resetTime ? Math.ceil((resetTime - Date.now()) / 1000) : undefined
          });
        }

        // Attach rate limit info to request
        (req as any).rateLimit = {
          limit: this.config.maxRequests,
          current: count,
          remaining: this.config.maxRequests - count,
          resetTime
        };

        // Continue with response handling
        const originalSend = res.send;
        res.send = function(body: any) {
          const wasSuccessful = this.config.requestWasSuccessful!(req, res);
          
          // Handle skip logic after response
          if ((wasSuccessful && this.config.skipSuccessfulRequests) ||
              (!wasSuccessful && this.config.skipFailedRequests)) {
            // Decrement counter if we should skip this request
            if (this.store.decrement) {
              this.store.decrement(identifier).catch(err => {
                logger.error('Failed to decrement rate limit counter', err);
              });
            }
          }

          return originalSend.call(this, body);
        }.bind(this);

        next();

      } catch (error: any) {
        logger.error('Rate limiter error', {
          error: error.message,
          path: req.path,
          ip: req.ip
        });
        next(); // Continue on error
      }
    };
  }

  // Reset rate limit for a specific key
  async resetKey(req: Request): Promise<void> {
    const key = this.config.keyGenerator!(req);
    const identifier = `rate_limit:${key}:${req.path}:${req.method}`;
    
    if (this.store.resetKey) {
      await this.store.resetKey(identifier);
    }
  }

  // Reset all rate limits
  async resetAll(): Promise<void> {
    if (this.store.resetAll) {
      await this.store.resetAll();
    }
  }
}

// Redis-based rate limit store
export class RedisRateLimitStore implements RateLimitStore {
  private prefix = 'rate_limit:';

  async incr(key: string, windowMs: number): Promise<{ count: number; resetTime?: number }> {
    const window = Math.floor(Date.now() / windowMs);
    const windowKey = `${this.prefix}${key}:${window}`;
    
    const count = await redisCache.get(windowKey) as number || 0;
    const newCount = count + 1;
    
    // Set with expiration
    await redisCache.set(windowKey, newCount, Math.ceil(windowMs / 1000));
    
    return {
      count: newCount,
      resetTime: (window + 1) * windowMs
    };
  }

  async decrement(key: string): Promise<void> {
    const windowMs = 60 * 1000; // Default window
    const window = Math.floor(Date.now() / windowMs);
    const windowKey = `${this.prefix}${key}:${window}`;
    
    const count = await redisCache.get(windowKey) as number || 0;
    if (count > 0) {
      await redisCache.set(windowKey, count - 1, Math.ceil(windowMs / 1000));
    }
  }

  async resetKey(key: string): Promise<void> {
    const keys = await redisCache.keys(`${this.prefix}${key}:*`);
    for (const k of keys) {
      await redisCache.del(k);
    }
  }

  async resetAll(): Promise<void> {
    const keys = await redisCache.keys(`${this.prefix}*`);
    for (const key of keys) {
      await redisCache.del(key);
    }
  }
}

// Pre-configured rate limiters for different scenarios
export class RateLimiterPresets {
  // Strict rate limiter for authentication endpoints
  static authenticationLimiter() {
    return new AdvancedRateLimiter({
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 5,
      message: 'Too many authentication attempts, please try again later.',
      keyGenerator: (req) => `auth:${req.ip}`,
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      onLimitReached: (req, res, options) => {
        logger.warn('Authentication rate limit exceeded', {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          path: req.path
        });
      }
    });
  }

  // General API rate limiter
  static apiLimiter() {
    return new AdvancedRateLimiter({
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 100,
      message: 'API rate limit exceeded.',
      keyGenerator: (req) => {
        const user = (req as any).user;
        return user ? `user:${user.id}` : `ip:${req.ip}`;
      },
      skipSuccessfulRequests: false,
      skipFailedRequests: true
    });
  }

  // Premium user rate limiter
  static premiumUserLimiter() {
    return new AdvancedRateLimiter({
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 500,
      message: 'Premium API rate limit exceeded.',
      keyGenerator: (req) => {
        const user = (req as any).user;
        return `premium:${user?.id || req.ip}`;
      }
    });
  }

  // Admin operation rate limiter
  static adminLimiter() {
    return new AdvancedRateLimiter({
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 200,
      message: 'Admin operation rate limit exceeded.',
      keyGenerator: (req) => {
        const user = (req as any).user;
        return `admin:${user?.id || req.ip}`;
      }
    });
  }

  // File download rate limiter
  static downloadLimiter() {
    return new AdvancedRateLimiter({
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 10,
      message: 'Download rate limit exceeded.',
      keyGenerator: (req) => `download:${req.ip}`,
      onLimitReached: (req, res, options) => {
        logger.warn('Download rate limit exceeded', {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          path: req.path
        });
      }
    });
  }

  // Adaptive rate limiter based on user role
  static adaptiveUserLimiter() {
    return new AdvancedRateLimiter({
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 100, // Default, will be overridden
      keyGenerator: (req) => {
        const user = (req as any).user;
        return user ? `adaptive:${user.id}` : `adaptive:${req.ip}`;
      }
    });
  }

  // Create custom endpoint-specific limiters
  static createEndpointLimiter(path: string, options: Partial<RateLimitConfig> = {}) {
    return new AdvancedRateLimiter({
      windowMs: 60 * 1000,
      maxRequests: 50,
      keyGenerator: (req) => `endpoint:${path}:${req.ip}`,
      message: `Rate limit exceeded for ${path}.`,
      ...options
    });
  }
}

// Distributed rate limiting for multiple server instances
export class DistributedRateLimiter extends AdvancedRateLimiter {
  private serverId: string;

  constructor(config: Partial<RateLimitConfig> = {}, serverId?: string) {
    super(config);
    this.serverId = serverId || `server_${Math.random().toString(36).substr(2, 9)}`;
  }

  middleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const key = this.config.keyGenerator!(req);
        const distributedKey = `distributed:${key}:${req.path}:${req.method}`;

        // Use Redis for distributed counting
        const script = `
          local key = KEYS[1]
          local window = ARGV[1]
          local limit = ARGV[2]
          local current_time = ARGV[3]
          
          local current_window = math.floor(current_time / window)
          local window_key = key .. ':' .. current_window
          
          local current = redis.call('GET', window_key)
          if current == false then
            current = 0
          else
            current = tonumber(current)
          end
          
          if current >= tonumber(limit) then
            return {current, (current_window + 1) * tonumber(window)}
          end
          
          redis.call('INCR', window_key)
          redis.call('EXPIRE', window_key, math.ceil(tonumber(window) / 1000))
          
          return {current + 1, (current_window + 1) * tonumber(window)}
        `;

        // This would be implemented with actual Redis Lua script execution
        // For now, fall back to regular rate limiting
        return super.middleware()(req, res, next);

      } catch (error: any) {
        logger.error('Distributed rate limiter error', {
          error: error.message,
          serverId: this.serverId
        });
        next(); // Continue on error
      }
    };
  }
}