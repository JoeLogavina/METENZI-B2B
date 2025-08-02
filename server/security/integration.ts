// 🔗 SECURITY INTEGRATION LAYER
// Phase 2: Integrating Enhanced Token Management with existing authentication

import { Express, Request, Response, NextFunction } from 'express';
import session from 'express-session';
import { RedisSessionStore, EnhancedSessionData, validateSessionSecurity } from './session-manager';
import { EnhancedTokenManager, TokenType, authenticateToken } from './token-manager';
import { logger } from '../lib/logger';

/**
 * Initialize the enhanced security layer with existing authentication
 */
export function initializeSecurityIntegration(app: Express): void {
  try {
    logger.info('Initializing enhanced security integration', {
      environment: process.env.NODE_ENV,
      category: 'security'
    });

    // Setup Redis-based session store
    const redisSessionStore = new RedisSessionStore({
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      rolling: true,
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'strict',
      maxConcurrentSessions: 5,
      requireDeviceFingerprint: true,
      trackIpChanges: true,
      enableSecurityLogging: true
    });

    // Configure session middleware with Redis store
    const sessionConfig: session.SessionOptions = {
      store: redisSessionStore,
      secret: process.env.SESSION_SECRET || 'fallback-secret',
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      }
    };

    // Apply session middleware
    app.use(session(sessionConfig));

    // Add session security validation
    app.use(validateSessionSecurity());

    // Token refresh endpoint
    app.post('/api/auth/refresh-token', async (req: Request, res: Response) => {
      try {
        const { refreshToken } = req.body;
        
        if (!refreshToken) {
          return res.status(400).json({
            error: 'BAD_REQUEST',
            message: 'Refresh token required'
          });
        }

        // Validate refresh token
        const validation = await EnhancedTokenManager.validateToken(refreshToken, TokenType.REFRESH);
        
        if (!validation.isValid) {
          return res.status(401).json({
            error: 'UNAUTHORIZED',
            message: 'Invalid refresh token'
          });
        }

        // Generate new session token
        const session = req.session as EnhancedSessionData;
        const newTokenResult = await EnhancedTokenManager.generateToken(
          validation.metadata!.userId,
          TokenType.SESSION,
          ['read', 'write'],
          {
            tenantId: validation.metadata!.tenantId,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            permissions: validation.metadata!.permissions
          }
        );

        // Update session with new token info
        session.userId = validation.metadata!.userId;
        session.tenantId = validation.metadata!.tenantId;
        session.lastActivity = Date.now();

        res.json({
          token: newTokenResult.token,
          expiresAt: new Date(newTokenResult.metadata.expiresAt).toISOString(),
          type: TokenType.SESSION
        });

        logger.info('Token refreshed successfully', {
          userId: validation.metadata!.userId,
          environment: process.env.NODE_ENV,
          category: 'security'
        });

      } catch (error) {
        logger.error('Token refresh failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
          environment: process.env.NODE_ENV,
          category: 'security'
        });

        res.status(500).json({
          error: 'INTERNAL_ERROR',
          message: 'Token refresh processing error'
        });
      }
    });

    // Token validation endpoint
    app.post('/api/auth/validate-token', async (req: Request, res: Response) => {
      try {
        const { token, expectedType } = req.body;
        
        if (!token) {
          return res.status(400).json({
            error: 'BAD_REQUEST',
            message: 'Token required for validation'
          });
        }

        const validation = await EnhancedTokenManager.validateToken(
          token,
          expectedType ? expectedType as TokenType : undefined
        );

        res.json({
          isValid: validation.isValid,
          needsRefresh: validation.needsRefresh,
          error: validation.error,
          metadata: validation.isValid ? {
            userId: validation.metadata!.userId,
            type: validation.metadata!.type,
            tenantId: validation.metadata!.tenantId,
            expiresAt: new Date(validation.metadata!.expiresAt).toISOString(),
            permissions: validation.metadata!.permissions
          } : undefined
        });

      } catch (error) {
        logger.error('Token validation endpoint failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
          environment: process.env.NODE_ENV,
          category: 'security'
        });

        res.status(500).json({
          error: 'INTERNAL_ERROR',
          message: 'Token validation processing error'
        });
      }
    });

    // Token revocation endpoint
    app.post('/api/auth/revoke-token', authenticateToken(), async (req: Request, res: Response) => {
      try {
        const { token, revokeAll } = req.body;
        const user = req.user as any;

        if (revokeAll) {
          // Revoke all user tokens
          const revokedCount = await EnhancedTokenManager.revokeAllUserTokens(user.id);
          
          res.json({
            message: 'All tokens revoked successfully',
            revokedCount
          });
        } else if (token) {
          // Revoke specific token
          const revoked = await EnhancedTokenManager.revokeToken(token);
          
          if (revoked) {
            res.json({ message: 'Token revoked successfully' });
          } else {
            res.status(400).json({
              error: 'BAD_REQUEST',
              message: 'Failed to revoke token'
            });
          }
        } else {
          res.status(400).json({
            error: 'BAD_REQUEST',
            message: 'Token required for revocation'
          });
        }

      } catch (error) {
        logger.error('Token revocation failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
          environment: process.env.NODE_ENV,
          category: 'security'
        });

        res.status(500).json({
          error: 'INTERNAL_ERROR',
          message: 'Token revocation processing error'
        });
      }
    });

    // Security statistics endpoint (admin only)
    app.get('/api/admin/security/stats', authenticateToken(TokenType.ADMIN, ['admin:read']), async (req: Request, res: Response) => {
      try {
        const user = req.user as any;
        const { userId } = req.query;

        const stats = await EnhancedTokenManager.getTokenStats(userId as string);
        
        res.json({
          data: stats,
          requestedBy: user.id,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        logger.error('Security statistics retrieval failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
          environment: process.env.NODE_ENV,
          category: 'security'
        });

        res.status(500).json({
          error: 'INTERNAL_ERROR',
          message: 'Failed to retrieve security statistics'
        });
      }
    });

    // Session management endpoints
    app.get('/api/auth/sessions', authenticateToken(), async (req: Request, res: Response) => {
      try {
        const user = req.user as any;
        const sessions = await redisSessionStore.getUserSessions(user.id);
        
        res.json({
          data: sessions.map(session => ({
            deviceFingerprint: session.deviceFingerprint,
            ipAddress: session.ipAddress,
            userAgent: session.userAgent,
            loginTimestamp: session.loginTimestamp,
            lastActivity: session.lastActivity
          }))
        });

      } catch (error) {
        logger.error('Session retrieval failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
          environment: process.env.NODE_ENV,
          category: 'security'
        });

        res.status(500).json({
          error: 'INTERNAL_ERROR',
          message: 'Failed to retrieve sessions'
        });
      }
    });

    app.delete('/api/auth/sessions', authenticateToken(), async (req: Request, res: Response) => {
      try {
        const user = req.user as any;
        const { sessionId, all } = req.body;

        if (all) {
          // Destroy all sessions except current
          const destroyedCount = await redisSessionStore.destroyUserSessions(user.id, req.sessionID);
          
          res.json({
            message: 'All sessions destroyed successfully',
            destroyedCount
          });
        } else if (sessionId) {
          // Destroy specific session
          await new Promise<void>((resolve, reject) => {
            redisSessionStore.destroy(sessionId, (err) => {
              if (err) reject(err);
              else resolve();
            });
          });
          
          res.json({ message: 'Session destroyed successfully' });
        } else {
          res.status(400).json({
            error: 'BAD_REQUEST',
            message: 'Session ID required or use all flag'
          });
        }

      } catch (error) {
        logger.error('Session destruction failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
          environment: process.env.NODE_ENV,
          category: 'security'
        });

        res.status(500).json({
          error: 'INTERNAL_ERROR',
          message: 'Failed to destroy sessions'
        });
      }
    });

    logger.info('Enhanced security integration completed successfully', {
      environment: process.env.NODE_ENV,
      category: 'security'
    });

  } catch (error) {
    logger.error('Security integration initialization failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      environment: process.env.NODE_ENV,
      category: 'security'
    });
    throw error;
  }
}

/**
 * Middleware for gradually migrating to token-based authentication
 */
export function hybridAuthenticationMiddleware() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // First try token-based authentication
      const token = extractTokenFromRequest(req);
      
      if (token) {
        const validation = await EnhancedTokenManager.validateToken(token);
        
        if (validation.isValid) {
          // Use token-based auth
          req.user = {
            id: validation.metadata!.userId,
            tokenType: validation.metadata!.type,
            tenantId: validation.metadata!.tenantId,
            permissions: validation.metadata!.permissions || []
          };

          if (validation.needsRefresh) {
            res.setHeader('X-Token-Refresh-Needed', 'true');
          }

          return next();
        }
      }

      // Fall back to session-based authentication
      const session = req.session as EnhancedSessionData;
      if (session && session.userId) {
        req.user = {
          id: session.userId,
          tenantId: session.tenantId,
          role: session.role,
          permissions: session.permissions || []
        };

        return next();
      }

      // No valid authentication found
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });

    } catch (error) {
      logger.error('Hybrid authentication middleware error', {
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