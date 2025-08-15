import { Router } from 'express';
import { BrevoNotificationQueue } from '../../services/brevoNotificationQueue';
import { BrevoEmailService } from '../../services/brevoEmailService';
import { logger } from '../../lib/logger';
import { z } from 'zod';

const router = Router();
const notificationQueue = new BrevoNotificationQueue();
const brevoService = new BrevoEmailService();

// Validation schemas
const sendTestEmailSchema = z.object({
  recipient: z.string().email(),
  templateName: z.string().min(1),
  tenant: z.enum(['EUR', 'KM']),
  testData: z.object({}).optional()
});

const addNotificationSchema = z.object({
  userId: z.string().uuid(),
  orderId: z.string().uuid().optional(),
  type: z.string().min(1),
  channel: z.string().default('email'),
  recipient: z.string().email(),
  subject: z.string().optional(),
  content: z.string().optional(),
  metadata: z.object({}).optional(),
  priority: z.number().min(1).max(10).default(5)
});

const webhookSchema = z.object({
  event: z.string(),
  messageId: z.string(),
  email: z.string().email(),
  timestamp: z.string().optional(),
  subject: z.string().optional(),
  reason: z.string().optional()
});

/**
 * Test Brevo connection and account info
 * GET /api/admin/brevo-notifications/test-connection
 */
router.get('/test-connection', async (req, res) => {
  try {
    logger.info('🔍 Testing Brevo connection via API');
    
    const result = await brevoService.testConnection();
    
    res.json({
      success: result.success,
      message: result.success ? 'Brevo connection successful' : 'Brevo connection failed',
      data: result.accountInfo,
      error: result.error,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('❌ Brevo connection test failed', { error: errorMessage });
    res.status(500).json({
      success: false,
      message: 'Failed to test Brevo connection',
      error: errorMessage
    });
  }
});

/**
 * Test complete notification system
 * GET /api/admin/brevo-notifications/test-system
 */
router.get('/test-system', async (req, res) => {
  try {
    logger.info('🧪 Running complete notification system test');
    
    const result = await notificationQueue.testSystem();
    
    res.json({
      success: result.success,
      message: `System test completed - ${result.results.filter(r => r.success).length}/${result.results.length} tests passed`,
      results: result.results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('❌ System test failed', { error: errorMessage });
    res.status(500).json({
      success: false,
      message: 'System test failed',
      error: errorMessage
    });
  }
});

/**
 * Send test email
 * POST /api/admin/brevo-notifications/send-test
 */
router.post('/send-test', async (req, res) => {
  try {
    const validatedData = sendTestEmailSchema.parse(req.body);
    
    logger.info('📧 Sending test email via API', {
      recipient: validatedData.recipient,
      templateName: validatedData.templateName,
      tenant: validatedData.tenant
    });
    
    const result = await brevoService.sendTestEmail(validatedData);
    
    res.json({
      success: result.success,
      message: result.success ? 'Test email sent successfully' : 'Failed to send test email',
      messageId: result.messageId,
      error: result.error,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request data',
        errors: error.errors
      });
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('❌ Failed to send test email', { error: errorMessage });
    res.status(500).json({
      success: false,
      message: 'Failed to send test email',
      error: errorMessage
    });
  }
});

/**
 * Add notification to queue
 * POST /api/admin/brevo-notifications/queue
 */
router.post('/queue', async (req, res) => {
  try {
    const validatedData = addNotificationSchema.parse(req.body);
    
    logger.info('➕ Adding notification to queue via API', {
      type: validatedData.type,
      recipient: validatedData.recipient
    });
    
    const notificationId = await notificationQueue.addNotification(validatedData);
    
    res.status(201).json({
      success: true,
      message: 'Notification added to queue successfully',
      notificationId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request data',
        errors: error.errors
      });
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('❌ Failed to queue notification', { error: errorMessage });
    res.status(500).json({
      success: false,
      message: 'Failed to queue notification',
      error: errorMessage
    });
  }
});

/**
 * Get queue status and statistics
 * GET /api/admin/brevo-notifications/queue/status
 */
router.get('/queue/status', async (req, res) => {
  try {
    const status = await notificationQueue.getQueueStatus();
    const detailedStats = await notificationQueue.getDetailedStats(7); // Last 7 days
    
    res.json({
      success: true,
      queueStatus: status,
      detailedStats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('❌ Failed to get queue status', { error: errorMessage });
    res.status(500).json({
      success: false,
      message: 'Failed to get queue status',
      error: errorMessage
    });
  }
});

/**
 * Retry specific notification
 * POST /api/admin/brevo-notifications/retry/:id
 */
router.post('/retry/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Notification ID is required'
      });
    }

    logger.info('🔄 Retrying notification via API', { notificationId: id });
    
    const success = await notificationQueue.retryNotification(id);
    
    res.json({
      success,
      message: success ? 'Notification queued for retry' : 'Failed to retry notification',
      notificationId: id,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('❌ Failed to retry notification', { 
      notificationId: req.params.id,
      error: errorMessage 
    });
    res.status(500).json({
      success: false,
      message: 'Failed to retry notification',
      error: errorMessage
    });
  }
});

/**
 * Get delivery statistics from Brevo
 * GET /api/admin/brevo-notifications/delivery-stats
 */
router.get('/delivery-stats', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'startDate and endDate query parameters are required (YYYY-MM-DD format)'
      });
    }

    logger.info('📊 Fetching delivery statistics', { startDate, endDate });
    
    const result = await brevoService.getDeliveryStats(
      startDate as string, 
      endDate as string
    );
    
    res.json({
      success: result.success,
      message: result.success ? 'Delivery statistics retrieved' : 'Failed to get delivery statistics',
      data: result.stats,
      error: result.error,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('❌ Failed to get delivery statistics', { error: errorMessage });
    res.status(500).json({
      success: false,
      message: 'Failed to get delivery statistics',
      error: errorMessage
    });
  }
});

