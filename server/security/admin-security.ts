// 👑 ADMIN SECURITY FEATURES
// Phase 3 Implementation - Enhanced administrative security controls

import { Request, Response, NextFunction } from 'express';
import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import { logger } from '../lib/logger';
import { redisCache } from '../cache/redis';
import { EnhancedTokenManager } from './token-manager';
import { FraudDetectionSystem } from './fraud-detection';

export interface AdminSession {
  userId: string;
  sessionId: string;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
  lastActivity: Date;
  permissions: string[];
  mfaVerified: boolean;
  riskScore: number;
}

export interface TwoFactorSecret {
  secret: string;
  qrCode: string;
  backupCodes: string[];
  enabled: boolean;
  createdAt: Date;
}

export class AdminSecurityManager {
  private static readonly CACHE_PREFIX = 'admin_security:';
  private static readonly SESSION_TIMEOUT = 3600; // 1 hour
  private static readonly MFA_WINDOW = 300; // 5 minutes for MFA verification
  private static readonly MAX_CONCURRENT_SESSIONS = 3;

  /**
   * Generate 2FA secret for admin user
   */
  static async generateTwoFactorSecret(userId: string, userEmail: string): Promise<TwoFactorSecret> {
    const secret = speakeasy.generateSecret({
      name: `B2B License Portal (${userEmail})`,
      issuer: 'B2B License Management',
      length: 32
    });

    // Generate backup codes
    const backupCodes = Array.from({ length: 10 }, () => 
      Math.random().toString(36).substr(2, 8).toUpperCase()
    );

    // Generate QR code
    const qrCode = await qrcode.toDataURL(secret.otpauth_url!);

    const twoFactorData: TwoFactorSecret = {
      secret: secret.base32,
      qrCode,
      backupCodes,
      enabled: false,
      createdAt: new Date()
    };

    // Store temporarily (not enabled until verified)
    const key = `${this.CACHE_PREFIX}2fa_setup:${userId}`;
    await redisCache.set(key, twoFactorData, 900); // 15 minutes to complete setup

    logger.info('2FA secret generated for admin', { userId });

    return twoFactorData;
  }

  /**
   * Verify and enable 2FA for admin user
   */
  static async enableTwoFactor(userId: string, token: string): Promise<boolean> {
    const setupKey = `${this.CACHE_PREFIX}2fa_setup:${userId}`;
    const setupData = await redisCache.get(setupKey) as TwoFactorSecret | null;

    if (!setupData) {
      throw new Error('2FA setup session expired');
    }

    // Verify the token
    const verified = speakeasy.totp.verify({
      secret: setupData.secret,
      encoding: 'base32',
      token,
      window: 2
    });

    if (!verified) {
      logger.warn('Failed 2FA verification during setup', { userId });
      return false;
    }

    // Enable 2FA
    setupData.enabled = true;
    const enabledKey = `${this.CACHE_PREFIX}2fa_enabled:${userId}`;
    await redisCache.set(enabledKey, setupData, 0); // Permanent

    // Clean up setup session  
    await redisCache.del(setupKey);

    logger.info('2FA enabled for admin user', { userId });
    return true;
  }

  /**
   * Verify 2FA token for admin login
   */
  static async verifyTwoFactor(userId: string, token: string): Promise<boolean> {
    const key = `${this.CACHE_PREFIX}2fa_enabled:${userId}`;
    const twoFactorData = await redisCache.get(key) as TwoFactorSecret | null;

    if (!twoFactorData || !twoFactorData.enabled) {
      return false; // 2FA not enabled
    }

    // Check if it's a backup code
    if (twoFactorData.backupCodes.includes(token.toUpperCase())) {
      // Remove used backup code
      twoFactorData.backupCodes = twoFactorData.backupCodes.filter(
        (code: string) => code !== token.toUpperCase()
      );
      await redisCache.set(key, twoFactorData, 0);
      
      logger.info('2FA backup code used', { userId });
      return true;
    }

    // Verify TOTP token
    const verified = speakeasy.totp.verify({
      secret: twoFactorData.secret,
      encoding: 'base32',
      token,
      window: 2
    });

    if (verified) {
      logger.info('2FA token verified', { userId });
    } else {
      logger.warn('Invalid 2FA token attempt', { userId });
    }

    return verified;
  }

