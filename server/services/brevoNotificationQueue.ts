import { db } from '../db';
import { brevoNotifications } from '../../shared/schema';
import { eq, and, lte, or, isNull, gte, sql } from 'drizzle-orm';
import { BrevoEmailService, EmailOrderData } from './brevoEmailService';
import { logger } from '../lib/logger';
import cron from 'node-cron';

export interface QueuedNotification {
  id: string;
  userId: string;
  orderId?: string;
  type: string;
  channel: string;
  recipient: string;
  subject?: string;
  content?: string;
  metadata?: any;
  retryCount: number;
  nextRetryAt?: Date;
  brevoMessageId?: string;
  deliveryStatus?: string;
}

export interface NotificationQueueStatus {
  pending: number;
  processing: number;
  failed: number;
  sent: number;
  delivered: number;
  bounced: number;
}

export class BrevoNotificationQueue {
  private brevoService: BrevoEmailService;
  private isProcessing = false;
  private maxRetries = 3;
  private retryDelays = [5 * 60 * 1000, 30 * 60 * 1000, 2 * 60 * 60 * 1000]; // 5min, 30min, 2h
  private processingInterval: NodeJS.Timer | null = null;
  private debugMode: boolean;

  constructor() {
    this.debugMode = process.env.NODE_ENV === 'development';
    this.brevoService = new BrevoEmailService();
    this.initializeScheduler();
    
    if (this.debugMode) {
      logger.info('🚀 BrevoNotificationQueue initialized', {
        maxRetries: this.maxRetries,
        retryDelays: this.retryDelays
      });
    }
  }

  private initializeScheduler(): void {
    // Process queue every minute in production, every 10 seconds in development
    const cronPattern = this.debugMode ? '*/10 * * * * *' : '* * * * *';
    
    cron.schedule(cronPattern, async () => {
      if (!this.isProcessing) {
        await this.processQueue();
      }
    });

    // Cleanup old notifications daily at 2 AM
    cron.schedule('0 2 * * *', async () => {
      await this.cleanupOldNotifications();
    });

    logger.info('📅 Notification queue scheduler initialized', {
      processingInterval: this.debugMode ? '10 seconds' : '1 minute',
      cleanupTime: '02:00 daily'
    });
  }

  /**
   * Add a notification to the queue
   */
  async addNotification(notification: Omit<QueuedNotification, 'id' | 'retryCount'>): Promise<string> {
    try {
      logger.info('➕ Adding notification to queue', {
        type: notification.type,
        channel: notification.channel,
        recipient: notification.recipient,
        orderId: notification.orderId
      });

      const [result] = await db.insert(brevoNotifications).values({
        userId: notification.userId,
        orderId: notification.orderId,
        type: notification.type,
        channel: notification.channel,
        recipient: notification.recipient,
        subject: notification.subject,
        content: notification.content,
        metadata: notification.metadata,
        status: 'pending',
        retryCount: 0
      }).returning({ id: brevoNotifications.id });

      logger.info('✅ Notification queued successfully', { 
        notificationId: result.id, 
        type: notification.type 
      });

      return result.id;

    } catch (error) {
      logger.error('❌ Failed to queue notification', { 
        error: error.message, 
        notification 
      });
      throw error;
    }
  }

