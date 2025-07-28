/**
 * Session Cache Middleware - Enterprise Performance Optimization
 * Caches deserialized user objects to reduce database calls
 */

interface CachedUser {
  id: string;
  username: string;
  email: string;
  role: string;
  tenantId: string;
  cachedAt: number;
}

class SessionCache {
  private cache = new Map<string, CachedUser>();
  private readonly CACHE_TTL = 300000; // 5 minutes
  private readonly MAX_CACHE_SIZE = 1000;

  set(userId: string, user: any): void {
    // Prevent cache from growing too large
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(userId, {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      cachedAt: Date.now()
    });
  }

  get(userId: string): CachedUser | null {
    const cached = this.cache.get(userId);
    if (!cached) return null;

    // Check if cache entry is expired
    if (Date.now() - cached.cachedAt > this.CACHE_TTL) {
      this.cache.delete(userId);
      return null;
    }

    return cached;
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  // Clean expired entries periodically
  cleanup(): void {
    const now = Date.now();
    for (const [userId, user] of this.cache.entries()) {
      if (now - user.cachedAt > this.CACHE_TTL) {
        this.cache.delete(userId);
      }
    }
  }
}

// Global session cache instance
export const sessionCache = new SessionCache();

// Cleanup expired entries every 5 minutes
setInterval(() => {
  sessionCache.cleanup();
}, 300000);

export default sessionCache;