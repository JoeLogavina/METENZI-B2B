import { performance } from 'perf_hooks';

interface PerformanceMetric {
  operation: string;
  duration: number;
  timestamp: number;
  userId?: string;
  metadata?: any;
}

class PerformanceService {
  private metrics: PerformanceMetric[] = [];
  private readonly MAX_METRICS = 1000; // Keep last 1000 metrics in memory
  private readonly SLOW_QUERY_THRESHOLD = 100; // 100ms threshold for slow operations

  // Start timing an operation
  startTiming(operation: string): string {
    const timingId = `${operation}-${Date.now()}-${Math.random()}`;
    performance.mark(`start-${timingId}`);
    return timingId;
  }

  // End timing and record metric
  endTiming(timingId: string, userId?: string, metadata?: any): number {
    const operation = timingId.split('-')[0];
    performance.mark(`end-${timingId}`);
    performance.measure(timingId, `start-${timingId}`, `end-${timingId}`);
    
    const measure = performance.getEntriesByName(timingId)[0];
    const duration = measure.duration;
    
    // Record metric
    this.recordMetric({
      operation,
      duration,
      timestamp: Date.now(),
      userId,
      metadata
    });

    // Performance monitoring disabled for production

    // Clean up performance entries
    performance.clearMarks(`start-${timingId}`);
    performance.clearMarks(`end-${timingId}`);
    performance.clearMeasures(timingId);

    return duration;
  }

  // Record a metric directly
  recordMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);
    
    // Keep only recent metrics
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS);
    }
  }

  // Get performance statistics
  getStats(operation?: string, timeWindowMinutes: number = 30): {
    count: number;
    averageDuration: number;
    minDuration: number;
    maxDuration: number;
    slowOperations: number;
    recentMetrics: PerformanceMetric[];
  } {
    const cutoffTime = Date.now() - (timeWindowMinutes * 60 * 1000);
    
    let filteredMetrics = this.metrics.filter(m => m.timestamp > cutoffTime);
    
    if (operation) {
      filteredMetrics = filteredMetrics.filter(m => m.operation === operation);
    }

    if (filteredMetrics.length === 0) {
      return {
        count: 0,
        averageDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        slowOperations: 0,
        recentMetrics: []
      };
    }

    const durations = filteredMetrics.map(m => m.duration);
    const slowOperationsCount = filteredMetrics.filter(m => m.duration > this.SLOW_QUERY_THRESHOLD).length;

    return {
      count: filteredMetrics.length,
      averageDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      slowOperations: slowOperationsCount,
      recentMetrics: filteredMetrics.slice(-10) // Last 10 operations
    };
  }

  // Get operations by type
  getOperationTypes(): string[] {
    const operations = new Set(this.metrics.map(m => m.operation));
    return Array.from(operations);
  }

  // Clear old metrics
  clearOldMetrics(olderThanMinutes: number = 60): void {
    const cutoffTime = Date.now() - (olderThanMinutes * 60 * 1000);
    this.metrics = this.metrics.filter(m => m.timestamp > cutoffTime);
  }
}

// Singleton instance
export const performanceService = new PerformanceService();

// Express middleware for automatic performance tracking
export function performanceMiddleware(operationName?: string) {
  return (req: any, res: any, next: any) => {
    const operation = operationName || `${req.method} ${req.route?.path || req.path}`;
    const timingId = performanceService.startTiming(operation);
    
    // Store timing ID in request for manual ending if needed
    req.performanceTimingId = timingId;
    
    // Override res.end to capture timing
    const originalEnd = res.end.bind(res);
    res.end = function(...args: any[]) {
      performanceService.endTiming(timingId, req.user?.id, {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        query: req.query
      });
      
      return originalEnd(...args);
    };
    
    next();
  };
}

// Utility function for manual timing in services
export async function timeOperation<T>(
  operation: string, 
  fn: () => Promise<T>, 
  userId?: string, 
  metadata?: any
): Promise<T> {
  const timingId = performanceService.startTiming(operation);
  
  try {
    const result = await fn();
    performanceService.endTiming(timingId, userId, metadata);
    return result;
  } catch (error) {
    performanceService.endTiming(timingId, userId, { ...metadata, error: error.message });
    throw error;
  }
}

// Database query timing helper
export async function timeQuery<T>(
  queryName: string,
  queryFn: () => Promise<T>,
  userId?: string
): Promise<T> {
  return timeOperation(`db:${queryName}`, queryFn, userId);
}