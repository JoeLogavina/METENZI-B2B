// 🔐 PHASE 2: ENHANCED TOKEN MANAGEMENT WITH REDIS PERSISTENCE
// Secure token storage, validation, and lifecycle management

import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { redisCache } from '../cache/redis';
import { logger } from '../lib/logger';
import { db } from '../db';
import { users } from '../../shared/schema';
import { eq } from 'drizzle-orm';

// Token types for different authentication contexts
export enum TokenType {
  SESSION = 'session',
  API = 'api',
  REFRESH = 'refresh',
  CSRF = 'csrf',
  ADMIN = 'admin',
  B2B = 'b2b'
}

// Token metadata structure
export interface TokenMetadata {
  userId: string;
  type: TokenType;
  scope: string[];
  tenantId?: string;
  deviceId?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: number;
  expiresAt: number;
  lastUsed?: number;
  permissions?: string[];
}

// Token validation result
export interface TokenValidationResult {
  isValid: boolean;
  metadata?: TokenMetadata;
  error?: string;
  needsRefresh?: boolean;
}

// Security token configuration
export interface TokenConfig {
  secret: string;
  expirationMinutes: number;
  refreshThresholdMinutes: number;
  maxConcurrentTokens: number;
  requireDeviceFingerprint: boolean;
}

export class EnhancedTokenManager {
  private static readonly TOKEN_PREFIX = 'token:';
  private static readonly USER_TOKENS_PREFIX = 'user_tokens:';
  private static readonly BLACKLIST_PREFIX = 'blacklist:';
  private static readonly TOKEN_STATS_PREFIX = 'token_stats:';
  
  // Default configurations for different token types
  private static readonly TOKEN_CONFIGS: Record<TokenType, TokenConfig> = {
    [TokenType.SESSION]: {
      secret: process.env.SESSION_SECRET || 'session-secret',
      expirationMinutes: 60 * 24, // 24 hours
      refreshThresholdMinutes: 60, // Refresh when 1 hour left
      maxConcurrentTokens: 5,
      requireDeviceFingerprint: true
    },
    [TokenType.API]: {
      secret: process.env.API_TOKEN_SECRET || 'api-secret',
      expirationMinutes: 60 * 24 * 7, // 7 days
      refreshThresholdMinutes: 60 * 24, // Refresh when 1 day left
      maxConcurrentTokens: 10,
      requireDeviceFingerprint: false
    },
    [TokenType.REFRESH]: {
      secret: process.env.REFRESH_TOKEN_SECRET || 'refresh-secret',
      expirationMinutes: 60 * 24 * 30, // 30 days
      refreshThresholdMinutes: 60 * 24 * 7, // Refresh when 7 days left
      maxConcurrentTokens: 3,
      requireDeviceFingerprint: true
    },
    [TokenType.CSRF]: {
      secret: process.env.CSRF_SECRET || 'csrf-secret',
      expirationMinutes: 60, // 1 hour
      refreshThresholdMinutes: 15, // Refresh when 15 minutes left
      maxConcurrentTokens: 1,
      requireDeviceFingerprint: false
    },
    [TokenType.ADMIN]: {
      secret: process.env.ADMIN_TOKEN_SECRET || 'admin-secret',
      expirationMinutes: 60 * 2, // 2 hours
      refreshThresholdMinutes: 30, // Refresh when 30 minutes left
      maxConcurrentTokens: 2,
      requireDeviceFingerprint: true
    },
    [TokenType.B2B]: {
      secret: process.env.B2B_TOKEN_SECRET || 'b2b-secret',
      expirationMinutes: 60 * 8, // 8 hours
      refreshThresholdMinutes: 60, // Refresh when 1 hour left
      maxConcurrentTokens: 3,
      requireDeviceFingerprint: true
    }
  };

