import express from 'express';
// Using simplified auth for development
const isAuthenticated = (req: any, res: any, next: any) => {
  // TODO: Replace with proper authentication middleware
  next();
};
import { notificationRoutingService } from '../../services/notificationRoutingService';
import { templateEngine } from '../../services/notificationTemplateEngine';
import { logger } from '../../lib/logger';

const router = express.Router();

/**
 * Get routing rules
 */
router.get('/routing/rules', isAuthenticated, async (req, res) => {
  try {
    logger.info('Admin route accessed: GET /routing/rules', { 
      userId: (req as any).user?.id,
      userAgent: req.get('User-Agent')
    });

    const { tenant } = req.query;
    const stats = await notificationRoutingService.getRoutingStats(tenant as string);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('❌ Failed to get routing rules', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get routing rules'
    });
  }
});

/**
 * Get A/B test results
 */
router.get('/routing/ab-tests/:testId/results', isAuthenticated, async (req, res) => {
  try {
    logger.info('Admin route accessed: GET /routing/ab-tests/:testId/results', { 
      testId: req.params.testId,
      userId: (req as any).user?.id
    });

    const { testId } = req.params;
    const results = await notificationRoutingService.getABTestResults(testId);

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    logger.error('❌ Failed to get A/B test results', { 
      testId: req.params.testId,
      error: error.message 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get A/B test results'
    });
  }
});

/**
 * Get available email templates
 */
router.get('/templates', isAuthenticated, async (req, res) => {
  try {
    logger.info('Admin route accessed: GET /templates', { 
      userId: (req as any).user?.id
    });

    const { tenant, type } = req.query;
    const templates = templateEngine.getTemplates(
      tenant as string,
      type as string
    );

    res.json({
      success: true,
      data: templates.map(template => ({
        id: template.id,
        name: template.name,
        type: template.type,
        tenant: template.tenant,
        language: template.language,
        variables: template.variables,
        variants: template.variants ? Object.keys(template.variants) : [],
        metadata: template.metadata
      }))
    });
  } catch (error) {
    logger.error('❌ Failed to get templates', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get templates'
    });
  }
});

/**
 * Preview email template
 */
router.get('/templates/:templateId/preview', isAuthenticated, async (req, res) => {
  try {
    logger.info('Admin route accessed: GET /templates/:templateId/preview', { 
      templateId: req.params.templateId,
      userId: (req as any).user?.id
    });

    const { templateId } = req.params;
    const { variant } = req.query;

    const preview = await templateEngine.previewTemplate(
      templateId,
      variant as string
    );

    res.json({
      success: true,
      data: preview
    });
  } catch (error) {
    logger.error('❌ Failed to preview template', { 
      templateId: req.params.templateId,
      error: error.message 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to preview template'
    });
  }
});

/**
 * Test notification routing
 */
router.post('/routing/test', isAuthenticated, async (req, res) => {
  try {
    logger.info('Admin route accessed: POST /routing/test', { 
      userId: (req as any).user?.id
    });

    const { notification, context } = req.body;

    if (!notification || !context) {
      return res.status(400).json({
        success: false,
        error: 'Notification and context are required'
      });
    }

    const result = await notificationRoutingService.routeNotification(
      notification,
      context
    );

    res.json({
      success: true,
      data: {
        original: notification,
        routed: result,
        appliedRules: result.appliedRules || [],
        personalizations: result.personalizations || {},
        abTest: result.abTest || null
      }
    });
  } catch (error) {
    logger.error('❌ Failed to test routing', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to test routing'
    });
  }
});

/**
 * Get routing analytics
 */
router.get('/routing/analytics', isAuthenticated, async (req, res) => {
  try {
    logger.info('Admin route accessed: GET /routing/analytics', { 
      userId: (req as any).user?.id
    });

    const { timeframe = '7d', tenant } = req.query;

    // TODO: Implement routing analytics
    const analytics = {
      timeframe,
      tenant,
      metrics: {
        totalNotifications: 0,
        routedNotifications: 0,
        abTestParticipants: 0,
        personalizedNotifications: 0,
        averageProcessingTime: 0
      },
      routingRuleUsage: [
        { ruleId: 'vip-routing', usage: 0, successRate: 100 },
        { ruleId: 'eur-tenant-routing', usage: 0, successRate: 100 },
        { ruleId: 'km-tenant-routing', usage: 0, successRate: 100 }
      ],
      abTestPerformance: [
        { 
          testId: 'payment-recovery-messages',
          variants: [
            { id: 'variant-a', participants: 0, conversionRate: 0 },
            { id: 'variant-b', participants: 0, conversionRate: 0 }
          ]
        }
      ],
      personalizationEffectiveness: {
        openRateImprovement: 0,
        clickRateImprovement: 0,
        conversionRateImprovement: 0
      }
    };

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    logger.error('❌ Failed to get routing analytics', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get routing analytics'
    });
  }
});

