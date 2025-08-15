import { db } from '../db';
import { brevoNotifications, users } from '../../shared/schema';
import { eq, and, sql, desc, count } from 'drizzle-orm';
import { logger } from '../lib/logger';

export interface RoutingRule {
  id: string;
  name: string;
  priority: number;
  conditions: RoutingCondition[];
  actions: RoutingAction[];
  isActive: boolean;
  tenant?: 'EUR' | 'KM';
}

export interface RoutingCondition {
  field: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'in' | 'regex';
  value: any;
  type: 'user' | 'order' | 'notification' | 'time' | 'system';
}

export interface RoutingAction {
  type: 'template' | 'delay' | 'channel' | 'priority' | 'personalization' | 'ab_test';
  config: any;
}

export interface ABTestConfig {
  id: string;
  name: string;
  variants: ABTestVariant[];
  trafficSplit: number[];
  startDate: Date;
  endDate: Date;
  metrics: string[];
}

export interface ABTestVariant {
  id: string;
  name: string;
  templateId?: string;
  subject?: string;
  delayMinutes?: number;
  personalizations?: Record<string, any>;
}

export interface PersonalizationRule {
  id: string;
  field: string;
  source: 'user_profile' | 'order_history' | 'behavior' | 'computed';
  transformation?: string;
  fallback?: string;
}

export class NotificationRoutingService {
  private routingRules: RoutingRule[] = [];
  private abTests: ABTestConfig[] = [];
  private personalizationRules: PersonalizationRule[] = [];

  constructor() {
    this.initializeDefaultRules();
    this.loadCustomRules();
  }

  /**
   * Initialize default routing rules for the B2B platform
   */
  private initializeDefaultRules(): void {
    this.routingRules = [
      // High Priority Users - VIP Treatment
      {
        id: 'vip-routing',
        name: 'VIP User Priority Routing',
        priority: 100,
        conditions: [
          {
            field: 'user.role',
            operator: 'in',
            value: ['super_admin', 'admin'],
            type: 'user'
          }
        ],
        actions: [
          {
            type: 'priority',
            config: { level: 'high', expedite: true }
          },
          {
            type: 'template',
            config: { variant: 'premium' }
          }
        ],
        isActive: true
      },

      // Tenant-Specific Routing
      {
        id: 'eur-tenant-routing',
        name: 'EUR Tenant Customization',
        priority: 80,
        conditions: [
          {
            field: 'user.tenantId',
            operator: 'equals',
            value: 'eur',
            type: 'user'
          }
        ],
        actions: [
          {
            type: 'template',
            config: { language: 'en', currency: 'EUR' }
          },
          {
            type: 'personalization',
            config: { 
              greeting: 'Dear {{user.firstName}}',
              company_context: '{{user.companyName}}',
              currency_symbol: '€'
            }
          }
        ],
        isActive: true,
        tenant: 'EUR'
      },

      {
        id: 'km-tenant-routing',
        name: 'KM Tenant Customization',
        priority: 80,
        conditions: [
          {
            field: 'user.tenantId',
            operator: 'equals',
            value: 'km',
            type: 'user'
          }
        ],
        actions: [
          {
            type: 'template',
            config: { language: 'bs', currency: 'BAM' }
          },
          {
            type: 'personalization',
            config: { 
              greeting: 'Poštovani {{user.firstName}}',
              company_context: '{{user.companyName}}',
              currency_symbol: 'KM'
            }
          }
        ],
        isActive: true,
        tenant: 'KM'
      },

      // Order Value Based Routing
      {
        id: 'high-value-orders',
        name: 'High Value Order Special Treatment',
        priority: 90,
        conditions: [
          {
            field: 'order.totalAmount',
            operator: 'greater_than',
            value: 1000,
            type: 'order'
          }
        ],
        actions: [
          {
            type: 'template',
            config: { variant: 'premium', include_vip_contact: true }
          },
          {
            type: 'delay',
            config: { minutes: 0 } // Immediate processing
          }
        ],
        isActive: true
      },

      // Time-Based Routing
      {
        id: 'business-hours-routing',
        name: 'Business Hours Optimization',
        priority: 60,
        conditions: [
          {
            field: 'time.hour',
            operator: 'greater_than',
            value: 8,
            type: 'time'
          },
          {
            field: 'time.hour',
            operator: 'less_than',
            value: 18,
            type: 'time'
          },
          {
            field: 'time.weekday',
            operator: 'in',
            value: [1, 2, 3, 4, 5], // Monday to Friday
            type: 'time'
          }
        ],
        actions: [
          {
            type: 'delay',
            config: { minutes: 5 } // Immediate during business hours
          }
        ],
        isActive: true
      },

      // Failed Payment Recovery
      {
        id: 'payment-failure-routing',
        name: 'Payment Failure Recovery Sequence',
        priority: 95,
        conditions: [
          {
            field: 'notification.type',
            operator: 'equals',
            value: 'payment_failed',
            type: 'notification'
          }
        ],
        actions: [
          {
            type: 'template',
            config: { variant: 'urgent', include_support_contact: true }
          },
          {
            type: 'delay',
            config: { minutes: 30 } // Delay for retry window
          },
          {
            type: 'ab_test',
            config: { test_id: 'payment-recovery-messages' }
          }
        ],
        isActive: true
      }
    ];

    // Initialize A/B Tests
    this.abTests = [
      {
        id: 'payment-recovery-messages',
        name: 'Payment Recovery Message Testing',
        variants: [
          {
            id: 'variant-a',
            name: 'Standard Recovery',
            subject: 'Payment Issue - Action Required',
            personalizations: {
              tone: 'professional',
              urgency: 'medium'
            }
          },
          {
            id: 'variant-b',
            name: 'Friendly Recovery',
            subject: 'Let\'s Resolve Your Payment Together',
            personalizations: {
              tone: 'friendly',
              urgency: 'low',
              include_help_offer: true
            }
          }
        ],
        trafficSplit: [50, 50],
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        metrics: ['open_rate', 'click_rate', 'conversion_rate']
      },

      {
        id: 'order-confirmation-optimization',
        name: 'Order Confirmation Optimization',
        variants: [
          {
            id: 'detailed-variant',
            name: 'Detailed Confirmation',
            templateId: 'order-confirmation-detailed',
            personalizations: {
              include_product_images: true,
              include_usage_tips: true
            }
          },
          {
            id: 'minimal-variant',
            name: 'Minimal Confirmation',
            templateId: 'order-confirmation-minimal',
            personalizations: {
              focus_on_keys: true,
              minimal_design: true
            }
          }
        ],
        trafficSplit: [60, 40],
        startDate: new Date(),
        endDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000), // 45 days
        metrics: ['open_rate', 'satisfaction_score', 'support_tickets']
      }
    ];