  /**
   * Process the notification queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    const startTime = Date.now();
    
    try {
      const pendingNotifications = await db
        .select()
        .from(brevoNotifications)
        .where(
          and(
            or(
              eq(brevoNotifications.status, 'pending'),
              and(
                eq(brevoNotifications.status, 'failed'),
                lte(brevoNotifications.nextRetryAt, new Date()),
                lte(brevoNotifications.retryCount, this.maxRetries)
              )
            )
          )
        )
        .limit(20); // Process max 20 notifications at a time

      if (pendingNotifications.length > 0) {
        logger.info('🔄 Processing notification queue', { 
          count: pendingNotifications.length 
        });

        // Process notifications in parallel (max 5 concurrent)
        const batchSize = 5;
        for (let i = 0; i < pendingNotifications.length; i += batchSize) {
          const batch = pendingNotifications.slice(i, i + batchSize);
          await Promise.all(batch.map(notification => this.processNotification(notification)));
        }
      } else if (this.debugMode) {
        logger.debug('📭 No pending notifications to process');
      }

    } catch (error) {
      logger.error('❌ Error processing notification queue', { 
        error: error.message,
        stack: error.stack 
      });
    } finally {
      this.isProcessing = false;
      const processingTime = Date.now() - startTime;
      
      if (this.debugMode) {
        logger.debug('⏱️ Queue processing completed', { 
          processingTimeMs: processingTime 
        });
      }
    }
  }

  /**
   * Process individual notification
   */
  private async processNotification(notification: any): Promise<void> {
    const notificationId = notification.id;
    
    try {
      logger.info('📤 Processing notification', {
        id: notificationId,
        type: notification.type,
        channel: notification.channel,
        retryCount: notification.retryCount
      });

      // Mark as processing
      await db
        .update(brevoNotifications)
        .set({ 
          status: 'processing',
          updatedAt: new Date()
        })
        .where(eq(brevoNotifications.id, notificationId));

      let success = false;
      let messageId: string | undefined;

      switch (notification.channel) {
        case 'email':
          const result = await this.processEmailNotification(notification);
          success = result.success;
          messageId = result.messageId;
          break;
        default:
          logger.warn('⚠️ Unsupported notification channel', { 
            channel: notification.channel,
            notificationId 
          });
          break;
      }

      if (success) {
        await db
          .update(brevoNotifications)
          .set({ 
            status: 'sent',
            sentAt: new Date(),
            updatedAt: new Date(),
            metadata: {
              ...notification.metadata,
              brevoMessageId: messageId
            }
          })
          .where(eq(brevoNotifications.id, notificationId));

        logger.info('✅ Notification sent successfully', { 
          notificationId,
          messageId 
        });
      } else {
        await this.handleFailedNotification(notification);
      }

    } catch (error) {
      logger.error('❌ Error processing notification', { 
        notificationId,
        error: error.message,
        stack: error.stack
      });
      await this.handleFailedNotification(notification, error.message);
    }
  }

