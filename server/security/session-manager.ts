// 🔐 REDIS-BASED SESSION MANAGEMENT
// Enhanced session storage with Redis backend and security features

import { Request, Response, NextFunction } from 'express';
import { SessionData, Store } from 'express-session';
import { redisCache } from '../cache/redis';
import { logger } from '../lib/logger';
import crypto from 'crypto';

// Extended session data interface
export interface EnhancedSessionData extends SessionData {
  userId?: string;
  tenantId?: string;
  role?: string;
  permissions?: string[];
  deviceFingerprint?: string;
  ipAddress?: string;
  userAgent?: string;
  loginTimestamp?: number;
  lastActivity?: number;
  csrfToken?: string;
  securityContext?: {
    loginAttempts?: number;
    lastFailedAttempt?: number;
    accountLocked?: boolean;
    requiresTwoFactor?: boolean;
    twoFactorVerified?: boolean;
  };
}

// Session security configuration
export interface SessionSecurityConfig {
  maxAge: number; // Session lifetime in milliseconds
  rolling: boolean; // Extend session on activity
  secure: boolean; // HTTPS only
  httpOnly: boolean; // No client-side access
  sameSite: 'strict' | 'lax' | 'none';
  maxConcurrentSessions: number;
  requireDeviceFingerprint: boolean;
  trackIpChanges: boolean;
  enableSecurityLogging: boolean;
}

/**
 * Redis-based session store with enhanced security features
 */
export class RedisSessionStore extends Store {
  private static readonly SESSION_PREFIX = 'session:';
  private static readonly USER_SESSIONS_PREFIX = 'user_sessions:';
  private static readonly SECURITY_LOG_PREFIX = 'session_security:';
  
  private config: SessionSecurityConfig;

  constructor(config: Partial<SessionSecurityConfig> = {}) {
    super();
    
    this.config = {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours default
      rolling: true,
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'strict',
      maxConcurrentSessions: 5,
      requireDeviceFingerprint: true,
      trackIpChanges: true,
      enableSecurityLogging: true,
      ...config
    };

    logger.info('Redis session store initialized', {
      config: this.config,
      environment: process.env.NODE_ENV,
      category: 'security'
    });
  }

  /**
   * Get session data from Redis
   */
  async get(sessionId: string, callback: (err?: any, session?: SessionData | null) => void): Promise<void> {
    try {
      const sessionKey = `${RedisSessionStore.SESSION_PREFIX}${sessionId}`;
      const sessionData = await redisCache.get<EnhancedSessionData>(sessionKey);
      
      if (!sessionData) {
        return callback(null, null);
      }

      // Check session expiration
      const now = Date.now();
      if (sessionData.cookie && sessionData.cookie.expires && new Date(sessionData.cookie.expires).getTime() < now) {
        await this.destroy(sessionId, () => {});
        return callback(null, null);
      }

      // Update last activity if rolling sessions are enabled
      if (this.config.rolling && sessionData.lastActivity) {
        sessionData.lastActivity = now;
        const ttl = Math.floor(this.config.maxAge / 1000);
        await redisCache.set(sessionKey, sessionData, ttl);
      }

      callback(null, sessionData);
    } catch (error) {
      logger.error('Session retrieval failed', {
        sessionId: sessionId.substring(0, 8) + '...',
        error: error instanceof Error ? error.message : 'Unknown error',
        environment: process.env.NODE_ENV,
        category: 'security'
      });
      callback(error);
    }
  }

