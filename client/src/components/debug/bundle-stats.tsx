// TIER 2 ENTERPRISE OPTIMIZATION: Bundle Statistics Component
// Development-only component to monitor code splitting performance

import { useState, useEffect } from "react";
import { performanceMonitor } from "@/lib/performance-monitor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function BundleStats() {
  const [metrics, setMetrics] = useState(() => performanceMonitor.getMetrics());
  const [insights, setInsights] = useState(() => performanceMonitor.getInsights());

  useEffect(() => {
    // Only update occasionally to prevent recursion
    const interval = setInterval(() => {
      try {
        const newMetrics = performanceMonitor.getMetrics();
        const newInsights = performanceMonitor.getInsights();
        
        // Only update if actually changed to prevent infinite loops
        setMetrics(prev => 
          JSON.stringify(prev) !== JSON.stringify(newMetrics) ? newMetrics : prev
        );
        setInsights(prev => 
          JSON.stringify(prev) !== JSON.stringify(newInsights) ? newInsights : prev
        );
      } catch (error) {
        console.warn('Bundle stats update error:', error);
      }
    }, 5000); // Longer interval to prevent issues

    return () => clearInterval(interval);
  }, []);

  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 max-w-sm z-50">
      <Card className="bg-white/95 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            📊 Bundle Performance
            <Badge variant="outline" className="text-xs">
              TIER 2
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          <div className="text-xs space-y-1">
            <div className="flex justify-between">
              <span>Cache Hit Rate:</span>
              <span className="font-mono">{insights.cacheHitRate}%</span>
            </div>
            <div className="flex justify-between">
              <span>Avg Load Time:</span>
              <span className="font-mono">{insights.averageLoadTime}ms</span>
            </div>
            <div className="flex justify-between">
              <span>Bundles Loaded:</span>
              <span className="font-mono">{metrics.bundleLoads.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Route Transitions:</span>
              <span className="font-mono">{metrics.routeTransitions.length}</span>
            </div>
          </div>

          {metrics.bundleLoads.length > 0 && (
            <div className="border-t pt-2">
              <div className="text-xs font-medium mb-1">Recent Loads:</div>
              <div className="space-y-1">
                {metrics.bundleLoads.slice(-3).map((bundle, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="truncate">{bundle.name}</span>
                    <div className="flex items-center gap-1">
                      <span className="font-mono">{bundle.loadTime}ms</span>
                      {bundle.cached && (
                        <Badge variant="secondary" className="text-xs px-1 py-0">
                          cached
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {insights.recommendations.length > 0 && (
            <div className="border-t pt-2">
              <div className="text-xs font-medium mb-1">Recommendations:</div>
              <div className="text-xs text-muted-foreground">
                {insights.recommendations[0]}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}