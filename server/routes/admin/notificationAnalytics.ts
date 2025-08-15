import { Router } from 'express';
import { notificationAnalyticsService } from '../../services/notificationAnalyticsService';
import { logger } from '../../lib/logger';
import { z } from 'zod';

const router = Router();

// Validation schemas
const analyticsQuerySchema = z.object({
  tenantId: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  days: z.string().transform(Number).optional(),
});

const realTimeQuerySchema = z.object({
  tenantId: z.string().optional(),
});

/**
 * Get comprehensive analytics summary
 * GET /api/admin/notification-analytics/summary
 */
router.get('/summary', async (req, res) => {
  try {
    const query = analyticsQuerySchema.parse(req.query);
    
    const startDate = query.startDate ? new Date(query.startDate) : undefined;
    const endDate = query.endDate ? new Date(query.endDate) : undefined;

    logger.info('🔍 Fetching analytics summary', {
      tenantId: query.tenantId,
      startDate,
      endDate
    });

    const summary = await notificationAnalyticsService.getAnalyticsSummary(
      query.tenantId,
      startDate,
      endDate
    );

    res.json({
      success: true,
      data: summary,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('❌ Failed to get analytics summary', { error: errorMessage });
    res.status(500).json({
      success: false,
      message: 'Failed to get analytics summary',
      error: errorMessage
    });
  }
});

/**
 * Get real-time metrics for live monitoring
 * GET /api/admin/notification-analytics/real-time
 */
router.get('/real-time', async (req, res) => {
  try {
    const query = realTimeQuerySchema.parse(req.query);

    logger.debug('⚡ Fetching real-time metrics', { tenantId: query.tenantId });

    const metrics = await notificationAnalyticsService.getRealTimeMetrics(query.tenantId);

    res.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('❌ Failed to get real-time metrics', { error: errorMessage });
    res.status(500).json({
      success: false,
      message: 'Failed to get real-time metrics',
      error: errorMessage
    });
  }
});

/**
 * Get failure analysis for troubleshooting
 * GET /api/admin/notification-analytics/failures
 */
router.get('/failures', async (req, res) => {
  try {
    const query = analyticsQuerySchema.parse(req.query);
    const days = query.days || 7;

    logger.info('🔍 Fetching failure analysis', {
      tenantId: query.tenantId,
      days
    });

    const analysis = await notificationAnalyticsService.getFailureAnalysis(
      query.tenantId,
      days
    );

    res.json({
      success: true,
      data: analysis,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('❌ Failed to get failure analysis', { error: errorMessage });
    res.status(500).json({
      success: false,
      message: 'Failed to get failure analysis',
      error: errorMessage
    });
  }
});

/**
 * Manually trigger daily analytics update
 * POST /api/admin/notification-analytics/update-daily
 */
router.post('/update-daily', async (req, res) => {
  try {
    const { date, tenantId } = req.body;
    
    const targetDate = date ? new Date(date) : new Date();
    
    logger.info('📊 Manually updating daily analytics', {
      date: targetDate.toISOString(),
      tenantId
    });

    await notificationAnalyticsService.updateDailyAnalytics(targetDate, tenantId);

    res.json({
      success: true,
      message: 'Daily analytics updated successfully',
      date: targetDate.toISOString(),
      tenantId: tenantId || 'all'
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('❌ Failed to update daily analytics', { error: errorMessage });
    res.status(500).json({
      success: false,
      message: 'Failed to update daily analytics',
      error: errorMessage
    });
  }
});

/**
 * Get performance metrics by notification type
 * GET /api/admin/notification-analytics/performance-by-type
 */
router.get('/performance-by-type', async (req, res) => {
  try {
    const query = analyticsQuerySchema.parse(req.query);
    
    const startDate = query.startDate ? new Date(query.startDate) : undefined;
    const endDate = query.endDate ? new Date(query.endDate) : undefined;

    logger.info('📈 Fetching performance by notification type', {
      tenantId: query.tenantId,
      startDate,
      endDate
    });

    const summary = await notificationAnalyticsService.getAnalyticsSummary(
      query.tenantId,
      startDate,
      endDate
    );

    // Extract and format template performance data
    const performanceByType = summary.templatePerformance.map(template => ({
      type: template.templateName,
      tenant: template.tenantId,
      language: template.language,
      metrics: {
        totalSent: template.totalSent,
        openRate: template.openRate,
        clickRate: template.clickRate,
        bounceRate: template.bounceRate,
        lastSentAt: template.lastSentAt
      }
    }));

    res.json({
      success: true,
      data: {
        performanceByType,
        summary: {
          totalTypes: performanceByType.length,
          avgOpenRate: performanceByType.reduce((sum, p) => sum + p.metrics.openRate, 0) / performanceByType.length,
          avgClickRate: performanceByType.reduce((sum, p) => sum + p.metrics.clickRate, 0) / performanceByType.length,
          avgBounceRate: performanceByType.reduce((sum, p) => sum + p.metrics.bounceRate, 0) / performanceByType.length
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('❌ Failed to get performance by type', { error: errorMessage });
    res.status(500).json({
      success: false,
      message: 'Failed to get performance by type',
      error: errorMessage
    });
  }
});

/**
 * Get notification volume trends for capacity planning
 * GET /api/admin/notification-analytics/volume-trends
 */
router.get('/volume-trends', async (req, res) => {
  try {
    const query = analyticsQuerySchema.parse(req.query);
    
    const startDate = query.startDate ? new Date(query.startDate) : undefined;
    const endDate = query.endDate ? new Date(query.endDate) : undefined;

    logger.info('📊 Fetching volume trends', {
      tenantId: query.tenantId,
      startDate,
      endDate
    });

    const summary = await notificationAnalyticsService.getAnalyticsSummary(
      query.tenantId,
      startDate,
      endDate
    );

    // Calculate volume trends and predictions
    const trends = summary.dailyTrends;
    const avgDailyVolume = trends.reduce((sum, day) => sum + day.sent, 0) / trends.length;
    const peakDailyVolume = Math.max(...trends.map(day => day.sent));
    const growthRate = trends.length > 1 ? 
      ((trends[trends.length - 1].sent - trends[0].sent) / trends[0].sent) * 100 : 0;

    res.json({
      success: true,
      data: {
        trends,
        summary: {
          avgDailyVolume: Math.round(avgDailyVolume),
          peakDailyVolume,
          growthRate: Number(growthRate.toFixed(2)),
          totalPeriodVolume: trends.reduce((sum, day) => sum + day.sent, 0),
          daysAnalyzed: trends.length
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('❌ Failed to get volume trends', { error: errorMessage });
    res.status(500).json({
      success: false,
      message: 'Failed to get volume trends',
      error: errorMessage
    });
  }
});

export default router;