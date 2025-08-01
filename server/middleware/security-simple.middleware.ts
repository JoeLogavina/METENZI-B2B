import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';

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
  skipSuccessfulRequests: true,
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
      user: (req.user as any)?.username
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