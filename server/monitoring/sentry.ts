// Enterprise Error Tracking - Sentry Integration
import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

// Type safe handlers
export const Handlers = {
  requestHandler: Sentry.Handlers?.requestHandler || ((req: any, res: any, next: any) => next()),
  tracingHandler: Sentry.Handlers?.tracingHandler || ((req: any, res: any, next: any) => next()),
  errorHandler: Sentry.Handlers?.errorHandler || ((err: any, req: any, res: any, next: any) => next(err))
};

export function initializeSentry() {
  // Initialize Sentry only if DSN is provided
  const sentryDsn = process.env.SENTRY_DSN;
  
  if (sentryDsn) {
    Sentry.init({
      dsn: sentryDsn,
      environment: process.env.NODE_ENV || 'development',
      
      // Performance monitoring
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      
      // Profiling integration
      integrations: [
        nodeProfilingIntegration(),
      ],
      
      // Profile sample rate
      profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      
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