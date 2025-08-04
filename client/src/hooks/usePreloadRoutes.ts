// TIER 2 ENTERPRISE OPTIMIZATION: Route Preloading Hook
// Intelligently preload routes based on user behavior

import { useEffect } from "react";
import { preloadRoute } from "@/lib/bundle-analyzer";

// TIER 2 OPTIMIZATION: Enhanced preloading strategies
const PRELOAD_STRATEGIES = {
  // Immediate preload on app start (critical routes) - ORDERS MOVED HERE
  immediate: ['eur-shop', 'cart', 'orders'],
  
  // Preload after initial render (secondary routes)
  delayed: ['wallet'],
  
  // Preload on hover/interaction (admin routes)
  interactive: ['admin-panel']
};

export function usePreloadRoutes() {
  useEffect(() => {
    // Preload critical routes immediately
    PRELOAD_STRATEGIES.immediate.forEach(route => {
      preloadRoute(route);
    });

    // Preload likely routes after a delay
    const delayedPreload = setTimeout(() => {
      PRELOAD_STRATEGIES.delayed.forEach(route => {
        preloadRoute(route);
      });
    }, 2000);

    return () => clearTimeout(delayedPreload);
  }, []);

  // Return preload function for interactive elements
  return {
    preloadOnHover: (routeName: string) => {
      return {
        onMouseEnter: () => preloadRoute(routeName),
        onFocus: () => preloadRoute(routeName)
      };
    }
  };
}

// Custom hook for route-specific preloading
export function useRoutePreload(routes: string[], delay = 1000) {
  useEffect(() => {
    const timer = setTimeout(() => {
      routes.forEach(route => preloadRoute(route));
    }, delay);

    return () => clearTimeout(timer);
  }, [routes, delay]);
}