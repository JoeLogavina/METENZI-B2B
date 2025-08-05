// 🔐 SECURE DOWNLOAD SYSTEM (Step 4)
// One-time use download tokens with fraud protection

import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';
import { redisCache } from '../cache/redis';
import { FraudDetectionSystem } from './fraud-detection';
import { SecurityAuditSystem } from './audit-system';

export interface DownloadToken {
  token: string;
  resourceId: string;
  userId: string;
  resourceType: 'license' | 'software' | 'document' | 'activation';
  filename?: string;
  filesize?: number;
  checksumSHA256?: string;
  createdAt: Date;
  expiresAt: Date;
  maxDownloads: number;
  currentDownloads: number;
  ipWhitelist?: string[];
  userAgent?: string;
  metadata: Record<string, any>;
}

export interface DownloadAttempt {
  tokenId: string;
  userId: string;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  success: boolean;
  errorReason?: string;
  downloadedBytes?: number;
  duration?: number;
}

export class SecureDownloadSystem {
  private static readonly TOKEN_LENGTH = 64;
  private static readonly DEFAULT_EXPIRY = 15 * 60 * 1000; // 15 minutes
  private static readonly MAX_DOWNLOADS_DEFAULT = 1;
  private static readonly CACHE_PREFIX = 'secure_download:';
  private static readonly RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
  private static readonly RATE_LIMIT_MAX_ATTEMPTS = 5;

