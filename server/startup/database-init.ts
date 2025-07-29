import { dbOptimizationService } from '../services/database-optimization.service';
import { performanceService } from '../services/performance.service';

export async function initializeDatabase(): Promise<void> {
  const initTimingId = performanceService.startTiming('db-initialization');
  
  try {

    
    // Check if performance indexes exist
    const indexes = await dbOptimizationService.checkIndexes();
    const missingIndexes = indexes.filter(idx => !idx.exists);
    
    if (missingIndexes.length > 0) {
      console.log(`⚠️ Missing ${missingIndexes.length} performance indexes`);
      console.log('Missing indexes:', missingIndexes.map(idx => idx.name));
      
      // Create missing indexes
      await dbOptimizationService.createPerformanceIndexes();
    } else {
    }
    
    // Update table statistics for better query planning
    await dbOptimizationService.updateTableStatistics();
    
    // Clean up old data
    await dbOptimizationService.cleanupOldData();
    

    
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    // Don't throw error - app should still start even if optimization fails
  } finally {
    performanceService.endTiming(initTimingId);
  }
}

// Helper function to check database health
export async function checkDatabaseHealth(): Promise<{
  healthy: boolean;
  indexes: { name: string; exists: boolean }[];
  connectionStats: any;
}> {
  try {
    const indexes = await dbOptimizationService.checkIndexes();
    const connectionStats = await dbOptimizationService.getConnectionStats();
    
    const allIndexesExist = indexes.every(idx => idx.exists);
    const connectionCount = connectionStats.total;
    
    return {
      healthy: allIndexesExist && connectionCount < 50, // Assume healthy if < 50 connections
      indexes,
      connectionStats
    };
  } catch (error) {
    console.error('Health check failed:', error);
    return {
      healthy: false,
      indexes: [],
      connectionStats: { byState: [], total: 0 }
    };
  }
}