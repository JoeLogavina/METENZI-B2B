// 🗄️ ADVANCED AUTHENTICATION DATABASE SCHEMA (Step 5)
// Database schema for enhanced authentication and authorization

import { pgTable, text, timestamp, integer, boolean, jsonb, uuid, varchar } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

// Enhanced user sessions table
export const userSessions = pgTable('user_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: varchar('session_id', { length: 128 }).unique().notNull(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  tenantId: varchar('tenant_id', { length: 100 }).notNull(),
  role: varchar('role', { length: 100 }).notNull(),
  permissions: jsonb('permissions').notNull().default([]),
  deviceFingerprint: varchar('device_fingerprint', { length: 64 }),
  ipAddress: varchar('ip_address', { length: 45 }).notNull(),
  userAgent: text('user_agent'),
  riskScore: integer('risk_score').notNull().default(0),
  mfaVerified: boolean('mfa_verified').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  metadata: jsonb('metadata').default({})
});

// Role definitions table
export const roles = pgTable('roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).unique().notNull(),
  displayName: varchar('display_name', { length: 200 }).notNull(),
  description: text('description'),
  permissions: jsonb('permissions').notNull().default([]),
  inheritance: jsonb('inheritance').default([]), // Parent role IDs
  isSystemRole: boolean('is_system_role').notNull().default(false),
  tenantSpecific: boolean('tenant_specific').notNull().default(true),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  isActive: boolean('is_active').notNull().default(true)
});

// User role assignments
export const userRoleAssignments = pgTable('user_role_assignments', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  roleId: uuid('role_id').notNull().references(() => roles.id),
  tenantId: varchar('tenant_id', { length: 100 }).notNull(),
  assignedBy: varchar('assigned_by', { length: 255 }).notNull(),
  assignedAt: timestamp('assigned_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at'),
  conditions: jsonb('conditions').default({}),
  isActive: boolean('is_active').notNull().default(true),
  metadata: jsonb('metadata').default({})
});

// Permission definitions table
export const permissions = pgTable('permissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 200 }).unique().notNull(),
  resource: varchar('resource', { length: 100 }).notNull(),
  action: varchar('action', { length: 100 }).notNull(),
  conditions: jsonb('conditions').default({}),
  scope: varchar('scope', { length: 50 }).notNull().default('tenant'), // global, tenant, user
  description: text('description'),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  isActive: boolean('is_active').notNull().default(true)
});

// Authentication attempts log
export const authenticationAttempts = pgTable('authentication_attempts', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: varchar('username', { length: 255 }).notNull(),
  ipAddress: varchar('ip_address', { length: 45 }).notNull(),
  userAgent: text('user_agent'),
  success: boolean('success').notNull(),
  failureReason: varchar('failure_reason', { length: 200 }),
  riskScore: integer('risk_score').default(0),
  fraudFlags: jsonb('fraud_flags').default([]),
  mfaRequired: boolean('mfa_required').default(false),
  mfaCompleted: boolean('mfa_completed').default(false),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  sessionId: varchar('session_id', { length: 128 }),
  metadata: jsonb('metadata').default({})
});

// Account lockouts table
export const accountLockouts = pgTable('account_lockouts', {
  id: uuid('id').primaryKey().defaultRandom(),
  identifier: varchar('identifier', { length: 500 }).notNull(), // username:ip combination
  attemptCount: integer('attempt_count').notNull().default(1),
  firstAttempt: timestamp('first_attempt').defaultNow().notNull(),
  lastAttempt: timestamp('last_attempt').defaultNow().notNull(),
  lockedUntil: timestamp('locked_until'),
  isLocked: boolean('is_locked').notNull().default(false),
  lockReason: varchar('lock_reason', { length: 200 }),
  unlockReason: varchar('unlock_reason', { length: 200 }),
  metadata: jsonb('metadata').default({})
});

// MFA challenges table
export const mfaChallenges = pgTable('mfa_challenges', {
  id: uuid('id').primaryKey().defaultRandom(),
  token: varchar('token', { length: 64 }).unique().notNull(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  challengeType: varchar('challenge_type', { length: 50 }).notNull().default('totp'),
  ipAddress: varchar('ip_address', { length: 45 }).notNull(),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  completed: boolean('completed').notNull().default(false),
  completedAt: timestamp('completed_at'),
  attemptCount: integer('attempt_count').notNull().default(0),
  metadata: jsonb('metadata').default({})
});

// Permission audit log
export const permissionAuditLog = pgTable('permission_audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  userRole: varchar('user_role', { length: 100 }).notNull(),
  resource: varchar('resource', { length: 100 }).notNull(),
  action: varchar('action', { length: 100 }).notNull(),
  granted: boolean('granted').notNull(),
  reason: varchar('reason', { length: 200 }),
  permissionId: uuid('permission_id'),
  conditionsChecked: jsonb('conditions_checked').default([]),
  failedConditions: jsonb('failed_conditions').default([]),
  ipAddress: varchar('ip_address', { length: 45 }).notNull(),
  userAgent: text('user_agent'),
  requestPath: varchar('request_path', { length: 500 }),
  requestMethod: varchar('request_method', { length: 10 }),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  auditData: jsonb('audit_data').default({})
});

