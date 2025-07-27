// TIER 2 ENTERPRISE OPTIMIZATION: Performance Monitoring for Code Splitting
// Monitor bundle loading performance and user experience

interface BundleMetrics {
  name: string;
  loadTime: number;
  size?: number;
  cached: boolean;
  timestamp: number;
}

interface PerformanceData {
  bundleLoads: BundleMetrics[];
  routeTransitions: Array<{
    from: string;
    to: string;
    duration: number;
    timestamp: number;
  }>;
  totalBundleSize: number;
  cacheHitRate: number;
}

class PerformanceMonitor {
  private metrics: PerformanceData = {
    bundleLoads: [],
    routeTransitions: [],
    totalBundleSize: 0,
    cacheHitRate: 0
  };

  // Track lazy component loading
  trackBundleLoad(name: string, loadTime: number, size?: number) {
    const cached = loadTime < 50; // Assume cached if very fast
    
    this.metrics.bundleLoads.push({
      name,
      loadTime,
      size,
      cached,
      timestamp: Date.now()
    });

    // Update cache hit rate
    const totalLoads = this.metrics.bundleLoads.length;
    const cachedLoads = this.metrics.bundleLoads.filter(m => m.cached).length;
    this.metrics.cacheHitRate = (cachedLoads / totalLoads) * 100;

    if (process.env.NODE_ENV === 'development') {
      console.log(`📊 Bundle ${name}: ${loadTime}ms ${cached ? '(cached)' : '(network)'}`);
    }
  }

  // Track route transitions
  trackRouteTransition(from: string, to: string, duration: number) {
    this.metrics.routeTransitions.push({
      from,
      to,
      duration,
      timestamp: Date.now()
    });

    if (process.env.NODE_ENV === 'development') {
      console.log(`🔄 Route ${from} → ${to}: ${duration}ms`);
    }
  }

  // Get performance summary
  getMetrics(): PerformanceData {
    return { ...this.metrics };
  }

  // Get performance insights with safety checks
  getInsights() {
    try {
      const avgLoadTime = this.metrics.bundleLoads.length > 0 
        ? this.metrics.bundleLoads.reduce((sum, m) => sum + m.loadTime, 0) / this.metrics.bundleLoads.length
        : 0;
      
      const slowBundles = this.metrics.bundleLoads.filter(m => m.loadTime > 200);
      const fastTransitions = this.metrics.routeTransitions.filter(t => t.duration < 100);
      
      return {
        averageLoadTime: Math.round(avgLoadTime),
        cacheHitRate: Math.round(this.metrics.cacheHitRate),
        slowBundles: slowBundles.length,
        fastTransitions: fastTransitions.length,
        totalRouteTransitions: this.metrics.routeTransitions.length,
        recommendations: []  // Simplified to prevent recursion
      };
    } catch (error) {
      return {
        averageLoadTime: 0,
        cacheHitRate: 0,
        slowBundles: 0,
        fastTransitions: 0,
        totalRouteTransitions: 0,
        recommendations: []
      };
    }
  }

  private generateRecommendations(): string[] {
    const recommendations = [];
    const insights = this.getInsights();

    if (insights.cacheHitRate < 70) {
      recommendations.push("Consider preloading more routes to improve cache hit rate");
    }

    if (insights.slowBundles > 2) {
      recommendations.push("Some bundles are loading slowly - consider code splitting further");
    }

    if (insights.averageLoadTime > 150) {
      recommendations.push("Average load time is high - implement more aggressive caching");
    }

    return recommendations;
  }

  // Reset metrics (useful for testing)
  reset() {
    this.metrics = {
      bundleLoads: [],
      routeTransitions: [],
      totalBundleSize: 0,
      cacheHitRate: 0
    };
  }
}

export const performanceMonitor = new PerformanceMonitor();

// Hook for tracking route performance
export function useRoutePerformance() {
  const trackTransition = (from: string, to: string) => {
    const startTime = performance.now();
    
    return () => {
      const duration = performance.now() - startTime;
      performanceMonitor.trackRouteTransition(from, to, duration);
    };
  };

  return { trackTransition };
}

// Enhanced lazy component creator with performance tracking
import { lazy } from "react";

export function createTrackedLazyComponent<T extends React.ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  componentName: string
) {
  const LazyComponent = lazy(async () => {
    const startTime = performance.now();
    const module = await importFn();
    const loadTime = performance.now() - startTime;
    
    performanceMonitor.trackBundleLoad(componentName, loadTime);
    
    return module;
  });
  
  (LazyComponent as any).displayName = `TrackedLazy(${componentName})`;
  return LazyComponent;
}