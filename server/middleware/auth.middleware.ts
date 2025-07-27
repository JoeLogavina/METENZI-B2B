import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
        role: 'b2b_user' | 'admin' | 'super_admin';
        email?: string;
      };
    }
  }
}

// Permission definitions
export const Permissions = {
  // Product permissions
  PRODUCT_READ: 'product:read',
  PRODUCT_CREATE: 'product:create',
  PRODUCT_UPDATE: 'product:update',
  PRODUCT_DELETE: 'product:delete',
  
  // User permissions
  USER_READ: 'user:read',
  USER_CREATE: 'user:create', 
  USER_UPDATE: 'user:update',
  USER_DELETE: 'user:delete',
  
  // Order permissions
  ORDER_READ: 'order:read',
  ORDER_CREATE: 'order:create',
  ORDER_UPDATE: 'order:update',
  
  // Report permissions
  REPORT_READ: 'report:read',
  REPORT_EXPORT: 'report:export',
  
  // System permissions
  SYSTEM_ADMIN: 'system:admin',
} as const;

type Permission = typeof Permissions[keyof typeof Permissions];

// Role-based permissions mapping
const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  b2b_user: [
    Permissions.PRODUCT_READ,
    Permissions.ORDER_READ,
    Permissions.ORDER_CREATE,
  ],
  admin: [
    Permissions.PRODUCT_READ,
    Permissions.PRODUCT_CREATE,
    Permissions.PRODUCT_UPDATE,
    Permissions.USER_READ,
    Permissions.ORDER_READ,
    Permissions.ORDER_UPDATE,
    Permissions.REPORT_READ,
  ],
  super_admin: [
    ...Object.values(Permissions),
  ],
};

// Authentication middleware
export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ 
      error: 'UNAUTHORIZED',
      message: 'Authentication required' 
    });
  }
  next();
};

// Authorization middleware factory
export const authorize = (...requiredPermissions: Permission[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'UNAUTHORIZED',
        message: 'Authentication required' 
      });
    }

    const userPermissions = ROLE_PERMISSIONS[req.user.role] || [];
    const hasPermission = requiredPermissions.every(permission => 
      userPermissions.includes(permission)
    );

    if (!hasPermission) {
      return res.status(403).json({ 
        error: 'FORBIDDEN',
        message: 'Insufficient permissions',
        required: requiredPermissions,
        granted: userPermissions
      });
    }

    next();
  };
};

// Role-based middleware (legacy support)
export const requireRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'UNAUTHORIZED',
        message: 'Authentication required' 
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'FORBIDDEN',
        message: 'Insufficient role permissions',
        required: roles,
        current: req.user.role
      });
    }

    next();
  };
};

// Request validation middleware factory
export const validateRequest = (schema: {
  body?: z.ZodSchema;
  query?: z.ZodSchema;
  params?: z.ZodSchema;
}) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (schema.body) {
        req.body = schema.body.parse(req.body);
      }
      if (schema.query) {
        req.query = schema.query.parse(req.query);
      }
      if (schema.params) {
        req.params = schema.params.parse(req.params);
      }
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: error.errors
        });
      }
      next(error);
    }
  };
};

// Rate limiting middleware
export const rateLimit = (
  windowMs: number = 15 * 60 * 1000, // 15 minutes
  maxRequests: number = 100
) => {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    const clientId = req.ip || 'unknown';
    const now = Date.now();
    const windowStart = now - windowMs;

    // Clean old entries
    for (const [key, value] of requests.entries()) {
      if (value.resetTime < windowStart) {
        requests.delete(key);
      }
    }

    const clientRequests = requests.get(clientId);
    
    if (!clientRequests) {
      requests.set(clientId, { count: 1, resetTime: now });
      return next();
    }

    if (clientRequests.resetTime < windowStart) {
      requests.set(clientId, { count: 1, resetTime: now });
      return next();
    }

    if (clientRequests.count >= maxRequests) {
      return res.status(429).json({
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests',
        retryAfter: Math.ceil((clientRequests.resetTime + windowMs - now) / 1000)
      });
    }

    clientRequests.count++;
    next();
  };
};

// Error handling middleware
export const errorHandler = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('API Error:', error);

  // Default error response
  let statusCode = 500;
  let errorResponse = {
    error: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  };

  // Handle specific error types
  if (error.name === 'ValidationError') {
    statusCode = 400;
    errorResponse = {
      error: 'VALIDATION_ERROR',
      message: error.message,
    };
  }

  if (error.code === '23505') { // PostgreSQL unique violation
    statusCode = 409;
    errorResponse = {
      error: 'CONFLICT',
      message: 'Resource already exists',
    };
  }

  if (error.code === '23503') { // PostgreSQL foreign key violation
    statusCode = 400;
    errorResponse = {
      error: 'REFERENCE_ERROR',
      message: 'Referenced resource does not exist',
    };
  }

  res.status(statusCode).json(errorResponse);
};

// Audit logging middleware
export const auditLog = (action: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json;
    
    res.json = function(data) {
      // Log the action
      console.log('AUDIT:', {
        timestamp: new Date().toISOString(),
        userId: req.user?.id,
        username: req.user?.username,
        action,
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        statusCode: res.statusCode,
      });
      
      return originalJson.call(this, data);
    };
    
    next();
  };
};