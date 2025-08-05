// 🔐 ADMIN SECURITY API ROUTES
// Phase 3 Implementation - Admin security management endpoints

import { Router } from 'express';
import { AdminSecurityManager, requireAdminAuth, requireMFA } from '../security/admin-security';
import { SecurityAuditSystem } from '../security/audit-system';
import { FraudDetectionSystem } from '../security/fraud-detection';
import { logger } from '../lib/logger';

const router = Router();

// Apply base admin authentication to all routes
router.use(requireAdminAuth(['admin:security']));

/**
 * Generate 2FA secret for admin user
 */
router.post('/2fa/generate', async (req, res) => {
  try {
    const { userEmail } = req.body;
    const adminSession = (req as any).adminSession;
    
    if (!userEmail) {
      return res.status(400).json({ error: 'User email is required' });
    }

    const twoFactorData = await AdminSecurityManager.generateTwoFactorSecret(
      adminSession.userId, 
      userEmail
    );

    await SecurityAuditSystem.logAdminAction(
      '2fa_setup_initiated',
      adminSession.userId,
      true,
      req,
      { targetUser: userEmail }
    );

    res.json({
      qrCode: twoFactorData.qrCode,
      backupCodes: twoFactorData.backupCodes,
      message: 'Scan QR code with authenticator app and verify to enable 2FA'
    });
  } catch (error: any) {
    logger.error('2FA generation error', { error: error.message });
    res.status(500).json({ error: 'Failed to generate 2FA secret' });
  }
});

/**
 * Enable 2FA after verification
 */
router.post('/2fa/enable', async (req, res) => {
  try {
    const { token } = req.body;
    const adminSession = (req as any).adminSession;

    if (!token) {
      return res.status(400).json({ error: 'Verification token is required' });
    }

    const success = await AdminSecurityManager.enableTwoFactor(adminSession.userId, token);

    await SecurityAuditSystem.logAdminAction(
      '2fa_enabled',
      adminSession.userId,
      success,
      req,
      { verificationToken: token.substring(0, 2) + '...' }
    );

    if (success) {
      res.json({ message: '2FA enabled successfully' });
    } else {
      res.status(400).json({ error: 'Invalid verification token' });
    }
  } catch (error: any) {
    logger.error('2FA enable error', { error: error.message });
    res.status(500).json({ error: 'Failed to enable 2FA' });
  }
});

/**
 * Verify 2FA token
 */
router.post('/2fa/verify', async (req, res) => {
  try {
    const { token } = req.body;
    const adminSession = (req as any).adminSession;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    const verified = await AdminSecurityManager.verifyTwoFactor(adminSession.userId, token);

    if (verified) {
      await AdminSecurityManager.markMFAVerified(adminSession.sessionId);
      
      await SecurityAuditSystem.logAdminAction(
        '2fa_verified',
        adminSession.userId,
        true,
        req
      );

      res.json({ message: '2FA verified successfully' });
    } else {
      await SecurityAuditSystem.logAdminAction(
        '2fa_verification_failed',
        adminSession.userId,
        false,
        req
      );

      res.status(400).json({ error: 'Invalid 2FA token' });
    }
  } catch (error: any) {
    logger.error('2FA verification error', { error: error.message });
    res.status(500).json({ error: 'Failed to verify 2FA token' });
  }
});

/**
 * Generate new backup codes
 */
router.post('/2fa/backup-codes', requireMFA('regenerate_backup_codes'), async (req, res) => {
  try {
    const adminSession = (req as any).adminSession;
    
    const newCodes = await AdminSecurityManager.generateNewBackupCodes(adminSession.userId);

    await SecurityAuditSystem.logAdminAction(
      'backup_codes_regenerated',
      adminSession.userId,
      true,
      req
    );

    res.json({ 
      backupCodes: newCodes,
      message: 'New backup codes generated. Store them securely.' 
    });
  } catch (error: any) {
    logger.error('Backup codes generation error', { error: error.message });
    res.status(500).json({ error: 'Failed to generate backup codes' });
  }
});

/**
 * Get admin security dashboard
 */
