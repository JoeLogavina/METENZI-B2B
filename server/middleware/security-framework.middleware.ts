import { Request, Response, NextFunction, Express } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import csrf from 'csurf';
import crypto from 'crypto';

// Centralized Security Configuration
export class SecurityConfig {
  static isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  }

  static isDevelopment(): boolean {
    return process.env.NODE_ENV === 'development';
  }

  static getEncryptionKey(keyName: string): string {
    const key = process.env[keyName];
    if (!key) {
      if (this.isProduction()) {
        throw new Error(`Critical: ${keyName} not configured in production`);
      }
      console.warn(`⚠️ Using development fallback for ${keyName}`);
      return `dev-${keyName.toLowerCase()}-${crypto.randomBytes(8).toString('hex')}`;
    }
    return key;
  }

  static shouldUseHTTPS(): boolean {
    return this.isProduction();
  }

  static getCookieSettings() {
    return {
      httpOnly: true,
      secure: this.shouldUseHTTPS(),
      sameSite: 'strict' as const,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    };
  }
}

// Rate Limiting Configuration
export class RateLimitConfig {
  static createLoginLimiter() {
    return rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: SecurityConfig.isProduction() ? 5 : 50, // Stricter in production
      message: {
        error: 'TOO_MANY_LOGIN_ATTEMPTS',
        message: 'Too many login attempts. Please try again later.',
        retryAfter: '15 minutes'
      },
      standardHeaders: true,
      legacyHeaders: false,
      skipSuccessfulRequests: true,
    });
  }

  static createApiLimiter() {
    return rateLimit({
      windowMs: 1 * 60 * 1000, // 1 minute
      max: SecurityConfig.isProduction() ? 100 : 1000, // More relaxed in development
      message: {
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please try again later.'
      },
      standardHeaders: true,
      legacyHeaders: false,
    });
  }

  static createAdminLimiter() {
    return rateLimit({
      windowMs: 5 * 60 * 1000, // 5 minutes
      max: SecurityConfig.isProduction() ? 50 : 500,
      message: {
        error: 'ADMIN_RATE_LIMIT_EXCEEDED',
        message: 'Too many admin requests. Please try again later.'
      },
      standardHeaders: true,
      legacyHeaders: false,
    });
  }
}

// CSRF Protection Configuration
export class CSRFConfig {
  static createCSRFProtection() {
    return csrf({
      cookie: false, // Use session store instead of cookies to avoid conflicts
      ignoreMethods: ['GET', 'HEAD', 'OPTIONS'],
      value: (req) => {
        // Check multiple sources for CSRF token
        return req.body._csrf || 
               req.query._csrf || 
               req.headers['x-csrf-token'] || 
               req.headers['x-xsrf-token'];
      }
    });
  }

  static createTokenHandler() {
    return (req: Request, res: Response) => {
      try {
        const token = (req as any).csrfToken();
        res.json({ 
          csrfToken: token,
          expires: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
        });
      } catch (error) {
        console.error('CSRF token generation failed:', error);
        res.status(500).json({ 
          error: 'CSRF_TOKEN_GENERATION_FAILED',
          message: 'Unable to generate security token' 
        });
      }
    };
  }
}

// Security Headers Configuration
export class SecurityHeaders {
  static create() {
    return helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: [
            "'self'", 
            "'unsafe-inline'", // Required for Tailwind
            "https://fonts.googleapis.com"
          ],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "https:", "blob:"],
          scriptSrc: SecurityConfig.isDevelopment() 
            ? ["'self'", "'unsafe-inline'", "'unsafe-eval'"] // Development needs
            : ["'self'"],
          connectSrc: SecurityConfig.isDevelopment()
            ? ["'self'", "ws:", "wss:"] // Allow hot reload in dev
            : ["'self'"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: SecurityConfig.isProduction() ? [] : null,
        },
        useDefaults: false,
      },
      hsts: SecurityConfig.isProduction() ? {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true
      } : false,
      noSniff: true,
      frameguard: { action: 'deny' },
      xssFilter: true,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
    });
  }
}

