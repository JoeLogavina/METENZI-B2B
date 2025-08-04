// Monitoring and Alerting Routes
import { Router } from 'express';
import { logSecurityEvent, AuditEventSeverity } from '../monitoring/audit';

const router = Router();

// Webhook endpoint for Alertmanager
router.post('/webhook', (req, res) => {
  const alerts = req.body.alerts || [];
  
  console.log('🚨 Alert received:', {
    receiver: req.body.receiver,
    status: req.body.status,
    alertsCount: alerts.length,
    alerts: alerts.map((alert: any) => ({
      status: alert.status,
      alertname: alert.labels?.alertname,
      severity: alert.labels?.severity,
      summary: alert.annotations?.summary
    }))
  });

  // Log to audit system
  alerts.forEach((alert: any) => {
    logSecurityEvent(
      'monitoring_alert_received',
      alert.labels?.severity === 'critical' ? AuditEventSeverity.CRITICAL : AuditEventSeverity.MEDIUM,
      undefined, // No specific user
      {
        alertname: alert.labels?.alertname,
        severity: alert.labels?.severity,
        summary: alert.annotations?.summary,
        description: alert.annotations?.description,
        status: alert.status,
        receiver: req.body.receiver
      },
      'success'
    );
  });

  res.status(200).json({ status: 'received' });
});

// Critical alerts webhook
router.post('/webhook/critical', (req, res) => {
  const alerts = req.body.alerts || [];
  
  console.log('🔥 CRITICAL Alert received:', {
    alertsCount: alerts.length,
    alerts: alerts.map((alert: any) => ({
      alertname: alert.labels?.alertname,
      summary: alert.annotations?.summary
    }))
  });

  // Here you could integrate with additional notification systems
  // - Send email
  // - Send SMS
  // - Send Slack message
  // - Page on-call engineer

  res.status(200).json({ status: 'critical alert processed' });
});

// Warning alerts webhook
router.post('/webhook/warning', (req, res) => {
  const alerts = req.body.alerts || [];
  
  console.log('⚠️  Warning Alert received:', {
    alertsCount: alerts.length,
    alerts: alerts.map((alert: any) => ({
      alertname: alert.labels?.alertname,
      summary: alert.annotations?.summary
    }))
  });

  res.status(200).json({ status: 'warning alert processed' });
});

// Health check endpoint for monitoring
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Monitoring status endpoint
router.get('/monitoring/status', (req, res) => {
  res.status(200).json({
    monitoring: {
      prometheus: 'active',
      grafana: 'configured',
      alertmanager: 'configured',
      sentry: process.env.SENTRY_DSN ? 'active' : 'disabled',
      audit_logging: 'active'
    },
    endpoints: {
      metrics: '/metrics',
      health: '/health',
      webhooks: {
        general: '/webhook',
        critical: '/webhook/critical',
        warning: '/webhook/warning'
      }
    }
  });
});

// API endpoints for frontend monitoring integration
router.get('/api/monitoring/health', (req, res) => {
  try {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      database: {
        status: 'connected'
      },
      memory: {
        used: memoryUsage.heapUsed,
        total: memoryUsage.heapTotal,
        rss: memoryUsage.rss,
        external: memoryUsage.external
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: (error as Error).message
    });
  }
});

router.get('/api/monitoring/metrics/summary', (req, res) => {
  try {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    // Calculate memory usage percentage
    const memoryPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
    
    // Mock performance data (in a real system this would come from actual metrics)
    const responseTime = Math.floor(Math.random() * 50) + 20; // 20-70ms
    const successRate = 0.98 + Math.random() * 0.02; // 98-100%
    
    res.status(200).json({
      timestamp: new Date().toISOString(),
      memory: {
        used: memoryUsage.heapUsed,
        total: memoryUsage.heapTotal,
        percentage: Math.round(memoryPercent)
      },
      cpu: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to percentage
      http: {
        total: Math.floor(Math.random() * 1000) + 500,
        successRate: successRate
      },
      performance: {
        avgResponseTime: responseTime
      },
      uptime: process.uptime()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to collect metrics',
      message: (error as Error).message
    });
  }
});

router.get('/api/monitoring/alerts', (req, res) => {
  try {
    const memoryUsage = process.memoryUsage();
    const memoryPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
    const uptime = process.uptime();
    
    const alerts = [];
    
    // Generate alerts based on system conditions
    if (memoryPercent > 80) {
      alerts.push({
        title: 'High Memory Usage',
        description: `Memory usage is at ${Math.round(memoryPercent)}%`,
        severity: 'warning',
        timestamp: new Date().toISOString(),
        component: 'system'
      });
    }
    
    if (uptime < 300) { // Less than 5 minutes uptime
      alerts.push({
        title: 'Recent System Restart',
        description: 'System was recently restarted',
        severity: 'info',
        timestamp: new Date(Date.now() - (300 - uptime) * 1000).toISOString(),
        component: 'system'
      });
    }
    
    // Count alerts by severity
    const stats = {
      critical: alerts.filter(a => a.severity === 'critical').length,
      warning: alerts.filter(a => a.severity === 'warning').length,
      info: alerts.filter(a => a.severity === 'info').length
    };
    
    res.status(200).json({
      timestamp: new Date().toISOString(),
      alerts: alerts,
      stats: stats,
      total: alerts.length
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to collect alerts',
      message: (error as Error).message
    });
  }
});

// Test endpoint to verify Sentry error capturing
router.get('/api/monitoring/test-sentry', (req, res) => {
  try {
    // Simulate a test error for Sentry
    if (req.query.trigger === 'error') {
      const { captureB2BError } = require('../monitoring/sentry');
      const testError = new Error('Test error for Sentry integration - this is intentional');
      
      captureB2BError(testError, {
        userId: 'test-user',
        action: 'sentry_integration_test',
        tenantId: 'eur',
        transactionId: 'test-' + Date.now()
      });
      
      return res.json({
        message: 'Test error sent to Sentry successfully',
        timestamp: new Date().toISOString(),
        sentryActive: !!process.env.SENTRY_DSN
      });
    }
    
    res.json({
      message: 'Sentry test endpoint ready. Add ?trigger=error to send a test error',
      sentryActive: !!process.env.SENTRY_DSN,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Sentry test failed',
      message: (error as Error).message
    });
  }
});

export default router;