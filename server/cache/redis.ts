import Redis from 'ioredis';

class RedisCache {
  private client: Redis;
  private isConnected: boolean = false;

  constructor() {
    // Initialize Redis client with fallback to in-memory cache if Redis unavailable
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: 0,
      lazyConnect: true,
      connectionName: 'b2b-portal',
      retryDelayOnFailover: 100,
      connectTimeout: 2000,
      commandTimeout: 1000,
      enableAutoPipelining: false,
    });

    this.client.on('connect', () => {
      this.isConnected = true;
    });

    let hasLoggedError = false;
    this.client.on('error', (error) => {
      if (!hasLoggedError) {
        console.warn('⚠️ Redis unavailable, using in-memory cache fallback');
        hasLoggedError = true;
      }
      this.isConnected = false;
    });

    this.client.on('close', () => {
      this.isConnected = false;
    });
    
    // Try to connect once and fallback silently if it fails
    this.client.connect().catch(() => {
      console.log('🔄 Redis unavailable, using in-memory cache');
      this.isConnected = false;
    });
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.isConnected) {
      return inMemoryCache.get<T>(key);
    }
    
    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.warn('Redis GET error, using in-memory:', error.message);
      return inMemoryCache.get<T>(key);
    }
  }

  async set(key: string, value: any, ttlSeconds: number = 300): Promise<boolean> {
    if (!this.isConnected) {
      return inMemoryCache.set(key, value, ttlSeconds);
    }
    
    try {
      await this.client.setex(key, ttlSeconds, JSON.stringify(value));
      return true;
    } catch (error) {
      console.warn('Redis SET error, using in-memory:', error.message);
      return inMemoryCache.set(key, value, ttlSeconds);
    }
  }

  async del(key: string): Promise<boolean> {
    if (!this.isConnected) return false;
    
    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      console.warn('Redis DEL error:', error);
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.isConnected) return false;
    
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      console.warn('Redis EXISTS error:', error);
      return false;
    }
  }

  async invalidatePattern(pattern: string): Promise<void> {
    if (!this.isConnected) return;
    
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } catch (error) {
      console.warn('Redis pattern invalidation error:', error);
    }
  }

  // Specialized methods for common use cases
  async cacheApiResponse(endpoint: string, filters: any, data: any, ttl: number = 300): Promise<void> {
    const key = this.generateCacheKey('api', endpoint, filters);
    await this.set(key, data, ttl);
  }

  async getCachedApiResponse<T>(endpoint: string, filters: any): Promise<T | null> {
    const key = this.generateCacheKey('api', endpoint, filters);
    return await this.get<T>(key);
  }

  async invalidateApiCache(endpoint: string): Promise<void> {
    const pattern = this.generateCacheKey('api', endpoint, '*');
    await this.invalidatePattern(pattern);
  }

  private generateCacheKey(prefix: string, endpoint: string, filters: any): string {
    const filterStr = typeof filters === 'string' ? filters : JSON.stringify(filters);
    return `${prefix}:${endpoint}:${Buffer.from(filterStr).toString('base64')}`;
  }

  async disconnect(): Promise<void> {
    try {
      await this.client.disconnect();
    } catch (error) {
      console.warn('Error disconnecting Redis:', error);
    }
  }
}

// In-memory cache fallback
class InMemoryCache {
  private cache = new Map<string, { value: any; expiry: number }>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    console.log('🔄 In-memory cache initialized as Redis fallback');
    // Clean up expired entries every 2 minutes
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      let cleaned = 0;
      for (const [key, entry] of this.cache.entries()) {
        if (entry.expiry < now) {
          this.cache.delete(key);
          cleaned++;
        }
      }
      if (cleaned > 0) {
        console.log(`🧹 Cleaned ${cleaned} expired cache entries`);
      }
    }, 2 * 60 * 1000);
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (entry.expiry < Date.now()) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.value;
  }

  set(key: string, value: any, ttlSeconds: number = 300): boolean {
    const expiry = Date.now() + (ttlSeconds * 1000);
    this.cache.set(key, { value, expiry });
    return true;
  }

  del(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cache.clear();
  }
}

// Global in-memory cache instance
const inMemoryCache = new InMemoryCache();

// Singleton instance
export const redisCache = new RedisCache();

// Helper functions for common operations
export const cacheHelpers = {
  // Products cache
  async getProducts(filters: any) {
    return await redisCache.getCachedApiResponse('products', filters);
  },
  
  async setProducts(filters: any, products: any[]) {
    await redisCache.cacheApiResponse('products', filters, products, 300); // 5 minutes
  },
  
  async invalidateProducts() {
    await redisCache.invalidateApiCache('products');
  },

  // User data cache
  async getUserData(userId: string) {
    return await redisCache.get(`user:${userId}`);
  },
  
  async setUserData(userId: string, userData: any) {
    await redisCache.set(`user:${userId}`, userData, 600); // 10 minutes
  },
  
  async invalidateUserData(userId: string) {
    await redisCache.del(`user:${userId}`);
  },

  // Wallet cache
  async getWalletData(userId: string) {
    return await redisCache.get(`wallet:${userId}`);
  },
  
  async setWalletData(userId: string, walletData: any) {
    await redisCache.set(`wallet:${userId}`, walletData, 120); // 2 minutes for financial data
  },
  
  async invalidateWalletData(userId: string) {
    await redisCache.del(`wallet:${userId}`);
  },

  // Orders cache
  async getOrdersData(userId: string, filters: any = {}) {
    const key = `orders:${userId}:${JSON.stringify(filters)}`;
    return await redisCache.get(key);
  },
  
  async setOrdersData(userId: string, filters: any, ordersData: any) {
    const key = `orders:${userId}:${JSON.stringify(filters)}`;
    await redisCache.set(key, ordersData, 300); // 5 minutes
  },
  
  async invalidateOrdersData(userId?: string) {
    if (userId) {
      await redisCache.invalidatePattern(`orders:${userId}:*`);
    } else {
      await redisCache.invalidatePattern(`orders:*`);
    }
  },

  // Categories cache
  async getCategoriesData() {
    return await redisCache.get('categories:all');
  },
  
  async setCategoriesData(categoriesData: any) {
    await redisCache.set('categories:all', categoriesData, 900); // 15 minutes
  },
  
  async invalidateCategoriesData() {
    await redisCache.invalidatePattern('categories:*');
  }
};