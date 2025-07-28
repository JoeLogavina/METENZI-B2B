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
   * CRITICAL: Must be called for EVERY request due to Neon connection pooling
   */
  static async setContext(userId: string, tenantId: string, userRole: string = 'b2b_user'): Promise<void> {
    try {
      // Use session-level settings (not transaction-level) for Neon compatibility
      await db.execute(sql`SELECT set_user_tenant_context_session(${userId}, ${tenantId}, ${userRole})`);
    } catch (error) {
      console.error('Failed to set tenant context:', error);
      throw new Error('Tenant context setup failed');
    }
  }

  /**
   * Set admin context for cross-tenant operations
   */
  static async setAdminContext(userId: string, userRole: string = 'admin'): Promise<void> {
    try {
      // Admin context allows cross-tenant access
      await db.execute(sql`SELECT set_user_tenant_context_session(${userId}, 'admin', ${userRole})`);
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