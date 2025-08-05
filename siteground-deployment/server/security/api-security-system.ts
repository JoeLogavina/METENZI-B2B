// 🛡️ API SECURITY & RATE LIMITING SYSTEM (Step 6)
// Advanced API protection with intelligent rate limiting and security controls

import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';
import { redisCache } from '../cache/redis';
import { SecurityAuditSystem } from './audit-system';
import { FraudDetectionSystem } from './fraud-detection';
import crypto from 'crypto';

export interface RateLimitRule {
  windowMs: number;
  maxRequests: number;
  identifier: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
  message?: string;
  headers?: boolean;
}

export interface APISecurityConfig {
  enableRateLimit: boolean;
  enableDDoSProtection: boolean;
  enableIPWhitelist: boolean;
  enableAPIKeyValidation: boolean;
  enableRequestSigning: boolean;
  maxRequestSize: number;
  allowedOrigins: string[];
  trustedProxies: string[];
}

export interface SecurityEvent {
  type: 'rate_limit' | 'ddos_detected' | 'suspicious_request' | 'api_abuse';
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: string;
  details: Record<string, any>;
  timestamp: Date;
  blocked: boolean;
}

export class APISecuritySystem {
  private static readonly RATE_LIMIT_PREFIX = 'rate_limit:';
  private static readonly API_KEY_PREFIX = 'api_key:';
  private static readonly SECURITY_EVENT_PREFIX = 'security_event:';
  private static readonly DDOS_DETECTION_PREFIX = 'ddos_detection:';
  
  private static readonly DEFAULT_WINDOW_MS = 60 * 1000; // 1 minute
  private static readonly DEFAULT_MAX_REQUESTS = 100;
  private static readonly DDOS_THRESHOLD = 1000; // requests per minute
  private static readonly SUSPICIOUS_THRESHOLD = 50; // failed requests per minute

