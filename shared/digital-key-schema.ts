// 🗄️ DIGITAL KEY DATABASE SCHEMA (Step 4)
// Database schema for digital key encryption and secure downloads

import { pgTable, text, timestamp, integer, boolean, jsonb, uuid, varchar } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

// Digital Keys table for encrypted license keys
export const digitalKeys = pgTable('digital_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  keyFingerprint: varchar('key_fingerprint', { length: 64 }).unique().notNull(),
  productId: varchar('product_id', { length: 255 }).notNull(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  encryptedKey: text('encrypted_key').notNull(),
  keyType: varchar('key_type', { length: 50 }).notNull().default('license'), // license, activation, download
  algorithm: varchar('algorithm', { length: 50 }).notNull().default('aes-256-gcm'),
  version: varchar('version', { length: 10 }).notNull().default('v2'),
  metadata: jsonb('metadata').notNull().default({}),
  maxUses: integer('max_uses').default(1),
  currentUses: integer('current_uses').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  revokedAt: timestamp('revoked_at'),
  revokedReason: text('revoked_reason')
});

// Download tokens table for secure file downloads
export const downloadTokens = pgTable('download_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  token: varchar('token', { length: 128 }).unique().notNull(),
  resourceId: varchar('resource_id', { length: 255 }).notNull(),
  resourceType: varchar('resource_type', { length: 50 }).notNull(), // license, software, document, activation
  userId: varchar('user_id', { length: 255 }).notNull(),
  filename: varchar('filename', { length: 500 }),
  filesize: integer('filesize'),
  checksumSHA256: varchar('checksum_sha256', { length: 64 }),
  maxDownloads: integer('max_downloads').notNull().default(1),
  currentDownloads: integer('current_downloads').notNull().default(0),
  ipWhitelist: jsonb('ip_whitelist').default([]),
  userAgent: text('user_agent'),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  lastUsedAt: timestamp('last_used_at'),
  isConsumed: boolean('is_consumed').notNull().default(false)
});

// Download attempts log for audit and analytics
export const downloadAttempts = pgTable('download_attempts', {
  id: uuid('id').primaryKey().defaultRandom(),
  tokenId: varchar('token_id', { length: 255 }).notNull(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  resourceId: varchar('resource_id', { length: 255 }).notNull(),
  ipAddress: varchar('ip_address', { length: 45 }).notNull(), // IPv6 compatible
  userAgent: text('user_agent'),
  success: boolean('success').notNull(),
  errorReason: varchar('error_reason', { length: 500 }),
  downloadedBytes: integer('downloaded_bytes').default(0),
  duration: integer('duration').default(0), // milliseconds
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  metadata: jsonb('metadata').default({})
});

// Key usage logs for detailed tracking
export const keyUsageLogs = pgTable('key_usage_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  keyId: uuid('key_id').notNull().references(() => digitalKeys.id),
  userId: varchar('user_id', { length: 255 }).notNull(),
  action: varchar('action', { length: 50 }).notNull(), // decrypt, use, validate, revoke
  success: boolean('success').notNull(),
  errorMessage: text('error_message'),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  metadata: jsonb('metadata').default({}),
  timestamp: timestamp('timestamp').defaultNow().notNull()
});

// Zod schemas for validation
export const insertDigitalKeySchema = createInsertSchema(digitalKeys, {
  keyFingerprint: z.string().min(16).max(64),
  productId: z.string().min(1).max(255),
  userId: z.string().min(1).max(255),
  encryptedKey: z.string().min(1),
  keyType: z.enum(['license', 'activation', 'download']),
  maxUses: z.number().int().positive().optional(),
  metadata: z.record(z.any()).default({})
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertDownloadTokenSchema = createInsertSchema(downloadTokens, {
  token: z.string().min(32).max(128),
  resourceId: z.string().min(1).max(255),
  resourceType: z.enum(['license', 'software', 'document', 'activation']),
  userId: z.string().min(1).max(255),
  maxDownloads: z.number().int().positive().max(10),
  expiresAt: z.date().refine(date => date > new Date(), {
    message: "Expiration date must be in the future"
  }),
  metadata: z.record(z.any()).default({})
}).omit({
  id: true,
  createdAt: true,
  lastUsedAt: true,
  isConsumed: true
});

export const insertDownloadAttemptSchema = createInsertSchema(downloadAttempts, {
  tokenId: z.string().min(1).max(255),
  userId: z.string().min(1).max(255),
  resourceId: z.string().min(1).max(255),
  ipAddress: z.string().ip(),
  success: z.boolean(),
  downloadedBytes: z.number().int().nonnegative().optional(),
  duration: z.number().int().nonnegative().optional(),
  metadata: z.record(z.any()).default({})
}).omit({
  id: true,
  timestamp: true
});

export const insertKeyUsageLogSchema = createInsertSchema(keyUsageLogs, {
  keyId: z.string().uuid(),
  userId: z.string().min(1).max(255),
  action: z.enum(['decrypt', 'use', 'validate', 'revoke', 'generate']),
  success: z.boolean(),
  ipAddress: z.string().ip().optional(),
  metadata: z.record(z.any()).default({})
}).omit({
  id: true,
  timestamp: true
});

// Select schemas (what comes back from database)
export const selectDigitalKeySchema = createSelectSchema(digitalKeys);
export const selectDownloadTokenSchema = createSelectSchema(downloadTokens);
export const selectDownloadAttemptSchema = createSelectSchema(downloadAttempts);
export const selectKeyUsageLogSchema = createSelectSchema(keyUsageLogs);

// TypeScript types
export type DigitalKey = typeof digitalKeys.$inferSelect;
export type InsertDigitalKey = z.infer<typeof insertDigitalKeySchema>;
export type DownloadToken = typeof downloadTokens.$inferSelect;
export type InsertDownloadToken = z.infer<typeof insertDownloadTokenSchema>;
export type DownloadAttempt = typeof downloadAttempts.$inferSelect;
export type InsertDownloadAttempt = z.infer<typeof insertDownloadAttemptSchema>;
export type KeyUsageLog = typeof keyUsageLogs.$inferSelect;
export type InsertKeyUsageLog = z.infer<typeof insertKeyUsageLogSchema>;

// Additional validation schemas for API endpoints
export const generateKeyRequestSchema = z.object({
  productId: z.string().min(1).max(255),
  keyType: z.enum(['license', 'activation', 'download']).default('license'),
  expiryDays: z.number().int().positive().max(365).optional(),
  maxUses: z.number().int().positive().max(100).default(1),
  generateDownloadUrl: z.boolean().default(false),
  metadata: z.record(z.any()).default({})
});

export const downloadTokenRequestSchema = z.object({
  resourceId: z.string().min(1).max(255),
  resourceType: z.enum(['license', 'software', 'document', 'activation']).default('license'),
  filename: z.string().max(500).optional(),
  expiryMinutes: z.number().int().positive().max(1440).default(15), // Max 24 hours
  maxDownloads: z.number().int().positive().max(10).default(1),
  metadata: z.record(z.any()).default({})
});

export type GenerateKeyRequest = z.infer<typeof generateKeyRequestSchema>;
export type DownloadTokenRequest = z.infer<typeof downloadTokenRequestSchema>;