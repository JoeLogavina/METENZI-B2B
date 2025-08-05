// 🛡️ ROLE-BASED ACCESS CONTROL SYSTEM (Step 5)
// Advanced permission management and authorization framework

import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';
import { redisCache } from '../cache/redis';
import { SecurityAuditSystem } from './audit-system';

export interface Permission {
  id: string;
  resource: string;
  action: string;
  conditions?: {
    tenant?: string[];
    field?: string[];
    time?: {
      start?: string;
      end?: string;
      days?: string[];
    };
    ip?: string[];
    location?: string[];
  };
  metadata: Record<string, any>;
}

export interface Role {
  id: string;
  name: string;
  displayName: string;
  description: string;
  permissions: Permission[];
  inheritance?: string[]; // Parent roles
  isSystemRole: boolean;
  tenantSpecific: boolean;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserRoleAssignment {
  userId: string;
  roleId: string;
  tenantId?: string;
  assignedBy: string;
  assignedAt: Date;
  expiresAt?: Date;
  conditions?: Record<string, any>;
  isActive: boolean;
}

export interface AccessControlContext {
  userId: string;
  userRole: string;
  tenantId: string;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  sessionData?: Record<string, any>;
}

export class RoleBasedAccessControl {
  private static readonly ROLE_CACHE_PREFIX = 'rbac_role:';
  private static readonly PERMISSION_CACHE_PREFIX = 'rbac_permission:';
  private static readonly USER_ROLES_PREFIX = 'rbac_user_roles:';
  private static readonly CACHE_TTL = 3600; // 1 hour

