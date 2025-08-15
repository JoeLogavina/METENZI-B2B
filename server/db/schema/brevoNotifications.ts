import { pgTable, uuid, varchar, text, timestamp, boolean, jsonb, index, integer } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Enhanced notifications table with Brevo integration
export const brevoNotifications = pgTable('brevo_notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  orderId: uuid('order_id'),
  type: varchar('type', { length: 50 }).notNull(), // 'order_confirmation', 'license_delivery', etc.
  channel: varchar('channel', { length: 20 }).notNull().default('email'),
  recipient: varchar('recipient', { length: 255 }).notNull(),
  subject: varchar('subject', { length: 255 }),
  content: text('content'),
  status: varchar('status', { length: 30 }).notNull().default('pending'), 
  // 'pending', 'processing', 'sent', 'delivered', 'failed', 'permanently_failed', 
  // 'bounced', 'soft_bounced', 'blocked', 'spam', 'opened', 'clicked'
  
  // Brevo specific fields
  brevoMessageId: varchar('brevo_message_id', { length: 100 }),
  brevoTemplateId: integer('brevo_template_id'),
  deliveryStatus: varchar('delivery_status', { length: 30 }),
  
  // Timing fields
  sentAt: timestamp('sent_at'),
  deliveredAt: timestamp('delivered_at'),
  openedAt: timestamp('opened_at'),
  clickedAt: timestamp('clicked_at'),
  bouncedAt: timestamp('bounced_at'),
  
  // Error handling
  failureReason: text('failure_reason'),
  lastError: text('last_error'),
  
  // Retry logic
  retryCount: integer('retry_count').default(0),
  nextRetryAt: timestamp('next_retry_at'),
  maxRetries: integer('max_retries').default(3),
  
  // Priority and categorization
  priority: integer('priority').default(5), // 1-10, 1 being highest priority
  tags: jsonb('tags'), // Array of tags for categorization
  
  // Metadata and template data
  metadata: jsonb('metadata'),
  templateData: jsonb('template_data'),
  
  // Audit fields
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => ({
  userIdIdx: index('brevo_notifications_user_id_idx').on(table.userId),
  orderIdIdx: index('brevo_notifications_order_id_idx').on(table.orderId),
  statusIdx: index('brevo_notifications_status_idx').on(table.status),
  typeIdx: index('brevo_notifications_type_idx').on(table.type),
  priorityIdx: index('brevo_notifications_priority_idx').on(table.priority),
  retryIdx: index('brevo_notifications_retry_idx').on(table.nextRetryAt, table.retryCount),
  brevoMessageIdx: index('brevo_notifications_message_id_idx').on(table.brevoMessageId),
  deliveryStatusIdx: index('brevo_notifications_delivery_status_idx').on(table.deliveryStatus),
  createdAtIdx: index('brevo_notifications_created_at_idx').on(table.createdAt),
  sentAtIdx: index('brevo_notifications_sent_at_idx').on(table.sentAt)
}));

// Enhanced email templates with Brevo integration
export const brevoEmailTemplates = pgTable('brevo_email_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  displayName: varchar('display_name', { length: 150 }).notNull(),
  description: text('description'),
  
  // Multi-tenant support
  tenant: varchar('tenant', { length: 10 }), // 'EUR', 'KM', or null for global
  language: varchar('language', { length: 5 }).default('en'), // 'en', 'bs'
  
  // Template content
  subject: varchar('subject', { length: 255 }).notNull(),
  htmlContent: text('html_content').notNull(),
  textContent: text('text_content').notNull(),
  previewText: varchar('preview_text', { length: 255 }),
  
  // Brevo integration
  brevoTemplateId: integer('brevo_template_id'),
  syncedWithBrevo: boolean('synced_with_brevo').default(false),
  lastSyncAt: timestamp('last_sync_at'),
  
  // Template configuration
  variables: jsonb('variables'), // Available template variables with descriptions
  requiredVariables: jsonb('required_variables'), // Variables that must be provided
  category: varchar('category', { length: 50 }).default('general'), // 'order', 'support', 'marketing', etc.
  
  // Status and versioning
  isActive: boolean('is_active').default(true),
  isDraft: boolean('is_draft').default(false),
  version: integer('version').default(1),
  previousVersionId: uuid('previous_version_id'),
  
  // A/B Testing support
  abTestConfig: jsonb('ab_test_config'),
  isAbTestVariant: boolean('is_ab_test_variant').default(false),
  abTestParentId: uuid('ab_test_parent_id'),
  
  // Usage statistics
  useCount: integer('use_count').default(0),
  lastUsedAt: timestamp('last_used_at'),
  
  // Audit fields
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => ({
  nameIdx: index('brevo_email_templates_name_idx').on(table.name),
  tenantIdx: index('brevo_email_templates_tenant_idx').on(table.tenant),
  languageIdx: index('brevo_email_templates_language_idx').on(table.language),
  activeIdx: index('brevo_email_templates_active_idx').on(table.isActive),
  categoryIdx: index('brevo_email_templates_category_idx').on(table.category),
  brevoTemplateIdx: index('brevo_email_templates_brevo_id_idx').on(table.brevoTemplateId),
  abTestParentIdx: index('brevo_email_templates_ab_parent_idx').on(table.abTestParentId),
  createdAtIdx: index('brevo_email_templates_created_at_idx').on(table.createdAt),
  uniqueTenantNameLang: index('brevo_email_templates_unique_idx').on(table.name, table.tenant, table.language)
}));

