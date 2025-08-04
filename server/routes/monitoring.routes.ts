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

export default router;