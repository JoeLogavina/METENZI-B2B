import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import csrf from 'csurf';
import { Request, Response, NextFunction } from 'express';

// Extend Express Request interface for CSRF token
declare global {
  namespace Express {
    interface Request {
      csrfToken(): string;
    }
    
    interface Session {
      userAgent?: string;
    }
  }
}

// Rate limiting for login attempts
export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login attempts per windowMs
  message: {
    error: 'TOO_MANY_ATTEMPTS',
    message: 'Too many login attempts, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip successful requests
  skipSuccessfulRequests: true,
  // Use default IP-based key generation (IPv6 compatible)
  keyGenerator: (req) => req.ip || req.socket.remoteAddress || 'unknown',
});

// Rate limiting for API endpoints
export const apiRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limiting for admin endpoints
export const adminRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 50, // Limit each IP to 50 admin requests per windowMs
  message: {
    error: 'ADMIN_RATE_LIMIT_EXCEEDED',
    message: 'Too many admin requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// CSRF protection middleware - needs session to be configured first
export const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    key: '_csrf',
  },
  // Use session store for CSRF tokens (fallback if cookie fails)
  ignoreMethods: ['GET', 'HEAD', 'OPTIONS'],
});

// Helmet security headers - relaxed CSP for development
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Allow inline scripts for development
      connectSrc: ["'self'", "ws:", "wss:"], // Allow WebSocket connections for hot reload
      objectSrc: ["'none'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
    },
    useDefaults: false, // Don't use default directives
  },
  hsts: process.env.NODE_ENV === 'production' ? {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  } : false, // Disable HSTS in development
  noSniff: true,
  frameguard: { action: 'deny' },
  xssFilter: true,
});

// CSRF token endpoint for client-side requests
export const csrfTokenHandler = (req: Request, res: Response) => {
  try {
    res.json({ csrfToken: req.csrfToken() });
  } catch (error) {
    console.error('CSRF token generation failed:', error);
    res.status(500).json({ error: 'Failed to generate CSRF token' });
  }
};

// Security middleware for protecting sensitive operations
export const protectSensitiveOperation = (req: Request, res: Response, next: NextFunction) => {
  // Additional security checks for sensitive operations
  const userAgent = req.get('User-Agent');
  const referer = req.get('Referer');
  
  // Log suspicious activity
  if (!userAgent || !referer) {
    console.warn('Suspicious request without proper headers:', {
      ip: req.ip,
      path: req.path,
      userAgent,
      referer,
      user: req.user?.username
    });
  }
  
  next();
};

// Middleware to validate session security
export const validateSessionSecurity = (req: Request, res: Response, next: NextFunction) => {
  if (req.user && req.session) {
    // Check for session hijacking indicators
    const currentUserAgent = req.get('User-Agent');
    const sessionUserAgent = (req.session as any).userAgent;
    
    if (sessionUserAgent && sessionUserAgent !== currentUserAgent) {
      console.warn('Potential session hijacking detected:', {
        userId: (req.user as any).id,
        username: (req.user as any).username,
        ip: req.ip,
        sessionUserAgent,
        currentUserAgent
      });
      
      // Optionally terminate session
      req.session.destroy((err) => {
        if (err) console.error('Error destroying suspicious session:', err);
      });
      
      return res.status(401).json({
        error: 'SESSION_SECURITY_VIOLATION',
        message: 'Session security violation detected. Please log in again.'
      });
    }
    
    // Store user agent on first request
    if (!sessionUserAgent) {
      (req.session as any).userAgent = currentUserAgent;
    }
  }
  
  next();
};