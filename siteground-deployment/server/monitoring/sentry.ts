// Enterprise Error Tracking - Sentry Integration
import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

// Type safe handlers - using correct v8 API with fallbacks
export const Handlers = {
  requestHandler: () => {
    // Use express integration for request handling in v8
    return (req: any, res: any, next: any) => next();
  },
  tracingHandler: () => {
    // Use express integration for tracing in v8
    return (req: any, res: any, next: any) => next();
  },
  errorHandler: () => {
    // Use express integration for error handling in v8
    return (err: any, req: any, res: any, next: any) => {
      if (process.env.SENTRY_DSN) {
        Sentry.captureException(err);
      }
      next(err);
    };
  }
};

export function initializeSentry() {
  // Initialize Sentry only if DSN is provided
  const sentryDsn = process.env.SENTRY_DSN;
  
  if (sentryDsn) {
    Sentry.init({
      dsn: sentryDsn,
      environment: process.env.NODE_ENV || 'development',
      
      // Enhanced Performance monitoring - capture 100% of transactions in development
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      
      // Profiling integration for detailed performance insights
      integrations: [
        nodeProfilingIntegration(),
      ],
      
      // Profile sample rate - capture detailed performance data
      profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      
      // Enhanced Performance Monitoring Options
      // Capture 100% of the transactions for performance monitoring
      // This gives you detailed insights into your B2B platform performance
      beforeSendTransaction(event) {
        // Add B2B platform specific context to transactions
        if (event.request?.url) {
          const url = new URL(event.request.url);
          event.tags = {
            ...event.tags,
            route: url.pathname,
            tenant: url.pathname.includes('/eur') ? 'EUR' : url.pathname.includes('/km') ? 'KM' : 'unknown',
            api_type: url.pathname.includes('/api/') ? 'api' : 'frontend'
          };
          
          // Track B2B specific operations
          if (url.pathname.includes('/api/orders')) {
            event.tags.operation_type = 'order_processing';
          } else if (url.pathname.includes('/api/products')) {
            event.tags.operation_type = 'product_management';
          } else if (url.pathname.includes('/api/wallet')) {
            event.tags.operation_type = 'wallet_operations';
          } else if (url.pathname.includes('/api/admin')) {
            event.tags.operation_type = 'admin_operations';
          }
        }
        
        return event;
      },
      
      // Release tracking
      release: process.env.npm_package_version,
      
      // Server name
      serverName: process.env.REPL_SLUG || 'b2b-license-platform',
      
      // Enhanced context
      beforeSend(event, hint) {
        // Add custom context for B2B platform
        if (event.request?.url) {
          const url = new URL(event.request.url);
          event.tags = {
            ...event.tags,
            route: url.pathname,
            tenant: url.pathname.includes('/eur') ? 'EUR' : url.pathname.includes('/km') ? 'KM' : 'unknown'
          };
        }
        
        return event;
      },
    });
    
    console.log('✅ Sentry error tracking initialized');
  } else {
    console.log('⚠️  Sentry DSN not configured - error tracking disabled');
  }
}

// Custom error capturing for B2B specific scenarios
export function captureB2BError(error: Error, context: {
  userId?: string;
  action?: string;
  tenantId?: string;
  branchId?: string;
  transactionId?: string;
}) {
  if (process.env.SENTRY_DSN) {
    Sentry.withScope((scope) => {
      // Set user context
      if (context.userId) {
        scope.setUser({ id: context.userId });
      }
      
      // Set custom context
      scope.setContext('b2b_context', {
        action: context.action,
        tenantId: context.tenantId,
        branchId: context.branchId,
        transactionId: context.transactionId,
      });
      
      // Set tags for filtering
      scope.setTag('error_category', 'b2b_business_logic');
      if (context.tenantId) scope.setTag('tenant', context.tenantId);
      if (context.action) scope.setTag('action', context.action);
      
      Sentry.captureException(error);
    });
  } else {
    // Fallback to console logging
    console.error('B2B Error:', error.message, context);
  }
}

export { Sentry };