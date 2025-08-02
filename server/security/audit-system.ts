// 📊 COMPREHENSIVE SECURITY AUDIT SYSTEM
// Phase 3 Implementation - Advanced logging and monitoring

import { logger } from '../lib/logger';
import { redisCache } from '../cache/redis';
import { Request } from 'express';

export interface AuditEvent {
  id: string;
  timestamp: Date;
  category: 'authentication' | 'authorization' | 'data_access' | 'system' | 'security' | 'admin' | 'fraud';
  action: string;
  userId?: string;
  ipAddress: string;
  userAgent: string;
  endpoint?: string;
  method?: string;
  success: boolean;
  details: Record<string, any>;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  metadata: {
    sessionId?: string;
    requestId?: string;
    duration?: number;
    responseCode?: number;
    dataAccessed?: string[];
    changes?: Record<string, { before: any; after: any }>;
  };
}

export interface AuditQuery {
  startDate?: Date;
  endDate?: Date;
  category?: string;
  action?: string;
  userId?: string;
  ipAddress?: string;
  riskLevel?: string;
  success?: boolean;
  limit?: number;
  offset?: number;
}

export interface AuditStats {
  totalEvents: number;
  eventsByCategory: Record<string, number>;
  eventsByRiskLevel: Record<string, number>;
  failureRate: number;
  topUsers: Array<{ userId: string; eventCount: number }>;
  topIPs: Array<{ ipAddress: string; eventCount: number }>;
  recentCriticalEvents: AuditEvent[];
}

export class SecurityAuditSystem {
  private static readonly CACHE_PREFIX = 'audit:';
  private static readonly EVENT_TTL = 2592000; // 30 days
  private static readonly STATS_TTL = 3600; // 1 hour
  private static readonly MAX_EVENTS_PER_QUERY = 1000;

  /**
   * Log a security audit event
   */
  static async logEvent(
    category: AuditEvent['category'],
    action: string,
    success: boolean,
    options: {
      userId?: string;
      ipAddress?: string;
      userAgent?: string;
      endpoint?: string;
      method?: string;
      details?: Record<string, any>;
      riskLevel?: AuditEvent['riskLevel'];
      metadata?: Partial<AuditEvent['metadata']>;
      req?: Request;
    } = {}
  ): Promise<string> {
    const eventId = this.generateEventId();
    const timestamp = new Date();

    // Extract info from request if provided
    let ipAddress = options.ipAddress;
    let userAgent = options.userAgent;
    let endpoint = options.endpoint;
    let method = options.method;

    if (options.req) {
      ipAddress = ipAddress || this.getClientIP(options.req);
      userAgent = userAgent || options.req.get('User-Agent') || 'unknown';
      endpoint = endpoint || options.req.path;
      method = method || options.req.method;
    }

    const event: AuditEvent = {
      id: eventId,
      timestamp,
      category,
      action,
      userId: options.userId,
      ipAddress: ipAddress || 'unknown',
      userAgent: userAgent || 'unknown',
      endpoint,
      method,
      success,
      details: options.details || {},
      riskLevel: options.riskLevel || this.calculateRiskLevel(category, action, success),
      metadata: {
        requestId: this.generateRequestId(),
        ...options.metadata
      }
    };

    // Store event in Redis with TTL
    const eventKey = `${this.CACHE_PREFIX}event:${eventId}`;
    await redisCache.set(eventKey, event, this.EVENT_TTL);

    // Add to time-based indexes for efficient querying
    await this.indexEvent(event);

    // Log to application logger
    logger.info('Security audit event', {
      category,
      action,
      success,
      riskLevel: event.riskLevel,
      userId: options.userId,
      ipAddress: event.ipAddress
    });

    // Handle critical events immediately
    if (event.riskLevel === 'critical') {
      await this.handleCriticalEvent(event);
    }

    return eventId;
  }

  /**
   * Log authentication events
   */
  static async logAuthentication(
    action: 'login_attempt' | 'login_success' | 'login_failure' | 'logout' | '2fa_verification' | 'password_change',
    userId: string,
    success: boolean,
    req: Request,
    details: Record<string, any> = {}
  ): Promise<string> {
    return this.logEvent('authentication', action, success, {
      userId,
      req,
      details,
      riskLevel: success ? 'low' : 'medium'
    });
  }

