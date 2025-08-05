import { Router } from 'express';
import { performanceService } from '../services/performance.service';
import { dbOptimizationService } from '../services/database-optimization.service';
import { redisCache } from '../cache/redis';

const performanceRouter = Router();

// Admin-only middleware
const requireAdmin = (req: any, res: any, next: any) => {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'super_admin')) {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

// Performance metrics endpoint
performanceRouter.get('/metrics', requireAdmin, async (req, res) => {
  try {
    const { operation, timeWindow } = req.query;
    const timeWindowMinutes = timeWindow ? parseInt(timeWindow as string) : 30;
    
    const stats = performanceService.getStats(operation as string, timeWindowMinutes);
    const connectionStats = await dbOptimizationService.getConnectionStats();
    const slowQueries = await dbOptimizationService.getSlowQueries(5);
    
    res.json({
      timestamp: new Date().toISOString(),
      timeWindow: `${timeWindowMinutes} minutes`,
      performance: stats,
      database: {
        connections: connectionStats,
        slowQueries: slowQueries.slice(0, 5) // Top 5 slow queries
      },
      operations: performanceService.getOperationTypes()
    });
  } catch (error) {
    console.error('Error getting performance metrics:', error);
    res.status(500).json({ message: 'Failed to get performance metrics' });
  }
});

// Database optimization endpoints
performanceRouter.get('/database/indexes', requireAdmin, async (req, res) => {
  try {
    const indexes = await dbOptimizationService.checkIndexes();
    res.json({ indexes });
  } catch (error) {
    console.error('Error checking indexes:', error);
    res.status(500).json({ message: 'Failed to check indexes' });
  }
});

performanceRouter.post('/database/optimize', requireAdmin, async (req, res) => {
  try {
    await dbOptimizationService.createPerformanceIndexes();
    res.json({ 
      message: 'Database optimization completed',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error optimizing database:', error);
    res.status(500).json({ message: 'Failed to optimize database' });
  }
});

performanceRouter.get('/database/stats', requireAdmin, async (req, res) => {
  try {
    const tableSizes = await dbOptimizationService.getTableSizes();
    const connectionStats = await dbOptimizationService.getConnectionStats();
    const slowQueries = await dbOptimizationService.getSlowQueries(10);
    
    res.json({
      tableSizes,
      connections: connectionStats,
      slowQueries
    });
  } catch (error) {
    console.error('Error getting database stats:', error);
    res.status(500).json({ message: 'Failed to get database stats' });
  }
});

performanceRouter.post('/database/cleanup', requireAdmin, async (req, res) => {
  try {
    await dbOptimizationService.cleanupOldData();
    res.json({ 
      message: 'Database cleanup completed',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error cleaning up database:', error);
    res.status(500).json({ message: 'Failed to cleanup database' });
  }
});

// Cache management endpoints
performanceRouter.get('/cache/stats', requireAdmin, async (req, res) => {
  try {
    // Try to get Redis info if available
    try {
      const info = await redisCache.get('cache:stats') || { status: 'unknown' };
      res.json({
        redis: {
          connected: true,
          info
        }
      });
    } catch (error) {
      res.json({
        redis: {
          connected: false,
          error: error.message
        }
      });
    }
  } catch (error) {
    console.error('Error getting cache stats:', error);
    res.status(500).json({ message: 'Failed to get cache stats' });
  }
});

performanceRouter.post('/cache/clear', requireAdmin, async (req, res) => {
  try {
    const { pattern } = req.body;
    
    if (pattern) {
      await redisCache.invalidatePattern(pattern);
      res.json({ 
        message: `Cache cleared for pattern: ${pattern}`,
        timestamp: new Date().toISOString()
      });
    } else {
      // Clear all cache
      await redisCache.invalidatePattern('*');
      res.json({ 
        message: 'All cache cleared',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Error clearing cache:', error);
    res.status(500).json({ message: 'Failed to clear cache' });
  }
});

// Performance monitoring endpoint
performanceRouter.get('/monitor', requireAdmin, async (req, res) => {
  try {
    const stats = performanceService.getStats(undefined, 5); // Last 5 minutes
    const recentOperations = stats.recentMetrics;
    
    // Get critical metrics
    const criticalMetrics = {
      averageResponseTime: stats.averageDuration,
      slowOperationsCount: stats.slowOperations,
      totalOperations: stats.count,
      recentOperations: recentOperations.map(op => ({
        operation: op.operation,
        duration: Math.round(op.duration),
        timestamp: new Date(op.timestamp).toISOString()
      }))
    };
    
    res.json({
      status: stats.averageDuration > 500 ? 'warning' : 'healthy',
      metrics: criticalMetrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting monitoring data:', error);
    res.status(500).json({ message: 'Failed to get monitoring data' });
  }
});

export default performanceRouter;