  /**
   * Create secure admin session with enhanced tracking
   */
  static async createAdminSession(req: Request, userId: string, permissions: string[]): Promise<AdminSession> {
    const sessionId = Math.random().toString(36).substr(2, 16) + Date.now().toString(36);
    const ipAddress = this.getClientIP(req);
    const userAgent = req.get('User-Agent') || 'unknown';

    // Check concurrent session limit
    await this.enforceSessionLimit(userId);

    // Analyze security risk
    const securityEvent = await FraudDetectionSystem.analyzeSecurityEvent(
      req, 
      'admin_login', 
      { permissions }
    );

    const session: AdminSession = {
      userId,
      sessionId,
      ipAddress,
      userAgent,
      createdAt: new Date(),
      lastActivity: new Date(),
      permissions,
      mfaVerified: false,
      riskScore: securityEvent.riskScore
    };

    // Store session
    const key = `${this.CACHE_PREFIX}session:${sessionId}`;
    await redisCache.set(key, session, this.SESSION_TIMEOUT);

    // Track user sessions
    const userSessionsKey = `${this.CACHE_PREFIX}user_sessions:${userId}`;
    const userSessions = (await redisCache.get(userSessionsKey) || []) as string[];
    userSessions.push(sessionId);
    await redisCache.set(userSessionsKey, userSessions, this.SESSION_TIMEOUT);

    logger.info('Admin session created', {
      userId,
      sessionId: sessionId.substring(0, 8) + '...',
      ipAddress,
      riskScore: session.riskScore
    });

    return session;
  }

  /**
   * Validate and refresh admin session
   */
  static async validateAdminSession(sessionId: string, req: Request): Promise<AdminSession | null> {
    const key = `${this.CACHE_PREFIX}session:${sessionId}`;
    const session = await redisCache.get(key) as AdminSession | null;

    if (!session) {
      return null;
    }

    // Verify IP and User-Agent consistency
    const currentIP = this.getClientIP(req);
    const currentUA = req.get('User-Agent') || 'unknown';

    if (session.ipAddress !== currentIP || session.userAgent !== currentUA) {
      logger.warn('Session hijacking attempt detected', {
        sessionId: sessionId.substring(0, 8) + '...',
        originalIP: session.ipAddress,
        currentIP,
        originalUA: session.userAgent.substring(0, 50),
        currentUA: currentUA.substring(0, 50)
      });

      // Invalidate suspicious session
      await this.invalidateSession(sessionId);
      return null;
    }

    // Update last activity
    session.lastActivity = new Date();
    await redisCache.set(key, session, this.SESSION_TIMEOUT);

    return session;
  }

  /**
   * Mark session as MFA verified
   */
  static async markMFAVerified(sessionId: string): Promise<void> {
    const key = `${this.CACHE_PREFIX}session:${sessionId}`;
    const session = await redisCache.get(key) as AdminSession | null;

    if (session) {
      session.mfaVerified = true;
      await redisCache.set(key, session, this.SESSION_TIMEOUT);
    }
  }

  /**
   * Check if admin action requires MFA verification
   */
  static requiresMFA(action: string): boolean {
    const mfaRequiredActions = [
      'delete_user',
      'modify_permissions',
      'system_settings',
      'security_config',
      'bulk_operations',
      'financial_operations'
    ];

    return mfaRequiredActions.includes(action);
  }

  /**
   * Enforce maximum concurrent sessions per user
   */
  private static async enforceSessionLimit(userId: string): Promise<void> {
    const userSessionsKey = `${this.CACHE_PREFIX}user_sessions:${userId}`;
    const userSessions = (await redisCache.get(userSessionsKey) || []) as string[];

    if (userSessions.length >= this.MAX_CONCURRENT_SESSIONS) {
      // Remove oldest session
      const oldestSession = userSessions.shift();
      if (oldestSession) {
        await this.invalidateSession(oldestSession);
      }
      
      logger.info('Oldest admin session terminated due to limit', {
        userId,
        terminatedSession: oldestSession?.substring(0, 8) + '...'
      });
    }
  }

  /**
   * Invalidate admin session
   */
  static async invalidateSession(sessionId: string): Promise<void> {
    const key = `${this.CACHE_PREFIX}session:${sessionId}`;
    const session = await redisCache.get(key) as AdminSession | null;

    if (session) {
      // Remove from user sessions list
      const userSessionsKey = `${this.CACHE_PREFIX}user_sessions:${session.userId}`;
      const userSessions = (await redisCache.get(userSessionsKey) || []) as string[];
      const filteredSessions = userSessions.filter((id: string) => id !== sessionId);
      await redisCache.set(userSessionsKey, filteredSessions, this.SESSION_TIMEOUT);

      // Delete session
      await redisCache.del(key);

      logger.info('Admin session invalidated', {
        sessionId: sessionId.substring(0, 8) + '...',
        userId: session.userId
      });
    }
  }