  /**
   * Log authorization events
   */
  static async logAuthorization(
    action: 'permission_check' | 'access_denied' | 'privilege_escalation',
    userId: string,
    success: boolean,
    req: Request,
    details: Record<string, any> = {}
  ): Promise<string> {
    return this.logEvent('authorization', action, success, {
      userId,
      req,
      details,
      riskLevel: success ? 'low' : 'high'
    });
  }

  /**
   * Log data access events
   */
  static async logDataAccess(
    action: 'data_read' | 'data_write' | 'data_delete' | 'bulk_operation' | 'export' | 'import',
    userId: string,
    success: boolean,
    req: Request,
    details: Record<string, any> = {}
  ): Promise<string> {
    const riskLevel = action.includes('delete') || action.includes('bulk') ? 'high' : 'low';
    
    return this.logEvent('data_access', action, success, {
      userId,
      req,
      details,
      riskLevel: success ? riskLevel : 'high'
    });
  }

  /**
   * Log admin actions
   */
  static async logAdminAction(
    action: string,
    adminUserId: string,
    success: boolean,
    req: Request,
    details: Record<string, any> = {}
  ): Promise<string> {
    return this.logEvent('admin', action, success, {
      userId: adminUserId,
      req,
      details,
      riskLevel: 'high' // All admin actions are high risk
    });
  }

  /**
   * Log fraud detection events
   */
  static async logFraudEvent(
    action: string,
    userId: string | undefined,
    success: boolean,
    req: Request,
    details: Record<string, any> = {}
  ): Promise<string> {
    return this.logEvent('fraud', action, success, {
      userId,
      req,
      details,
      riskLevel: 'critical'
    });
  }

  /**
   * Query audit events with filtering and pagination
   */
  static async queryEvents(query: AuditQuery = {}): Promise<{
    events: AuditEvent[];
    total: number;
    hasMore: boolean;
  }> {
    const limit = Math.min(query.limit || 50, this.MAX_EVENTS_PER_QUERY);
    const offset = query.offset || 0;

    // Build search pattern based on query  
    const pattern = this.buildSearchPattern(query);
    // For now, get all event keys - would use proper indexing in production
    const allKeys = Object.keys(await redisCache.getAll() || {});
    const eventKeys = allKeys.filter(key => key.startsWith(`${this.CACHE_PREFIX}event:`));

    // Filter and sort events
    let events: AuditEvent[] = [];
    
    for (const key of eventKeys) {
      const event = await redisCache.get(key) as AuditEvent | null;
      if (event && this.matchesQuery(event, query)) {
        events.push(event);
      }
    }

    // Sort by timestamp (newest first)
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const total = events.length;
    const paginatedEvents = events.slice(offset, offset + limit);

    return {
      events: paginatedEvents,
      total,
      hasMore: offset + limit < total
    };
  }