  // Define system roles
  private static readonly SYSTEM_ROLES: Role[] = [
    {
      id: 'super_admin',
      name: 'super_admin',
      displayName: 'Super Administrator',
      description: 'Full system access across all tenants',
      permissions: [
        {
          id: 'super_admin_all',
          resource: '*',
          action: '*',
          metadata: { system: true }
        }
      ],
      isSystemRole: true,
      tenantSpecific: false,
      metadata: { level: 100, system: true },
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'admin',
      name: 'admin',
      displayName: 'Administrator',
      description: 'Administrative access within tenant',
      permissions: [
        { id: 'admin_users', resource: 'users', action: '*', metadata: {} },
        { id: 'admin_products', resource: 'products', action: '*', metadata: {} },
        { id: 'admin_orders', resource: 'orders', action: '*', metadata: {} },
        { id: 'admin_reports', resource: 'reports', action: 'read', metadata: {} },
        { id: 'admin_settings', resource: 'settings', action: '*', metadata: {} },
        { id: 'admin_licenses', resource: 'licenses', action: '*', metadata: {} }
      ],
      isSystemRole: true,
      tenantSpecific: true,
      metadata: { level: 80 },
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'b2b_user',
      name: 'b2b_user',
      displayName: 'B2B User',
      description: 'Business user with purchasing capabilities',
      permissions: [
        { id: 'b2b_products', resource: 'products', action: 'read', metadata: {} },
        { id: 'b2b_orders', resource: 'orders', action: 'read,create', metadata: {} },
        { id: 'b2b_wallet', resource: 'wallet', action: 'read', metadata: {} },
        { id: 'b2b_profile', resource: 'profile', action: 'read,update', metadata: {} },
        { id: 'b2b_licenses', resource: 'licenses', action: 'read', metadata: {} }
      ],
      isSystemRole: true,
      tenantSpecific: true,
      metadata: { level: 50 },
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'user',
      name: 'user',
      displayName: 'Regular User',
      description: 'Standard user with basic access',
      permissions: [
        { id: 'user_products', resource: 'products', action: 'read', metadata: {} },
        { id: 'user_orders', resource: 'orders', action: 'read', metadata: {} },
        { id: 'user_profile', resource: 'profile', action: 'read,update', metadata: {} }
      ],
      isSystemRole: true,
      tenantSpecific: true,
      metadata: { level: 20 },
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  // Check if user has specific permission
  static async hasPermission(
    context: AccessControlContext,
    resource: string,
    action: string,
    targetData?: Record<string, any>
  ): Promise<{
    granted: boolean;
    reason?: string;
    conditions?: Record<string, any>;
    auditData?: Record<string, any>;
  }> {
    try {
      // Super admin bypass
      if (context.userRole === 'super_admin') {
        return {
          granted: true,
          reason: 'super_admin_access',
          auditData: { bypass: true }
        };
      }

      // Get user's effective permissions
      const permissions = await this.getUserEffectivePermissions(
        context.userId,
        context.userRole,
        context.tenantId
      );

      // Check for matching permissions
      for (const permission of permissions) {
        const match = this.matchesPermission(permission, resource, action);
        if (match.matches) {
          // Validate conditions if present
          const conditionCheck = await this.validatePermissionConditions(
            permission,
            context,
            targetData
          );

          if (conditionCheck.valid) {
            await this.logPermissionCheck(context, resource, action, true, permission.id);
            
            return {
              granted: true,
              reason: 'permission_granted',
              conditions: permission.conditions,
              auditData: {
                permissionId: permission.id,
                conditionsValidated: conditionCheck.conditionsChecked
              }
            };
          } else {
            await this.logPermissionCheck(context, resource, action, false, permission.id, conditionCheck.reason);
            
            return {
              granted: false,
              reason: conditionCheck.reason || 'conditions_not_met',
              auditData: {
                permissionId: permission.id,
                failedConditions: conditionCheck.failedConditions
              }
            };
          }
        }
      }

      await this.logPermissionCheck(context, resource, action, false, null, 'no_matching_permission');

      return {
        granted: false,
        reason: 'no_permission',
        auditData: { 
          userRole: context.userRole,
          permissionsChecked: permissions.length
        }
      };

    } catch (error: any) {
      logger.error('Permission check error', {
        error: error.message,
        userId: context.userId,
        resource,
        action
      });

      return {
        granted: false,
        reason: 'permission_check_error',
        auditData: { error: error.message }
      };
    }
  }

  // Enhanced middleware for fine-grained access control
  static requirePermission(
    resource: string,
    action: string,
    options: {
      strict?: boolean;
      logAccess?: boolean;
      extractTargetData?: (req: Request) => Record<string, any>;
      onDenied?: (req: Request, res: Response, reason: string) => void;
    } = {}
  ) {
    return async (req: any, res: Response, next: NextFunction) => {
      try {
        // Extract user context
        const context: AccessControlContext = {
          userId: req.user?.id || 'anonymous',
          userRole: req.user?.role || 'guest',
          tenantId: req.user?.tenantId || 'default',
          ipAddress: req.ip,
          userAgent: req.get('User-Agent') || 'unknown',
          timestamp: new Date(),
          sessionData: req.session
        };

        // Extract target data if provided
        const targetData = options.extractTargetData ? options.extractTargetData(req) : {};

        // Check permission
        const permissionResult = await this.hasPermission(context, resource, action, targetData);

        if (!permissionResult.granted) {
          // Log access denied
          await SecurityAuditSystem.logEvent(
            'auth',
            'access_denied',
            false,
            {
              userId: context.userId,
              userRole: context.userRole,
              resource,
              action,
              reason: permissionResult.reason,
              path: req.path,
              method: req.method,
              ipAddress: req.ip,
              auditData: permissionResult.auditData
            }
          );

          // Custom denied handler
          if (options.onDenied) {
            return options.onDenied(req, res, permissionResult.reason || 'Access denied');
          }

          return res.status(403).json({
            error: 'ACCESS_DENIED',
            message: this.getAccessDeniedMessage(permissionResult.reason),
            resource,
            action,
            reason: permissionResult.reason
          });
        }

        // Log access granted if enabled
        if (options.logAccess) {
          await SecurityAuditSystem.logEvent(
            'auth',
            'access_granted',
            true,
            {
              userId: context.userId,
              userRole: context.userRole,
              resource,
              action,
              path: req.path,
              method: req.method,
              auditData: permissionResult.auditData
            }
          );
        }

        // Attach permission context to request
        req.permissionContext = {
          ...permissionResult,
          context
        };

        next();

      } catch (error: any) {
        logger.error('RBAC middleware error', {
          error: error.message,
          resource,
          action,
          path: req.path
        });

        res.status(500).json({
          error: 'AUTHORIZATION_ERROR',
          message: 'Access control system error'
        });
      }
    };
  }

  // Get user's effective permissions with role inheritance
  static async getUserEffectivePermissions(
    userId: string,
    userRole: string,
    tenantId: string
  ): Promise<Permission[]> {
    const cacheKey = `${this.PERMISSION_CACHE_PREFIX}${userId}:${userRole}:${tenantId}`;
    const cached = await redisCache.get(cacheKey);

    if (cached) {
      return cached as Permission[];
    }

    try {
      // Get role permissions
      const role = await this.getRole(userRole);
      if (!role) {
        logger.warn('Role not found', { userRole, userId });
        return [];
      }

      let allPermissions: Permission[] = [...role.permissions];

      // Add inherited permissions
      if (role.inheritance && role.inheritance.length > 0) {
        for (const parentRoleId of role.inheritance) {
          const parentRole = await this.getRole(parentRoleId);
          if (parentRole) {
            allPermissions.push(...parentRole.permissions);
          }
        }
      }

      // Get user-specific role assignments
      const userRoles = await this.getUserRoleAssignments(userId, tenantId);
      for (const assignment of userRoles) {
        if (assignment.isActive && (!assignment.expiresAt || assignment.expiresAt > new Date())) {
          const assignedRole = await this.getRole(assignment.roleId);
          if (assignedRole) {
            allPermissions.push(...assignedRole.permissions);
          }
        }
      }

      // Remove duplicates and merge conditions
      const effectivePermissions = this.consolidatePermissions(allPermissions);

      // Cache for 1 hour
      await redisCache.set(cacheKey, effectivePermissions, this.CACHE_TTL);

      return effectivePermissions;

    } catch (error: any) {
      logger.error('Failed to get effective permissions', {
        error: error.message,
        userId,
        userRole,
        tenantId
      });
      return [];
    }
  }

  // Role management functions
  static async createRole(roleData: Omit<Role, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const roleId = `role_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const role: Role = {
      ...roleData,
      id: roleId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Store role (in production, this would be in database)
    const cacheKey = `${this.ROLE_CACHE_PREFIX}${roleId}`;
    await redisCache.set(cacheKey, role, this.CACHE_TTL);

    logger.info('Role created', {
      roleId,
      name: role.name,
      permissionCount: role.permissions.length
    });

    return roleId;
  }

  static async updateRole(roleId: string, updates: Partial<Role>): Promise<boolean> {
    try {
      const role = await this.getRole(roleId);
      if (!role) {
        return false;
      }

      const updatedRole: Role = {
        ...role,
        ...updates,
        updatedAt: new Date()
      };

      const cacheKey = `${this.ROLE_CACHE_PREFIX}${roleId}`;
      await redisCache.set(cacheKey, updatedRole, this.CACHE_TTL);

      // Invalidate permission caches
      await this.invalidatePermissionCaches(roleId);

      logger.info('Role updated', {
        roleId,
        updates: Object.keys(updates)
      });

      return true;

    } catch (error: any) {
      logger.error('Failed to update role', {
        error: error.message,
        roleId
      });
      return false;
    }
  }

  // Assign role to user
  static async assignRoleToUser(
    userId: string,
    roleId: string,
    tenantId: string,
    assignedBy: string,
    expiresAt?: Date
  ): Promise<boolean> {
    try {
      const assignment: UserRoleAssignment = {
        userId,
        roleId,
        tenantId,
        assignedBy,
        assignedAt: new Date(),
        expiresAt,
        isActive: true
      };

      // Store assignment (in production, this would be in database)
      const userRolesKey = `${this.USER_ROLES_PREFIX}${userId}:${tenantId}`;
      const userRoles = await redisCache.get(userRolesKey) as UserRoleAssignment[] || [];
      
      userRoles.push(assignment);
      await redisCache.set(userRolesKey, userRoles, this.CACHE_TTL);

      // Invalidate user's permission cache
      await this.invalidateUserPermissionCache(userId, tenantId);

      await SecurityAuditSystem.logEvent(
        'auth',
        'role_assigned',
        true,
        {
          userId,
          roleId,
          tenantId,
          assignedBy,
          expiresAt
        }
      );

      logger.info('Role assigned to user', {
        userId,
        roleId,
        tenantId,
        assignedBy
      });

      return true;

    } catch (error: any) {
      logger.error('Failed to assign role', {
        error: error.message,
        userId,
        roleId
      });
      return false;
    }
  }

  // Private helper methods
  private static async getRole(roleId: string): Promise<Role | null> {
    const cacheKey = `${this.ROLE_CACHE_PREFIX}${roleId}`;
    const cached = await redisCache.get(cacheKey);

    if (cached) {
      return cached as Role;
    }

    // Check system roles
    const systemRole = this.SYSTEM_ROLES.find(role => role.id === roleId);
    if (systemRole) {
      await redisCache.set(cacheKey, systemRole, this.CACHE_TTL);
      return systemRole;
    }

    // In production, query database for custom roles
    return null;
  }

  private static matchesPermission(
    permission: Permission,
    resource: string,
    action: string
  ): { matches: boolean; specificity: number } {
    // Wildcard permission
    if (permission.resource === '*' && permission.action === '*') {
      return { matches: true, specificity: 0 };
    }

    // Resource wildcard
    if (permission.resource === '*' && this.actionMatches(permission.action, action)) {
      return { matches: true, specificity: 1 };
    }

    // Action wildcard
    if (permission.resource === resource && permission.action === '*') {
      return { matches: true, specificity: 2 };
    }

    // Exact match
    if (permission.resource === resource && this.actionMatches(permission.action, action)) {
      return { matches: true, specificity: 3 };
    }

    return { matches: false, specificity: 0 };
  }

  private static actionMatches(permissionAction: string, requestedAction: string): boolean {
    if (permissionAction === '*') return true;
    if (permissionAction === requestedAction) return true;
    
    // Check comma-separated actions
    const actions = permissionAction.split(',').map(a => a.trim());
    return actions.includes(requestedAction);
  }

  private static async validatePermissionConditions(
    permission: Permission,
    context: AccessControlContext,
    targetData?: Record<string, any>
  ): Promise<{
    valid: boolean;
    reason?: string;
    conditionsChecked: string[];
    failedConditions?: string[];
  }> {
    const conditionsChecked: string[] = [];
    const failedConditions: string[] = [];

    if (!permission.conditions) {
      return { valid: true, conditionsChecked };
    }

    // Tenant condition
    if (permission.conditions.tenant) {
      conditionsChecked.push('tenant');
      if (!permission.conditions.tenant.includes(context.tenantId)) {
        failedConditions.push('tenant');
        return {
          valid: false,
          reason: 'tenant_not_allowed',
          conditionsChecked,
          failedConditions
        };
      }
    }

    // Time conditions
    if (permission.conditions.time) {
      conditionsChecked.push('time');
      const now = new Date();
      const timeCondition = permission.conditions.time;

      if (timeCondition.start && timeCondition.end) {
        const startTime = new Date(timeCondition.start);
        const endTime = new Date(timeCondition.end);
        
        if (now < startTime || now > endTime) {
          failedConditions.push('time');
          return {
            valid: false,
            reason: 'outside_time_window',
            conditionsChecked,
            failedConditions
          };
        }
      }

      if (timeCondition.days) {
        const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        if (!timeCondition.days.map(d => d.toLowerCase()).includes(currentDay)) {
          failedConditions.push('time');
          return {
            valid: false,
            reason: 'day_not_allowed',
            conditionsChecked,
            failedConditions
          };
        }
      }
    }

    // IP condition
    if (permission.conditions.ip) {
      conditionsChecked.push('ip');
      if (!permission.conditions.ip.includes(context.ipAddress)) {
        failedConditions.push('ip');
        return {
          valid: false,
          reason: 'ip_not_allowed',
          conditionsChecked,
          failedConditions
        };
      }
    }

    return { valid: true, conditionsChecked };
  }

  private static consolidatePermissions(permissions: Permission[]): Permission[] {
    const consolidated = new Map<string, Permission>();

    for (const permission of permissions) {
      const key = `${permission.resource}:${permission.action}`;
      
      if (!consolidated.has(key)) {
        consolidated.set(key, { ...permission });
      } else {
        // Merge conditions if needed
        const existing = consolidated.get(key)!;
        if (permission.conditions && existing.conditions) {
          // Merge logic here - for now, take the more permissive
          existing.conditions = { ...existing.conditions, ...permission.conditions };
        }
      }
    }

    return Array.from(consolidated.values());
  }

  private static async getUserRoleAssignments(
    userId: string,
    tenantId: string
  ): Promise<UserRoleAssignment[]> {
    const userRolesKey = `${this.USER_ROLES_PREFIX}${userId}:${tenantId}`;
    return await redisCache.get(userRolesKey) as UserRoleAssignment[] || [];
  }

  private static async logPermissionCheck(
    context: AccessControlContext,
    resource: string,
    action: string,
    granted: boolean,
    permissionId?: string | null,
    reason?: string
  ): Promise<void> {
    await SecurityAuditSystem.logEvent(
      'auth',
      'permission_check',
      granted,
      {
        userId: context.userId,
        userRole: context.userRole,
        resource,
        action,
        permissionId,
        reason,
        ipAddress: context.ipAddress,
        timestamp: context.timestamp
      }
    );
  }

  private static getAccessDeniedMessage(reason?: string): string {
    const messages: Record<string, string> = {
      'no_permission': 'You do not have permission to perform this action',
      'conditions_not_met': 'Access conditions not satisfied',
      'tenant_not_allowed': 'Action not allowed for your organization',
      'outside_time_window': 'Action not allowed at this time',
      'day_not_allowed': 'Action not allowed on this day',
      'ip_not_allowed': 'Action not allowed from this location',
      'permission_check_error': 'Unable to verify permissions'
    };

    return messages[reason || 'no_permission'] || 'Access denied';
  }

  private static async invalidatePermissionCaches(roleId: string): Promise<void> {
    // In production, this would invalidate all user permission caches that include this role
    const keys = await redisCache.keys(`${this.PERMISSION_CACHE_PREFIX}*`);
    for (const key of keys) {
      await redisCache.del(key);
    }
  }

  private static async invalidateUserPermissionCache(userId: string, tenantId: string): Promise<void> {
    const keys = await redisCache.keys(`${this.PERMISSION_CACHE_PREFIX}${userId}:*:${tenantId}`);
    for (const key of keys) {
      await redisCache.del(key);
    }
  }
}