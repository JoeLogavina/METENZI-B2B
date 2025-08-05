// Enterprise Metrics Collection - Prometheus Integration
import { register, collectDefaultMetrics, Counter, Histogram, Gauge } from 'prom-client';

// Collect default Node.js metrics
collectDefaultMetrics({
  timeout: 5000,
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
});

// B2B Platform Specific Metrics

// HTTP Request metrics
export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code', 'tenant'],
});

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code', 'tenant'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
});

// B2B Business Logic Metrics
export const licenseKeysGenerated = new Counter({
  name: 'license_keys_generated_total',
  help: 'Total number of license keys generated',
  labelNames: ['tenant', 'product_id'],
});

export const walletTransactions = new Counter({
  name: 'wallet_transactions_total',
  help: 'Total number of wallet transactions',
  labelNames: ['tenant', 'transaction_type', 'status'],
});

export const walletBalance = new Gauge({
  name: 'wallet_balance_eur',
  help: 'Current wallet balances in EUR',
  labelNames: ['user_id', 'tenant', 'balance_type'],
});

export const branchCreations = new Counter({
  name: 'branch_creations_total',
  help: 'Total number of branch accounts created',
  labelNames: ['tenant', 'parent_company'],
});

export const activeUserSessions = new Gauge({
  name: 'active_user_sessions',
  help: 'Number of active user sessions',
  labelNames: ['tenant', 'user_role'],
});

// Database Connection Metrics
export const databaseConnections = new Gauge({
  name: 'database_connections_active',
  help: 'Number of active database connections',
});

export const databaseQueryDuration = new Histogram({
  name: 'database_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['query_type', 'table'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
});

// API Response Metrics
export const apiErrors = new Counter({
  name: 'api_errors_total',
  help: 'Total number of API errors',
  labelNames: ['endpoint', 'error_type', 'status_code', 'tenant'],
});

// Security Metrics
export const authenticationAttempts = new Counter({
  name: 'authentication_attempts_total',
  help: 'Total number of authentication attempts',
  labelNames: ['status', 'tenant', 'user_role'],
});

export const fraudDetectionEvents = new Counter({
  name: 'fraud_detection_events_total',
  help: 'Total number of fraud detection events',
  labelNames: ['event_type', 'severity', 'tenant'],
});

// Performance tracking helpers
export function trackHttpRequest(method: string, route: string, statusCode: number, duration: number, tenant: string = 'unknown') {
  httpRequestsTotal.inc({ method, route, status_code: statusCode.toString(), tenant });
  httpRequestDuration.observe({ method, route, status_code: statusCode.toString(), tenant }, duration / 1000);
}

export function trackLicenseKeyGeneration(tenant: string, productId: string) {
  licenseKeysGenerated.inc({ tenant, product_id: productId });
}

export function trackWalletTransaction(tenant: string, transactionType: string, status: string) {
  walletTransactions.inc({ tenant, transaction_type: transactionType, status });
}

export function updateWalletBalance(userId: string, tenant: string, balanceType: string, amount: number) {
  walletBalance.set({ user_id: userId, tenant, balance_type: balanceType }, amount);
}

export function trackBranchCreation(tenant: string, parentCompany: string) {
  branchCreations.inc({ tenant, parent_company: parentCompany });
}

export function updateActiveUserSessions(tenant: string, userRole: string, count: number) {
  activeUserSessions.set({ tenant, user_role: userRole }, count);
}

export function trackApiError(endpoint: string, errorType: string, statusCode: number, tenant: string = 'unknown') {
  apiErrors.inc({ endpoint, error_type: errorType, status_code: statusCode.toString(), tenant });
}

export function trackAuthenticationAttempt(status: string, tenant: string, userRole: string) {
  authenticationAttempts.inc({ status, tenant, user_role: userRole });
}

export function trackFraudDetectionEvent(eventType: string, severity: string, tenant: string) {
  fraudDetectionEvents.inc({ event_type: eventType, severity, tenant });
}

export function trackDatabaseQuery(queryType: string, table: string, duration: number) {
  databaseQueryDuration.observe({ query_type: queryType, table }, duration / 1000);
}

// Export the registry for the /metrics endpoint
export { register };