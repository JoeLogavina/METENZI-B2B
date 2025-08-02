// 🗄️ API SECURITY DATABASE SCHEMA (Step 6)
// Database schema for API security, rate limiting, and monitoring

import { pgTable, text, timestamp, integer, boolean, jsonb, uuid, varchar, decimal } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

// API Keys table
export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  keyHash: varchar('key_hash', { length: 128 }).unique().notNull(), // Hashed API key
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  permissions: jsonb('permissions').notNull().default([]),
  rateLimit: integer('rate_limit').notNull().default(1000), // requests per hour
  tenantId: varchar('tenant_id', { length: 100 }).notNull(),
  createdBy: varchar('created_by', { length: 255 }).notNull(),
  lastUsed: timestamp('last_used'),
  requestCount: integer('request_count').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  metadata: jsonb('metadata').default({})
});

// Rate Limit Rules table
export const rateLimitRules = pgTable('rate_limit_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  endpoint: varchar('endpoint', { length: 200 }).notNull(),
  method: varchar('method', { length: 10 }).default('*'), // GET, POST, *, etc.
  windowMs: integer('window_ms').notNull(), // Time window in milliseconds
  maxRequests: integer('max_requests').notNull(),
  identifier: varchar('identifier', { length: 50 }).notNull(), // ip, user, api_key, etc.
  skipSuccessful: boolean('skip_successful').default(false),
  skipFailed: boolean('skip_failed').default(false),
  isActive: boolean('is_active').notNull().default(true),
  priority: integer('priority').notNull().default(0), // Higher priority rules first
  createdBy: varchar('created_by', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  metadata: jsonb('metadata').default({})
});

// Rate Limit Violations table
export const rateLimitViolations = pgTable('rate_limit_violations', {
  id: uuid('id').primaryKey().defaultRandom(),
  ruleId: uuid('rule_id').references(() => rateLimitRules.id),
  identifier: varchar('identifier', { length: 200 }).notNull(), // IP, user ID, API key, etc.
  endpoint: varchar('endpoint', { length: 200 }).notNull(),
  method: varchar('method', { length: 10 }).notNull(),
  requestCount: integer('request_count').notNull(),
  windowStart: timestamp('window_start').notNull(),
  windowEnd: timestamp('window_end').notNull(),
  ipAddress: varchar('ip_address', { length: 45 }).notNull(),
  userAgent: text('user_agent'),
  userId: varchar('user_id', { length: 255 }),
  blocked: boolean('blocked').notNull().default(true),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  metadata: jsonb('metadata').default({})
});

// Security Events table (for monitoring and analytics)
export const securityEvents = pgTable('security_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: varchar('type', { length: 50 }).notNull(), // rate_limit, ddos_detected, suspicious_request, etc.
  severity: varchar('severity', { length: 20 }).notNull(), // low, medium, high, critical
  source: varchar('source', { length: 100 }).notNull(), // IP address or identifier
  endpoint: varchar('endpoint', { length: 200 }),
  method: varchar('method', { length: 10 }),
  userAgent: text('user_agent'),
  userId: varchar('user_id', { length: 255 }),
  sessionId: varchar('session_id', { length: 128 }),
  blocked: boolean('blocked').notNull().default(false),
  riskScore: integer('risk_score').default(0), // 0-100
  details: jsonb('details').default({}),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at'),
  resolvedBy: varchar('resolved_by', { length: 255 }),
  metadata: jsonb('metadata').default({})
});

// IP Blocks table
export const ipBlocks = pgTable('ip_blocks', {
  id: uuid('id').primaryKey().defaultRandom(),
  ipAddress: varchar('ip_address', { length: 45 }).notNull(),
  cidrRange: varchar('cidr_range', { length: 50 }), // For subnet blocking
  reason: varchar('reason', { length: 200 }).notNull(),
  severity: varchar('severity', { length: 20 }).notNull(),
  blockedBy: varchar('blocked_by', { length: 255 }).notNull(),
  expiresAt: timestamp('expires_at'),
  isActive: boolean('is_active').notNull().default(true),
  isPermanent: boolean('is_permanent').notNull().default(false),
  attemptCount: integer('attempt_count').default(0),
  lastAttempt: timestamp('last_attempt'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  metadata: jsonb('metadata').default({})
});

// DDoS Detection Events table
export const ddosEvents = pgTable('ddos_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  ipAddress: varchar('ip_address', { length: 45 }).notNull(),
  requestCount: integer('request_count').notNull(),
  windowStart: timestamp('window_start').notNull(),
  windowEnd: timestamp('window_end').notNull(),
  threshold: integer('threshold').notNull(),
  severity: varchar('severity', { length: 20 }).notNull(),
  blocked: boolean('blocked').notNull().default(true),
  mitigationAction: varchar('mitigation_action', { length: 100 }), // block_ip, rate_limit, etc.
  resolved: boolean('resolved').notNull().default(false),
  resolvedAt: timestamp('resolved_at'),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  metadata: jsonb('metadata').default({})
});