// Brevo webhook events log
export const brevoWebhookEvents = pgTable('brevo_webhook_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  messageId: varchar('message_id', { length: 100 }).notNull(),
  notificationId: uuid('notification_id'),
  
  // Event details
  event: varchar('event', { length: 50 }).notNull(), // 'delivered', 'bounce', 'opened', etc.
  eventTime: timestamp('event_time').notNull(),
  recipient: varchar('recipient', { length: 255 }).notNull(),
  subject: varchar('subject', { length: 255 }),
  
  // Event specific data
  bounceReason: text('bounce_reason'),
  userAgent: text('user_agent'),
  clickedUrl: text('clicked_url'),
  ipAddress: varchar('ip_address', { length: 45 }),
  location: jsonb('location'), // Country, city, etc.
  
  // Raw webhook data
  rawData: jsonb('raw_data').notNull(),
  
  // Processing status
  processed: boolean('processed').default(false),
  processedAt: timestamp('processed_at'),
  processingError: text('processing_error'),
  
  // Audit
  receivedAt: timestamp('received_at').defaultNow().notNull()
}, (table) => ({
  messageIdIdx: index('brevo_webhook_events_message_id_idx').on(table.messageId),
  notificationIdIdx: index('brevo_webhook_events_notification_id_idx').on(table.notificationId),
  eventIdx: index('brevo_webhook_events_event_idx').on(table.event),
  eventTimeIdx: index('brevo_webhook_events_event_time_idx').on(table.eventTime),
  processedIdx: index('brevo_webhook_events_processed_idx').on(table.processed),
  receivedAtIdx: index('brevo_webhook_events_received_at_idx').on(table.receivedAt)
}));

// Notification analytics and stats
export const notificationAnalytics = pgTable('notification_analytics', {
  id: uuid('id').primaryKey().defaultRandom(),
  date: timestamp('date').notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  tenant: varchar('tenant', { length: 10 }),
  
  // Counts
  sent: integer('sent').default(0),
  delivered: integer('delivered').default(0),
  opened: integer('opened').default(0),
  clicked: integer('clicked').default(0),
  bounced: integer('bounced').default(0),
  failed: integer('failed').default(0),
  
  // Rates (calculated)
  deliveryRate: integer('delivery_rate').default(0), // Percentage * 100
  openRate: integer('open_rate').default(0),
  clickRate: integer('click_rate').default(0),
  bounceRate: integer('bounce_rate').default(0),
  
  // Performance metrics
  avgDeliveryTimeMs: integer('avg_delivery_time_ms'),
  avgProcessingTimeMs: integer('avg_processing_time_ms'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => ({
  dateTypeIdx: index('notification_analytics_date_type_idx').on(table.date, table.type),
  tenantIdx: index('notification_analytics_tenant_idx').on(table.tenant),
  dateIdx: index('notification_analytics_date_idx').on(table.date)
}));

// User notification preferences
export const userNotificationSettings = pgTable('user_notification_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  
  // Notification types preferences
  orderConfirmation: boolean('order_confirmation').default(true),
  licenseDelivery: boolean('license_delivery').default(true),
  supportUpdates: boolean('support_updates').default(true),
  marketingEmails: boolean('marketing_emails').default(false),
  systemNotifications: boolean('system_notifications').default(true),
  
  // Channel preferences
  emailEnabled: boolean('email_enabled').default(true),
  smsEnabled: boolean('sms_enabled').default(false),
  pushEnabled: boolean('push_enabled').default(false),
  
  // Timing preferences
  quietHoursStart: varchar('quiet_hours_start', { length: 5 }), // HH:MM format
  quietHoursEnd: varchar('quiet_hours_end', { length: 5 }),
  timezone: varchar('timezone', { length: 50 }).default('UTC'),
  
  // Language preference
  preferredLanguage: varchar('preferred_language', { length: 5 }).default('en'),
  
  // Frequency settings
  digestFrequency: varchar('digest_frequency', { length: 20 }).default('immediate'), // immediate, daily, weekly
  maxEmailsPerDay: integer('max_emails_per_day').default(10),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => ({
  userIdIdx: index('user_notification_settings_user_id_idx').on(table.userId)
}));

// Export types for TypeScript
export type BrevoNotification = typeof brevoNotifications.$inferSelect;
export type InsertBrevoNotification = typeof brevoNotifications.$inferInsert;
export type BrevoEmailTemplate = typeof brevoEmailTemplates.$inferSelect;
export type InsertBrevoEmailTemplate = typeof brevoEmailTemplates.$inferInsert;
export type BrevoWebhookEvent = typeof brevoWebhookEvents.$inferSelect;
export type InsertBrevoWebhookEvent = typeof brevoWebhookEvents.$inferInsert;
export type NotificationAnalytics = typeof notificationAnalytics.$inferSelect;
export type InsertNotificationAnalytics = typeof notificationAnalytics.$inferInsert;
export type UserNotificationSettings = typeof userNotificationSettings.$inferSelect;
export type InsertUserNotificationSettings = typeof userNotificationSettings.$inferInsert;