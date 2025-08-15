import { db } from '../db';
import { brevoNotifications, notificationAnalytics, emailTemplateMetrics, notificationEvents } from '../../shared/schema';
import { eq, and, gte, lte, sql, desc, count, avg, sum } from 'drizzle-orm';
import { logger } from '../lib/logger';

export interface AnalyticsSummary {
  totalNotifications: number;
  deliveryRate: number;
  bounceRate: number;
  avgProcessingTime: number;
  dailyTrends: DailyTrend[];
  templatePerformance: TemplatePerformance[];
  recentEvents: NotificationEvent[];
}

export interface DailyTrend {
  date: string;
  sent: number;
  delivered: number;
  bounced: number;
  failed: number;
  deliveryRate: number;
}

export interface TemplatePerformance {
  templateName: string;
  tenantId: string;
  language: string;
  totalSent: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
  lastSentAt: Date | null;
}

export interface NotificationEvent {
  id: string;
  eventType: string;
  timestamp: Date;
  source: string;
  eventData: any;
}

export interface RealTimeMetrics {
  activeQueue: number;
  processingRate: number;
  errorRate: number;
  avgResponseTime: number;
  lastHourTrends: HourlyTrend[];
}

export interface HourlyTrend {
  hour: string;
  sent: number;
  delivered: number;
  failed: number;
}

export class NotificationAnalyticsService {
  
