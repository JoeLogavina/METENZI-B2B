// Enhanced Audit Logging for B2B Platform
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
// Note: Will integrate with existing audit logging if available

// Audit event categories for B2B platform
export enum AuditEventCategory {
  USER_MANAGEMENT = 'user_management',
  FINANCIAL_TRANSACTION = 'financial_transaction',
  LICENSE_MANAGEMENT = 'license_management',
  SECURITY_EVENT = 'security_event',
  SYSTEM_ADMIN = 'system_admin',
  DATA_ACCESS = 'data_access',
  BRANCH_MANAGEMENT = 'branch_management',
  PRODUCT_MANAGEMENT = 'product_management',
  AUTHENTICATION = 'authentication',
  CONFIGURATION_CHANGE = 'configuration_change'
}

export enum AuditEventSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface AuditLogEntry {
  timestamp: Date;
  category: AuditEventCategory;
  severity: AuditEventSeverity;
  action: string;
  userId?: string;
  userName?: string;
  userRole?: string;
  tenantId?: string;
  branchId?: string;
  resourceType?: string;
  resourceId?: string;
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  transactionId?: string;
  outcome: 'success' | 'failure' | 'partial';
  errorMessage?: string;
}

// Create dedicated audit logger with file rotation
const auditLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new DailyRotateFile({
      filename: 'logs/audit-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '100m',
      maxFiles: '2555d', // ~7 years retention for compliance
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    }),
    // Also log to console in development
    ...(process.env.NODE_ENV === 'development' ? [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
      })
    ] : [])
  ]
});

export function logAuditEvent(entry: AuditLogEntry) {
  const auditRecord = {
    ...entry,
    timestamp: entry.timestamp.toISOString(),
    platform: 'b2b-license-management',
    version: process.env.npm_package_version || '1.0.0'
  };

  // Log to Winston audit logger
  auditLogger.info('audit_event', auditRecord);

  // TODO: Integrate with existing audit logger if available
  // auditLog(entry.category, entry.action, { ... });
}

// Convenience functions for common B2B audit events

export function logUserManagementEvent(
  action: string,
  userId: string,
  userName: string,
  userRole: string,
  details: Record<string, any>,
  outcome: 'success' | 'failure' | 'partial' = 'success',
  tenantId?: string,
  ipAddress?: string
) {
  logAuditEvent({
    timestamp: new Date(),
    category: AuditEventCategory.USER_MANAGEMENT,
    severity: AuditEventSeverity.MEDIUM,
    action,
    userId,
    userName,
    userRole,
    tenantId,
    details,
    ipAddress,
    outcome
  });
}

export function logFinancialTransaction(
  action: string,
  userId: string,
  transactionId: string,
  amount: number,
  currency: string,
  details: Record<string, any>,
  outcome: 'success' | 'failure' | 'partial' = 'success',
  tenantId?: string
) {
  logAuditEvent({
    timestamp: new Date(),
    category: AuditEventCategory.FINANCIAL_TRANSACTION,
    severity: AuditEventSeverity.HIGH,
    action,
    userId,
    tenantId,
    transactionId,
    resourceType: 'wallet_transaction',
    resourceId: transactionId,
    details: {
      ...details,
      amount,
      currency
    },
    outcome
  });
}

export function logLicenseManagementEvent(
  action: string,
  userId: string,
  productId: string,
  licenseKey?: string,
  details: Record<string, any> = {},
  outcome: 'success' | 'failure' | 'partial' = 'success',
  tenantId?: string
) {
  logAuditEvent({
    timestamp: new Date(),
    category: AuditEventCategory.LICENSE_MANAGEMENT,
    severity: AuditEventSeverity.HIGH,
    action,
    userId,
    tenantId,
    resourceType: 'license_key',
    resourceId: licenseKey || productId,
    details: {
      ...details,
      productId,
      licenseKey: licenseKey ? '[REDACTED]' : undefined
    },
    outcome
  });
}

export function logSecurityEvent(
  action: string,
  severity: AuditEventSeverity,
  userId: string | undefined,
  details: Record<string, any>,
  outcome: 'success' | 'failure' | 'partial' = 'success',
  ipAddress?: string,
  userAgent?: string
) {
  logAuditEvent({
    timestamp: new Date(),
    category: AuditEventCategory.SECURITY_EVENT,
    severity,
    action,
    userId,
    details,
    ipAddress,
    userAgent,
    outcome
  });
}

export function logBranchManagementEvent(
  action: string,
  parentUserId: string,
  branchId: string,
  branchName: string,
  details: Record<string, any>,
  outcome: 'success' | 'failure' | 'partial' = 'success',
  tenantId?: string
) {
  logAuditEvent({
    timestamp: new Date(),
    category: AuditEventCategory.BRANCH_MANAGEMENT,
    severity: AuditEventSeverity.MEDIUM,
    action,
    userId: parentUserId,
    tenantId,
    branchId,
    resourceType: 'branch_account',
    resourceId: branchId,
    details: {
      ...details,
      branchName
    },
    outcome
  });
}

export function logAdminAction(
  action: string,
  adminUserId: string,
  targetResourceType: string,
  targetResourceId: string,
  details: Record<string, any>,
  outcome: 'success' | 'failure' | 'partial' = 'success'
) {
  logAuditEvent({
    timestamp: new Date(),
    category: AuditEventCategory.SYSTEM_ADMIN,
    severity: AuditEventSeverity.HIGH,
    action,
    userId: adminUserId,
    resourceType: targetResourceType,
    resourceId: targetResourceId,
    details,
    outcome
  });
}

export function logAuthenticationEvent(
  action: string,
  userId: string | undefined,
  userName: string | undefined,
  outcome: 'success' | 'failure' | 'partial',
  details: Record<string, any> = {},
  ipAddress?: string,
  userAgent?: string,
  tenantId?: string
) {
  logAuditEvent({
    timestamp: new Date(),
    category: AuditEventCategory.AUTHENTICATION,
    severity: outcome === 'failure' ? AuditEventSeverity.MEDIUM : AuditEventSeverity.LOW,
    action,
    userId,
    userName,
    tenantId,
    details,
    ipAddress,
    userAgent,
    outcome
  });
}