// Zod schemas for validation
export const insertUserSessionSchema = createInsertSchema(userSessions, {
  sessionId: z.string().min(32).max(128),
  userId: z.string().min(1).max(255),
  tenantId: z.string().min(1).max(100),
  role: z.string().min(1).max(100),
  permissions: z.array(z.string()).default([]),
  ipAddress: z.string().ip(),
  riskScore: z.number().int().min(0).max(100).default(0),
  expiresAt: z.date().refine(date => date > new Date(), {
    message: "Expiration date must be in the future"
  })
}).omit({
  id: true,
  createdAt: true,
  lastActivity: true
});

export const insertRoleSchema = createInsertSchema(roles, {
  name: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/, {
    message: "Role name must contain only letters, numbers, underscores and hyphens"
  }),
  displayName: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  permissions: z.array(z.object({
    id: z.string(),
    resource: z.string(),
    action: z.string(),
    conditions: z.record(z.any()).optional(),
    metadata: z.record(z.any()).default({})
  })).default([])
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertUserRoleAssignmentSchema = createInsertSchema(userRoleAssignments, {
  userId: z.string().min(1).max(255),
  roleId: z.string().uuid(),
  tenantId: z.string().min(1).max(100),
  assignedBy: z.string().min(1).max(255),
  expiresAt: z.date().optional().refine(date => !date || date > new Date(), {
    message: "Expiration date must be in the future"
  })
}).omit({
  id: true,
  assignedAt: true
});

export const insertPermissionSchema = createInsertSchema(permissions, {
  name: z.string().min(1).max(200),
  resource: z.string().min(1).max(100),
  action: z.string().min(1).max(100),
  scope: z.enum(['global', 'tenant', 'user']).default('tenant'),
  description: z.string().max(1000).optional()
}).omit({
  id: true,
  createdAt: true
});

export const insertAuthAttemptSchema = createInsertSchema(authenticationAttempts, {
  username: z.string().min(1).max(255),
  ipAddress: z.string().ip(),
  success: z.boolean(),
  riskScore: z.number().int().min(0).max(100).optional()
}).omit({
  id: true,
  timestamp: true
});

export const insertMfaChallengeSchema = createInsertSchema(mfaChallenges, {
  token: z.string().length(32),
  userId: z.string().min(1).max(255),
  challengeType: z.enum(['totp', 'sms', 'email']).default('totp'),
  ipAddress: z.string().ip(),
  expiresAt: z.date().refine(date => date > new Date(), {
    message: "Expiration date must be in the future"
  })
}).omit({
  id: true,
  createdAt: true
});

// Select schemas (what comes back from database)
export const selectUserSessionSchema = createSelectSchema(userSessions);
export const selectRoleSchema = createSelectSchema(roles);
export const selectUserRoleAssignmentSchema = createSelectSchema(userRoleAssignments);
export const selectPermissionSchema = createSelectSchema(permissions);
export const selectAuthAttemptSchema = createSelectSchema(authenticationAttempts);
export const selectMfaChallengeSchema = createSelectSchema(mfaChallenges);
export const selectPermissionAuditSchema = createSelectSchema(permissionAuditLog);

// TypeScript types
export type UserSession = typeof userSessions.$inferSelect;
export type InsertUserSession = z.infer<typeof insertUserSessionSchema>;
export type Role = typeof roles.$inferSelect;
export type InsertRole = z.infer<typeof insertRoleSchema>;
export type UserRoleAssignment = typeof userRoleAssignments.$inferSelect;
export type InsertUserRoleAssignment = z.infer<typeof insertUserRoleAssignmentSchema>;
export type Permission = typeof permissions.$inferSelect;
export type InsertPermission = z.infer<typeof insertPermissionSchema>;
export type AuthenticationAttempt = typeof authenticationAttempts.$inferSelect;
export type InsertAuthenticationAttempt = z.infer<typeof insertAuthAttemptSchema>;
export type MfaChallenge = typeof mfaChallenges.$inferSelect;
export type InsertMfaChallenge = z.infer<typeof insertMfaChallengeSchema>;
export type PermissionAudit = typeof permissionAuditLog.$inferSelect;

// API request/response schemas
export const loginRequestSchema = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(1).max(200),
  rememberMe: z.boolean().optional().default(false),
  deviceName: z.string().max(100).optional()
});

export const mfaVerifyRequestSchema = z.object({
  mfaToken: z.string().length(32),
  totpCode: z.string().length(6).regex(/^\d{6}$/),
  trustDevice: z.boolean().optional().default(false)
});

export const permissionCheckRequestSchema = z.object({
  resource: z.string().min(1).max(100),
  action: z.string().min(1).max(100),
  targetData: z.record(z.any()).optional()
});

export const roleAssignmentRequestSchema = z.object({
  userId: z.string().uuid(),
  roleId: z.string().min(1).max(100),
  tenantId: z.string().min(1).max(100),
  expiresAt: z.string().datetime().optional()
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type MfaVerifyRequest = z.infer<typeof mfaVerifyRequestSchema>;
export type PermissionCheckRequest = z.infer<typeof permissionCheckRequestSchema>;
export type RoleAssignmentRequest = z.infer<typeof roleAssignmentRequestSchema>;