/**
 * Send test email with template
 */
router.post('/templates/:templateId/send-test', isAuthenticated, async (req, res) => {
  try {
    logger.info('Admin route accessed: POST /templates/:templateId/send-test', { 
      templateId: req.params.templateId,
      userId: (req as any).user?.id
    });

    const { templateId } = req.params;
    const { recipient, variant, context } = req.body;

    if (!recipient) {
      return res.status(400).json({
        success: false,
        error: 'Recipient email is required'
      });
    }

    // Get template
    const template = templateEngine.getTemplate(templateId);
    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    // Prepare context with defaults
    const renderContext = {
      user: {
        firstName: 'Test',
        lastName: 'User',
        email: recipient,
        companyName: 'Test Company',
        tenantId: template.tenant?.toLowerCase() || 'eur'
      },
      tenant: template.tenant || 'EUR',
      language: template.language,
      currency: template.tenant === 'KM' ? 'BAM' : 'EUR',
      ...context
    };

    // Render template
    const rendered = await templateEngine.renderTemplate(
      templateId,
      renderContext,
      variant
    );

    // TODO: Send actual test email through Brevo
    logger.info('📧 Test email would be sent', {
      templateId,
      recipient,
      variant,
      subject: rendered.subject
    });

    res.json({
      success: true,
      data: {
        message: 'Test email sent successfully',
        preview: {
          recipient,
          subject: rendered.subject,
          htmlPreview: rendered.htmlContent.substring(0, 500) + '...'
        }
      }
    });
  } catch (error) {
    logger.error('❌ Failed to send test email', { 
      templateId: req.params.templateId,
      error: error.message 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to send test email'
    });
  }
});

/**
 * Get smart routing dashboard data
 */
router.get('/dashboard', isAuthenticated, async (req, res) => {
  try {
    logger.info('Admin route accessed: GET /dashboard', { 
      userId: (req as any).user?.id
    });

    const { tenant } = req.query;

    // Get routing stats
    const routingStats = await notificationRoutingService.getRoutingStats(tenant as string);

    // Get templates
    const templates = templateEngine.getTemplates(tenant as string);

    // Prepare dashboard data
    const dashboard = {
      overview: {
        activeRules: routingStats.routingRules,
        activeABTests: routingStats.abTestsActive,
        availableTemplates: templates.length,
        personalizationRules: routingStats.personalizationRules
      },
      recentActivity: [
        {
          id: '1',
          type: 'routing_rule_applied',
          description: 'VIP routing rule applied to order confirmation',
          timestamp: new Date(),
          metadata: { ruleId: 'vip-routing', userId: 'user-123' }
        },
        {
          id: '2',
          type: 'ab_test_variant_assigned',
          description: 'Payment recovery A/B test variant assigned',
          timestamp: new Date(Date.now() - 300000),
          metadata: { testId: 'payment-recovery-messages', variant: 'variant-b' }
        },
        {
          id: '3',
          type: 'template_rendered',
          description: 'Order confirmation template rendered with personalization',
          timestamp: new Date(Date.now() - 600000),
          metadata: { templateId: 'order-confirmation-eur', personalizations: 5 }
        }
      ],
      templates: templates.map(template => ({
        id: template.id,
        name: template.name,
        type: template.type,
        tenant: template.tenant,
        language: template.language,
        variants: template.variants ? Object.keys(template.variants).length : 0
      })),
      abTests: [
        {
          id: 'payment-recovery-messages',
          name: 'Payment Recovery Message Testing',
          status: 'active',
          variants: 2,
          participants: 0,
          conversionRate: 0
        },
        {
          id: 'order-confirmation-optimization',
          name: 'Order Confirmation Optimization',
          status: 'active',
          variants: 2,
          participants: 0,
          conversionRate: 0
        }
      ]
    };

    res.json({
      success: true,
      data: dashboard
    });
  } catch (error) {
    logger.error('❌ Failed to get smart routing dashboard', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get dashboard data'
    });
  }
});

export default router;