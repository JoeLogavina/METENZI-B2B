// 🔐 ADVANCED AUTHENTICATION & AUTHORIZATION SYSTEM (Step 5)
// Enterprise-grade user management with role-based access control and permissions

import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';
import { redisCache } from '../cache/redis';
import { SecurityAuditSystem } from './audit-system';
import { FraudDetectionSystem } from './fraud-detection';

export interface UserPermission {
  id: string;
  resource: string;
  action: string;
  conditions?: Record<string, any>;
  scope?: 'global' | 'tenant' | 'user';
}

export interface Role {
  id: string;
  name: string;
  displayName: string;
  description: string;
  permissions: UserPermission[];
  isSystemRole: boolean;
  tenantId?: string;
  metadata: Record<string, any>;
}

export interface UserSession {
  sessionId: string;
  userId: string;
  tenantId: string;
  role: string;
  permissions: string[];
  deviceFingerprint: string;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
  lastActivity: Date;
  expiresAt: Date;
  mfaVerified: boolean;
  riskScore: number;
}

export interface AuthenticationResult {
  success: boolean;
  user?: {
    id: string;
    username: string;
    email: string;
    role: string;
    tenantId: string;
    permissions: string[];
  };
  session?: UserSession;
  requiresMFA?: boolean;
  mfaToken?: string;
  errorReason?: string;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
}

export class AdvancedAuthSystem {
  private static readonly SESSION_PREFIX = 'auth_session:';
  private static readonly MFA_PREFIX = 'mfa_challenge:';
  private static readonly PERMISSION_CACHE_PREFIX = 'permissions:';
  private static readonly FAILED_ATTEMPTS_PREFIX = 'failed_auth:';
  
  private static readonly SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours
  private static readonly MFA_DURATION = 10 * 60 * 1000; // 10 minutes
  private static readonly MAX_FAILED_ATTEMPTS = 5;
  private static readonly LOCKOUT_DURATION = 30 * 60 * 1000; // 30 minutes

