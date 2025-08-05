// 🔍 ADVANCED FRAUD DETECTION SYSTEM
// Phase 3 Implementation - Real-time fraud monitoring and prevention

import { logger } from '../lib/logger';
import { redisCache } from '../cache/redis';
import { Request } from 'express';

export interface SecurityEvent {
  userId?: string;
  ipAddress: string;
  userAgent: string;
  endpoint: string;
  action: string;
  timestamp: Date;
  riskScore: number;
  details: Record<string, any>;
}

export interface FraudDetectionRule {
  name: string;
  description: string;
  riskWeight: number;
  enabled: boolean;
  threshold?: number;
  timeWindow?: number; // in minutes
}

export class FraudDetectionSystem {
  private static readonly CACHE_PREFIX = 'fraud:';
  private static readonly HIGH_RISK_THRESHOLD = 75;
  private static readonly MODERATE_RISK_THRESHOLD = 40;
  
  // Default fraud detection rules
  private static readonly DEFAULT_RULES: FraudDetectionRule[] = [
    {
      name: 'rapid_requests',
      description: 'Unusually high request frequency from single IP',
      riskWeight: 25,
      enabled: true,
      threshold: 50, // requests per minute
      timeWindow: 1
    },
    {
      name: 'multiple_failed_logins',
      description: 'Multiple failed login attempts',
      riskWeight: 30,
      enabled: true,
      threshold: 5,
      timeWindow: 15
    },
    {
      name: 'suspicious_user_agent',
      description: 'Bot-like or suspicious user agent detected',
      riskWeight: 15,
      enabled: true
    },
    {
      name: 'unusual_license_access',
      description: 'Accessing unusual number of licenses',
      riskWeight: 20,
      enabled: true,
      threshold: 10,
      timeWindow: 60
    },
    {
      name: 'geolocation_anomaly',
      description: 'Access from unusual geographic location',
      riskWeight: 25,
      enabled: true
    },
    {
      name: 'license_key_brute_force',
      description: 'Attempting to access multiple license keys rapidly',
      riskWeight: 35,
      enabled: true,
      threshold: 3,
      timeWindow: 5
    }
  ];

  /**
   * Analyze a security event and calculate risk score
   */
  static async analyzeSecurityEvent(req: Request, action: string, details: Record<string, any> = {}): Promise<SecurityEvent> {
    const event: SecurityEvent = {
      userId: (req as any).user?.id,
      ipAddress: this.getClientIP(req),
      userAgent: req.get('User-Agent') || 'unknown',
      endpoint: req.path,
      action,
      timestamp: new Date(),
      riskScore: 0,
      details
    };

    // Calculate risk score based on multiple factors
    event.riskScore = await this.calculateRiskScore(event);

    // Log the security event
    await this.logSecurityEvent(event);

    // Take action if high risk
    if (event.riskScore >= this.HIGH_RISK_THRESHOLD) {
      await this.handleHighRiskEvent(event);
    }

    return event;
  }

  /**
   * Calculate comprehensive risk score for an event
   */
  private static async calculateRiskScore(event: SecurityEvent): Promise<number> {
    let totalRisk = 0;
    const rules = this.DEFAULT_RULES.filter(rule => rule.enabled);

    for (const rule of rules) {
      const ruleRisk = await this.evaluateRule(rule, event);
      totalRisk += ruleRisk;
    }

    // Cap at 100
    return Math.min(totalRisk, 100);
  }

  /**
   * Evaluate a specific fraud detection rule
   */
  private static async evaluateRule(rule: FraudDetectionRule, event: SecurityEvent): Promise<number> {
    try {
      switch (rule.name) {
        case 'rapid_requests':
          return await this.evaluateRapidRequests(rule, event);
        
        case 'multiple_failed_logins':
          return await this.evaluateFailedLogins(rule, event);
        
        case 'suspicious_user_agent':
          return this.evaluateSuspiciousUserAgent(rule, event);
        
        case 'unusual_license_access':
          return await this.evaluateUnusualLicenseAccess(rule, event);
        
        case 'geolocation_anomaly':
          return await this.evaluateGeolocationAnomaly(rule, event);
        
        case 'license_key_brute_force':
          return await this.evaluateLicenseKeyBruteForce(rule, event);
        
        default:
          return 0;
      }
    } catch (error: any) {
      logger.error('Error evaluating fraud rule', { 
        rule: rule.name, 
        error: error.message 
      });
      return 0;
    }
  }

