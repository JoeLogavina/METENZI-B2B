import { Request, Response, NextFunction } from 'express';
import { TenantContextService } from '../services/tenant-context.service';

/**
 * RLS Context Middleware
 * Sets database session variables for Row-Level Security policies
 * CRITICAL: Must run on every authenticated request due to Neon connection pooling
 */
export async function rlsContextMiddleware(req: Request, res: Response, next: NextFunction) {
  const user = req.user as any;
  
  // Skip for unauthenticated requests
  if (!user) {
    return next();
  }

  try {
    const userId = user.id;
    const userRole = user.role || 'b2b_user';
    const tenantId = user.tenantId || 'eur';

    console.log(`🔐 RLS Context Setting: ${req.method} ${req.path} - User: ${user.username} (${userRole}) - Tenant: ${tenantId}`);

    // Set RLS context for every request
    if (userRole === 'admin' || userRole === 'super_admin') {
      await TenantContextService.setAdminContext(userId, userRole);
    } else {
      await TenantContextService.setContext(userId, tenantId, userRole);
    }

    console.log(`✅ RLS Context Set Successfully: ${userId.substring(0,8)}...`);
    next();
  } catch (error) {
    console.error('RLS context middleware failed:', error);
    // Continue anyway - don't break the request
    next();
  }
}