  /**
   * Get comprehensive analytics summary for the dashboard
   */
  async getAnalyticsSummary(
    tenantId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<AnalyticsSummary> {
    try {
      const dateFilter = this.getDateFilter(startDate, endDate);
      const tenantFilter = tenantId ? eq(brevoNotifications.userId, tenantId) : undefined;
      
      const filters = [dateFilter, tenantFilter].filter(Boolean);
      const whereClause = filters.length > 0 ? and(...filters) : undefined;

      // Get total notifications summary
      const totalStats = await db
        .select({
          total: count(),
          delivered: sum(sql`CASE WHEN status = 'delivered' THEN 1 ELSE 0 END`).mapWith(Number),
          bounced: sum(sql`CASE WHEN status IN ('bounced', 'soft_bounced') THEN 1 ELSE 0 END`).mapWith(Number),
          failed: sum(sql`CASE WHEN status = 'failed' THEN 1 ELSE 0 END`).mapWith(Number),
          avgProcessingTime: avg(sql`EXTRACT(EPOCH FROM (sent_at - created_at)) * 1000`).mapWith(Number),
        })
        .from(brevoNotifications)
        .where(whereClause);

      const stats = totalStats[0];
      const deliveryRate = stats.total > 0 ? (stats.delivered / stats.total) * 100 : 0;
      const bounceRate = stats.total > 0 ? (stats.bounced / stats.total) * 100 : 0;

      // Get daily trends
      const dailyTrends = await this.getDailyTrends(tenantId, startDate, endDate);
      
      // Get template performance
      const templatePerformance = await this.getTemplatePerformance(tenantId);
      
      // Get recent events
      const recentEvents = await this.getRecentEvents(tenantId, 50);

      return {
        totalNotifications: stats.total,
        deliveryRate: Number(deliveryRate.toFixed(2)),
        bounceRate: Number(bounceRate.toFixed(2)),
        avgProcessingTime: Number((stats.avgProcessingTime || 0).toFixed(0)),
        dailyTrends,
        templatePerformance,
        recentEvents
      };

    } catch (error) {
      logger.error('Failed to get analytics summary', { error: error.message, tenantId });
      throw error;
    }
  }

  /**
   * Get real-time metrics for live monitoring
   */
  async getRealTimeMetrics(tenantId?: string): Promise<RealTimeMetrics> {
    try {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      
      const tenantFilter = tenantId ? eq(brevoNotifications.userId, tenantId) : undefined;

      // Get active queue count
      const activeQueueResult = await db
        .select({ count: count() })
        .from(brevoNotifications)
        .where(
          and(
            eq(brevoNotifications.status, 'pending'),
            tenantFilter
          )
        );

      // Get last hour statistics
      const lastHourStats = await db
        .select({
          sent: count(sql`CASE WHEN status = 'sent' THEN 1 END`).mapWith(Number),
          delivered: count(sql`CASE WHEN status = 'delivered' THEN 1 END`).mapWith(Number),
          failed: count(sql`CASE WHEN status = 'failed' THEN 1 END`).mapWith(Number),
          avgProcessingTime: avg(sql`EXTRACT(EPOCH FROM (sent_at - created_at)) * 1000`).mapWith(Number),
        })
        .from(brevoNotifications)
        .where(
          and(
            gte(brevoNotifications.createdAt, oneHourAgo),
            tenantFilter
          )
        );

      const hourStats = lastHourStats[0];
      const totalLastHour = hourStats.sent + hourStats.delivered + hourStats.failed;
      const errorRate = totalLastHour > 0 ? (hourStats.failed / totalLastHour) * 100 : 0;
      const processingRate = totalLastHour; // notifications per hour

      // Get hourly trends for the last 24 hours
      const lastHourTrends = await this.getHourlyTrends(tenantId, 24);

      return {
        activeQueue: activeQueueResult[0].count,
        processingRate: Number(processingRate.toFixed(0)),
        errorRate: Number(errorRate.toFixed(2)),
        avgResponseTime: Number((hourStats.avgProcessingTime || 0).toFixed(0)),
        lastHourTrends
      };

    } catch (error) {
      logger.error('Failed to get real-time metrics', { error: error.message, tenantId });
      throw error;
    }
  }

  /**
   * Get daily trends for analytics charts
   */
  private async getDailyTrends(
    tenantId?: string,
    startDate?: Date,
    endDate?: Date,
    days: number = 30
  ): Promise<DailyTrend[]> {
    const end = endDate || new Date();
    const start = startDate || new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    
    const tenantFilter = tenantId ? eq(brevoNotifications.userId, tenantId) : undefined;

    const dailyStats = await db
      .select({
        date: sql<string>`DATE(created_at)`,
        sent: count(sql`CASE WHEN status IN ('sent', 'delivered') THEN 1 END`).mapWith(Number),
        delivered: count(sql`CASE WHEN status = 'delivered' THEN 1 END`).mapWith(Number),
        bounced: count(sql`CASE WHEN status IN ('bounced', 'soft_bounced') THEN 1 END`).mapWith(Number),
        failed: count(sql`CASE WHEN status = 'failed' THEN 1 END`).mapWith(Number),
      })
      .from(brevoNotifications)
      .where(
        and(
          gte(brevoNotifications.createdAt, start),
          lte(brevoNotifications.createdAt, end),
          tenantFilter
        )
      )
      .groupBy(sql`DATE(created_at)`)
      .orderBy(sql`DATE(created_at)`);

    return dailyStats.map(stat => ({
      date: stat.date,
      sent: stat.sent,
      delivered: stat.delivered,
      bounced: stat.bounced,
      failed: stat.failed,
      deliveryRate: stat.sent > 0 ? Number(((stat.delivered / stat.sent) * 100).toFixed(2)) : 0
    }));
  }

  /**
   * Get hourly trends for real-time monitoring
   */
  private async getHourlyTrends(tenantId?: string, hours: number = 24): Promise<HourlyTrend[]> {
    const end = new Date();
    const start = new Date(end.getTime() - hours * 60 * 60 * 1000);
    
    const tenantFilter = tenantId ? eq(brevoNotifications.userId, tenantId) : undefined;

    const hourlyStats = await db
      .select({
        hour: sql<string>`TO_CHAR(created_at, 'YYYY-MM-DD HH24:00')`,
        sent: count(sql`CASE WHEN status IN ('sent', 'delivered') THEN 1 END`).mapWith(Number),
        delivered: count(sql`CASE WHEN status = 'delivered' THEN 1 END`).mapWith(Number),
        failed: count(sql`CASE WHEN status = 'failed' THEN 1 END`).mapWith(Number),
      })
      .from(brevoNotifications)
      .where(
        and(
          gte(brevoNotifications.createdAt, start),
          tenantFilter
        )
      )
      .groupBy(sql`TO_CHAR(created_at, 'YYYY-MM-DD HH24:00')`)
      .orderBy(sql`TO_CHAR(created_at, 'YYYY-MM-DD HH24:00')`);

    return hourlyStats.map(stat => ({
      hour: stat.hour,
      sent: stat.sent,
      delivered: stat.delivered,
      failed: stat.failed
    }));
  }

  /**
   * Get template performance metrics
   */
  private async getTemplatePerformance(tenantId?: string): Promise<TemplatePerformance[]> {
    // Since we don't have emailTemplateMetrics table in current schema, 
    // we'll calculate from brevoNotifications table
    const tenantFilter = tenantId ? eq(brevoNotifications.userId, tenantId) : undefined;

    const templateStats = await db
      .select({
        type: brevoNotifications.type,
        totalSent: count().mapWith(Number),
        delivered: count(sql`CASE WHEN status = 'delivered' THEN 1 END`).mapWith(Number),
        bounced: count(sql`CASE WHEN status IN ('bounced', 'soft_bounced') THEN 1 END`).mapWith(Number),
        opened: count(sql`CASE WHEN opened_at IS NOT NULL THEN 1 END`).mapWith(Number),
        clicked: count(sql`CASE WHEN clicked_at IS NOT NULL THEN 1 END`).mapWith(Number),
        lastSent: sql<Date>`MAX(sent_at)`,
      })
      .from(brevoNotifications)
      .where(tenantFilter)
      .groupBy(brevoNotifications.type);

    return templateStats.map(stat => ({
      templateName: stat.type,
      tenantId: tenantId || 'all',
      language: 'en', // Default for now
      totalSent: stat.totalSent,
      openRate: stat.totalSent > 0 ? Number(((stat.opened / stat.totalSent) * 100).toFixed(2)) : 0,
      clickRate: stat.totalSent > 0 ? Number(((stat.clicked / stat.totalSent) * 100).toFixed(2)) : 0,
      bounceRate: stat.totalSent > 0 ? Number(((stat.bounced / stat.totalSent) * 100).toFixed(2)) : 0,
      lastSentAt: stat.lastSent
    }));
  }

  /**
   * Get recent notification events
   */
  private async getRecentEvents(tenantId?: string, limit: number = 50): Promise<NotificationEvent[]> {
    // Since we might not have notificationEvents table yet, we'll use brevoNotifications
    const tenantFilter = tenantId ? eq(brevoNotifications.userId, tenantId) : undefined;

    const recentNotifications = await db
      .select({
        id: brevoNotifications.id,
        status: brevoNotifications.status,
        type: brevoNotifications.type,
        recipient: brevoNotifications.recipient,
        createdAt: brevoNotifications.createdAt,
        sentAt: brevoNotifications.sentAt,
        deliveredAt: brevoNotifications.deliveredAt,
        failureReason: brevoNotifications.failureReason,
      })
      .from(brevoNotifications)
      .where(tenantFilter)
      .orderBy(desc(brevoNotifications.createdAt))
      .limit(limit);

    return recentNotifications.map(notification => ({
      id: notification.id,
      eventType: notification.status,
      timestamp: notification.deliveredAt || notification.sentAt || notification.createdAt,
      source: 'system',
      eventData: {
        type: notification.type,
        recipient: notification.recipient,
        failureReason: notification.failureReason
      }
    }));
  }

  /**
   * Update daily analytics aggregates
   */
  async updateDailyAnalytics(date: Date, tenantId?: string): Promise<void> {
    try {
      const dateStr = date.toISOString().split('T')[0];
      const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

      const tenantFilter = tenantId ? eq(brevoNotifications.userId, tenantId) : undefined;

      // Get notification types for the day
      const notificationTypes = await db
        .selectDistinct({ type: brevoNotifications.type })
        .from(brevoNotifications)
        .where(
          and(
            gte(brevoNotifications.createdAt, startOfDay),
            lte(brevoNotifications.createdAt, endOfDay),
            tenantFilter
          )
        );

      // Update analytics for each type
      for (const { type } of notificationTypes) {
        const stats = await db
          .select({
            totalSent: count().mapWith(Number),
            totalDelivered: count(sql`CASE WHEN status = 'delivered' THEN 1 END`).mapWith(Number),
            totalBounced: count(sql`CASE WHEN status IN ('bounced', 'soft_bounced') THEN 1 END`).mapWith(Number),
            totalFailed: count(sql`CASE WHEN status = 'failed' THEN 1 END`).mapWith(Number),
            avgProcessingTime: avg(sql`EXTRACT(EPOCH FROM (sent_at - created_at)) * 1000`).mapWith(Number),
          })
          .from(brevoNotifications)
          .where(
            and(
              eq(brevoNotifications.type, type),
              gte(brevoNotifications.createdAt, startOfDay),
              lte(brevoNotifications.createdAt, endOfDay),
              tenantFilter
            )
          );

        const stat = stats[0];
        const deliveryRate = stat.totalSent > 0 ? (stat.totalDelivered / stat.totalSent) * 100 : 0;
        const bounceRate = stat.totalSent > 0 ? (stat.totalBounced / stat.totalSent) * 100 : 0;

        // Upsert analytics record
        await db
          .insert(notificationAnalytics)
          .values({
            date: dateStr,
            type: type,
            tenantId: tenantId || 'all',
            totalSent: stat.totalSent,
            totalDelivered: stat.totalDelivered,
            totalBounced: stat.totalBounced,
            totalFailed: stat.totalFailed,
            avgProcessingTime: Math.round(stat.avgProcessingTime || 0),
            deliveryRate: deliveryRate.toFixed(2),
            bounceRate: bounceRate.toFixed(2),
          })
          .onConflictDoUpdate({
            target: [notificationAnalytics.date, notificationAnalytics.type, notificationAnalytics.tenantId],
            set: {
              totalSent: stat.totalSent,
              totalDelivered: stat.totalDelivered,
              totalBounced: stat.totalBounced,
              totalFailed: stat.totalFailed,
              avgProcessingTime: Math.round(stat.avgProcessingTime || 0),
              deliveryRate: deliveryRate.toFixed(2),
              bounceRate: bounceRate.toFixed(2),
              updatedAt: sql`NOW()`,
            },
          });
      }

      logger.info('📊 Daily analytics updated', { date: dateStr, tenantId });

    } catch (error) {
      logger.error('Failed to update daily analytics', { 
        error: error.message, 
        date: date.toISOString(), 
        tenantId 
      });
      throw error;
    }
  }

  /**
   * Get failure analysis for troubleshooting
   */
  async getFailureAnalysis(tenantId?: string, days: number = 7): Promise<any> {
    const end = new Date();
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    
    const tenantFilter = tenantId ? eq(brevoNotifications.userId, tenantId) : undefined;

    const failureReasons = await db
      .select({
        reason: brevoNotifications.failureReason,
        count: count().mapWith(Number),
      })
      .from(brevoNotifications)
      .where(
        and(
          eq(brevoNotifications.status, 'failed'),
          gte(brevoNotifications.createdAt, start),
          tenantFilter
        )
      )
      .groupBy(brevoNotifications.failureReason)
      .orderBy(desc(count()));

    return {
      timeRange: { start, end },
      failureReasons: failureReasons.filter(r => r.reason),
      totalFailures: failureReasons.reduce((sum, r) => sum + r.count, 0)
    };
  }

  /**
   * Helper method to create date filters
   */
  private getDateFilter(startDate?: Date, endDate?: Date) {
    if (startDate && endDate) {
      return and(
        gte(brevoNotifications.createdAt, startDate),
        lte(brevoNotifications.createdAt, endDate)
      );
    } else if (startDate) {
      return gte(brevoNotifications.createdAt, startDate);
    } else if (endDate) {
      return lte(brevoNotifications.createdAt, endDate);
    }
    return undefined;
  }
}

export const notificationAnalyticsService = new NotificationAnalyticsService();