  /**
   * Store session data in Redis
   */
  async set(sessionId: string, session: SessionData, callback?: (err?: any) => void): Promise<void> {
    try {
      const enhancedSession = session as EnhancedSessionData;
      const now = Date.now();
      
      // Add security metadata
      if (!enhancedSession.lastActivity) {
        enhancedSession.lastActivity = now;
      }
      
      if (!enhancedSession.loginTimestamp && enhancedSession.userId) {
        enhancedSession.loginTimestamp = now;
      }

      // Enforce concurrent session limits
      if (enhancedSession.userId) {
        await this.enforceSessionLimits(enhancedSession.userId, sessionId);
      }

      // Store session with TTL
      const sessionKey = `${RedisSessionStore.SESSION_PREFIX}${sessionId}`;
      const ttl = Math.floor(this.config.maxAge / 1000);
      
      await Promise.all([
        redisCache.set(sessionKey, enhancedSession, ttl),
        this.updateUserSessionList(enhancedSession.userId, sessionId, ttl)
      ]);

      // Security logging
      if (this.config.enableSecurityLogging && enhancedSession.userId) {
        await this.logSecurityEvent(enhancedSession.userId, 'session_created', {
          sessionId: sessionId.substring(0, 8) + '...',
          ipAddress: enhancedSession.ipAddress,
          userAgent: enhancedSession.userAgent
        });
      }

      if (callback) callback();
    } catch (error) {
      logger.error('Session storage failed', {
        sessionId: sessionId.substring(0, 8) + '...',
        error: error instanceof Error ? error.message : 'Unknown error',
        environment: process.env.NODE_ENV,
        category: 'security'
      });
      if (callback) callback(error);
    }
  }

  /**
   * Destroy session in Redis
   */
  async destroy(sessionId: string, callback?: (err?: any) => void): Promise<void> {
    try {
      const sessionKey = `${RedisSessionStore.SESSION_PREFIX}${sessionId}`;
      
      // Get session data for logging before deletion
      const sessionData = await redisCache.get<EnhancedSessionData>(sessionKey);
      
      // Remove from Redis
      await redisCache.del(sessionKey);
      
      // Remove from user's session list
      if (sessionData?.userId) {
        await this.removeFromUserSessionList(sessionData.userId, sessionId);
        
        // Security logging
        if (this.config.enableSecurityLogging) {
          await this.logSecurityEvent(sessionData.userId, 'session_destroyed', {
            sessionId: sessionId.substring(0, 8) + '...',
            reason: 'explicit_logout'
          });
        }
      }

      if (callback) callback();
    } catch (error) {
      logger.error('Session destruction failed', {
        sessionId: sessionId.substring(0, 8) + '...',
        error: error instanceof Error ? error.message : 'Unknown error',
        environment: process.env.NODE_ENV,
        category: 'security'
      });
      if (callback) callback(error);
    }
  }

  /**
   * Touch session to extend expiration
   */
  async touch(sessionId: string, session: SessionData, callback?: (err?: any) => void): Promise<void> {
    try {
      const enhancedSession = session as EnhancedSessionData;
      enhancedSession.lastActivity = Date.now();
      
      const sessionKey = `${RedisSessionStore.SESSION_PREFIX}${sessionId}`;
      const ttl = Math.floor(this.config.maxAge / 1000);
      
      await redisCache.set(sessionKey, enhancedSession, ttl);
      
      if (callback) callback();
    } catch (error) {
      logger.error('Session touch failed', {
        sessionId: sessionId.substring(0, 8) + '...',
        error: error instanceof Error ? error.message : 'Unknown error',
        environment: process.env.NODE_ENV
      });
      if (callback) callback(error);
    }
  }

  /**
   * Get all session IDs (used for cleanup)
   */
  async all(callback: (err?: any, obj?: SessionData[] | { [sid: string]: SessionData } | null) => void): Promise<void> {
    try {
      // This is expensive - mainly for debugging/monitoring
      const pattern = `${RedisSessionStore.SESSION_PREFIX}*`;
      // Note: In production, consider implementing pagination
      callback(null, {});
    } catch (error) {
      callback(error);
    }
  }

