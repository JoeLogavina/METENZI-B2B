// 🔐 ADVANCED AUTHENTICATION ROUTES (Step 5)
// API endpoints for enhanced authentication and authorization

import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';
import { AdvancedAuthSystem } from '../security/advanced-auth-system';
import { RoleBasedAccessControl } from '../security/role-based-access-control';
import { z } from 'zod';
import { validateRequestMiddleware } from '../middleware/validation';

const router = Router();

// Authentication schemas
const loginSchema = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(1).max(200),
  rememberMe: z.boolean().optional(),
  deviceName: z.string().max(100).optional()
});

const mfaVerifySchema = z.object({
  mfaToken: z.string().length(32),
  totpCode: z.string().length(6).regex(/^\d{6}$/),
  trustDevice: z.boolean().optional()
});

const roleAssignmentSchema = z.object({
  userId: z.string().uuid(),
  roleId: z.string().min(1).max(100),
  tenantId: z.string().min(1).max(100),
  expiresAt: z.string().datetime().optional()
});

// Enhanced login endpoint
router.post('/login', validateRequestMiddleware(loginSchema), async (req: Request, res: Response) => {
  try {
    const { username, password, rememberMe, deviceName } = loginSchema.parse(req.body);

    const authResult = await AdvancedAuthSystem.authenticateUser(username, password, req);

    if (!authResult.success) {
      return res.status(401).json({
        error: 'LOGIN_FAILED',
        message: authResult.errorReason || 'Authentication failed',
        requiresMFA: authResult.requiresMFA,
        mfaToken: authResult.mfaToken,
        riskLevel: authResult.riskLevel
      });
    }

    // Set session cookie/header
    if (authResult.session) {
      res.setHeader('X-Session-ID', authResult.session.sessionId);
      res.cookie('session_id', authResult.session.sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000, // 30 days or 1 day
        sameSite: 'strict'
      });
    }

    res.json({
      success: true,
      user: authResult.user,
      session: {
        id: authResult.session?.sessionId,
        expiresAt: authResult.session?.expiresAt,
        riskScore: authResult.session?.riskScore
      },
      permissions: authResult.user?.permissions || [],
      riskLevel: authResult.riskLevel
    });

  } catch (error: any) {
    logger.error('Login endpoint error', {
      error: error.message,
      ipAddress: req.ip
    });

    res.status(500).json({
      error: 'LOGIN_ERROR',
      message: 'Authentication service temporarily unavailable'
    });
  }
});

// MFA verification endpoint
router.post('/verify-mfa', validateRequestMiddleware(mfaVerifySchema), async (req: Request, res: Response) => {
  try {
    const { mfaToken, totpCode, trustDevice } = mfaVerifySchema.parse(req.body);

    const authResult = await AdvancedAuthSystem.verifyMFA(mfaToken, totpCode, req);

    if (!authResult.success) {
      return res.status(401).json({
        error: 'MFA_VERIFICATION_FAILED',
        message: authResult.errorReason || 'MFA verification failed',
        riskLevel: authResult.riskLevel
      });
    }

    // Set session cookie
    if (authResult.session) {
      res.setHeader('X-Session-ID', authResult.session.sessionId);
      res.cookie('session_id', authResult.session.sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000, // 1 day
        sameSite: 'strict'
      });
    }

    res.json({
      success: true,
      user: authResult.user,
      session: {
        id: authResult.session?.sessionId,
        expiresAt: authResult.session?.expiresAt,
        mfaVerified: true
      },
      permissions: authResult.user?.permissions || []
    });

  } catch (error: any) {
    logger.error('MFA verification error', {
      error: error.message,
      ipAddress: req.ip
    });

    res.status(500).json({
      error: 'MFA_ERROR',
      message: 'MFA verification service error'
    });
  }
});

// Session validation endpoint
router.get('/session', async (req: Request, res: Response) => {
  try {
    const sessionId = req.headers['x-session-id'] || req.cookies.session_id;

    if (!sessionId) {
      return res.status(401).json({
        error: 'NO_SESSION',
        message: 'No active session found'
      });
    }

    // For demo purposes, return session info without Redis validation
    // In production, this would use Redis to validate the session
    res.json({
      valid: true,
      session: {
        id: sessionId,
        userId: 'test-user-id',
        role: 'admin',
        tenantId: 'eur',
        permissions: ['users:read', 'users:write', 'products:read'],
        lastActivity: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        mfaVerified: true,
        riskScore: 10
      }
    });

  } catch (error: any) {
    logger.error('Session validation error', {
      error: error.message,
      sessionId: typeof req.headers['x-session-id'] === 'string' ? 
        req.headers['x-session-id'].substring(0, 8) + '...' : 'unknown'
    });

    res.status(500).json({
      error: 'SESSION_ERROR',
      message: 'Session validation service error'
    });
  }
});

// Logout endpoint
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const sessionId = req.headers['x-session-id'] || req.cookies.session_id;

    if (sessionId) {
      // Invalidate session (implementation would clear from Redis)
      // await AdvancedAuthSystem.invalidateSession(sessionId as string);
    }

    // Clear session cookie
    res.clearCookie('session_id');
    res.removeHeader('X-Session-ID');

    res.json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error: any) {
    logger.error('Logout error', {
      error: error.message,
      sessionId: typeof req.headers['x-session-id'] === 'string' ? 
        req.headers['x-session-id'].substring(0, 8) + '...' : 'unknown'
    });

    res.status(500).json({
      error: 'LOGOUT_ERROR',
      message: 'Logout service error'
    });
  }
});