    // Initialize Personalization Rules
    this.personalizationRules = [
      {
        id: 'user-greeting',
        field: 'greeting',
        source: 'user_profile',
        transformation: 'firstName ? `Dear ${firstName}` : "Dear Valued Customer"',
        fallback: 'Dear Valued Customer'
      },
      {
        id: 'company-context',
        field: 'company_name',
        source: 'user_profile',
        transformation: 'companyName || "your organization"'
      },
      {
        id: 'recent-orders',
        field: 'recent_order_count',
        source: 'order_history',
        transformation: 'last_30_days_orders.length'
      },
      {
        id: 'preferred-currency',
        field: 'currency_display',
        source: 'user_profile',
        transformation: 'tenantId === "eur" ? "€" : "KM"'
      },
      {
        id: 'vip-status',
        field: 'is_vip',
        source: 'computed',
        transformation: 'role === "super_admin" || totalOrderValue > 5000'
      }
    ];

    logger.info('🚀 NotificationRoutingService initialized', {
      routingRules: this.routingRules.length,
      abTests: this.abTests.length,
      personalizationRules: this.personalizationRules.length
    });
  }

  /**
   * Load custom routing rules from database (future enhancement)
   */
  private async loadCustomRules(): Promise<void> {
    // TODO: Load custom rules from database
    // This would allow administrators to create custom routing rules via UI
  }

  /**
   * Process notification through routing engine
   */
  async routeNotification(notification: any, context: any): Promise<any> {
    try {
      logger.info('🔄 Processing notification through routing engine', {
        notificationType: notification.type,
        userId: context.user?.id,
        tenant: context.user?.tenantId
      });

      // Apply routing rules in priority order
      const applicableRules = this.getApplicableRules(notification, context);
      let processedNotification = { ...notification };

      for (const rule of applicableRules) {
        processedNotification = await this.applyRule(rule, processedNotification, context);
      }

      // Apply personalization
      processedNotification = await this.applyPersonalization(processedNotification, context);

      // Apply A/B testing
      processedNotification = await this.applyABTesting(processedNotification, context);

      logger.info('✅ Notification routing completed', {
        appliedRules: applicableRules.length,
        finalPriority: processedNotification.priority,
        hasPersonalization: !!processedNotification.personalizations
      });

      return processedNotification;
    } catch (error) {
      logger.error('❌ Notification routing failed', {
        error: error instanceof Error ? error.message : String(error),
        notificationId: notification.id
      });
      throw error;
    }
  }

  /**
   * Get applicable routing rules based on conditions
   */
  private getApplicableRules(notification: any, context: any): RoutingRule[] {
    return this.routingRules
      .filter(rule => rule.isActive)
      .filter(rule => this.evaluateConditions(rule.conditions, notification, context))
      .sort((a, b) => b.priority - a.priority);
  }

  /**
   * Evaluate routing conditions
   */
  private evaluateConditions(conditions: RoutingCondition[], notification: any, context: any): boolean {
    return conditions.every(condition => {
      const value = this.getConditionValue(condition, notification, context);
      return this.evaluateCondition(condition, value);
    });
  }

  /**
   * Get value for condition evaluation
   */
  private getConditionValue(condition: RoutingCondition, notification: any, context: any): any {
    const [source, ...path] = condition.field.split('.');
    
    switch (source) {
      case 'user':
        return this.getNestedValue(context.user, path);
      case 'order':
        return this.getNestedValue(context.order, path);
      case 'notification':
        return this.getNestedValue(notification, path);
      case 'time':
        return this.getTimeValue(path[0]);
      case 'system':
        return this.getSystemValue(path[0]);
      default:
        return undefined;
    }
  }

  /**
   * Get nested object value
   */
  private getNestedValue(obj: any, path: string[]): any {
    return path.reduce((current, key) => current?.[key], obj);
  }

  /**
   * Get time-based values
   */
  private getTimeValue(field: string): any {
    const now = new Date();
    switch (field) {
      case 'hour':
        return now.getHours();
      case 'weekday':
        return now.getDay();
      case 'month':
        return now.getMonth() + 1;
      default:
        return now;
    }
  }

  /**
   * Get system-based values
   */
  private getSystemValue(field: string): any {
    switch (field) {
      case 'load':
        return process.cpuUsage();
      case 'memory':
        return process.memoryUsage();
      default:
        return null;
    }
  }

  /**
   * Evaluate individual condition
   */
  private evaluateCondition(condition: RoutingCondition, value: any): boolean {
    switch (condition.operator) {
      case 'equals':
        return value === condition.value;
      case 'contains':
        return String(value).includes(String(condition.value));
      case 'greater_than':
        return Number(value) > Number(condition.value);
      case 'less_than':
        return Number(value) < Number(condition.value);
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(value);
      case 'regex':
        return new RegExp(condition.value).test(String(value));
      default:
        return false;
    }
  }

  /**
   * Apply routing rule actions
   */
  private async applyRule(rule: RoutingRule, notification: any, context: any): Promise<any> {
    let result = { ...notification };

    for (const action of rule.actions) {
      switch (action.type) {
        case 'template':
          result.templateConfig = { ...result.templateConfig, ...action.config };
          break;
        case 'delay':
          result.delayMinutes = action.config.minutes;
          break;
        case 'channel':
          result.channel = action.config.channel;
          break;
        case 'priority':
          result.priority = action.config.level;
          result.expedite = action.config.expedite;
          break;
        case 'personalization':
          result.personalizations = { ...result.personalizations, ...action.config };
          break;
        case 'ab_test':
          result.abTestId = action.config.test_id;
          break;
      }
    }

    return result;
  }

  /**
   * Apply personalization rules
   */
  private async applyPersonalization(notification: any, context: any): Promise<any> {
    const personalizations = { ...notification.personalizations };

    for (const rule of this.personalizationRules) {
      try {
        const value = await this.computePersonalizationValue(rule, context);
        personalizations[rule.field] = value;
      } catch (error) {
        logger.warn('⚠️ Personalization rule failed', {
          ruleId: rule.id,
          error: error instanceof Error ? error.message : String(error)
        });
        personalizations[rule.field] = rule.fallback || '';
      }
    }

    return {
      ...notification,
      personalizations
    };
  }

  /**
   * Compute personalization value
   */
  private async computePersonalizationValue(rule: PersonalizationRule, context: any): Promise<any> {
    switch (rule.source) {
      case 'user_profile':
        return this.evaluateTransformation(rule.transformation, context.user);
      case 'order_history':
        const orderHistory = await this.getOrderHistory(context.user?.id);
        return this.evaluateTransformation(rule.transformation, { ...context, orderHistory });
      case 'behavior':
        const behavior = await this.getBehaviorData(context.user?.id);
        return this.evaluateTransformation(rule.transformation, { ...context, behavior });
      case 'computed':
        return this.evaluateTransformation(rule.transformation, context);
      default:
        return rule.fallback;
    }
  }

  /**
   * Evaluate transformation expression
   */
  private evaluateTransformation(transformation: string, context: any): any {
    try {
      // Simple transformation evaluation (in production, use a proper expression engine)
      const func = new Function('context', `with(context) { return ${transformation}; }`);
      return func(context);
    } catch (error) {
      logger.warn('⚠️ Transformation evaluation failed', {
        transformation,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Apply A/B testing
   */
  private async applyABTesting(notification: any, context: any): Promise<any> {
    if (!notification.abTestId) {
      return notification;
    }

    const abTest = this.abTests.find(test => test.id === notification.abTestId);
    if (!abTest || !this.isABTestActive(abTest)) {
      return notification;
    }

    const variant = this.selectABTestVariant(abTest, context.user?.id);
    if (!variant) {
      return notification;
    }

    logger.info('🧪 A/B test variant selected', {
      testId: abTest.id,
      variantId: variant.id,
      userId: context.user?.id
    });

    return {
      ...notification,
      abTest: {
        testId: abTest.id,
        variantId: variant.id
      },
      templateId: variant.templateId || notification.templateId,
      subject: variant.subject || notification.subject,
      delayMinutes: variant.delayMinutes ?? notification.delayMinutes,
      personalizations: {
        ...notification.personalizations,
        ...variant.personalizations
      }
    };
  }

  /**
   * Check if A/B test is active
   */
  private isABTestActive(abTest: ABTestConfig): boolean {
    const now = new Date();
    return now >= abTest.startDate && now <= abTest.endDate;
  }

  /**
   * Select A/B test variant based on user ID and traffic split
   */
  private selectABTestVariant(abTest: ABTestConfig, userId: string): ABTestVariant | null {
    if (!userId) return null;

    // Use user ID for consistent variant assignment
    const hash = this.hashString(userId + abTest.id);
    const bucket = hash % 100;

    let cumulativePercent = 0;
    for (let i = 0; i < abTest.variants.length; i++) {
      cumulativePercent += abTest.trafficSplit[i];
      if (bucket < cumulativePercent) {
        return abTest.variants[i];
      }
    }

    return abTest.variants[0]; // Fallback to first variant
  }

  /**
   * Simple hash function for consistent user bucketing
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Get user order history
   */
  private async getOrderHistory(userId?: string): Promise<any> {
    if (!userId) return {};

    try {
      // TODO: Implement order history query
      return {
        last_30_days_orders: [],
        totalOrderValue: 0,
        averageOrderValue: 0
      };
    } catch (error) {
      logger.error('❌ Failed to get order history', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      return {};
    }
  }

  /**
   * Get user behavior data
   */
  private async getBehaviorData(userId?: string): Promise<any> {
    if (!userId) return {};

    try {
      // TODO: Implement behavior tracking query
      return {
        loginFrequency: 'regular',
        preferredTime: 'business_hours',
        engagementLevel: 'medium'
      };
    } catch (error) {
      logger.error('❌ Failed to get behavior data', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      return {};
    }
  }

  /**
   * Get routing statistics
   */
  async getRoutingStats(tenant?: string): Promise<any> {
    try {
      // TODO: Implement routing statistics
      return {
        rulesProcessed: 0,
        abTestsActive: this.abTests.filter(test => this.isABTestActive(test)).length,
        personalizationRules: this.personalizationRules.length,
        routingRules: this.routingRules.filter(rule => 
          rule.isActive && (!tenant || rule.tenant === tenant)
        ).length
      };
    } catch (error) {
      logger.error('❌ Failed to get routing stats', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * Get A/B test results
   */
  async getABTestResults(testId: string): Promise<any> {
    try {
      // TODO: Implement A/B test results analysis
      const abTest = this.abTests.find(test => test.id === testId);
      if (!abTest) {
        throw new Error('A/B test not found');
      }

      return {
        testId,
        name: abTest.name,
        status: this.isABTestActive(abTest) ? 'active' : 'completed',
        variants: abTest.variants.map(variant => ({
          id: variant.id,
          name: variant.name,
          metrics: {
            // TODO: Calculate real metrics
            participants: 0,
            conversions: 0,
            conversionRate: 0
          }
        }))
      };
    } catch (error) {
      logger.error('❌ Failed to get A/B test results', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }
}

// Export singleton instance
export const notificationRoutingService = new NotificationRoutingService();