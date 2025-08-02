// Redis extensions for audit system compatibility

import { redisCache } from './redis';

// Extend Redis cache with additional methods needed for audit system
export const extendedRedisCache = {
  ...redisCache,
  
  // Get all keys matching a pattern
  async keys(pattern: string): Promise<string[]> {
    // Simple implementation - in production would use Redis KEYS command
    const all = await this.getAll() || {};
    return Object.keys(all).filter(key => {
      if (pattern.endsWith('*')) {
        return key.startsWith(pattern.slice(0, -1));
      }
      return key === pattern;
    });
  },

  // Get all key-value pairs
  async getAll(): Promise<Record<string, any>> {
    // This is a simplified implementation
    // In production, this would use Redis SCAN or similar
    return {};
  },

  // Delete key (alias for del)
  async delete(key: string): Promise<void> {
    await this.del(key);
  }
};