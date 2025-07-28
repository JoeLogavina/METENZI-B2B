// TIER 2 ENTERPRISE OPTIMIZATION: API Data Preloading
// Preload critical API data before routes are accessed

import { useEffect } from "react";
import { queryClient } from "@/lib/queryClient";

// Data preloading strategies
const DATA_PRELOAD_STRATEGIES = {
  // Immediate data preload (0ms delay)
  immediate: [
    '/api/products',
    '/api/cart'
  ],
  
  // Delayed data preload (1s delay for faster orders) - ORDERS API OPTIMIZED
  delayed: [
    '/api/orders',
    '/api/wallet/transactions'
  ],
  
  // Secondary delayed (2s delay)
  secondary: [
    '/api/wallet'
  ],
  
  // Interactive data preload (on user action)
  interactive: [
    '/api/admin/users',
    '/api/admin/products'
  ]
};

export function useDataPreload() {
  useEffect(() => {
    // Preload immediate data
    DATA_PRELOAD_STRATEGIES.immediate.forEach(endpoint => {
      preloadData(endpoint);
    });

    // Preload delayed data (priority - orders)
    const delayedTimer = setTimeout(() => {
      DATA_PRELOAD_STRATEGIES.delayed.forEach(endpoint => {
        preloadData(endpoint);
      });
    }, 1000); // Faster delay for orders

    // Preload secondary data
    const secondaryTimer = setTimeout(() => {
      DATA_PRELOAD_STRATEGIES.secondary.forEach(endpoint => {
        preloadData(endpoint);
      });
    }, 2500);

    return () => {
      clearTimeout(delayedTimer);
      clearTimeout(secondaryTimer);
    };
  }, []);

  return {
    preloadDataOnHover: (endpoint: string) => {
      return {
        onMouseEnter: () => preloadData(endpoint),
        onFocus: () => preloadData(endpoint)
      };
    }
  };
}

// Preload data using React Query prefetching
function preloadData(endpoint: string) {
  if (typeof window === 'undefined') return;
  
  // Only preload if not already cached
  const cached = queryClient.getQueryData([endpoint]);
  if (cached) return;

  // Use requestIdleCallback for non-blocking preload
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      queryClient.prefetchQuery({
        queryKey: [endpoint],
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 30 * 60 * 1000, // 30 minutes
      }).then(() => {
        if (process.env.NODE_ENV === 'development') {

        }
      }).catch(() => {
        // Silently handle preload failures
      });
    });
  }
}

// Enhanced hook for critical routes with data preloading  
export function useOrdersPreload() {
  useEffect(() => {
    // TIER 2: Ultra-aggressive preload for orders page performance
    const timer = setTimeout(() => {
      // Preload orders data with high priority caching
      queryClient.prefetchQuery({
        queryKey: ['/api/orders'],
        staleTime: 2 * 60 * 1000, // 2 minutes stale time
        gcTime: 15 * 60 * 1000, // 15 minutes cache retention
      }).then(() => {
        if (process.env.NODE_ENV === 'development') {
          console.log('🗄️ Orders data preloaded aggressively');
        }
      }).catch(() => {
        // Silent failure
      });
    }, 200); // Ultra-fast preload

    return () => clearTimeout(timer);
  }, []);
}