  /**
   * Process email notification
   */
  private async processEmailNotification(notification: any): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }> {
    try {
      if (notification.type === 'order_confirmation' && notification.orderId) {
        // Get full order data for order confirmation emails
        const orderData = await this.getOrderData(notification.orderId);
        
        if (!orderData) {
          logger.error('❌ Order data not found', { 
            orderId: notification.orderId,
            notificationId: notification.id 
          });
          return { success: false, error: 'Order data not found' };
        }

        // Send order confirmation via Brevo
        const result = await this.brevoService.sendOrderConfirmation(orderData);
        return result;

      } else {
        // Send generic notification email
        return await this.sendGenericEmail(notification);
      }

    } catch (error) {
      logger.error('❌ Failed to process email notification', { 
        notificationId: notification.id,
        error: error.message 
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Send generic email notification
   */
  private async sendGenericEmail(notification: any): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }> {
    try {
      const testData = {
        orderNumber: 'GENERIC-001',
        customerName: 'Valued Customer',
        orderDate: new Date().toLocaleDateString(),
        totalAmount: '0.00',
        currency: 'EUR',
        items: []
      };

      const result = await this.brevoService.sendTestEmail({
        recipient: notification.recipient,
        templateName: notification.type,
        tenant: notification.metadata?.tenant || 'EUR',
        testData: notification.metadata?.templateData || testData
      });

      return result;

    } catch (error) {
      logger.error('❌ Failed to send generic email', { 
        notificationId: notification.id,
        error: error.message 
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle failed notification
   */
  private async handleFailedNotification(notification: any, errorMessage?: string): Promise<void> {
    const newRetryCount = notification.retryCount + 1;
    const notificationId = notification.id;
    
    if (newRetryCount <= this.maxRetries) {
      const nextRetryAt = new Date(Date.now() + this.retryDelays[newRetryCount - 1]);
      
      await db
        .update(brevoNotifications)
        .set({
          status: 'failed',
          retryCount: newRetryCount,
          nextRetryAt,
          failureReason: errorMessage,
          updatedAt: new Date()
        })
        .where(eq(brevoNotifications.id, notificationId));

      logger.warn('⚠️ Notification failed, scheduled for retry', { 
        notificationId,
        retryCount: newRetryCount,
        nextRetryAt: nextRetryAt.toISOString(),
        error: errorMessage 
      });
    } else {
      await db
        .update(brevoNotifications)
        .set({
          status: 'permanently_failed',
          failureReason: errorMessage || 'Max retries exceeded',
          updatedAt: new Date()
        })
        .where(eq(brevoNotifications.id, notificationId));

      logger.error('💀 Notification permanently failed', { 
        notificationId,
        errorMessage 
      });
    }
  }

  /**
   * Get order data for email notifications
   */
  private async getOrderData(orderId: string): Promise<EmailOrderData | null> {
    try {
      // This would integrate with your existing order system
      // For now, return a mock order for testing
      logger.debug('🔍 Fetching order data', { orderId });

      // In real implementation, you'd query your orders, orderItems, licenseKeys tables
      // This is a simplified example
      const mockOrderData: EmailOrderData = {
        orderId,
        orderNumber: `ORD-${Date.now()}`,
        customerName: 'Test Customer',
        customerEmail: 'test@example.com',
        tenant: 'EUR',
        totalAmount: 199.99,
        currency: 'EUR',
        orderDate: new Date(),
        items: [
          {
            productId: 'prod-1',
            productName: 'Antivirus Pro Security',
            sku: 'SKU-12345',
            quantity: 1,
            unitPrice: 199.99,
            totalPrice: 199.99
          }
        ],
        licenseKeys: [
          {
            productName: 'Antivirus Pro Security',
            sku: 'SKU-12345',
            licenseKey: 'ABCD-EFGH-IJKL-MNOP',
            activationUrl: 'https://activate.example.com',
            expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
          }
        ]
      };

      return mockOrderData;

    } catch (error) {
      logger.error('❌ Failed to get order data', { 
        orderId,
        error: error.message 
      });
      return null;
    }
  }

  /**
   * Cleanup old notifications
   */
  private async cleanupOldNotifications(): Promise<void> {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      const result = await db
        .delete(brevoNotifications)
        .where(
          and(
            lte(brevoNotifications.createdAt, thirtyDaysAgo),
            or(
              eq(brevoNotifications.status, 'sent'),
              eq(brevoNotifications.status, 'delivered'),
              eq(brevoNotifications.status, 'permanently_failed')
            )
          )
        );

      logger.info('🧹 Cleaned up old notifications', { 
        deletedCount: result.rowCount,
        cutoffDate: thirtyDaysAgo.toISOString() 
      });

    } catch (error) {
      logger.error('❌ Error cleaning up old notifications', { 
        error: error.message 
      });
    }
  }

  /**
   * Get queue status statistics
   */
  async getQueueStatus(): Promise<NotificationQueueStatus> {
    try {
      const results = await db
        .select({
          status: brevoNotifications.status,
          count: sql`COUNT(*)`
        })
        .from(brevoNotifications)
        .where(gte(brevoNotifications.createdAt, sql`NOW() - INTERVAL '24 hours'`))
        .groupBy(brevoNotifications.status);

      const status: NotificationQueueStatus = { 
        pending: 0, 
        processing: 0, 
        failed: 0, 
        sent: 0,
        delivered: 0,
        bounced: 0
      };
      
      results.forEach(result => {
        const count = parseInt(result.count as string);
        switch (result.status) {
          case 'pending':
            status.pending = count;
            break;
          case 'processing':
            status.processing = count;
            break;
          case 'failed':
          case 'permanently_failed':
            status.failed += count;
            break;
          case 'sent':
            status.sent = count;
            break;
          case 'delivered':
            status.delivered = count;
            break;
          case 'bounced':
          case 'blocked':
          case 'spam':
            status.bounced += count;
            break;
        }
      });

      return status;

    } catch (error) {
      logger.error('❌ Failed to get queue status', { 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Retry specific notification
   */
  async retryNotification(notificationId: string): Promise<boolean> {
    try {
      logger.info('🔄 Manually retrying notification', { notificationId });

      await db
        .update(brevoNotifications)
        .set({
          status: 'pending',
          nextRetryAt: null,
          failureReason: null,
          updatedAt: new Date()
        })
        .where(eq(brevoNotifications.id, notificationId));

      logger.info('✅ Notification queued for retry', { notificationId });
      return true;

    } catch (error) {
      logger.error('❌ Failed to retry notification', { 
        notificationId,
        error: error.message 
      });
      return false;
    }
  }

  /**
   * Update delivery status from Brevo webhook
   */
  async updateDeliveryStatus(messageId: string, status: string, reason?: string): Promise<boolean> {
    try {
      logger.info('📬 Updating delivery status', { 
        messageId, 
        status,
        reason 
      });

      const updateData: any = {
        status: this.mapDeliveryStatus(status),
        updatedAt: new Date()
      };

      if (status === 'delivered') {
        updateData.deliveredAt = new Date();
      }

      if (reason) {
        updateData.failureReason = reason;
      }

      await db
        .update(brevoNotifications)
        .set(updateData)
        .where(sql`metadata->>'brevoMessageId' = ${messageId}`);

      logger.info('✅ Delivery status updated', { messageId, status });
      return true;

    } catch (error) {
      logger.error('❌ Failed to update delivery status', { 
        messageId,
        error: error.message 
      });
      return false;
    }
  }

  /**
   * Map Brevo delivery status to our internal status
   */
  private mapDeliveryStatus(brevoStatus: string): string {
    const statusMap: { [key: string]: string } = {
      'delivered': 'delivered',
      'bounce': 'bounced',
      'softBounce': 'soft_bounced',
      'blocked': 'blocked',
      'spam': 'spam',
      'opened': 'opened',
      'clicked': 'clicked'
    };

    return statusMap[brevoStatus] || 'sent';
  }

  /**
   * Test the notification system
   */
  async testSystem(): Promise<{ success: boolean; results: any[] }> {
    const results: any[] = [];

    try {
      logger.info('🧪 Starting notification system test...');

      // Test 1: Brevo connection
      logger.info('📡 Testing Brevo connection...');
      const connectionTest = await this.brevoService.testConnection();
      results.push({
        test: 'Brevo Connection',
        success: connectionTest.success,
        data: connectionTest.accountInfo,
        error: connectionTest.error
      });

      // Test 2: Queue functionality
      logger.info('🔄 Testing queue functionality...');
      const testNotificationId = await this.addNotification({
        userId: 'test-user',
        type: 'test_notification',
        channel: 'email',
        recipient: 'test@example.com',
        subject: 'Test Notification',
        content: 'This is a test notification',
        metadata: { test: true, tenant: 'EUR' }
      });

      results.push({
        test: 'Queue Addition',
        success: !!testNotificationId,
        data: { notificationId: testNotificationId }
      });

      // Test 3: Queue status
      logger.info('📊 Testing queue status...');
      const queueStatus = await this.getQueueStatus();
      results.push({
        test: 'Queue Status',
        success: true,
        data: queueStatus
      });

      logger.info('✅ Notification system test completed', { 
        totalTests: results.length,
        successCount: results.filter(r => r.success).length
      });

      return { success: true, results };

    } catch (error) {
      logger.error('❌ Notification system test failed', { 
        error: error.message 
      });
      
      results.push({
        test: 'System Test',
        success: false,
        error: error.message
      });

      return { success: false, results };
    }
  }

  /**
   * Get detailed notification statistics
   */
  async getDetailedStats(days = 7): Promise<any> {
    try {
      const daysAgo = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const stats = await db
        .select({
          date: sql`DATE(created_at)`,
          status: brevoNotifications.status,
          type: brevoNotifications.type,
          count: sql`COUNT(*)`
        })
        .from(brevoNotifications)
        .where(gte(brevoNotifications.createdAt, daysAgo))
        .groupBy(sql`DATE(created_at)`, brevoNotifications.status, brevoNotifications.type)
        .orderBy(sql`DATE(created_at) DESC`);

      return stats;

    } catch (error) {
      logger.error('❌ Failed to get detailed stats', { 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Stop the queue processor
   */
  stop(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    logger.info('🛑 Notification queue stopped');
  }
}