  /**
   * Check for rapid requests from same IP
   */
  private static async evaluateRapidRequests(rule: FraudDetectionRule, event: SecurityEvent): Promise<number> {
    const key = `${this.CACHE_PREFIX}requests:${event.ipAddress}`;
    const windowStart = Date.now() - (rule.timeWindow! * 60 * 1000);
    
    // Get recent requests
    const requests = (await redisCache.get(key) || []) as number[];
    const recentRequests = requests.filter((timestamp: number) => timestamp > windowStart);
    
    // Add current request
    recentRequests.push(Date.now());
    
    // Store updated list with TTL
    await redisCache.set(key, recentRequests, rule.timeWindow! * 60);
    
    // Calculate risk based on request frequency
    if (recentRequests.length > rule.threshold!) {
      const excessRequests = recentRequests.length - rule.threshold!;
      return Math.min(rule.riskWeight * (excessRequests / rule.threshold!), rule.riskWeight);
    }
    
    return 0;
  }

  /**
   * Check for multiple failed login attempts
   */
  private static async evaluateFailedLogins(rule: FraudDetectionRule, event: SecurityEvent): Promise<number> {
    if (event.action !== 'failed_login') return 0;
    
    const key = `${this.CACHE_PREFIX}failed_logins:${event.ipAddress}`;
    const windowStart = Date.now() - (rule.timeWindow! * 60 * 1000);
    
    const failedAttempts = (await redisCache.get(key) || []) as number[];
    const recentFailures = failedAttempts.filter((timestamp: number) => timestamp > windowStart);
    
    recentFailures.push(Date.now());
    await redisCache.set(key, recentFailures, rule.timeWindow! * 60);
    
    if (recentFailures.length > rule.threshold!) {
      return rule.riskWeight;
    }
    
    return 0;
  }

  /**
   * Detect suspicious user agents (bots, scrapers, etc.)
   */
  private static evaluateSuspiciousUserAgent(rule: FraudDetectionRule, event: SecurityEvent): number {
    const suspiciousPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i,
      /curl/i,
      /wget/i,
      /python-requests/i,
      /^$/,
      /unknown/i
    ];
    