router.get('/dashboard', async (req, res) => {
  try {
    const adminSession = (req as any).adminSession;
    
    const [securityDashboard, auditStats, fraudStats] = await Promise.all([
      AdminSecurityManager.getSecurityDashboard(adminSession.userId),
      SecurityAuditSystem.getAuditStats('day'),
      FraudDetectionSystem.getSecurityStats()
    ]);

    await SecurityAuditSystem.logAdminAction(
      'security_dashboard_accessed',
      adminSession.userId,
      true,
      req
    );

    res.json({
      dashboard: securityDashboard,
      auditStats,
      fraudStats,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    logger.error('Security dashboard error', { error: error.message });
    res.status(500).json({ error: 'Failed to load security dashboard' });
  }
});

/**
 * Get audit events with filtering
 */
router.get('/audit/events', async (req, res) => {
  try {
    const adminSession = (req as any).adminSession;
    const {
      category,
      action,
      userId,
      ipAddress,
      riskLevel,
      success,
      limit = '50',
      offset = '0'
    } = req.query;

    const query = {
      category: category as string,
      action: action as string,
      userId: userId as string,
      ipAddress: ipAddress as string,
      riskLevel: riskLevel as string,
      success: success === 'true' ? true : success === 'false' ? false : undefined,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    };

    const results = await SecurityAuditSystem.queryEvents(query);

    await SecurityAuditSystem.logAdminAction(
      'audit_events_queried',
      adminSession.userId,
      true,
      req,
      { query }
    );

    res.json(results);
  } catch (error: any) {
    logger.error('Audit events query error', { error: error.message });
    res.status(500).json({ error: 'Failed to query audit events' });
  }
});

/**
 * Export audit logs for compliance
 */
router.post('/audit/export', requireMFA('export_audit_logs'), async (req, res) => {
  try {
    const adminSession = (req as any).adminSession;
    const { startDate, endDate, category, riskLevel } = req.body;

    const csvData = await SecurityAuditSystem.exportAuditLogs({
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      category,
      riskLevel
    });

    await SecurityAuditSystem.logAdminAction(
      'audit_logs_exported',
      adminSession.userId,
      true,
      req,
      { exportCriteria: { startDate, endDate, category, riskLevel } }
    );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="audit-export-${Date.now()}.csv"`);
    res.send(csvData);
  } catch (error: any) {
    logger.error('Audit export error', { error: error.message });
    res.status(500).json({ error: 'Failed to export audit logs' });
  }
});

/**
 * Get critical security events
 */
router.get('/audit/critical', async (req, res) => {
  try {
    const adminSession = (req as any).adminSession;
    const limit = parseInt(req.query.limit as string) || 20;

    const criticalEvents = await SecurityAuditSystem.getCriticalEvents(limit);

    await SecurityAuditSystem.logAdminAction(
      'critical_events_reviewed',
      adminSession.userId,
      true,
      req
    );

    res.json({ events: criticalEvents });
  } catch (error: any) {
    logger.error('Critical events query error', { error: error.message });
    res.status(500).json({ error: 'Failed to get critical events' });
  }
});

/**
 * Get user security timeline
 */
router.get('/audit/user/:userId', async (req, res) => {
  try {
    const adminSession = (req as any).adminSession;
    const { userId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;

    const timeline = await SecurityAuditSystem.getUserSecurityTimeline(userId, limit);

    await SecurityAuditSystem.logAdminAction(
      'user_security_timeline_accessed',
      adminSession.userId,
      true,
      req,
      { targetUserId: userId }
    );

    res.json({ timeline });
  } catch (error: any) {
    logger.error('User timeline error', { error: error.message });
    res.status(500).json({ error: 'Failed to get user security timeline' });
  }
});

/**
 * Check if IP is blocked by fraud detection
 */
router.get('/fraud/blocked-ip/:ip', async (req, res) => {
  try {
    const adminSession = (req as any).adminSession;
    const { ip } = req.params;

    const isBlocked = await FraudDetectionSystem.isIPBlocked(ip);

    await SecurityAuditSystem.logAdminAction(
      'ip_block_status_checked',
      adminSession.userId,
      true,
      req,
      { checkedIP: ip }
    );

    res.json({ ipAddress: ip, isBlocked });
  } catch (error: any) {
    logger.error('IP block check error', { error: error.message });
    res.status(500).json({ error: 'Failed to check IP block status' });
  }
});

/**
 * Disable 2FA for a user (emergency action)
 */
router.post('/2fa/disable/:userId', requireMFA('disable_user_2fa'), async (req, res) => {
  try {
    const adminSession = (req as any).adminSession;
    const { userId } = req.params;
    const { reason } = req.body;

    await AdminSecurityManager.disableTwoFactor(userId, adminSession.userId);

    await SecurityAuditSystem.logAdminAction(
      '2fa_disabled_for_user',
      adminSession.userId,
      true,
      req,
      { targetUserId: userId, reason }
    );

    res.json({ message: '2FA disabled for user', userId });
  } catch (error: any) {
    logger.error('2FA disable error', { error: error.message });
    res.status(500).json({ error: 'Failed to disable 2FA' });
  }
});

/**
 * Invalidate user session (emergency action)
 */
router.post('/sessions/invalidate/:sessionId', requireMFA('invalidate_session'), async (req, res) => {
  try {
    const adminSession = (req as any).adminSession;
    const { sessionId } = req.params;
    const { reason } = req.body;

    await AdminSecurityManager.invalidateSession(sessionId);

    await SecurityAuditSystem.logAdminAction(
      'session_invalidated',
      adminSession.userId,
      true,
      req,
      { targetSessionId: sessionId, reason }
    );

    res.json({ message: 'Session invalidated', sessionId });
  } catch (error: any) {
    logger.error('Session invalidation error', { error: error.message });
    res.status(500).json({ error: 'Failed to invalidate session' });
  }
});

export default router;