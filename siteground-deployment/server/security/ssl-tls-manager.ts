// 🔒 SSL/TLS SECURITY MANAGER (Step 7)
// Comprehensive SSL/TLS security for all communications

import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';
import helmet from 'helmet';
import crypto from 'crypto';

export interface SSLTLSConfig {
  enforceHTTPS: boolean;
  hstsMaxAge: number;
  includeSubDomains: boolean;
  preload: boolean;
  strictTransportSecurity: boolean;
  certificatePinning: boolean;
  cspEnabled: boolean;
  upgradeInsecureRequests: boolean;
  secureHeaders: boolean;
}

export interface SecurityHeaders {
  'Strict-Transport-Security'?: string;
  'Content-Security-Policy'?: string;
  'X-Content-Type-Options'?: string;
  'X-Frame-Options'?: string;
  'X-XSS-Protection'?: string;
  'Referrer-Policy'?: string;
  'Feature-Policy'?: string;
  'Permissions-Policy'?: string;
  'Cross-Origin-Embedder-Policy'?: string;
  'Cross-Origin-Opener-Policy'?: string;
  'Cross-Origin-Resource-Policy'?: string;
}

export class SSLTLSManager {
  private static readonly DEFAULT_HSTS_MAX_AGE = 31536000; // 1 year
  private static readonly CSP_NONCE_LENGTH = 16;
  
  // Main SSL/TLS security middleware
  static createSecurityMiddleware(config: Partial<SSLTLSConfig> = {}) {
    const fullConfig: SSLTLSConfig = {
      enforceHTTPS: process.env.NODE_ENV === 'production',
      hstsMaxAge: this.DEFAULT_HSTS_MAX_AGE,
      includeSubDomains: true,
      preload: true,
      strictTransportSecurity: true,
      certificatePinning: false, // Disabled by default due to complexity
      cspEnabled: true,
      upgradeInsecureRequests: process.env.NODE_ENV === 'production',
      secureHeaders: true,
      ...config
    };

    return [
      // 1. HTTPS Enforcement
      this.enforceHTTPS(fullConfig),
      
      // 2. Comprehensive Security Headers
      this.setSecurityHeaders(fullConfig),
      
      // 3. CSP with nonce support
      this.contentSecurityPolicy(fullConfig),
      
      // 4. Additional security middleware
      this.additionalSecurityMiddleware(fullConfig)
    ];
  }

  // Enforce HTTPS redirects
  static enforceHTTPS(config: SSLTLSConfig) {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!config.enforceHTTPS) {
        return next();
      }

      // Check if request is secure
      const isSecure = req.secure || 
        req.get('X-Forwarded-Proto') === 'https' ||
        req.get('X-Forwarded-Ssl') === 'on' ||
        req.connection.encrypted;

      if (!isSecure) {
        const redirectUrl = `https://${req.get('Host')}${req.originalUrl}`;
        
        logger.warn('HTTPS redirect', {
          originalUrl: req.originalUrl,
          redirectUrl,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });

        return res.redirect(301, redirectUrl);
      }