  /**
   * Get admin security dashboard data
   */
  static async getSecurityDashboard(userId: string): Promise<{
    activeSessions: number;
    recentLogins: Array<{ timestamp: Date; ipAddress: string; success: boolean }>;
    mfaEnabled: boolean;
    riskScore: number;
    securityAlerts: number;
  }> {
    const userSessionsKey = `${this.CACHE_PREFIX}user_sessions:${userId}`;
    const activeSessions = (await redisCache.get(userSessionsKey) || []) as string[];

    const mfaKey = `${this.CACHE_PREFIX}2fa_enabled:${userId}`;
    const mfaData = await redisCache.get(mfaKey) as TwoFactorSecret | null;

    // This would query actual login history in production
    return {
      activeSessions: activeSessions.length,
      recentLogins: [],
      mfaEnabled: !!(mfaData && mfaData.enabled),
      riskScore: 0,
      securityAlerts: 0
    };
  }

  /**
   * Generate new backup codes for 2FA
   */
  static async generateNewBackupCodes(userId: string): Promise<string[]> {
    const key = `${this.CACHE_PREFIX}2fa_enabled:${userId}`;
    const twoFactorData = await redisCache.get(key) as TwoFactorSecret | null;

    if (!twoFactorData || !twoFactorData.enabled) {
      throw new Error('2FA not enabled for user');
    }

    // Generate new backup codes
    const newBackupCodes = Array.from({ length: 10 }, () => 
      Math.random().toString(36).substr(2, 8).toUpperCase()
    );

    twoFactorData.backupCodes = newBackupCodes;
    await redisCache.set(key, twoFactorData, 0);

    logger.info('New 2FA backup codes generated', { userId });

    return newBackupCodes;
  }

  /**
   * Disable 2FA for admin user (emergency)
   */
  static async disableTwoFactor(userId: string, adminUserId: string): Promise<void> {
    const key = `${this.CACHE_PREFIX}2fa_enabled:${userId}`;
    await redisCache.del(key);

    logger.warn('2FA disabled for admin user', {
      targetUserId: userId,
      disabledByAdmin: adminUserId
    });
  }

  /**
   * Extract client IP from request
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

// Middleware for admin authentication with enhanced security
export const requireAdminAuth = (requiredPermissions: string[] = [], requireMFA = false) => {
  return async (req: any, res: Response, next: NextFunction) => {
    try {
      const sessionId = req.headers['x-admin-session'] || req.cookies?.adminSession;
      
      if (!sessionId) {
        return res.status(401).json({ error: 'Admin authentication required' });
      }

      const session = await AdminSecurityManager.validateAdminSession(sessionId, req);
      
      if (!session) {
        return res.status(401).json({ error: 'Invalid or expired admin session' });
      }

      // Check permissions
      if (requiredPermissions.length > 0) {
        const hasPermission = requiredPermissions.every(permission => 
          session.permissions.includes(permission)
        );
        
        if (!hasPermission) {
          return res.status(403).json({ error: 'Insufficient admin permissions' });
        }
      }

      // Check MFA requirement
      if (requireMFA && !session.mfaVerified) {
        return res.status(403).json({ 
          error: 'MFA verification required for this action',
          requiresMFA: true 
        });
      }

      // Check risk score
      if (session.riskScore > 75) {
        return res.status(403).json({ 
          error: 'Action blocked due to high security risk',
          riskScore: session.riskScore 
        });
      }

      req.adminSession = session;
      next();
    } catch (error: any) {
      logger.error('Admin authentication middleware error', { error: error.message });
      res.status(500).json({ error: 'Authentication system error' });
    }
  };
};

// Middleware to require MFA for sensitive actions
export const requireMFA = (action: string) => {
  return async (req: any, res: Response, next: NextFunction) => {
    if (!AdminSecurityManager.requiresMFA(action)) {
      return next();
    }

    const session = req.adminSession;
    if (!session || !session.mfaVerified) {
      return res.status(403).json({
        error: 'MFA verification required for this action',
        action,
        requiresMFA: true
      });
    }

    next();
  };
};