// API Request Analytics table
export const apiRequestAnalytics = pgTable('api_request_analytics', {
  id: uuid('id').primaryKey().defaultRandom(),
  date: timestamp('date').notNull(), // Aggregated by hour/day
  endpoint: varchar('endpoint', { length: 200 }).notNull(),
  method: varchar('method', { length: 10 }).notNull(),
  statusCode: integer('status_code'),
  requestCount: integer('request_count').notNull().default(0),
  blockedCount: integer('blocked_count').notNull().default(0),
  avgResponseTime: decimal('avg_response_time', { precision: 8, scale: 2 }),
  minResponseTime: decimal('min_response_time', { precision: 8, scale: 2 }),
  maxResponseTime: decimal('max_response_time', { precision: 8, scale: 2 }),
  errorCount: integer('error_count').notNull().default(0),
  uniqueIPs: integer('unique_ips').notNull().default(0),
  uniqueUsers: integer('unique_users').notNull().default(0),
  metadata: jsonb('metadata').default({}),
  aggregatedAt: timestamp('aggregated_at').defaultNow().notNull()
});

// API Key Usage Analytics table
export const apiKeyUsage = pgTable('api_key_usage', {
  id: uuid('id').primaryKey().defaultRandom(),
  apiKeyId: uuid('api_key_id').references(() => apiKeys.id).notNull(),
  endpoint: varchar('endpoint', { length: 200 }).notNull(),
  method: varchar('method', { length: 10 }).notNull(),
  statusCode: integer('status_code').notNull(),
  responseTime: decimal('response_time', { precision: 8, scale: 2 }),
  ipAddress: varchar('ip_address', { length: 45 }).notNull(),
  userAgent: text('user_agent'),
  requestSize: integer('request_size'), // bytes
  responseSize: integer('response_size'), // bytes
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  metadata: jsonb('metadata').default({})
});

// Security Configuration table
export const securityConfig = pgTable('security_config', {
  id: uuid('id').primaryKey().defaultRandom(),
  category: varchar('category', { length: 50 }).notNull(), // rate_limiting, ddos_protection, etc.
  setting: varchar('setting', { length: 100 }).notNull(),
  value: jsonb('value').notNull(),
  description: text('description'),
  isActive: boolean('is_active').notNull().default(true),
  updatedBy: varchar('updated_by', { length: 255 }).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  metadata: jsonb('metadata').default({})
});

// Zod schemas for validation
export const insertApiKeySchema = createInsertSchema(apiKeys, {
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  permissions: z.array(z.string()).default([]),
  rateLimit: z.number().int().min(1).max(100000).default(1000),
  tenantId: z.string().min(1).max(100),
  createdBy: z.string().min(1).max(255)
}).omit({
  id: true,
  keyHash: true,
  lastUsed: true,
  requestCount: true,
  createdAt: true
});