  // Main API security middleware
  static createSecurityMiddleware(config: Partial<APISecurityConfig> = {}) {
    const fullConfig: APISecurityConfig = {
      enableRateLimit: true,
      enableDDoSProtection: true,
      enableIPWhitelist: false,
      enableAPIKeyValidation: false,
      enableRequestSigning: false,
      maxRequestSize: 10 * 1024 * 1024, // 10MB
      allowedOrigins: ['*'],
      trustedProxies: ['127.0.0.1', '::1'],
      ...config
    };

    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const startTime = Date.now();
        
        // 1. DDoS Detection
        if (fullConfig.enableDDoSProtection) {
          const ddosCheck = await this.checkDDoSProtection(req);
          if (ddosCheck.blocked) {
            await this.logSecurityEvent({
              type: 'ddos_detected',
              severity: 'critical',
              source: req.ip,
              details: ddosCheck.details,
              timestamp: new Date(),
              blocked: true
            });

            return res.status(429).json({
              error: 'DDOS_PROTECTION',
              message: 'Request blocked by DDoS protection',
              retryAfter: ddosCheck.retryAfter
            });
          }
        }

        // 2. Rate Limiting
        if (fullConfig.enableRateLimit) {
          const rateLimitCheck = await this.checkRateLimit(req);
          if (rateLimitCheck.blocked) {
            res.setHeader('X-RateLimit-Limit', rateLimitCheck.limit);
            res.setHeader('X-RateLimit-Remaining', 0);
            res.setHeader('X-RateLimit-Reset', rateLimitCheck.resetTime);

            await this.logSecurityEvent({
              type: 'rate_limit',
              severity: 'medium',
              source: req.ip,
              details: rateLimitCheck.details,
              timestamp: new Date(),
              blocked: true
            });

            return res.status(429).json({
              error: 'RATE_LIMIT_EXCEEDED',
              message: 'Too many requests, please try again later',
              retryAfter: rateLimitCheck.retryAfter
            });
          }

          // Set rate limit headers for successful requests
          res.setHeader('X-RateLimit-Limit', rateLimitCheck.limit);
          res.setHeader('X-RateLimit-Remaining', rateLimitCheck.remaining);
          res.setHeader('X-RateLimit-Reset', rateLimitCheck.resetTime);
        }

        // 3. Request Size Validation
        const contentLength = parseInt(req.get('content-length') || '0');
        if (contentLength > fullConfig.maxRequestSize) {
          await this.logSecurityEvent({
            type: 'suspicious_request',
            severity: 'medium',
            source: req.ip,
            details: { contentLength, maxAllowed: fullConfig.maxRequestSize },
            timestamp: new Date(),
            blocked: true
          });

          return res.status(413).json({
            error: 'REQUEST_TOO_LARGE',
            message: 'Request payload too large'
          });
        }

        // 4. Origin Validation
        const origin = req.get('origin');
        if (origin && fullConfig.allowedOrigins.length > 0 && !fullConfig.allowedOrigins.includes('*')) {
          if (!fullConfig.allowedOrigins.includes(origin)) {
            await this.logSecurityEvent({
              type: 'suspicious_request',
              severity: 'medium',
              source: req.ip,
              details: { origin, allowedOrigins: fullConfig.allowedOrigins },
              timestamp: new Date(),
              blocked: true
            });

            return res.status(403).json({
              error: 'ORIGIN_NOT_ALLOWED',
              message: 'Origin not allowed'
            });
          }
        }

        // 5. API Key Validation (if enabled)
        if (fullConfig.enableAPIKeyValidation) {
          const apiKeyCheck = await this.validateAPIKey(req);
          if (!apiKeyCheck.valid) {
            await this.logSecurityEvent({
              type: 'api_abuse',
              severity: 'high',
              source: req.ip,
              details: { reason: apiKeyCheck.reason },
              timestamp: new Date(),
              blocked: true
            });

            return res.status(401).json({
              error: 'INVALID_API_KEY',
              message: apiKeyCheck.reason || 'Invalid API key'
            });
          }

          // Attach API key info to request
          (req as any).apiKey = apiKeyCheck.keyInfo;
        }

        // 6. Request Signing Validation (if enabled)
        if (fullConfig.enableRequestSigning) {
          const signatureCheck = await this.validateRequestSignature(req);
          if (!signatureCheck.valid) {
            await this.logSecurityEvent({
              type: 'api_abuse',
              severity: 'high',
              source: req.ip,
              details: { reason: signatureCheck.reason },
              timestamp: new Date(),
              blocked: true
            });

            return res.status(401).json({
              error: 'INVALID_SIGNATURE',
              message: signatureCheck.reason || 'Invalid request signature'
            });
          }
        }

        // 7. Fraud Detection Integration
        const fraudAnalysis = await FraudDetectionSystem.analyzeSecurityEvent(
          req,
          'api_request',
          { 
            endpoint: req.path,
            method: req.method,
            userAgent: req.get('User-Agent'),
            timestamp: Date.now()
          }
        );

        if (fraudAnalysis.riskScore > 80) {
          await this.logSecurityEvent({
            type: 'suspicious_request',
            severity: 'high',
            source: req.ip,
            details: { 
              riskScore: fraudAnalysis.riskScore,
              riskFactors: fraudAnalysis.riskFactors 
            },
            timestamp: new Date(),
            blocked: true
          });

          return res.status(403).json({
            error: 'SUSPICIOUS_REQUEST',
            message: 'Request blocked for security review'
          });
        }

        // Add security metadata to request
        (req as any).security = {
          riskScore: fraudAnalysis.riskScore,
          processingTime: Date.now() - startTime,
          securityChecks: ['ddos', 'rate_limit', 'size', 'origin', 'fraud'].filter(check => {
            switch (check) {
              case 'ddos': return fullConfig.enableDDoSProtection;
              case 'rate_limit': return fullConfig.enableRateLimit;
              case 'api_key': return fullConfig.enableAPIKeyValidation;
              case 'signature': return fullConfig.enableRequestSigning;
              default: return true;
            }
          })
        };

        next();

      } catch (error: any) {
        logger.error('API security middleware error', {
          error: error.message,
          path: req.path,
          method: req.method,
          ip: req.ip
        });

        res.status(500).json({
          error: 'SECURITY_ERROR',
          message: 'Security validation failed'
        });
      }
    };
  }

  // Advanced rate limiting with multiple strategies
  static async checkRateLimit(req: Request): Promise<{
    blocked: boolean;
    limit: number;
    remaining: number;
    resetTime: number;
    retryAfter?: number;
    details?: Record<string, any>;
  }> {
    const ip = req.ip;
    const endpoint = req.path;
    const user = (req as any).user;
    
    // Determine rate limit based on user type and endpoint
    const rateLimits = this.getRateLimitsForRequest(req);
    
    for (const rateLimit of rateLimits) {
      const key = `${this.RATE_LIMIT_PREFIX}${rateLimit.identifier}:${ip}:${endpoint}`;
      const window = Math.floor(Date.now() / rateLimit.windowMs);
      const windowKey = `${key}:${window}`;
      
      const current = await redisCache.get(windowKey) as number || 0;
      
      if (current >= rateLimit.maxRequests) {
        const nextWindow = (window + 1) * rateLimit.windowMs;
        const retryAfter = Math.ceil((nextWindow - Date.now()) / 1000);
        
        return {
          blocked: true,
          limit: rateLimit.maxRequests,
          remaining: 0,
          resetTime: nextWindow,
          retryAfter,
          details: {
            identifier: rateLimit.identifier,
            window: window,
            current: current
          }
        };
      }
      
      // Increment counter
      await redisCache.set(windowKey, current + 1, Math.ceil(rateLimit.windowMs / 1000));
      
      return {
        blocked: false,
        limit: rateLimit.maxRequests,
        remaining: rateLimit.maxRequests - current - 1,
        resetTime: (window + 1) * rateLimit.windowMs
      };
    }
    
    // Default rate limit
    return {
      blocked: false,
      limit: this.DEFAULT_MAX_REQUESTS,
      remaining: this.DEFAULT_MAX_REQUESTS - 1,
      resetTime: Date.now() + this.DEFAULT_WINDOW_MS
    };
  }

  // DDoS protection with adaptive thresholds
  static async checkDDoSProtection(req: Request): Promise<{
    blocked: boolean;
    retryAfter?: number;
    details?: Record<string, any>;
  }> {
    const ip = req.ip;
    const window = Math.floor(Date.now() / (60 * 1000)); // 1-minute windows
    const key = `${this.DDOS_DETECTION_PREFIX}${ip}:${window}`;
    
    const requestCount = await redisCache.get(key) as number || 0;
    
    // Increment request counter
    await redisCache.set(key, requestCount + 1, 120); // Keep for 2 minutes
    
    if (requestCount >= this.DDOS_THRESHOLD) {
      // Check if this IP is already blocked
      const blockKey = `${this.DDOS_DETECTION_PREFIX}blocked:${ip}`;
      const blockExpiry = await redisCache.get(blockKey);
      
      if (!blockExpiry) {
        // Block for 15 minutes
        const blockDuration = 15 * 60; // 15 minutes
        await redisCache.set(blockKey, Date.now() + (blockDuration * 1000), blockDuration);
        
        await SecurityAuditSystem.logEvent(
          'security',
          'ddos_ip_blocked',
          true,
          {
            ipAddress: ip,
            requestCount: requestCount,
            threshold: this.DDOS_THRESHOLD,
            blockDuration: blockDuration
          }
        );
      }
      
      return {
        blocked: true,
        retryAfter: 900, // 15 minutes
        details: {
          requestCount: requestCount,
          threshold: this.DDOS_THRESHOLD,
          window: window
        }
      };
    }
    
    return { blocked: false };
  }

  // Endpoint-specific rate limiting
  static getRateLimitsForRequest(req: Request): RateLimitRule[] {
    const user = (req as any).user;
    const endpoint = req.path;
    const method = req.method;
    
    const rules: RateLimitRule[] = [];
    
    // Authentication endpoints - more restrictive
    if (endpoint.startsWith('/api/auth/')) {
      if (endpoint.includes('/login')) {
        rules.push({
          windowMs: 15 * 60 * 1000, // 15 minutes
          maxRequests: 5,
          identifier: 'auth_login'
        });
      } else if (endpoint.includes('/verify-mfa')) {
        rules.push({
          windowMs: 5 * 60 * 1000, // 5 minutes
          maxRequests: 10,
          identifier: 'auth_mfa'
        });
      } else {
        rules.push({
          windowMs: 60 * 1000, // 1 minute
          maxRequests: 30,
          identifier: 'auth_general'
        });
      }
    }
    
    // Admin endpoints
    else if (endpoint.startsWith('/api/admin/')) {
      rules.push({
        windowMs: 60 * 1000, // 1 minute
        maxRequests: user?.role === 'super_admin' ? 200 : 100,
        identifier: 'admin_endpoints'
      });
    }
    
    // Product and order endpoints
    else if (endpoint.startsWith('/api/products') || endpoint.startsWith('/api/orders')) {
      if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
        rules.push({
          windowMs: 60 * 1000, // 1 minute
          maxRequests: 20,
          identifier: 'write_operations'
        });
      } else {
        rules.push({
          windowMs: 60 * 1000, // 1 minute
          maxRequests: user?.role === 'admin' ? 200 : 100,
          identifier: 'read_operations'
        });
      }
    }
    
    // License download endpoints
    else if (endpoint.startsWith('/api/secure-download') || endpoint.includes('/download/')) {
      rules.push({
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 50,
        identifier: 'download_operations'
      });
    }
    
    // Default rate limit for other endpoints
    else {
      rules.push({
        windowMs: this.DEFAULT_WINDOW_MS,
        maxRequests: user?.role === 'admin' ? 200 : this.DEFAULT_MAX_REQUESTS,
        identifier: 'default'
      });
    }
    
    return rules;
  }

  // API Key validation system
  static async validateAPIKey(req: Request): Promise<{
    valid: boolean;
    reason?: string;
    keyInfo?: Record<string, any>;
  }> {
    const apiKey = req.get('X-API-Key') || req.query.api_key;
    
    if (!apiKey) {
      return { valid: false, reason: 'API key required' };
    }
    
    const keyData = await redisCache.get(`${this.API_KEY_PREFIX}${apiKey}`);
    
    if (!keyData) {
      return { valid: false, reason: 'Invalid API key' };
    }
    
    const keyInfo = keyData as any;
    
    // Check if key is active
    if (!keyInfo.active) {
      return { valid: false, reason: 'API key disabled' };
    }
    
    // Check expiration
    if (keyInfo.expiresAt && new Date(keyInfo.expiresAt) < new Date()) {
      return { valid: false, reason: 'API key expired' };
    }
    
    // Check rate limits for this key
    const keyRateLimit = await this.checkAPIKeyRateLimit(apiKey, keyInfo);
    if (keyRateLimit.exceeded) {
      return { valid: false, reason: 'API key rate limit exceeded' };
    }
    
    return { valid: true, keyInfo };
  }

  // Request signature validation
  static async validateRequestSignature(req: Request): Promise<{
    valid: boolean;
    reason?: string;
  }> {
    const signature = req.get('X-Signature');
    const timestamp = req.get('X-Timestamp');
    const nonce = req.get('X-Nonce');
    
    if (!signature || !timestamp || !nonce) {
      return { valid: false, reason: 'Missing signature headers' };
    }
    
    // Check timestamp (prevent replay attacks)
    const requestTime = parseInt(timestamp);
    const currentTime = Date.now();
    const timeDiff = Math.abs(currentTime - requestTime);
    
    if (timeDiff > 5 * 60 * 1000) { // 5 minutes
      return { valid: false, reason: 'Request timestamp too old' };
    }
    
    // Check nonce (prevent replay attacks)
    const nonceKey = `nonce:${nonce}`;
    const nonceExists = await redisCache.get(nonceKey);
    
    if (nonceExists) {
      return { valid: false, reason: 'Nonce already used' };
    }
    
    // Store nonce for 10 minutes
    await redisCache.set(nonceKey, true, 600);
    
    // Validate signature (simplified - in production, use proper HMAC)
    const expectedSignature = crypto
      .createHash('sha256')
      .update(`${req.method}${req.path}${timestamp}${nonce}`)
      .digest('hex');
    
    if (signature !== expectedSignature) {
      return { valid: false, reason: 'Invalid signature' };
    }
    
    return { valid: true };
  }

  // API key rate limiting
  static async checkAPIKeyRateLimit(apiKey: string, keyInfo: any): Promise<{
    exceeded: boolean;
    remaining?: number;
  }> {
    const limit = keyInfo.rateLimit || 1000; // Default 1000 requests per hour
    const window = Math.floor(Date.now() / (60 * 60 * 1000)); // 1-hour windows
    const key = `api_key_rate:${apiKey}:${window}`;
    
    const current = await redisCache.get(key) as number || 0;
    
    if (current >= limit) {
      return { exceeded: true };
    }
    
    await redisCache.set(key, current + 1, 3600); // 1 hour TTL
    
    return { exceeded: false, remaining: limit - current - 1 };
  }

  // Security event logging
  static async logSecurityEvent(event: SecurityEvent): Promise<void> {
    const eventKey = `${this.SECURITY_EVENT_PREFIX}${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    
    await redisCache.set(eventKey, event, 24 * 60 * 60); // Keep for 24 hours
    
    // Log to audit system
    await SecurityAuditSystem.logEvent(
      'api_security',
      event.type,
      !event.blocked,
      {
        severity: event.severity,
        source: event.source,
        details: event.details,
        blocked: event.blocked
      }
    );
    
    // Log to application logger
    const logLevel = event.severity === 'critical' ? 'error' : 
                    event.severity === 'high' ? 'warn' : 'info';
    
    logger[logLevel](`API Security Event: ${event.type}`, {
      severity: event.severity,
      source: event.source,
      blocked: event.blocked,
      details: event.details
    });
  }

  // Security monitoring and analytics
  static async getSecurityAnalytics(timeframe: 'hour' | 'day' | 'week' = 'hour'): Promise<{
    totalRequests: number;
    blockedRequests: number;
    topBlockedIPs: Array<{ ip: string; count: number }>;
    eventsByType: Record<string, number>;
    riskScoreDistribution: Record<string, number>;
  }> {
    const windowMs = timeframe === 'hour' ? 60 * 60 * 1000 :
                     timeframe === 'day' ? 24 * 60 * 60 * 1000 :
                     7 * 24 * 60 * 60 * 1000;
    
    const cutoff = Date.now() - windowMs;
    
    // Get security events from Redis
    const eventKeys = await redisCache.keys(`${this.SECURITY_EVENT_PREFIX}*`);
    const events: SecurityEvent[] = [];
    
    for (const key of eventKeys) {
      const event = await redisCache.get(key) as SecurityEvent;
      if (event && event.timestamp.getTime() > cutoff) {
        events.push(event);
      }
    }
    
    // Analyze events
    const analytics = {
      totalRequests: events.length,
      blockedRequests: events.filter(e => e.blocked).length,
      topBlockedIPs: this.getTopBlockedIPs(events),
      eventsByType: this.groupEventsByType(events),
      riskScoreDistribution: this.getRiskScoreDistribution(events)
    };
    
    return analytics;
  }

  // Helper methods for analytics
  private static getTopBlockedIPs(events: SecurityEvent[]): Array<{ ip: string; count: number }> {
    const ipCounts: Record<string, number> = {};
    
    events.filter(e => e.blocked).forEach(event => {
      const ip = event.source;
      ipCounts[ip] = (ipCounts[ip] || 0) + 1;
    });
    
    return Object.entries(ipCounts)
      .map(([ip, count]) => ({ ip, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private static groupEventsByType(events: SecurityEvent[]): Record<string, number> {
    const typeCounts: Record<string, number> = {};
    
    events.forEach(event => {
      typeCounts[event.type] = (typeCounts[event.type] || 0) + 1;
    });
    
    return typeCounts;
  }

  private static getRiskScoreDistribution(events: SecurityEvent[]): Record<string, number> {
    const distribution: Record<string, number> = {
      'low': 0,
      'medium': 0,
      'high': 0,
      'critical': 0
    };
    
    events.forEach(event => {
      distribution[event.severity]++;
    });
    
    return distribution;
  }
}