    const userAgent = event.userAgent.toLowerCase();
    const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(userAgent));
    
    return isSuspicious ? rule.riskWeight : 0;
  }

  /**
   * Check for unusual license access patterns
   */
  private static async evaluateUnusualLicenseAccess(rule: FraudDetectionRule, event: SecurityEvent): Promise<number> {
    if (!event.action.includes('license_access')) return 0;
    
    const key = `${this.CACHE_PREFIX}license_access:${event.userId || event.ipAddress}`;
    const windowStart = Date.now() - (rule.timeWindow! * 60 * 1000);
    
    const accesses = (await redisCache.get(key) || []) as number[];
    const recentAccesses = accesses.filter((timestamp: number) => timestamp > windowStart);
    
    recentAccesses.push(Date.now());
    await redisCache.set(key, recentAccesses, rule.timeWindow! * 60);
    
    if (recentAccesses.length > rule.threshold!) {
      return rule.riskWeight;
    }
    
    return 0;
  }

  /**
   * Check for geolocation anomalies (simplified - would integrate with GeoIP service)
   */
  private static async evaluateGeolocationAnomaly(rule: FraudDetectionRule, event: SecurityEvent): Promise<number> {
    if (!event.userId) return 0;
    
    const key = `${this.CACHE_PREFIX}user_locations:${event.userId}`;
    const userLocations = await redisCache.get(key) || [];
    
    // For now, return 0 - would integrate with GeoIP service in production
    // This would check if the IP location significantly differs from user's typical locations
    return 0;
  }

  /**
   * Detect license key brute force attempts
   */
  private static async evaluateLicenseKeyBruteForce(rule: FraudDetectionRule, event: SecurityEvent): Promise<number> {
    if (event.action !== 'license_key_access' || !event.details.licenseKeyAttempt) return 0;
    
    const key = `${this.CACHE_PREFIX}license_brute:${event.ipAddress}`;
    const windowStart = Date.now() - (rule.timeWindow! * 60 * 1000);
    
    const attempts = (await redisCache.get(key) || []) as Array<{timestamp: number, licenseKey: string}>;
    const recentAttempts = attempts.filter((attempt: any) => attempt.timestamp > windowStart);
    
    // Track unique license keys attempted
    const uniqueKeys = new Set(recentAttempts.map((attempt: any) => attempt.licenseKey));
    const newKey = event.details.licenseKeyAttempt;
    
    if (!uniqueKeys.has(newKey)) {
      recentAttempts.push({
        timestamp: Date.now(),
        licenseKey: newKey
      });
      
      await redisCache.set(key, recentAttempts, rule.timeWindow! * 60);
      
      if (uniqueKeys.size + 1 > rule.threshold!) {
        return rule.riskWeight;
      }
    }
    
    return 0;
  }

  /**
   * Handle high-risk security events
   */
  private static async handleHighRiskEvent(event: SecurityEvent): Promise<void> {
    logger.warn('High-risk security event detected', {
      riskScore: event.riskScore,
      ipAddress: event.ipAddress,
      userId: event.userId,
      action: event.action,
      endpoint: event.endpoint
    });

    // Implement rate limiting for high-risk IPs
    if (event.riskScore >= this.HIGH_RISK_THRESHOLD) {
      const blockKey = `${this.CACHE_PREFIX}blocked_ip:${event.ipAddress}`;
      await redisCache.set(blockKey, {
        blockedAt: Date.now(),
        riskScore: event.riskScore,
        reason: 'High-risk fraud detection score'
      }, 3600); // Block for 1 hour
    }

    // Store high-risk event for admin review
    const alertKey = `${this.CACHE_PREFIX}alerts:${Date.now()}`;
    await redisCache.set(alertKey, event, 86400); // Keep for 24 hours
  }

  /**
   * Check if IP is currently blocked
   */
  static async isIPBlocked(ipAddress: string): Promise<boolean> {
    const blockKey = `${this.CACHE_PREFIX}blocked_ip:${ipAddress}`;
    const blockInfo = await redisCache.get(blockKey);
    return !!blockInfo;
  }

  /**
   * Log security event to audit trail
   */
  private static async logSecurityEvent(event: SecurityEvent): Promise<void> {
    const logKey = `${this.CACHE_PREFIX}events:${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    await redisCache.set(logKey, {
      ...event,
      timestamp: event.timestamp.toISOString()
    }, 604800); // Keep for 7 days

    // Also log to application logger
    logger.info('Security event analyzed', {
      action: event.action,
      riskScore: event.riskScore,
      ipAddress: event.ipAddress,
      userId: event.userId,
      endpoint: event.endpoint
    });
  }

  /**
   * Get security statistics for monitoring
   */
  static async getSecurityStats(): Promise<{
    totalEvents: number;
    highRiskEvents: number;
    blockedIPs: number;
    topRiskyActions: Array<{ action: string; count: number; avgRisk: number }>;
  }> {
    // This would query Redis for aggregated statistics
    // For now, return mock data structure
    return {
      totalEvents: 0,
      highRiskEvents: 0,
      blockedIPs: 0,
      topRiskyActions: []
    };
  }

  /**
   * Extract client IP from request (handles proxies)
   */
  private static getClientIP(req: Request): string {
    const forwarded = req.get('X-Forwarded-For');
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }
    
    return req.get('X-Real-IP') || 
           req.get('X-Client-IP') || 
           req.connection.remoteAddress || 
           req.ip || 
           'unknown';
  }
}

// Middleware for automatic fraud detection
export const fraudDetectionMiddleware = (action?: string) => {
  return async (req: any, res: any, next: any) => {
    try {
      // Skip fraud detection for health checks and static assets
      if (req.path.includes('/health') || req.path.includes('/static')) {
        return next();
      }

      const detectedAction = action || `${req.method.toLowerCase()}_${req.path.replace(/\//g, '_')}`;
      const event = await FraudDetectionSystem.analyzeSecurityEvent(req, detectedAction, {
        method: req.method,
        query: req.query,
        bodySize: JSON.stringify(req.body || {}).length
      });

      // Block if high risk
      if (event.riskScore >= 75) {
        return res.status(429).json({
          error: 'Request blocked due to suspicious activity',
          riskScore: event.riskScore
        });
      }

      // Add risk info to request for downstream use
      req.securityEvent = event;
      next();
    } catch (error: any) {
      logger.error('Fraud detection middleware error', { error: error.message });
      // Continue on error - don't break user experience
      next();
    }
  };
};