  // Generate secure one-time download token
  static async generateDownloadToken(
    resourceId: string,
    userId: string,
    options: {
      resourceType?: 'license' | 'software' | 'document' | 'activation';
      filename?: string;
      filesize?: number;
      checksumSHA256?: string;
      expiryMinutes?: number;
      maxDownloads?: number;
      ipWhitelist?: string[];
      userAgent?: string;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<DownloadToken> {
    try {
      const token = crypto.randomBytes(this.TOKEN_LENGTH / 2).toString('hex');
      const now = new Date();
      const expiryMs = (options.expiryMinutes || 15) * 60 * 1000;
      
      const downloadToken: DownloadToken = {
        token,
        resourceId,
        userId,
        resourceType: options.resourceType || 'license',
        filename: options.filename,
        filesize: options.filesize,
        checksumSHA256: options.checksumSHA256,
        createdAt: now,
        expiresAt: new Date(now.getTime() + expiryMs),
        maxDownloads: options.maxDownloads || this.MAX_DOWNLOADS_DEFAULT,
        currentDownloads: 0,
        ipWhitelist: options.ipWhitelist,
        userAgent: options.userAgent,
        metadata: options.metadata || {}
      };

      // Store in Redis with expiration
      const cacheKey = `${this.CACHE_PREFIX}token:${token}`;
      await redisCache.set(cacheKey, downloadToken, Math.ceil(expiryMs / 1000));

      // Track token generation for audit
      await SecurityAuditSystem.logEvent(
        'download',
        'token_generated',
        true,
        {
          userId,
          resourceId,
          resourceType: downloadToken.resourceType,
          expiresAt: downloadToken.expiresAt,
          ipAddress: options.userAgent ? 'server-generated' : undefined
        }
      );

      logger.info('Secure download token generated', {
        token: token.substring(0, 8) + '...',
        resourceId,
        userId,
        resourceType: downloadToken.resourceType,
        expiresAt: downloadToken.expiresAt
      });

      return downloadToken;
    } catch (error: any) {
      logger.error('Failed to generate download token', {
        error: error.message,
        resourceId,
        userId
      });
      throw new Error('Failed to generate secure download token');
    }
  }

  // Validate and consume download token
  static async validateDownloadToken(
    token: string,
    req: Request
  ): Promise<{
    valid: boolean;
    downloadToken?: DownloadToken;
    errorReason?: string;
  }> {
    try {
      // Rate limiting check
      const rateLimitResult = await this.checkRateLimit(req.ip);
      if (!rateLimitResult.allowed) {
        await this.logDownloadAttempt(token, 'unknown', req, false, 'rate_limit_exceeded');
        return { valid: false, errorReason: 'Too many download attempts. Please try again later.' };
      }

      const cacheKey = `${this.CACHE_PREFIX}token:${token}`;
      const downloadToken = await redisCache.get(cacheKey) as DownloadToken | null;

      if (!downloadToken) {
        await this.logDownloadAttempt(token, 'unknown', req, false, 'token_not_found');
        return { valid: false, errorReason: 'Download token not found or expired' };
      }

      // Check expiration
      if (new Date() > downloadToken.expiresAt) {
        await redisCache.del(cacheKey);
        await this.logDownloadAttempt(token, downloadToken.userId, req, false, 'token_expired');
        return { valid: false, errorReason: 'Download token has expired' };
      }

      // Check download limit
      if (downloadToken.currentDownloads >= downloadToken.maxDownloads) {
        await this.logDownloadAttempt(token, downloadToken.userId, req, false, 'download_limit_exceeded');
        return { valid: false, errorReason: 'Download limit exceeded' };
      }

      // Check IP whitelist if specified
      if (downloadToken.ipWhitelist && downloadToken.ipWhitelist.length > 0) {
        if (!downloadToken.ipWhitelist.includes(req.ip)) {
          await this.logDownloadAttempt(token, downloadToken.userId, req, false, 'ip_not_whitelisted');
          return { valid: false, errorReason: 'Access denied from this IP address' };
        }
      }

      // Check User-Agent if specified
      if (downloadToken.userAgent && req.get('User-Agent') !== downloadToken.userAgent) {
        await this.logDownloadAttempt(token, downloadToken.userId, req, false, 'user_agent_mismatch');
        return { valid: false, errorReason: 'Invalid request signature' };
      }

      // Fraud detection check
      const fraudAnalysis = await FraudDetectionSystem.analyzeSecurityEvent(
        req,
        'download_attempt',
        {
          resourceId: downloadToken.resourceId,
          resourceType: downloadToken.resourceType,
          userId: downloadToken.userId
        }
      );

      if (fraudAnalysis.riskScore > 70) {
        await this.logDownloadAttempt(token, downloadToken.userId, req, false, 'fraud_detection_triggered');
        logger.warn('High-risk download attempt blocked', {
          token: token.substring(0, 8) + '...',
          riskScore: fraudAnalysis.riskScore,
          userId: downloadToken.userId,
          ipAddress: req.ip
        });
        return { valid: false, errorReason: 'Download request flagged for security review' };
      }

      // Token is valid
      return { valid: true, downloadToken };

    } catch (error: any) {
      logger.error('Download token validation error', {
        error: error.message,
        token: token.substring(0, 8) + '...',
        ipAddress: req.ip
      });
      return { valid: false, errorReason: 'Token validation failed' };
    }
  }

  // Consume download token (mark as used)
  static async consumeDownloadToken(
    token: string,
    downloadedBytes: number = 0,
    duration: number = 0
  ): Promise<void> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}token:${token}`;
      const downloadToken = await redisCache.get(cacheKey) as DownloadToken | null;

      if (!downloadToken) {
        throw new Error('Download token not found');
      }

      // Increment download counter
      downloadToken.currentDownloads++;
      downloadToken.metadata.lastUsed = new Date();
      downloadToken.metadata.downloadedBytes = downloadedBytes;
      downloadToken.metadata.duration = duration;

      // Update or remove token based on download limits
      if (downloadToken.currentDownloads >= downloadToken.maxDownloads) {
        // Token exhausted, remove it
        await redisCache.del(cacheKey);
        logger.info('Download token consumed and removed', {
          token: token.substring(0, 8) + '...',
          userId: downloadToken.userId,
          resourceId: downloadToken.resourceId,
          totalDownloads: downloadToken.currentDownloads
        });
      } else {
        // Update token with new download count
        const remainingTTL = Math.ceil((downloadToken.expiresAt.getTime() - Date.now()) / 1000);
        await redisCache.set(cacheKey, downloadToken, remainingTTL);
        logger.info('Download token updated', {
          token: token.substring(0, 8) + '...',
          remaining: downloadToken.maxDownloads - downloadToken.currentDownloads
        });
      }

      // Log successful download
      await SecurityAuditSystem.logEvent(
        'download',
        'download_completed',
        true,
        {
          userId: downloadToken.userId,
          resourceId: downloadToken.resourceId,
          resourceType: downloadToken.resourceType,
          downloadedBytes,
          duration,
          downloadNumber: downloadToken.currentDownloads
        }
      );

    } catch (error: any) {
      logger.error('Failed to consume download token', {
        error: error.message,
        token: token.substring(0, 8) + '...'
      });
      throw error;
    }
  }

  // Rate limiting for download attempts
  private static async checkRateLimit(ipAddress: string): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: Date;
  }> {
    const rateLimitKey = `${this.CACHE_PREFIX}rate_limit:${ipAddress}`;
    const current = await redisCache.get(rateLimitKey) as number | null;
    const windowStart = Date.now() - this.RATE_LIMIT_WINDOW;

    if (current === null) {
      // First request in window
      await redisCache.set(rateLimitKey, 1, Math.ceil(this.RATE_LIMIT_WINDOW / 1000));
      return {
        allowed: true,
        remaining: this.RATE_LIMIT_MAX_ATTEMPTS - 1,
        resetTime: new Date(Date.now() + this.RATE_LIMIT_WINDOW)
      };
    }

    if (current >= this.RATE_LIMIT_MAX_ATTEMPTS) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: new Date(Date.now() + this.RATE_LIMIT_WINDOW)
      };
    }

    // Increment counter
    await redisCache.incr(rateLimitKey);
    
    return {
      allowed: true,
      remaining: this.RATE_LIMIT_MAX_ATTEMPTS - current - 1,
      resetTime: new Date(Date.now() + this.RATE_LIMIT_WINDOW)
    };
  }

  // Log download attempt for audit
  private static async logDownloadAttempt(
    tokenId: string,
    userId: string,
    req: Request,
    success: boolean,
    errorReason?: string,
    downloadedBytes?: number,
    duration?: number
  ): Promise<void> {
    const attempt: DownloadAttempt = {
      tokenId: tokenId.substring(0, 8) + '...',
      userId,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent') || 'unknown',
      timestamp: new Date(),
      success,
      errorReason,
      downloadedBytes,
      duration
    };

    await SecurityAuditSystem.logEvent(
      'download',
      success ? 'download_success' : 'download_failed',
      success,
      {
        ...attempt,
        path: req.path,
        method: req.method
      }
    );
  }

  // Middleware for protecting download routes
  static protectDownload() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const token = req.params.token || req.query.token;
        
        if (!token || typeof token !== 'string') {
          return res.status(400).json({ 
            error: 'MISSING_TOKEN',
            message: 'Download token is required' 
          });
        }

        const validation = await this.validateDownloadToken(token, req);
        
        if (!validation.valid) {
          return res.status(401).json({
            error: 'INVALID_TOKEN',
            message: validation.errorReason || 'Invalid download token'
          });
        }

        // Attach download token to request
        (req as any).downloadToken = validation.downloadToken;
        next();

      } catch (error: any) {
        logger.error('Download protection middleware error', {
          error: error.message,
          path: req.path,
          ip: req.ip
        });
        res.status(500).json({
          error: 'DOWNLOAD_PROTECTION_ERROR',
          message: 'Unable to validate download request'
        });
      }
    };
  }

  // Get download statistics
  static async getDownloadStats(timeRange: 'hour' | 'day' | 'week' = 'day'): Promise<{
    totalDownloads: number;
    successfulDownloads: number;
    failedDownloads: number;
    tokensGenerated: number;
    tokensConsumed: number;
    averageDownloadSize: number;
    topResourceTypes: Array<{ type: string; count: number }>;
    recentActivity: DownloadAttempt[];
  }> {
    // Simplified stats - in production would query audit system
    return {
      totalDownloads: 0,
      successfulDownloads: 0,
      failedDownloads: 0,
      tokensGenerated: 0,
      tokensConsumed: 0,
      averageDownloadSize: 0,
      topResourceTypes: [
        { type: 'license', count: 0 },
        { type: 'software', count: 0 },
        { type: 'document', count: 0 }
      ],
      recentActivity: []
    };
  }

  // Clean up expired tokens
  static async cleanupExpiredTokens(): Promise<number> {
    try {
      // Simplified cleanup - in production would use Redis SCAN
      let cleanedCount = 0;

      logger.info('Token cleanup completed', { cleanedCount });
      return cleanedCount;
    } catch (error: any) {
      logger.error('Token cleanup failed', { error: error.message });
      return 0;
    }
  }

  // Revoke download token
  static async revokeDownloadToken(token: string, reason: string): Promise<boolean> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}token:${token}`;
      const downloadToken = await redisCache.get(cacheKey) as DownloadToken | null;

      if (!downloadToken) {
        return false;
      }

      await redisCache.del(cacheKey);

      await SecurityAuditSystem.logEvent(
        'download',
        'token_revoked',
        true,
        {
          token: token.substring(0, 8) + '...',
          userId: downloadToken.userId,
          resourceId: downloadToken.resourceId,
          reason
        }
      );

      logger.info('Download token revoked', {
        token: token.substring(0, 8) + '...',
        reason,
        userId: downloadToken.userId
      });

      return true;
    } catch (error: any) {
      logger.error('Failed to revoke download token', {
        error: error.message,
        token: token.substring(0, 8) + '...'
      });
      return false;
    }
  }
}