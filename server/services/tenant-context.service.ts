import { db } from '../db';
import { sql } from 'drizzle-orm';

/**
 * Enterprise Tenant Context Service
 * Manages RLS context for bulletproof tenant isolation
 */
export class TenantContextService {
  private static contextCache = new Map<string, { setAt: number }>();
  private static CACHE_TTL = 30000; // 30 seconds

  /**
   * Set complete tenant context for RLS policies
   */
  static async setContext(userId: string, tenantId: string, userRole: string = 'b2b_user'): Promise<void> {
    const cacheKey = `${userId}:${tenantId}:${userRole}`;
    const cached = this.contextCache.get(cacheKey);
    
    // Skip if context was recently set (performance optimization)
    if (cached && (Date.now() - cached.setAt) < this.CACHE_TTL) {
      return;
    }

    try {
      await db.execute(sql`SELECT set_user_tenant_context(${userId}, ${tenantId}, ${userRole})`);
      
      this.contextCache.set(cacheKey, { setAt: Date.now() });
    } catch (error) {
      console.error('Failed to set tenant context:', error);
      throw new Error('Tenant context setup failed');
    }
  }

  /**
   * Set admin context for cross-tenant operations
   */
  static async setAdminContext(userId: string, userRole: string = 'admin'): Promise<void> {
    const cacheKey = `admin:${userId}:${userRole}`;
    const cached = this.contextCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.setAt) < this.CACHE_TTL) {
      return;
    }

    try {
      await db.execute(sql`SELECT set_user_tenant_context(${userId}, 'admin', ${userRole})`);
      
      this.contextCache.set(cacheKey, { setAt: Date.now() });
    } catch (error) {
      console.error('Failed to set admin context:', error);
      throw new Error('Admin context setup failed');
    }
  }

  /**
   * Clear context cache (useful for testing)
   */
  static clearCache(): void {
    this.contextCache.clear();
  }
}