  /**
   * Get audit statistics
   */
  static async getAuditStats(timeRange: 'hour' | 'day' | 'week' | 'month' = 'day'): Promise<AuditStats> {
    const cacheKey = `${this.CACHE_PREFIX}stats:${timeRange}`;
    const cachedStats = await redisCache.get(cacheKey);

    if (cachedStats) {
      return cachedStats as AuditStats;
    }

    // Calculate time window
    const now = new Date();
    const timeWindows = {
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000
    };

    const startTime = new Date(now.getTime() - timeWindows[timeRange]);

    // Query events in time range
    const { events } = await this.queryEvents({
      startDate: startTime,
      endDate: now,
      limit: this.MAX_EVENTS_PER_QUERY
    });

    // Calculate statistics
    const stats: AuditStats = {
      totalEvents: events.length,
      eventsByCategory: {},
      eventsByRiskLevel: {},
      failureRate: 0,
      topUsers: [],
      topIPs: [],
      recentCriticalEvents: []
    };

    // Aggregate data
    const userCounts: Record<string, number> = {};
    const ipCounts: Record<string, number> = {};
    let failureCount = 0;

    for (const event of events) {
      // Category counts
      stats.eventsByCategory[event.category] = (stats.eventsByCategory[event.category] || 0) + 1;
      
      // Risk level counts
      stats.eventsByRiskLevel[event.riskLevel] = (stats.eventsByRiskLevel[event.riskLevel] || 0) + 1;
      
      // Failure tracking
      if (!event.success) {
        failureCount++;
      }

      // User activity
      if (event.userId) {
        userCounts[event.userId] = (userCounts[event.userId] || 0) + 1;
      }

      // IP activity
      ipCounts[event.ipAddress] = (ipCounts[event.ipAddress] || 0) + 1;

      // Critical events
      if (event.riskLevel === 'critical') {
        stats.recentCriticalEvents.push(event);
      }
    }

    // Calculate failure rate
    stats.failureRate = events.length > 0 ? (failureCount / events.length) * 100 : 0;

    // Sort and limit top users and IPs
    stats.topUsers = Object.entries(userCounts)
      .map(([userId, count]) => ({ userId, eventCount: count }))
      .sort((a, b) => b.eventCount - a.eventCount)
      .slice(0, 10);

    stats.topIPs = Object.entries(ipCounts)
      .map(([ipAddress, count]) => ({ ipAddress, eventCount: count }))
      .sort((a, b) => b.eventCount - a.eventCount)
      .slice(0, 10);

    // Sort critical events by timestamp
    stats.recentCriticalEvents.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    stats.recentCriticalEvents = stats.recentCriticalEvents.slice(0, 20);

    // Cache stats
    await redisCache.set(cacheKey, stats, this.STATS_TTL);

    return stats;
  }

  /**
   * Get security timeline for a specific user
   */
  static async getUserSecurityTimeline(userId: string, limit = 50): Promise<AuditEvent[]> {
    const { events } = await this.queryEvents({ userId, limit });
    return events;
  }

  /**
   * Get recent critical security events
   */
  static async getCriticalEvents(limit = 20): Promise<AuditEvent[]> {
    const { events } = await this.queryEvents({ riskLevel: 'critical', limit });
    return events;
  }