/**
 * Handle Brevo webhooks
 * POST /api/admin/brevo-notifications/webhook
 */
router.post('/webhook', async (req, res) => {
  try {
    logger.info('🔔 Received Brevo webhook', { 
      headers: req.headers,
      body: req.body 
    });

    const validatedData = webhookSchema.parse(req.body);
    
    // Process the webhook
    const deliveryStatus = await brevoService.handleWebhook(validatedData);
    
    if (deliveryStatus) {
      // Update notification status in our system
      await notificationQueue.updateDeliveryStatus(
        deliveryStatus.messageId,
        deliveryStatus.status,
        deliveryStatus.reason
      );
      
      logger.info('✅ Webhook processed successfully', {
        messageId: deliveryStatus.messageId,
        status: deliveryStatus.status
      });
    }

    // Always respond with 200 to Brevo
    res.status(200).json({
      success: true,
      message: 'Webhook processed',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('❌ Failed to process webhook', { 
      error: errorMessage,
      body: req.body 
    });
    
    // Still respond with 200 to avoid webhook retries
    res.status(200).json({
      success: false,
      message: 'Webhook processing failed',
      error: errorMessage
    });
  }
});

/**
 * Manual order confirmation trigger
 * POST /api/admin/brevo-notifications/send-order-confirmation
 */
router.post('/send-order-confirmation', async (req, res) => {
  try {
    const { orderId, email, tenant } = req.body;
    
    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: 'orderId is required'
      });
    }

    logger.info('📧 Manual order confirmation trigger', { orderId, email, tenant });

    // Add to queue for processing
    const notificationId = await notificationQueue.addNotification({
      userId: req.user?.id || 'admin',
      orderId,
      type: 'order_confirmation',
      channel: 'email',
      recipient: email || 'default', // Will be resolved from order
      metadata: { 
        manualTrigger: true,
        triggeredBy: req.user?.id || 'admin',
        tenant: tenant || 'EUR'
      }
    });

    res.json({
      success: true,
      message: 'Order confirmation queued for sending',
      notificationId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('❌ Failed to send order confirmation', { 
      orderId: req.body.orderId,
      error: errorMessage 
    });
    res.status(500).json({
      success: false,
      message: 'Failed to send order confirmation',
      error: errorMessage
    });
  }
});

/**
 * Debug endpoint - get notification details
 * GET /api/admin/brevo-notifications/debug/:id
 */
router.get('/debug/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // This would query the notification from database
    // For now, return debug info
    
    res.json({
      success: true,
      message: 'Debug information retrieved',
      notificationId: id,
      debugInfo: {
        queueStatus: await notificationQueue.getQueueStatus(),
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        brevoConfig: {
          apiKeyConfigured: !!process.env.BREVO_API_KEY,
          fromEmail: process.env.BREVO_FROM_EMAIL,
          testMode: process.env.BREVO_TEST_MODE === 'true'
        }
      }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('❌ Failed to get debug info', { error: errorMessage });
    res.status(500).json({
      success: false,
      message: 'Failed to get debug information',
      error: errorMessage
    });
  }
});

/**
 * Health check endpoint
 * GET /api/admin/brevo-notifications/health
 */
router.get('/health', async (req, res) => {
  try {
    const healthStatus = {
      service: 'Brevo Notification System',
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      checks: {
        brevoConnection: false,
        queueService: false,
        database: false
      }
    };

    // Test Brevo connection
    try {
      const brevoTest = await brevoService.testConnection();
      healthStatus.checks.brevoConnection = brevoTest.success;
    } catch (error) {
      healthStatus.checks.brevoConnection = false;
    }

    // Test queue service
    try {
      await notificationQueue.getQueueStatus();
      healthStatus.checks.queueService = true;
    } catch (error) {
      healthStatus.checks.queueService = false;
    }

    // Check if all systems are healthy
    const allHealthy = Object.values(healthStatus.checks).every(check => check === true);
    healthStatus.status = allHealthy ? 'healthy' : 'degraded';

    res.status(allHealthy ? 200 : 503).json(healthStatus);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('❌ Health check failed', { error: errorMessage });
    res.status(503).json({
      service: 'Brevo Notification System',
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: errorMessage
    });
  }
});

export default router;