  /**
   * Generate a secure token with metadata storage in Redis
   */
  static async generateToken(
    userId: string,
    type: TokenType,
    scope: string[] = [],
    options: {
      tenantId?: string;
      deviceId?: string;
      ipAddress?: string;
      userAgent?: string;
      permissions?: string[];
    } = {}
  ): Promise<{ token: string; metadata: TokenMetadata }> {
    try {
      // Validate required parameters
      if (!userId || userId.trim() === '') {
        throw new Error('User ID is required for token generation');
      }
      const config = this.TOKEN_CONFIGS[type];
      const now = Date.now();
      const expiresAt = now + (config.expirationMinutes * 60 * 1000);
      
      // Generate unique token ID
      const tokenId = this.generateTokenId();
      
      // Create token metadata
      const metadata: TokenMetadata = {
        userId,
        type,
        scope,
        tenantId: options.tenantId,
        deviceId: options.deviceId || this.generateDeviceFingerprint(options.userAgent, options.ipAddress),
        ipAddress: options.ipAddress,
        userAgent: options.userAgent,
        createdAt: now,
        expiresAt,
        permissions: options.permissions || []
      };

      // Check concurrent token limits
      await this.enforceTokenLimits(userId, type, config.maxConcurrentTokens);

      // Create JWT payload
      const payload = {
        jti: tokenId,
        sub: userId,
        type,
        scope,
        tenant: options.tenantId,
        device: metadata.deviceId,
        iat: Math.floor(now / 1000),
        exp: Math.floor(expiresAt / 1000)
      };

      // Sign the token
      const token = jwt.sign(payload, config.secret, {
        algorithm: 'HS256',
        issuer: 'b2b-platform',
        audience: 'b2b-users'
      });

      // Store metadata in Redis
      const tokenKey = `${this.TOKEN_PREFIX}${tokenId}`;
      const ttlSeconds = Math.floor(config.expirationMinutes * 60);
      
      await Promise.all([
        // Store token metadata
        redisCache.set(tokenKey, metadata, ttlSeconds),
        // Add to user's token list
        this.addToUserTokenList(userId, tokenId, type, ttlSeconds),
        // Update token statistics
        this.updateTokenStats(userId, type, 'created')
      ]);

      logger.info('Token generated successfully', {
        userId,
        type,
        tokenId: tokenId.substring(0, 8) + '...',
        expiresAt: new Date(expiresAt).toISOString(),
        environment: process.env.NODE_ENV,
        category: 'security'
      });

      return { token, metadata };
    } catch (error) {
      logger.error('Token generation failed', {
        userId,
        type,
        error: error instanceof Error ? error.message : 'Unknown error',
        environment: process.env.NODE_ENV,
        category: 'security'
      });
      throw new Error('Failed to generate secure token');
    }
  }