  /**
   * Export audit logs for compliance
   */
  static async exportAuditLogs(query: AuditQuery): Promise<string> {
    const { events } = await this.queryEvents({
      ...query,
      limit: this.MAX_EVENTS_PER_QUERY
    });

    // Convert to CSV format
    const headers = [
      'ID', 'Timestamp', 'Category', 'Action', 'User ID', 'IP Address',
      'Endpoint', 'Method', 'Success', 'Risk Level', 'Details'
    ];

    const csvRows = [
      headers.join(','),
      ...events.map(event => [
        event.id,
        event.timestamp.toISOString(),
        event.category,
        event.action,
        event.userId || '',
        event.ipAddress,
        event.endpoint || '',
        event.method || '',
        event.success.toString(),
        event.riskLevel,
        JSON.stringify(event.details).replace(/"/g, '""')
      ].map(field => `"${field}"`).join(','))
    ];

    return csvRows.join('\n');
  }

  /**
   * Clean up old audit events
   */
  static async cleanupOldEvents(olderThanDays = 30): Promise<number> {
    const cutoffTime = new Date(Date.now() - (olderThanDays * 24 * 60 * 60 * 1000));
    // Get all event keys
    const allKeys = Object.keys(await redisCache.getAll() || {});
    const eventKeys = allKeys.filter(key => key.startsWith(`${this.CACHE_PREFIX}event:`));

    let deletedCount = 0;

    for (const key of eventKeys) {
      const event = await redisCache.get(key) as AuditEvent | null;
      if (event && new Date(event.timestamp) < cutoffTime) {
        await redisCache.del(key);
        deletedCount++;
      }
    }

    logger.info('Audit cleanup completed', { deletedCount, cutoffDays: olderThanDays });
    return deletedCount;
  }

  // Private helper methods

  private static generateEventId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private static generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  private static calculateRiskLevel(
    category: AuditEvent['category'],
    action: string,
    success: boolean
  ): AuditEvent['riskLevel'] {
    if (!success) {
      if (category === 'authentication' || category === 'authorization') {
        return 'high';
      }
      return 'medium';
    }

    if (category === 'fraud') return 'critical';
    if (category === 'admin') return 'high';
    if (action.includes('delete') || action.includes('bulk')) return 'medium';
    
    return 'low';
  }

  private static async indexEvent(event: AuditEvent): Promise<void> {
    // Create time-based indexes for efficient querying
    const timeIndexes = [
      `${this.CACHE_PREFIX}index:hour:${this.getHourKey(event.timestamp)}`,
      `${this.CACHE_PREFIX}index:day:${this.getDayKey(event.timestamp)}`,
      `${this.CACHE_PREFIX}index:category:${event.category}`,
      `${this.CACHE_PREFIX}index:risk:${event.riskLevel}`
    ];

    if (event.userId) {
      timeIndexes.push(`${this.CACHE_PREFIX}index:user:${event.userId}`);
    }

    // Add event ID to relevant indexes
    for (const indexKey of timeIndexes) {
      const eventIds = (await redisCache.get(indexKey) || []) as string[];
      eventIds.push(event.id);
      await redisCache.set(indexKey, eventIds, this.EVENT_TTL);
    }
  }

  private static async handleCriticalEvent(event: AuditEvent): Promise<void> {
    // Store in priority queue for immediate admin attention
    const alertKey = `${this.CACHE_PREFIX}critical_alerts`;
    const alerts = (await redisCache.get(alertKey) || []) as AuditEvent[];
    alerts.unshift(event); // Add to front of queue
    
    // Keep only latest 100 critical alerts
    if (alerts.length > 100) {
      alerts.splice(100);
    }
    
    await redisCache.set(alertKey, alerts, 86400); // 24 hours

    logger.error('Critical security event detected', {
      eventId: event.id,
      category: event.category,
      action: event.action,
      userId: event.userId,
      ipAddress: event.ipAddress
    });
  }

  private static buildSearchPattern(query: AuditQuery): string {
    // Simple pattern for now - would be more sophisticated with proper indexing
    return `${this.CACHE_PREFIX}event:*`;
  }

  private static matchesQuery(event: AuditEvent, query: AuditQuery): boolean {
    if (query.startDate && new Date(event.timestamp) < query.startDate) return false;
    if (query.endDate && new Date(event.timestamp) > query.endDate) return false;
    if (query.category && event.category !== query.category) return false;
    if (query.action && event.action !== query.action) return false;
    if (query.userId && event.userId !== query.userId) return false;
    if (query.ipAddress && event.ipAddress !== query.ipAddress) return false;
    if (query.riskLevel && event.riskLevel !== query.riskLevel) return false;
    if (query.success !== undefined && event.success !== query.success) return false;
    
    return true;
  }

  private static getHourKey(date: Date): string {
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`;
  }

  private static getDayKey(date: Date): string {
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  }

  private static getClientIP(req: Request): string {
    const forwarded = req.get('X-Forwarded-For');
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }
    
    return req.get('X-Real-IP') || 
           req.get('X-Client-IP') || 
           req.connection.remoteAddress || 
           req.ip || 
           'unknown';
  }
}

// Middleware for automatic audit logging
export const auditMiddleware = (category: AuditEvent['category'], action?: string) => {
  return async (req: any, res: any, next: any) => {
    const startTime = Date.now();
    
    // Store original res.json to capture response
    const originalJson = res.json;
    let responseData: any;
    
    res.json = function(data: any) {
      responseData = data;
      return originalJson.call(this, data);
    };

    // Continue to next middleware
    res.on('finish', async () => {
      try {
        const duration = Date.now() - startTime;
        const success = res.statusCode < 400;
        const auditAction = action || `${req.method.toLowerCase()}_${req.path.replace(/\//g, '_')}`;

        await SecurityAuditSystem.logEvent(category, auditAction, success, {
          userId: req.user?.id || req.adminSession?.userId,
          req,
          details: {
            query: req.query,
            bodySize: JSON.stringify(req.body || {}).length,
            responseSize: JSON.stringify(responseData || {}).length
          },
          metadata: {
            duration,
            responseCode: res.statusCode,
            sessionId: req.sessionId || req.adminSession?.sessionId
          }
        });
      } catch (error: any) {
        logger.error('Audit middleware error', { error: error.message });
      }
    });

    next();
  };
};