export const insertRateLimitRuleSchema = createInsertSchema(rateLimitRules, {
  name: z.string().min(1).max(100),
  endpoint: z.string().min(1).max(200),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', '*']).default('*'),
  windowMs: z.number().int().min(1000).max(24 * 60 * 60 * 1000), // 1 second to 24 hours
  maxRequests: z.number().int().min(1).max(100000),
  identifier: z.enum(['ip', 'user', 'api_key', 'session']).default('ip'),
  priority: z.number().int().min(0).max(100).default(0)
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertSecurityEventSchema = createInsertSchema(securityEvents, {
  type: z.enum(['rate_limit', 'ddos_detected', 'suspicious_request', 'api_abuse', 'blocked_ip']),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  source: z.string().min(1).max(100),
  endpoint: z.string().max(200).optional(),
  method: z.string().max(10).optional(),
  riskScore: z.number().int().min(0).max(100).optional()
}).omit({
  id: true,
  timestamp: true
});

export const insertIpBlockSchema = createInsertSchema(ipBlocks, {
  ipAddress: z.string().ip(),
  cidrRange: z.string().regex(/^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/).optional(),
  reason: z.string().min(1).max(200),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  blockedBy: z.string().min(1).max(255),
  expiresAt: z.date().optional()
}).omit({
  id: true,
  createdAt: true
});

export const insertDdosEventSchema = createInsertSchema(ddosEvents, {
  ipAddress: z.string().ip(),
  requestCount: z.number().int().min(1),
  windowStart: z.date(),
  windowEnd: z.date(),
  threshold: z.number().int().min(1),
  severity: z.enum(['low', 'medium', 'high', 'critical'])
}).omit({
  id: true,
  timestamp: true
});

// Select schemas (what comes back from database)
export const selectApiKeySchema = createSelectSchema(apiKeys);
export const selectRateLimitRuleSchema = createSelectSchema(rateLimitRules);
export const selectRateLimitViolationSchema = createSelectSchema(rateLimitViolations);
export const selectSecurityEventSchema = createSelectSchema(securityEvents);
export const selectIpBlockSchema = createSelectSchema(ipBlocks);
export const selectDdosEventSchema = createSelectSchema(ddosEvents);
export const selectApiRequestAnalyticsSchema = createSelectSchema(apiRequestAnalytics);
export const selectApiKeyUsageSchema = createSelectSchema(apiKeyUsage);
export const selectSecurityConfigSchema = createSelectSchema(securityConfig);

// TypeScript types
export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = z.infer<typeof insertApiKeySchema>;
export type RateLimitRule = typeof rateLimitRules.$inferSelect;
export type InsertRateLimitRule = z.infer<typeof insertRateLimitRuleSchema>;
export type RateLimitViolation = typeof rateLimitViolations.$inferSelect;
export type SecurityEvent = typeof securityEvents.$inferSelect;
export type InsertSecurityEvent = z.infer<typeof insertSecurityEventSchema>;
export type IpBlock = typeof ipBlocks.$inferSelect;
export type InsertIpBlock = z.infer<typeof insertIpBlockSchema>;
export type DdosEvent = typeof ddosEvents.$inferSelect;
export type InsertDdosEvent = z.infer<typeof insertDdosEventSchema>;
export type ApiRequestAnalytics = typeof apiRequestAnalytics.$inferSelect;
export type ApiKeyUsage = typeof apiKeyUsage.$inferSelect;
export type SecurityConfig = typeof securityConfig.$inferSelect;

// API request/response schemas
export const apiKeyCreateRequestSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  permissions: z.array(z.string()).default([]),
  rateLimit: z.number().int().min(1).max(100000).default(1000),
  expiresIn: z.number().int().min(1).max(365).optional() // days
});

export const rateLimitConfigRequestSchema = z.object({
  endpoint: z.string().min(1).max(200),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', '*']).default('*'),
  windowMs: z.number().int().min(1000),
  maxRequests: z.number().int().min(1),
  enabled: z.boolean().default(true)
});

export const ipBlockRequestSchema = z.object({
  ipAddress: z.string().ip(),
  duration: z.number().int().min(1).max(10080), // minutes (max 1 week)
  reason: z.string().min(1).max(200),
  severity: z.enum(['low', 'medium', 'high', 'critical']).default('medium')
});

export const securityAnalyticsRequestSchema = z.object({
  timeframe: z.enum(['hour', 'day', 'week', 'month']).default('day'),
  includeDetails: z.boolean().default(false),
  endpoint: z.string().optional(),
  eventType: z.string().optional()
});

export type ApiKeyCreateRequest = z.infer<typeof apiKeyCreateRequestSchema>;
export type RateLimitConfigRequest = z.infer<typeof rateLimitConfigRequestSchema>;
export type IpBlockRequest = z.infer<typeof ipBlockRequestSchema>;
export type SecurityAnalyticsRequest = z.infer<typeof securityAnalyticsRequestSchema>;