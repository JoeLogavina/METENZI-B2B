// Monitoring Middleware for Enhanced Tracking
import { Request, Response, NextFunction } from 'express';
import { trackApiError, trackAuthenticationAttempt } from '../monitoring/prometheus';
import { logAuthenticationEvent, logSecurityEvent, AuditEventSeverity } from '../monitoring/audit';
import { captureB2BError } from '../monitoring/sentry';

// Enhanced error tracking middleware
export function errorTrackingMiddleware(err: any, req: Request, res: Response, next: NextFunction) {
  const tenant = req.path.includes('/eur') ? 'EUR' : req.path.includes('/km') ? 'KM' : 'unknown';
  const endpoint = req.route?.path || req.path;
  const statusCode = err.status || err.statusCode || 500;
  
  // Track in Prometheus
  trackApiError(endpoint, err.name || 'UnknownError', statusCode, tenant);
  
  // Log security events for authentication errors
  if (statusCode === 401 || statusCode === 403) {
    logSecurityEvent(
      'authentication_failure',
      AuditEventSeverity.MEDIUM,
      req.user?.id,
      {
        endpoint: endpoint,
        method: req.method,
        error: err.message,
        statusCode: statusCode
      },
      'failure',
      req.ip,
      req.get('User-Agent')
    );
  }
  
  // Capture in Sentry for critical errors
  if (statusCode >= 500) {
    captureB2BError(err, {
      userId: req.user?.id,
      action: `${req.method} ${endpoint}`,
      tenantId: tenant,
    });
  }
  
  next(err);
}

// Authentication tracking middleware
export function authenticationTrackingMiddleware(req: Request, res: Response, next: NextFunction) {
  const originalJson = res.json;
  
  res.json = function(body) {
    // Track authentication attempts
    if (req.path.includes('/auth') || req.path.includes('/login')) {
      const tenant = req.path.includes('/eur') ? 'EUR' : req.path.includes('/km') ? 'KM' : 'unknown';
      const success = res.statusCode < 400;
      const userRole = body?.user?.role || 'unknown';
      
      trackAuthenticationAttempt(success ? 'success' : 'failure', tenant, userRole);
      
      logAuthenticationEvent(
        req.method === 'POST' ? 'login_attempt' : 'auth_check',
        body?.user?.id,
        body?.user?.username,
        success ? 'success' : 'failure',
        {
          method: req.method,
          endpoint: req.path,
          statusCode: res.statusCode
        },
        req.ip,
        req.get('User-Agent'),
        tenant
      );
    }
    
    return originalJson.call(this, body);
  };
  
  next();
}

// B2B specific tracking middleware
export function b2bTrackingMiddleware(req: Request, res: Response, next: NextFunction) {
  // Track B2B specific operations
  if (req.user?.role === 'b2b_user') {
    res.on('finish', () => {
      const isB2BOperation = 
        req.path.includes('/branches') ||
        req.path.includes('/wallet') ||
        req.path.includes('/license');
        
      if (isB2BOperation && res.statusCode < 400) {
        const tenant = req.user.tenantId || 'unknown';
        
        // Log B2B operations for audit
        if (req.method === 'POST' && req.path.includes('/branches')) {
          // This will be tracked in the specific route handler
        }
      }
    });
  }
  
  next();
}