  /**
   * Validate token and return metadata
   */
  static async validateToken(token: string, expectedType?: TokenType): Promise<TokenValidationResult> {
    try {
      // First decode without verification to get token ID
      const decoded = jwt.decode(token) as any;
      if (!decoded || !decoded.jti) {
        return { isValid: false, error: 'Invalid token format' };
      }

      const tokenId = decoded.jti;
      const type = decoded.type as TokenType;
      const config = this.TOKEN_CONFIGS[type];

      if (!config) {
        return { isValid: false, error: 'Unknown token type' };
      }

      if (expectedType && type !== expectedType) {
        return { isValid: false, error: 'Token type mismatch' };
      }

      // Check if token is blacklisted
      const isBlacklisted = await redisCache.exists(`${this.BLACKLIST_PREFIX}${tokenId}`);
      if (isBlacklisted) {
        return { isValid: false, error: 'Token has been revoked' };
      }

      // Verify JWT signature
      let payload: any;
      try {
        payload = jwt.verify(token, config.secret, {
          algorithms: ['HS256'],
          issuer: 'b2b-platform',
          audience: 'b2b-users'
        });
      } catch (jwtError) {
        return { isValid: false, error: 'Token signature invalid' };
      }

      // Get metadata from Redis
      const tokenKey = `${this.TOKEN_PREFIX}${tokenId}`;
      const metadata = await redisCache.get<TokenMetadata>(tokenKey);

      if (!metadata) {
        return { isValid: false, error: 'Token metadata not found' };
      }

      // Check expiration
      const now = Date.now();
      if (now > metadata.expiresAt) {
        return { isValid: false, error: 'Token has expired' };
      }

      // Update last used timestamp
      metadata.lastUsed = now;
      const remainingTtl = Math.floor((metadata.expiresAt - now) / 1000);
      await redisCache.set(tokenKey, metadata, remainingTtl);

      // Check if token needs refresh
      const needsRefresh = (metadata.expiresAt - now) < (config.refreshThresholdMinutes * 60 * 1000);

      // Update token statistics
      await this.updateTokenStats(metadata.userId, type, 'validated');

      logger.debug('Token validated successfully', {
        userId: metadata.userId,
        type,
        tokenId: tokenId.substring(0, 8) + '...',
        needsRefresh,
        environment: process.env.NODE_ENV,
        category: 'security'
      });

      return { isValid: true, metadata, needsRefresh };
    } catch (error) {
      logger.error('Token validation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        environment: process.env.NODE_ENV,
        category: 'security'
      });
      return { isValid: false, error: 'Token validation error' };
    }
  }

  /**
   * Revoke a specific token
   */
  static async revokeToken(token: string): Promise<boolean> {
    try {
      const decoded = jwt.decode(token) as any;
      if (!decoded || !decoded.jti) {
        return false;
      }

      const tokenId = decoded.jti;
      const userId = decoded.sub;
      const type = decoded.type as TokenType;

      // Add to blacklist
      const ttl = Math.max(0, decoded.exp - Math.floor(Date.now() / 1000));
      await redisCache.set(`${this.BLACKLIST_PREFIX}${tokenId}`, true, ttl);

      // Remove from user's token list
      await this.removeFromUserTokenList(userId, tokenId);

      // Update statistics
      await this.updateTokenStats(userId, type, 'revoked');

      logger.info('Token revoked successfully', {
        userId,
        type,
        tokenId: tokenId.substring(0, 8) + '...',
        environment: process.env.NODE_ENV,
        category: 'security'
      });

      return true;
    } catch (error) {
      logger.error('Token revocation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        environment: process.env.NODE_ENV,
        category: 'security'
      });
      return false;
    }
  }

  /**
   * Revoke all tokens for a user
   */
  static async revokeAllUserTokens(userId: string, excludeTokenId?: string): Promise<number> {
    try {
      const userTokensKey = `${this.USER_TOKENS_PREFIX}${userId}`;
      const tokenList = await redisCache.get<string[]>(userTokensKey) || [];
      
      let revokedCount = 0;
      const promises = tokenList
        .filter(tokenId => tokenId !== excludeTokenId)
        .map(async (tokenId) => {
          const tokenKey = `${this.TOKEN_PREFIX}${tokenId}`;
          const metadata = await redisCache.get<TokenMetadata>(tokenKey);
          
          if (metadata) {
            const ttl = Math.max(0, Math.floor((metadata.expiresAt - Date.now()) / 1000));
            await redisCache.set(`${this.BLACKLIST_PREFIX}${tokenId}`, true, ttl);
            revokedCount++;
          }
        });

      await Promise.all(promises);

      // Clear user's token list
      if (excludeTokenId) {
        await redisCache.set(userTokensKey, [excludeTokenId], 60 * 60 * 24);
      } else {
        await redisCache.del(userTokensKey);
      }

      logger.info('All user tokens revoked', {
        userId,
        revokedCount,
        environment: process.env.NODE_ENV,
        category: 'security'
      });

      return revokedCount;
    } catch (error) {
      logger.error('Failed to revoke all user tokens', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        environment: process.env.NODE_ENV,
        category: 'security'
      });
      return 0;
    }
  }

  /**
   * Get token statistics for monitoring
   */
  static async getTokenStats(userId?: string): Promise<any> {
    try {
      const statsKey = userId ? `${this.TOKEN_STATS_PREFIX}${userId}` : `${this.TOKEN_STATS_PREFIX}global`;
      const stats = await redisCache.get(statsKey) || {};
      
      return {
        ...stats,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Failed to get token statistics', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        environment: process.env.NODE_ENV
      });
      return {};
    }
  }

  /**
   * Cleanup expired tokens (maintenance function)
   */
  static async cleanupExpiredTokens(): Promise<number> {
    try {
      // This is automatically handled by Redis TTL, but we can do additional cleanup
      const pattern = `${this.TOKEN_PREFIX}*`;
      // Redis will automatically expire keys, so this is mainly for logging
      
      logger.info('Token cleanup completed', {
        environment: process.env.NODE_ENV,
        category: 'maintenance'
      });

      return 0;
    } catch (error) {
      logger.error('Token cleanup failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        environment: process.env.NODE_ENV
      });
      return 0;
    }
  }

  // Private helper methods
  private static generateTokenId(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private static generateDeviceFingerprint(userAgent?: string, ipAddress?: string): string {
    const components = [
      userAgent || 'unknown',
      ipAddress || 'unknown',
      Date.now().toString()
    ];
    return crypto.createHash('sha256').update(components.join('|')).digest('hex').substring(0, 16);
  }

  private static async enforceTokenLimits(userId: string, type: TokenType, maxTokens: number): Promise<void> {
    const userTokensKey = `${this.USER_TOKENS_PREFIX}${userId}`;
    const tokenList = await redisCache.get<string[]>(userTokensKey) || [];
    
    if (tokenList.length >= maxTokens) {
      // Remove oldest tokens
      const tokensToRemove = tokenList.slice(0, tokenList.length - maxTokens + 1);
      for (const tokenId of tokensToRemove) {
        await redisCache.del(`${this.TOKEN_PREFIX}${tokenId}`);
      }
      
      // Update user token list
      const remainingTokens = tokenList.slice(tokensToRemove.length);
      await redisCache.set(userTokensKey, remainingTokens, 60 * 60 * 24);
    }
  }

  private static async addToUserTokenList(userId: string, tokenId: string, type: TokenType, ttl: number): Promise<void> {
    const userTokensKey = `${this.USER_TOKENS_PREFIX}${userId}`;
    const tokenList = await redisCache.get<string[]>(userTokensKey) || [];
    tokenList.push(tokenId);
    await redisCache.set(userTokensKey, tokenList, ttl);
  }

  private static async removeFromUserTokenList(userId: string, tokenId: string): Promise<void> {
    const userTokensKey = `${this.USER_TOKENS_PREFIX}${userId}`;
    const tokenList = await redisCache.get<string[]>(userTokensKey) || [];
    const updatedList = tokenList.filter(id => id !== tokenId);
    
    if (updatedList.length > 0) {
      await redisCache.set(userTokensKey, updatedList, 60 * 60 * 24);
    } else {
      await redisCache.del(userTokensKey);
    }
  }

  private static async updateTokenStats(userId: string, type: TokenType, action: 'created' | 'validated' | 'revoked'): Promise<void> {
    try {
      const statsKey = `${this.TOKEN_STATS_PREFIX}${userId}`;
      const stats = await redisCache.get<any>(statsKey) || {};
      
      const typeKey = type.toString();
      if (!stats[typeKey]) {
        stats[typeKey] = { created: 0, validated: 0, revoked: 0 };
      }
      
      stats[typeKey][action]++;
      stats.lastActivity = Date.now();
      
      await redisCache.set(statsKey, stats, 60 * 60 * 24 * 7); // 7 days
    } catch (error) {
      // Non-critical, don't throw
      logger.debug('Failed to update token statistics', { error: error.message });
    }
  }
}