// Session Security Middleware
export class SessionSecurity {
  static validateSession() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (req.user && req.session) {
        const currentUserAgent = req.get('User-Agent');
        const sessionUserAgent = (req.session as any).userAgent;
        
        // Store user agent on first request
        if (!sessionUserAgent) {
          (req.session as any).userAgent = currentUserAgent;
          (req.session as any).createdAt = Date.now();
        }
        
        // Check for session hijacking indicators
        if (sessionUserAgent && sessionUserAgent !== currentUserAgent) {
          console.warn('🚨 Potential session hijacking detected:', {
            userId: (req.user as any).id,
            username: (req.user as any).username,
            ip: req.ip,
            sessionUserAgent,
            currentUserAgent,
            timestamp: new Date().toISOString()
          });
          
          // Destroy suspicious session
          req.session.destroy((err) => {
            if (err) console.error('Error destroying suspicious session:', err);
          });
          
          return res.status(401).json({
            error: 'SESSION_SECURITY_VIOLATION',
            message: 'Session security violation detected. Please log in again.'
          });
        }
        
        // Check session age (24 hours max)
        const sessionAge = Date.now() - ((req.session as any).createdAt || 0);
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        
        if (sessionAge > maxAge) {
          req.session.destroy((err) => {
            if (err) console.error('Error destroying expired session:', err);
          });
          
          return res.status(401).json({
            error: 'SESSION_EXPIRED',
            message: 'Session has expired. Please log in again.'
          });
        }
      }
      
      next();
    };
  }

  static protectSensitiveOperation() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Additional security checks for sensitive operations
      const userAgent = req.get('User-Agent');
      const referer = req.get('Referer');
      const origin = req.get('Origin');
      
      // Log suspicious activity
      if (!userAgent) {
        console.warn('🚨 Suspicious request without User-Agent:', {
          ip: req.ip,
          path: req.path,
          method: req.method,
          user: (req.user as any)?.username,
          timestamp: new Date().toISOString()
        });
      }
      
      // Check for CSRF attempts (additional to middleware)
      if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
        if (!referer && !origin) {
          console.warn('🚨 State-changing request without referer/origin:', {
            ip: req.ip,
            path: req.path,
            method: req.method,
            user: (req.user as any)?.username,
            timestamp: new Date().toISOString()
          });
        }
      }
      
      next();
    };
  }
}

// Input Validation & Sanitization
export class InputSecurity {
  static sanitizeInput() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Basic input sanitization
      const sanitizeString = (str: string): string => {
        if (typeof str !== 'string') return str;
        
        // Remove potential XSS vectors
        return str
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+\s*=/gi, '')
          .trim();
      };
      
      const sanitizeObject = (obj: any): any => {
        if (typeof obj === 'string') {
          return sanitizeString(obj);
        }
        
        if (Array.isArray(obj)) {
          return obj.map(sanitizeObject);
        }
        
        if (obj && typeof obj === 'object') {
          const sanitized: any = {};
          for (const [key, value] of Object.entries(obj)) {
            sanitized[key] = sanitizeObject(value);
          }
          return sanitized;
        }
        
        return obj;
      };
      
      // Sanitize request body
      if (req.body) {
        req.body = sanitizeObject(req.body);
      }
      
      // Sanitize query parameters
      if (req.query) {
        req.query = sanitizeObject(req.query);
      }
      
      next();
    };
  }
}

// Simplified Security Middleware for Development
export class SecurityFramework {
  static applySecurityMiddleware(app: Express) {
    console.log('🔒 Initializing Basic Security...');
    
    // Simplified for development - just headers
    app.use(SecurityHeaders.create());
    
    console.log('✅ Basic Security initialized');
  }
  
  static setupCSRFProtection(app: Express) {
    console.log('🛡️ CSRF disabled for development');
    
    // Simple token endpoint without validation
    app.get('/api/csrf-token', (req, res) => {
      res.json({ 
        csrfToken: `dev-${Date.now()}`,
        expires: Date.now() + (24 * 60 * 60 * 1000)
      });
    });
  }
  
  static getSensitiveOperationProtection() {
    return (req: any, res: any, next: any) => next(); // No-op for development
  }
}