      next();
    };
  }

  // Set comprehensive security headers
  static setSecurityHeaders(config: SSLTLSConfig) {
    return helmet({
      // Strict Transport Security
      hsts: config.strictTransportSecurity ? {
        maxAge: config.hstsMaxAge,
        includeSubDomains: config.includeSubDomains,
        preload: config.preload
      } : false,

      // Content Security Policy (handled separately)
      contentSecurityPolicy: false,

      // X-Content-Type-Options
      noSniff: true,

      // X-Frame-Options
      frameguard: { action: 'deny' },

      // X-XSS-Protection
      xssFilter: true,

      // Referrer Policy
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },

      // Cross-Origin Policies
      crossOriginEmbedderPolicy: { policy: 'require-corp' },
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      crossOriginResourcePolicy: { policy: 'same-origin' },

      // Feature/Permissions Policy
      permittedCrossDomainPolicies: false,

      // Additional security headers
      hidePoweredBy: true,
      ieNoOpen: true,
      noCache: false // Allow caching for performance
    });
  }

  // Content Security Policy with nonce support
  static contentSecurityPolicy(config: SSLTLSConfig) {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!config.cspEnabled) {
        return next();
      }

      // Generate nonce for inline scripts/styles
      const nonce = crypto.randomBytes(this.CSP_NONCE_LENGTH).toString('base64');
      res.locals.nonce = nonce;

      // Build CSP directives
      const directives: Record<string, string[]> = {
        'default-src': ["'self'"],
        'script-src': [
          "'self'",
          `'nonce-${nonce}'`,
          // Allow specific trusted domains for development
          ...(process.env.NODE_ENV === 'development' ? [
            "'unsafe-inline'", 
            "'unsafe-eval'",
            "http://localhost:*",
            "ws://localhost:*"
          ] : [])
        ],
        'style-src': [
          "'self'",
          `'nonce-${nonce}'`,
          "'unsafe-inline'", // Required for some CSS frameworks
          'https://fonts.googleapis.com'
        ],
        'img-src': [
          "'self'",
          'data:',
          'https:',
          'blob:'
        ],
        'font-src': [
          "'self'",
          'https://fonts.gstatic.com',
          'data:'
        ],
        'connect-src': [
          "'self'",
          'https:',
          'wss:',
          // Allow Vite dev server connections
          ...(process.env.NODE_ENV === 'development' ? [
            "http://localhost:*",
            "ws://localhost:*",
            "http://127.0.0.1:*",
            "ws://127.0.0.1:*"
          ] : [])
        ],
        'media-src': ["'self'"],
        'object-src': ["'none'"],
        'frame-src': ["'none'"],
        'worker-src': ["'self'", 'blob:'],
        'manifest-src': ["'self'"],
        'form-action': ["'self'"],
        'frame-ancestors': ["'none'"],
        'base-uri': ["'self'"]
      };

      // Add upgrade-insecure-requests in production
      if (config.upgradeInsecureRequests) {
        directives['upgrade-insecure-requests'] = [];
      }

      // Convert directives to CSP string
      const cspString = Object.entries(directives)
        .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
        .join('; ');

      res.setHeader('Content-Security-Policy', cspString);

      // Also set report-only header for monitoring
      if (process.env.NODE_ENV === 'development') {
        res.setHeader('Content-Security-Policy-Report-Only', cspString);
      }

      next();
    };
  }

  // Additional security middleware
  static additionalSecurityMiddleware(config: SSLTLSConfig) {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!config.secureHeaders) {
        return next();
      }

      // Additional custom security headers
      const additionalHeaders: SecurityHeaders = {
        // Feature Policy (legacy)
        'Feature-Policy': [
          "camera 'none'",
          "microphone 'none'",
          "geolocation 'none'",
          "payment 'none'",
          "usb 'none'"
        ].join('; '),

        // Permissions Policy (modern)
        'Permissions-Policy': [
          "camera=()",
          "microphone=()",
          "geolocation=()",
          "payment=()",
          "usb=()"
        ].join(', '),

        // Expect-CT (Certificate Transparency)
        'Expect-CT': `max-age=86400, enforce`,

        // X-Permitted-Cross-Domain-Policies
        'X-Permitted-Cross-Domain-Policies': 'none',

        // Cache Control for sensitive pages
        'Cache-Control': req.path.includes('/admin') || req.path.includes('/auth') 
          ? 'no-cache, no-store, must-revalidate, private'
          : 'public, max-age=300'
      };

      // Apply headers
      Object.entries(additionalHeaders).forEach(([header, value]) => {
        if (value) {
          res.setHeader(header, value);
        }
      });

      next();
    };
  }

  // Certificate pinning middleware (for advanced deployments)
  static certificatePinning(pinnedKeys: string[]) {
    return (req: Request, res: Response, next: NextFunction) => {
      if (pinnedKeys.length === 0) {
        return next();
      }

      // In a real implementation, this would validate the certificate chain
      // against the pinned public keys. This is a simplified example.
      const hpkpHeader = `pin-sha256="${pinnedKeys.join('"; pin-sha256="')}"; max-age=5184000; includeSubDomains`;
      
      res.setHeader('Public-Key-Pins', hpkpHeader);
      
      next();
    };
  }

  // SSL/TLS configuration validation
  static validateSSLConfig(): {
    isValid: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check environment variables
    if (process.env.NODE_ENV === 'production') {
      if (!process.env.SSL_CERT_PATH && !process.env.HTTPS_ENABLED) {
        issues.push('SSL certificate path not configured for production');
      }

      if (!process.env.SSL_KEY_PATH && !process.env.HTTPS_ENABLED) {
        issues.push('SSL private key path not configured for production');
      }
    }

    // Check for common misconfigurations
    if (process.env.NODE_ENV !== 'production' && process.env.ENFORCE_HTTPS === 'true') {
      recommendations.push('HTTPS enforcement enabled in development - this may cause issues');
    }

    // Validate HSTS configuration
    const hstsMaxAge = parseInt(process.env.HSTS_MAX_AGE || '31536000');
    if (hstsMaxAge < 31536000) {
      recommendations.push('HSTS max-age should be at least 1 year (31536000 seconds)');
    }

    return {
      isValid: issues.length === 0,
      issues,
      recommendations
    };
  }

  // Generate CSP report endpoint
  static cspReportEndpoint() {
    return (req: Request, res: Response) => {
      try {
        const report = req.body;
        
        logger.warn('CSP Violation Report', {
          report,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          timestamp: new Date()
        });

        // Store report for analysis (could be sent to monitoring service)
        this.storeCSPViolation(report, req);

        res.status(204).send();
      } catch (error) {
        logger.error('CSP report processing error', { error });
        res.status(400).json({ error: 'Invalid report format' });
      }
    };
  }

  // Store CSP violations for analysis
  private static storeCSPViolation(report: any, req: Request) {
    // This could integrate with your monitoring/analytics service
    const violation = {
      documentUri: report['document-uri'],
      violatedDirective: report['violated-directive'],
      blockedUri: report['blocked-uri'],
      lineNumber: report['line-number'],
      sourceFile: report['source-file'],
      timestamp: new Date(),
      userAgent: req.get('User-Agent'),
      ip: req.ip
    };

    // Log to file or send to monitoring service
    logger.info('CSP Violation Stored', violation);
  }

  // Security headers validation
  static validateSecurityHeaders(req: Request, res: Response): {
    present: string[];
    missing: string[];
    recommendations: string[];
  } {
    const requiredHeaders = [
      'Strict-Transport-Security',
      'Content-Security-Policy',
      'X-Content-Type-Options',
      'X-Frame-Options',
      'X-XSS-Protection',
      'Referrer-Policy'
    ];

    const present: string[] = [];
    const missing: string[] = [];

    requiredHeaders.forEach(header => {
      if (res.getHeader(header)) {
        present.push(header);
      } else {
        missing.push(header);
      }
    });

    const recommendations: string[] = [];
    
    if (missing.includes('Strict-Transport-Security') && process.env.NODE_ENV === 'production') {
      recommendations.push('Enable HSTS for production deployment');
    }

    if (missing.includes('Content-Security-Policy')) {
      recommendations.push('Implement Content Security Policy to prevent XSS attacks');
    }

    return { present, missing, recommendations };
  }

  // TLS version and cipher validation
  static validateTLSConfiguration(): {
    tlsVersion: string;
    ciphers: string[];
    recommendations: string[];
  } {
    const recommendations: string[] = [];

    // Check TLS version (this would be implemented differently in a real server)
    const tlsVersion = process.env.TLS_VERSION || 'TLS 1.2+';
    
    if (tlsVersion.includes('1.0') || tlsVersion.includes('1.1')) {
      recommendations.push('Upgrade to TLS 1.2 or higher for better security');
    }

    // Common secure cipher suites
    const recommendedCiphers = [
      'ECDHE-RSA-AES128-GCM-SHA256',
      'ECDHE-RSA-AES256-GCM-SHA384',
      'ECDHE-RSA-CHACHA20-POLY1305',
      'ECDHE-ECDSA-AES128-GCM-SHA256',
      'ECDHE-ECDSA-AES256-GCM-SHA384'
    ];

    return {
      tlsVersion,
      ciphers: recommendedCiphers,
      recommendations
    };
  }

  // OCSP Stapling configuration
  static enableOCSPStapling(): {
    enabled: boolean;
    configuration: Record<string, any>;
  } {
    // This would configure OCSP stapling for certificate validation
    const config = {
      enabled: process.env.OCSP_STAPLING === 'true',
      responderUrl: process.env.OCSP_RESPONDER_URL,
      cacheTimeout: parseInt(process.env.OCSP_CACHE_TIMEOUT || '3600')
    };

    return {
      enabled: config.enabled,
      configuration: config
    };
  }
}