// Permission check endpoint
router.post('/check-permission', 
  RoleBasedAccessControl.requirePermission('auth', 'read'),
  async (req: any, res: Response) => {
    try {
      const { resource, action, targetData } = req.body;

      if (!resource || !action) {
        return res.status(400).json({
          error: 'INVALID_REQUEST',
          message: 'Resource and action are required'
        });
      }

      const context = {
        userId: req.user.id,
        userRole: req.user.role,
        tenantId: req.user.tenantId,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || 'unknown',
        timestamp: new Date(),
        sessionData: req.session
      };

      const permissionResult = await RoleBasedAccessControl.hasPermission(
        context,
        resource,
        action,
        targetData
      );

      res.json({
        granted: permissionResult.granted,
        reason: permissionResult.reason,
        conditions: permissionResult.conditions,
        auditData: permissionResult.auditData
      });

    } catch (error: any) {
      logger.error('Permission check error', {
        error: error.message,
        userId: req.user?.id
      });

      res.status(500).json({
        error: 'PERMISSION_CHECK_ERROR',
        message: 'Permission check service error'
      });
    }
  }
);

// Role management endpoints (admin only)
router.get('/roles',
  RoleBasedAccessControl.requirePermission('roles', 'read', { logAccess: true }),
  async (req: any, res: Response) => {
    try {
      // In production, this would query the database
      const systemRoles = [
        {
          id: 'super_admin',
          name: 'super_admin',
          displayName: 'Super Administrator',
          description: 'Full system access across all tenants',
          isSystemRole: true,
          tenantSpecific: false
        },
        {
          id: 'admin',
          name: 'admin',
          displayName: 'Administrator',
          description: 'Administrative access within tenant',
          isSystemRole: true,
          tenantSpecific: true
        },
        {
          id: 'b2b_user',
          name: 'b2b_user',
          displayName: 'B2B User',
          description: 'Business user with purchasing capabilities',
          isSystemRole: true,
          tenantSpecific: true
        },
        {
          id: 'user',
          name: 'user',
          displayName: 'Regular User',
          description: 'Standard user with basic access',
          isSystemRole: true,
          tenantSpecific: true
        }
      ];

      res.json({
        roles: systemRoles,
        total: systemRoles.length
      });

    } catch (error: any) {
      logger.error('Role list error', {
        error: error.message,
        userId: req.user?.id
      });

      res.status(500).json({
        error: 'ROLE_LIST_ERROR',
        message: 'Failed to retrieve roles'
      });
    }
  }
);

// Assign role to user (admin only)
router.post('/assign-role',
  RoleBasedAccessControl.requirePermission('users', 'write', { logAccess: true }),
  async (req: any, res: Response) => {
    try {
      const { userId, roleId, tenantId, expiresAt } = roleAssignmentSchema.parse(req.body);

      const success = await RoleBasedAccessControl.assignRoleToUser(
        userId,
        roleId,
        tenantId,
        req.user.id,
        expiresAt ? new Date(expiresAt) : undefined
      );

      if (!success) {
        return res.status(400).json({
          error: 'ROLE_ASSIGNMENT_FAILED',
          message: 'Failed to assign role to user'
        });
      }

      res.json({
        success: true,
        message: 'Role assigned successfully',
        assignment: {
          userId,
          roleId,
          tenantId,
          assignedBy: req.user.id,
          assignedAt: new Date(),
          expiresAt: expiresAt ? new Date(expiresAt) : null
        }
      });

    } catch (error: any) {
      logger.error('Role assignment error', {
        error: error.message,
        adminUserId: req.user?.id,
        requestBody: req.body
      });

      res.status(500).json({
        error: 'ROLE_ASSIGNMENT_ERROR',
        message: 'Role assignment service error'
      });
    }
  }
);

// Get user permissions
router.get('/permissions/:userId?',
  RoleBasedAccessControl.requirePermission('users', 'read'),
  async (req: any, res: Response) => {
    try {
      const targetUserId = req.params.userId || req.user.id;
      const tenantId = req.user.tenantId;

      // Get target user info (simplified)
      const targetUser = {
        id: targetUserId,
        role: targetUserId === req.user.id ? req.user.role : 'b2b_user' // Simplified
      };

      const permissions = await RoleBasedAccessControl.getUserEffectivePermissions(
        targetUserId,
        targetUser.role,
        tenantId
      );

      res.json({
        userId: targetUserId,
        role: targetUser.role,
        tenantId,
        permissions: permissions.map(p => ({
          id: p.id,
          resource: p.resource,
          action: p.action,
          conditions: p.conditions
        })),
        permissionCount: permissions.length
      });

    } catch (error: any) {
      logger.error('Get permissions error', {
        error: error.message,
        userId: req.user?.id,
        targetUserId: req.params.userId
      });

      res.status(500).json({
        error: 'PERMISSIONS_ERROR',
        message: 'Failed to retrieve permissions'
      });
    }
  }
);

export default router;