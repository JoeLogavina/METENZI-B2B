import { db } from '../db';
import { sql } from 'drizzle-orm';
import { performanceService } from './performance.service';

export class DatabaseOptimizationService {
  private static instance: DatabaseOptimizationService;
  
  static getInstance(): DatabaseOptimizationService {
    if (!DatabaseOptimizationService.instance) {
      DatabaseOptimizationService.instance = new DatabaseOptimizationService();
    }
    return DatabaseOptimizationService.instance;
  }

  // Check if indexes exist
  async checkIndexes(): Promise<{ name: string; exists: boolean }[]> {
    const timingId = performanceService.startTiming('check-indexes');
    
    try {
      const expectedIndexes = [
        'idx_products_region_active',
        'idx_products_platform_category',
        'idx_products_search',
        'idx_products_price',
        'idx_orders_user_date',
        'idx_orders_status_date',
        'idx_wallet_transactions_user_date',
        'idx_cart_items_user',
        'idx_license_keys_product_available'
      ];

      const results = [];
      for (const indexName of expectedIndexes) {
        const result = await db.execute(sql`
          SELECT EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE indexname = ${indexName}
          );
        `);
        
        results.push({
          name: indexName,
          exists: (result.rows[0] as any).exists
        });
      }

      return results;
    } finally {
      performanceService.endTiming(timingId);
    }
  }

  // Create performance indexes programmatically
  async createPerformanceIndexes(): Promise<void> {
    const timingId = performanceService.startTiming('create-indexes');
    
    try {
      console.log('🚀 Creating performance indexes...');

      // Products indexes
      await this.createIndexSafely(
        'idx_products_region_active',
        sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_region_active 
            ON products (region, is_active) WHERE is_active = true`
      );

      await this.createIndexSafely(
        'idx_products_search',
        sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_search 
            ON products USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')))`
      );

      // Orders indexes (critical for performance)
      await this.createIndexSafely(
        'idx_orders_user_date',
        sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_user_date 
            ON orders (user_id, created_at DESC)`
      );

      await this.createIndexSafely(
        'idx_orders_status_date',
        sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_status_date 
            ON orders (status, created_at DESC)`
      );

      // Wallet transactions indexes
      await this.createIndexSafely(
        'idx_wallet_transactions_user_date',
        sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wallet_transactions_user_date 
            ON wallet_transactions (user_id, created_at DESC)`
      );

      // Cart indexes
      await this.createIndexSafely(
        'idx_cart_items_user',
        sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cart_items_user 
            ON cart_items (user_id, created_at DESC)`
      );

      // License keys indexes
      await this.createIndexSafely(
        'idx_license_keys_product_available',
        sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_license_keys_product_available 
            ON license_keys (product_id, is_used) WHERE is_used = false`
      );

      
      // Update table statistics
      await this.updateTableStatistics();
      
    } finally {
      performanceService.endTiming(timingId);
    }
  }

  private async createIndexSafely(indexName: string, indexSql: any): Promise<void> {
    try {
      console.log(`Creating index: ${indexName}`);
      await db.execute(indexSql);
    } catch (error) {
      if (error.message?.includes('already exists')) {
        console.log(`⚠️ Index already exists: ${indexName}`);
      } else {
        console.error(`❌ Failed to create index ${indexName}:`, error);
        throw error;
      }
    }
  }

  // Update table statistics for better query planning
  async updateTableStatistics(): Promise<void> {
    const timingId = performanceService.startTiming('update-statistics');
    
    try {
      console.log('📊 Updating table statistics...');
      
      const tables = [
        'products', 'orders', 'order_items', 'wallet_transactions', 
        'cart_items', 'license_keys', 'users', 'categories', 'wallets'
      ];

      for (const table of tables) {
        try {
          await db.execute(sql.raw(`ANALYZE ${table}`));
        } catch (error) {
          console.warn(`⚠️ Failed to update statistics for ${table}:`, error);
        }
      }
      
    } finally {
      performanceService.endTiming(timingId);
    }
  }

  // Get query performance insights
  async getSlowQueries(limit: number = 10): Promise<any[]> {
    try {
      // Get slow queries from pg_stat_statements if available
      const result = await db.execute(sql`
        SELECT 
          query,
          calls,
          total_time,
          mean_time,
          rows
        FROM pg_stat_statements 
        ORDER BY mean_time DESC 
        LIMIT ${limit}
      `);
      
      return result.rows as any[];
    } catch (error) {
      // pg_stat_statements might not be available
      console.warn('pg_stat_statements not available:', error);
      return [];
    }
  }

  // Get table sizes and bloat information
  async getTableSizes(): Promise<any[]> {
    try {
      const result = await db.execute(sql`
        SELECT 
          schemaname,
          tablename,
          attname,
          n_distinct,
          correlation,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
        FROM pg_stats 
        WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
      `);
      
      return result.rows as any[];
    } catch (error) {
      console.warn('Failed to get table sizes:', error);
      return [];
    }
  }

  // Get database connection statistics
  async getConnectionStats(): Promise<any> {
    try {
      const result = await db.execute(sql`
        SELECT 
          state,
          count(*) as count
        FROM pg_stat_activity 
        WHERE pid <> pg_backend_pid()
        GROUP BY state
      `);
      
      const totalConnections = await db.execute(sql`
        SELECT count(*) as total FROM pg_stat_activity WHERE pid <> pg_backend_pid()
      `);
      
      return {
        byState: result.rows,
        total: (totalConnections.rows[0] as any).total
      };
    } catch (error) {
      console.warn('Failed to get connection stats:', error);
      return { byState: [], total: 0 };
    }
  }

  // Clean up old performance data
  async cleanupOldData(): Promise<void> {
    const timingId = performanceService.startTiming('cleanup-old-data');
    
    try {
      console.log('🧹 Cleaning up old data...');
      
      // Clean up old cart items (older than 30 days)
      await db.execute(sql`
        DELETE FROM cart_items 
        WHERE created_at < NOW() - INTERVAL '30 days'
      `);
      
      // Clean up old session data (if sessions table exists)
      try {
        await db.execute(sql`
          DELETE FROM sessions 
          WHERE expire < NOW()
        `);
      } catch (error) {
        // Sessions table might not exist
        console.log('Sessions table cleanup skipped');
      }
      
      
    } finally {
      performanceService.endTiming(timingId);
    }
  }
}

// Export singleton instance
export const dbOptimizationService = DatabaseOptimizationService.getInstance();