  // Enhanced user authentication with fraud detection
  static async authenticateUser(
    username: string,
    password: string,
    req: Request
  ): Promise<AuthenticationResult> {
    try {
      const startTime = Date.now();

      // Check for account lockout
      const lockoutCheck = await this.checkAccountLockout(username, req.ip);
      if (lockoutCheck.isLocked) {
        await SecurityAuditSystem.logEvent(
          'auth',
          'authentication_blocked',
          false,
          {
            username,
            reason: 'account_locked',
            ipAddress: req.ip,
            lockoutExpires: lockoutCheck.expiresAt
          }
        );

        return {
          success: false,
          errorReason: `Account locked until ${lockoutCheck.expiresAt?.toLocaleString()}`,
          riskLevel: 'high'
        };
      }

      // Fraud detection analysis
      const fraudAnalysis = await FraudDetectionSystem.analyzeSecurityEvent(
        req,
        'authentication_attempt',
        { username, timestamp: Date.now() }
      );

      if (fraudAnalysis.riskScore > 80) {
        await this.recordFailedAttempt(username, req.ip, 'fraud_detection');
        
        return {
          success: false,
          errorReason: 'Authentication request flagged for security review',
          riskLevel: 'critical'
        };
      }

      // Retrieve user from database (simplified for this implementation)
      const user = await this.getUserByUsername(username);
      if (!user) {
        await this.recordFailedAttempt(username, req.ip, 'user_not_found');
        
        return {
          success: false,
          errorReason: 'Invalid credentials',
          riskLevel: 'medium'
        };
      }

      // Verify password
      const passwordValid = await bcrypt.compare(password, user.passwordHash);
      if (!passwordValid) {
        await this.recordFailedAttempt(username, req.ip, 'invalid_password');
        
        return {
          success: false,
          errorReason: 'Invalid credentials',
          riskLevel: 'medium'
        };
      }

      // Check if user requires MFA
      const requiresMFA = user.mfaEnabled && !user.mfaBypass;
      if (requiresMFA) {
        const mfaToken = await this.generateMFAChallenge(user.id, req);
        
        await SecurityAuditSystem.logEvent(
          'auth',
          'mfa_challenge_sent',
          true,
          {
            userId: user.id,
            username: user.username,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
          }
        );

        return {
          success: false,
          requiresMFA: true,
          mfaToken,
          riskLevel: fraudAnalysis.riskScore > 50 ? 'medium' : 'low'
        };
      }

      // Create user session
      const session = await this.createUserSession(user, req, fraudAnalysis.riskScore);
      
      // Clear failed attempts
      await this.clearFailedAttempts(username, req.ip);

      // Log successful authentication
      await SecurityAuditSystem.logEvent(
        'auth',
        'authentication_success',
        true,
        {
          userId: user.id,
          username: user.username,
          sessionId: session.sessionId,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          duration: Date.now() - startTime,
          riskScore: fraudAnalysis.riskScore
        }
      );

      logger.info('User authenticated successfully', {
        userId: user.id,
        username: user.username,
        sessionId: session.sessionId,
        riskScore: fraudAnalysis.riskScore
      });

      return {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          tenantId: user.tenantId,
          permissions: await this.getUserPermissions(user.id, user.role, user.tenantId)
        },
        session,
        riskLevel: fraudAnalysis.riskScore > 50 ? 'medium' : 'low'
      };

    } catch (error: any) {
      logger.error('Authentication system error', {
        error: error.message,
        username,
        ipAddress: req.ip
      });

      await SecurityAuditSystem.logEvent(
        'auth',
        'authentication_error',
        false,
        {
          username,
          error: error.message,
          ipAddress: req.ip
        }
      );

      return {
        success: false,
        errorReason: 'Authentication system temporarily unavailable',
        riskLevel: 'high'
      };
    }
  }

  // Verify MFA token
  static async verifyMFA(
    mfaToken: string,
    totpCode: string,
    req: Request
  ): Promise<AuthenticationResult> {
    try {
      const mfaCacheKey = `${this.MFA_PREFIX}${mfaToken}`;
      const mfaData = await redisCache.get(mfaCacheKey);

      if (!mfaData) {
        return {
          success: false,
          errorReason: 'MFA challenge expired or invalid',
          riskLevel: 'medium'
        };
      }

      const user = await this.getUserById(mfaData.userId);
      if (!user) {
        return {
          success: false,
          errorReason: 'User not found',
          riskLevel: 'high'
        };
      }

      // Verify TOTP code
      const verified = speakeasy.totp.verify({
        secret: user.mfaSecret,
        encoding: 'base32',
        token: totpCode,
        window: 2 // Allow 2 time steps variance
      });

      if (!verified) {
        await SecurityAuditSystem.logEvent(
          'auth',
          'mfa_verification_failed',
          false,
          {
            userId: user.id,
            username: user.username,
            ipAddress: req.ip,
            mfaToken
          }
        );

        return {
          success: false,
          errorReason: 'Invalid MFA code',
          riskLevel: 'medium'
        };
      }

      // Remove MFA challenge
      await redisCache.del(mfaCacheKey);

      // Create authenticated session
      const session = await this.createUserSession(user, req, mfaData.riskScore || 0);

      await SecurityAuditSystem.logEvent(
        'auth',
        'mfa_verification_success',
        true,
        {
          userId: user.id,
          username: user.username,
          sessionId: session.sessionId,
          ipAddress: req.ip
        }
      );

      return {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          tenantId: user.tenantId,
          permissions: await this.getUserPermissions(user.id, user.role, user.tenantId)
        },
        session,
        riskLevel: 'low'
      };

    } catch (error: any) {
      logger.error('MFA verification error', {
        error: error.message,
        mfaToken,
        ipAddress: req.ip
      });

      return {
        success: false,
        errorReason: 'MFA verification failed',
        riskLevel: 'high'
      };
    }
  }

  // Create and manage user sessions
  static async createUserSession(
    user: any,
    req: Request,
    riskScore: number = 0
  ): Promise<UserSession> {
    const sessionId = crypto.randomBytes(32).toString('hex');
    const deviceFingerprint = this.generateDeviceFingerprint(req);
    const now = new Date();

    const session: UserSession = {
      sessionId,
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
      permissions: await this.getUserPermissions(user.id, user.role, user.tenantId),
      deviceFingerprint,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent') || 'unknown',
      createdAt: now,
      lastActivity: now,
      expiresAt: new Date(now.getTime() + this.SESSION_DURATION),
      mfaVerified: true,
      riskScore
    };

    // Store session in Redis
    const sessionKey = `${this.SESSION_PREFIX}${sessionId}`;
    await redisCache.set(sessionKey, session, Math.ceil(this.SESSION_DURATION / 1000));

    // Track active sessions for user
    await this.trackUserSession(user.id, sessionId);

    return session;
  }

  // Validate user session and permissions
  static async validateSession(sessionId: string, requiredPermission?: string): Promise<{
    valid: boolean;
    session?: UserSession;
    reason?: string;
  }> {
    try {
      const sessionKey = `${this.SESSION_PREFIX}${sessionId}`;
      const session = await redisCache.get(sessionKey) as UserSession | null;

      if (!session) {
        return { valid: false, reason: 'Session not found' };
      }

      if (new Date() > session.expiresAt) {
        await redisCache.del(sessionKey);
        return { valid: false, reason: 'Session expired' };
      }

      // Check permission if required
      if (requiredPermission && !session.permissions.includes(requiredPermission)) {
        return { valid: false, reason: 'Insufficient permissions' };
      }

      // Update last activity
      session.lastActivity = new Date();
      await redisCache.set(sessionKey, session, Math.ceil(this.SESSION_DURATION / 1000));

      return { valid: true, session };

    } catch (error: any) {
      logger.error('Session validation error', {
        error: error.message,
        sessionId: sessionId.substring(0, 8) + '...'
      });
      return { valid: false, reason: 'Session validation failed' };
    }
  }

  // Permission management system
  static async getUserPermissions(
    userId: string,
    userRole: string,
    tenantId: string
  ): Promise<string[]> {
    try {
      const cacheKey = `${this.PERMISSION_CACHE_PREFIX}${userId}:${userRole}:${tenantId}`;
      const cached = await redisCache.get(cacheKey);

      if (cached) {
        return cached as string[];
      }

      // Get role-based permissions
      const rolePermissions = await this.getRolePermissions(userRole, tenantId);
      
      // Get user-specific permissions
      const userPermissions = await this.getUserSpecificPermissions(userId);

      // Combine and deduplicate permissions
      const allPermissions = [...new Set([...rolePermissions, ...userPermissions])];

      // Cache permissions for 30 minutes
      await redisCache.set(cacheKey, allPermissions, 1800);

      return allPermissions;

    } catch (error: any) {
      logger.error('Failed to get user permissions', {
        error: error.message,
        userId,
        userRole,
        tenantId
      });
      return [];
    }
  }

  // Enhanced middleware for route protection
  static requirePermission(permission: string, options: {
    allowSuperAdmin?: boolean;
    tenantSpecific?: boolean;
    logAccess?: boolean;
  } = {}) {
    return async (req: any, res: Response, next: NextFunction) => {
      try {
        const sessionId = req.headers['x-session-id'] || req.session?.id;
        
        if (!sessionId) {
          return res.status(401).json({
            error: 'SESSION_REQUIRED',
            message: 'Valid session required'
          });
        }

        const validation = await this.validateSession(sessionId, permission);
        
        if (!validation.valid) {
          await SecurityAuditSystem.logEvent(
            'auth',
            'authorization_failed',
            false,
            {
              sessionId: sessionId.substring(0, 8) + '...',
              requiredPermission: permission,
              reason: validation.reason,
              ipAddress: req.ip,
              path: req.path
            }
          );

          return res.status(403).json({
            error: 'INSUFFICIENT_PERMISSIONS',
            message: validation.reason || 'Access denied'
          });
        }

        const session = validation.session!;

        // Super admin bypass
        if (options.allowSuperAdmin && session.role === 'super_admin') {
          req.user = { id: session.userId, role: session.role, tenantId: session.tenantId };
          req.session = session;
          return next();
        }

        // Tenant-specific check
        if (options.tenantSpecific) {
          const requestTenant = req.params.tenantId || req.query.tenantId || req.body.tenantId;
          if (requestTenant && requestTenant !== session.tenantId && session.role !== 'super_admin') {
            return res.status(403).json({
              error: 'TENANT_MISMATCH',
              message: 'Access denied for this tenant'
            });
          }
        }

        // Log access if enabled
        if (options.logAccess) {
          await SecurityAuditSystem.logEvent(
            'auth',
            'resource_accessed',
            true,
            {
              userId: session.userId,
              permission,
              path: req.path,
              method: req.method,
              ipAddress: req.ip
            }
          );
        }

        req.user = { id: session.userId, role: session.role, tenantId: session.tenantId };
        req.session = session;
        next();

      } catch (error: any) {
        logger.error('Permission middleware error', {
          error: error.message,
          permission,
          path: req.path
        });

        res.status(500).json({
          error: 'AUTHORIZATION_ERROR',
          message: 'Authorization system error'
        });
      }
    };
  }

  // Account lockout management
  private static async checkAccountLockout(username: string, ipAddress: string): Promise<{
    isLocked: boolean;
    expiresAt?: Date;
    attemptsRemaining?: number;
  }> {
    const lockoutKey = `${this.FAILED_ATTEMPTS_PREFIX}${username}:${ipAddress}`;
    const attempts = await redisCache.get(lockoutKey) as any;

    if (!attempts) {
      return { isLocked: false, attemptsRemaining: this.MAX_FAILED_ATTEMPTS };
    }

    if (attempts.count >= this.MAX_FAILED_ATTEMPTS) {
      const lockoutExpires = new Date(attempts.lockedUntil);
      if (new Date() < lockoutExpires) {
        return { isLocked: true, expiresAt: lockoutExpires };
      } else {
        // Lockout expired, clear attempts
        await redisCache.del(lockoutKey);
        return { isLocked: false, attemptsRemaining: this.MAX_FAILED_ATTEMPTS };
      }
    }

    return {
      isLocked: false,
      attemptsRemaining: this.MAX_FAILED_ATTEMPTS - attempts.count
    };
  }

  private static async recordFailedAttempt(
    username: string,
    ipAddress: string,
    reason: string
  ): Promise<void> {
    const lockoutKey = `${this.FAILED_ATTEMPTS_PREFIX}${username}:${ipAddress}`;
    const attempts = await redisCache.get(lockoutKey) as any || { count: 0 };

    attempts.count++;
    attempts.lastAttempt = new Date();
    attempts.reason = reason;

    if (attempts.count >= this.MAX_FAILED_ATTEMPTS) {
      attempts.lockedUntil = Date.now() + this.LOCKOUT_DURATION;
    }

    await redisCache.set(lockoutKey, attempts, Math.ceil(this.LOCKOUT_DURATION / 1000));

    await SecurityAuditSystem.logEvent(
      'auth',
      'failed_attempt_recorded',
      false,
      {
        username,
        ipAddress,
        reason,
        attemptCount: attempts.count,
        isLocked: attempts.count >= this.MAX_FAILED_ATTEMPTS
      }
    );
  }

  private static async clearFailedAttempts(username: string, ipAddress: string): Promise<void> {
    const lockoutKey = `${this.FAILED_ATTEMPTS_PREFIX}${username}:${ipAddress}`;
    await redisCache.del(lockoutKey);
  }

  private static async generateMFAChallenge(userId: string, req: Request): Promise<string> {
    const mfaToken = crypto.randomBytes(16).toString('hex');
    const mfaData = {
      userId,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.MFA_DURATION)
    };

    const mfaCacheKey = `${this.MFA_PREFIX}${mfaToken}`;
    await redisCache.set(mfaCacheKey, mfaData, Math.ceil(this.MFA_DURATION / 1000));

    return mfaToken;
  }

  private static generateDeviceFingerprint(req: Request): string {
    const components = [
      req.get('User-Agent') || '',
      req.get('Accept-Language') || '',
      req.get('Accept-Encoding') || '',
      req.ip
    ].join('|');

    return crypto.createHash('sha256').update(components).digest('hex').substring(0, 16);
  }

  private static async trackUserSession(userId: string, sessionId: string): Promise<void> {
    const userSessionsKey = `user_sessions:${userId}`;
    const sessions = await redisCache.get(userSessionsKey) as string[] || [];
    
    sessions.push(sessionId);
    
    // Keep only last 10 sessions
    if (sessions.length > 10) {
      sessions.splice(0, sessions.length - 10);
    }

    await redisCache.set(userSessionsKey, sessions, 86400); // 24 hours
  }

  // Helper methods for database operations (simplified)
  private static async getUserByUsername(username: string): Promise<any> {
    // This would typically query the database
    // For now, return a mock user for testing
    return {
      id: 'test-user-id',
      username,
      email: `${username}@company.com`,
      passwordHash: await bcrypt.hash('password123', 10),
      role: 'admin',
      tenantId: 'eur',
      mfaEnabled: false,
      mfaSecret: '',
      mfaBypass: false
    };
  }

  private static async getUserById(userId: string): Promise<any> {
    // This would typically query the database
    return this.getUserByUsername('admin');
  }

  private static async getRolePermissions(role: string, tenantId: string): Promise<string[]> {
    // This would typically query the database for role permissions
    const rolePermissions: Record<string, string[]> = {
      'super_admin': ['*'], // All permissions
      'admin': [
        'users:read', 'users:write', 'users:delete',
        'products:read', 'products:write', 'products:delete',
        'orders:read', 'orders:write', 'orders:cancel',
        'reports:read', 'system:configure'
      ],
      'b2b_user': [
        'products:read', 'orders:read', 'orders:create',
        'wallet:read', 'profile:read', 'profile:write'
      ],
      'user': [
        'products:read', 'orders:read', 'profile:read'
      ]
    };

    return rolePermissions[role] || [];
  }

  private static async getUserSpecificPermissions(userId: string): Promise<string[]> {
    // This would typically query the database for user-specific permissions
    return [];
  }
}