  /**
   * Clear all sessions
   */
  async clear(callback?: (err?: any) => void): Promise<void> {
    try {
      const pattern = `${RedisSessionStore.SESSION_PREFIX}*`;
      await redisCache.invalidatePattern(pattern);
      
      logger.info('All sessions cleared', {
        environment: process.env.NODE_ENV,
        category: 'security'
      });
      
      if (callback) callback();
    } catch (error) {
      logger.error('Session clear failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        environment: process.env.NODE_ENV
      });
      if (callback) callback(error);
    }
  }

  /**
   * Get session count
   */
  async length(callback: (err?: any, length?: number) => void): Promise<void> {
    try {
      // This is approximated since Redis doesn't have an efficient way to count keys
      callback(null, 0);
    } catch (error) {
      callback(error);
    }
  }

  /**
   * Destroy all sessions for a specific user
   */
  async destroyUserSessions(userId: string, excludeSessionId?: string): Promise<number> {
    try {
      const userSessionsKey = `${RedisSessionStore.USER_SESSIONS_PREFIX}${userId}`;
      const sessionList = await redisCache.get<string[]>(userSessionsKey) || [];
      
      let destroyedCount = 0;
      const promises = sessionList
        .filter(sessionId => sessionId !== excludeSessionId)
        .map(async (sessionId) => {
          const sessionKey = `${RedisSessionStore.SESSION_PREFIX}${sessionId}`;
          await redisCache.del(sessionKey);
          destroyedCount++;
        });

      await Promise.all(promises);

      // Update user session list
      if (excludeSessionId) {
        await redisCache.set(userSessionsKey, [excludeSessionId], Math.floor(this.config.maxAge / 1000));
      } else {
        await redisCache.del(userSessionsKey);
      }

      // Security logging
      if (this.config.enableSecurityLogging) {
        await this.logSecurityEvent(userId, 'all_sessions_destroyed', {
          count: destroyedCount,
          excludedSession: excludeSessionId?.substring(0, 8) + '...'
        });
      }

      logger.info('User sessions destroyed', {
        userId,
        destroyedCount,
        environment: process.env.NODE_ENV,
        category: 'security'
      });

      return destroyedCount;
    } catch (error) {
      logger.error('Failed to destroy user sessions', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        environment: process.env.NODE_ENV
      });
      return 0;
    }
  }

  /**
   * Get active sessions for a user
   */
  async getUserSessions(userId: string): Promise<EnhancedSessionData[]> {
    try {
      const userSessionsKey = `${RedisSessionStore.USER_SESSIONS_PREFIX}${userId}`;
      const sessionList = await redisCache.get<string[]>(userSessionsKey) || [];
      
      const sessions: EnhancedSessionData[] = [];
      const promises = sessionList.map(async (sessionId) => {
        const sessionKey = `${RedisSessionStore.SESSION_PREFIX}${sessionId}`;
        const session = await redisCache.get<EnhancedSessionData>(sessionKey);
        if (session) {
          sessions.push(session);
        }
      });

      await Promise.all(promises);
      return sessions;
    } catch (error) {
      logger.error('Failed to get user sessions', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        environment: process.env.NODE_ENV
      });
      return [];
    }
  }

  // Private helper methods
  private async enforceSessionLimits(userId: string, currentSessionId: string): Promise<void> {
    const userSessionsKey = `${RedisSessionStore.USER_SESSIONS_PREFIX}${userId}`;
    const sessionList = await redisCache.get<string[]>(userSessionsKey) || [];
    
    if (sessionList.length >= this.config.maxConcurrentSessions) {
      // Remove oldest sessions
      const sessionsToRemove = sessionList.slice(0, sessionList.length - this.config.maxConcurrentSessions + 1);
      
      for (const sessionId of sessionsToRemove) {
        const sessionKey = `${RedisSessionStore.SESSION_PREFIX}${sessionId}`;
        await redisCache.del(sessionKey);
      }
      
      // Security logging
      if (this.config.enableSecurityLogging) {
        await this.logSecurityEvent(userId, 'sessions_limit_enforced', {
          removedCount: sessionsToRemove.length,
          currentSession: currentSessionId.substring(0, 8) + '...'
        });
      }
    }
  }

  private async updateUserSessionList(userId: string | undefined, sessionId: string, ttl: number): Promise<void> {
    if (!userId) return;
    
    const userSessionsKey = `${RedisSessionStore.USER_SESSIONS_PREFIX}${userId}`;
    const sessionList = await redisCache.get<string[]>(userSessionsKey) || [];
    
    // Add new session if not already present
    if (!sessionList.includes(sessionId)) {
      sessionList.push(sessionId);
    }
    
    await redisCache.set(userSessionsKey, sessionList, ttl);
  }

  private async removeFromUserSessionList(userId: string, sessionId: string): Promise<void> {
    const userSessionsKey = `${RedisSessionStore.USER_SESSIONS_PREFIX}${userId}`;
    const sessionList = await redisCache.get<string[]>(userSessionsKey) || [];
    const updatedList = sessionList.filter(id => id !== sessionId);
    
    if (updatedList.length > 0) {
      await redisCache.set(userSessionsKey, updatedList, Math.floor(this.config.maxAge / 1000));
    } else {
      await redisCache.del(userSessionsKey);
    }
  }

  private async logSecurityEvent(userId: string, event: string, data: any): Promise<void> {
    try {
      const logKey = `${RedisSessionStore.SECURITY_LOG_PREFIX}${userId}:${Date.now()}`;
      const logEntry = {
        userId,
        event,
        data,
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV
      };
      
      // Store security log with 30-day retention
      await redisCache.set(logKey, logEntry, 30 * 24 * 60 * 60);
    } catch (error) {
      // Non-critical, don't throw
      logger.debug('Failed to log security event', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }
}

/**
 * Security middleware for session validation
 */
export function validateSessionSecurity() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const session = req.session as EnhancedSessionData;
      
      if (!session || !session.userId) {
        return next();
      }

      const now = Date.now();
      let securityWarnings: string[] = [];

      // Check for IP address changes
      const currentIp = req.ip || req.connection.remoteAddress;
      if (session.ipAddress && session.ipAddress !== currentIp) {
        securityWarnings.push('IP address changed');
        
        // Update session with new IP
        session.ipAddress = currentIp;
      }

      // Check for user agent changes
      const currentUserAgent = req.headers['user-agent'];
      if (session.userAgent && session.userAgent !== currentUserAgent) {
        securityWarnings.push('User agent changed');
      }

      // Check for suspicious session patterns
      if (session.lastActivity && (now - session.lastActivity) > 12 * 60 * 60 * 1000) {
        securityWarnings.push('Long inactive session');
      }

      // Generate new CSRF token if needed
      if (!session.csrfToken) {
        session.csrfToken = crypto.randomBytes(32).toString('hex');
      }

      // Log security warnings
      if (securityWarnings.length > 0) {
        logger.warn('Session security warnings', {
          userId: session.userId,
          warnings: securityWarnings,
          currentIp,
          sessionId: req.sessionID?.substring(0, 8) + '...',
          environment: process.env.NODE_ENV,
          category: 'security'
        });
      }

      // Update session activity
      session.lastActivity = now;

      next();
    } catch (error) {
      logger.error('Session security validation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        environment: process.env.NODE_ENV,
        category: 'security'
      });
      next();
    }
  };
}

/**
 * Create device fingerprint for session tracking
 */
export function generateDeviceFingerprint(req: Request): string {
  const components = [
    req.headers['user-agent'] || 'unknown',
    req.headers['accept-language'] || 'unknown',
    req.headers['accept-encoding'] || 'unknown',
    req.ip || req.connection.remoteAddress || 'unknown'
  ];
  
  return crypto.createHash('sha256').update(components.join('|')).digest('hex').substring(0, 32);
}