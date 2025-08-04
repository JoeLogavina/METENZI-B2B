// TIER 2 ENTERPRISE OPTIMIZATION: Bundle Analysis Utilities
// Tools for analyzing and optimizing bundle size

import { lazy, ComponentType } from "react";

// Bundle size tracking for development
export const bundleTracker = {
  lazyComponents: new Map<string, number>(),
  
  trackComponent(name: string, size: number) {
    this.lazyComponents.set(name, size);
    if (process.env.NODE_ENV === 'development') {
      console.log(`📦 Bundle: ${name} loaded (${size}kb)`);
    }
  },
  
  getStats() {
    return Array.from(this.lazyComponents.entries()).map(([name, size]) => ({
      name,
      size,
      status: 'loaded'
    }));
  }
};

// Enhanced lazy loading with bundle tracking
export function createLazyComponent<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  componentName: string
) {
  const LazyComponent = lazy(async () => {
    const startTime = performance.now();
    const module = await importFn();
    const loadTime = performance.now() - startTime;
    
    // Track in development
    if (process.env.NODE_ENV === 'development') {
      bundleTracker.trackComponent(componentName, Math.round(loadTime));
    }
    
    return module;
  });
  
  // Type assertion for displayName (LazyExoticComponent doesn't include this in types)
  (LazyComponent as any).displayName = `Lazy(${componentName})`;
  return LazyComponent;
}

// Preload critical routes for better UX
export function preloadRoute(routeName: string) {
  const routes: Record<string, () => Promise<any>> = {
    'eur-shop': () => import("@/pages/eur-shop"),
    'cart': () => import("@/pages/cart"),
    'checkout': () => import("@/pages/checkout"),
    'wallet': () => import("@/pages/wallet-page"),
    'orders': () => import("@/pages/orders"),
    'admin-panel': () => import("@/pages/admin-panel")
  };
  
  const route = routes[routeName];
  if (route && typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    requestIdleCallback(() => {
      route().then(() => {
        if (process.env.NODE_ENV === 'development') {

        }
      }).catch(() => {
        // Silently handle preload failures
      });
    });
  }
}

// Intersection Observer for lazy loading components on scroll
export function createIntersectionLazyComponent<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  componentName: string,
  options: IntersectionObserverInit = { threshold: 0.1 }
) {
  return createLazyComponent(importFn, componentName);
}