/**
 * Express middleware for token-based authentication
 */
export function authenticateToken(expectedType?: TokenType, requiredPermissions?: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Extract token from various sources
      const token = extractTokenFromRequest(req);
      
      if (!token) {
        return res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Authentication token required'
        });
      }

      // Validate token
      const validation = await EnhancedTokenManager.validateToken(token, expectedType);
      
      if (!validation.isValid) {
        return res.status(401).json({
          error: 'UNAUTHORIZED',
          message: validation.error || 'Invalid authentication token'
        });
      }

      // Check permissions if required
      if (requiredPermissions && requiredPermissions.length > 0) {
        const userPermissions = validation.metadata?.permissions || [];
        const hasPermission = requiredPermissions.some(perm => userPermissions.includes(perm));
        
        if (!hasPermission) {
          return res.status(403).json({
            error: 'FORBIDDEN',
            message: 'Insufficient permissions'
          });
        }
      }

      // Add token info to request
      req.user = { 
        id: validation.metadata!.userId,
        tokenType: validation.metadata!.type,
        tenantId: validation.metadata!.tenantId,
        permissions: validation.metadata!.permissions || []
      };

      // Add refresh warning header if needed
      if (validation.needsRefresh) {
        res.setHeader('X-Token-Refresh-Needed', 'true');
      }

      next();
    } catch (error) {
      logger.error('Token authentication middleware error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        environment: process.env.NODE_ENV,
        category: 'security'
      });
      
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Authentication processing error'
      });
    }
  };
}

/**
 * Extract token from request headers, cookies, or query params
 */
function extractTokenFromRequest(req: Request): string | null {
  // Check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Check cookies
  if (req.cookies && req.cookies.authToken) {
    return req.cookies.authToken;
  }

  // Check query parameter (less secure, use with caution)
  if (req.query.token && typeof req.query.token === 'string') {
    return req.query.token;
  }

  return null;
}