// 🔐 API SECURITY MANAGEMENT ROUTES (Step 6)
// Endpoints for monitoring and managing API security features

import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';
import { APISecuritySystem } from '../security/api-security-system';
import { RoleBasedAccessControl } from '../security/role-based-access-control';
import { z } from 'zod';
import { validateRequestMiddleware } from '../middleware/validation';

const router = Router();

// Security analytics request schema
const analyticsRequestSchema = z.object({
  timeframe: z.enum(['hour', 'day', 'week']).default('hour'),
  includeDetails: z.boolean().default(false)
});

const apiKeyCreateSchema = z.object({
  name: z.string().min(1).max(100),
  permissions: z.array(z.string()).default([]),
  rateLimit: z.number().int().min(1).max(10000).default(1000),
  expiresIn: z.number().int().min(1).optional(), // days
  description: z.string().max(500).optional()
});

const rateLimitUpdateSchema = z.object({
  endpoint: z.string().min(1),
  windowMs: z.number().int().min(1000),
  maxRequests: z.number().int().min(1),
  enabled: z.boolean().default(true)
});

// Get security analytics and metrics
router.get('/analytics',
  RoleBasedAccessControl.requirePermission('security', 'read', { logAccess: true }),
  validateRequestMiddleware(analyticsRequestSchema),
  async (req: any, res: Response) => {
    try {
      const { timeframe, includeDetails } = req.query;

      const analytics = await APISecuritySystem.getSecurityAnalytics(timeframe);

      // Add additional metrics
      const metrics = {
        ...analytics,
        securityScore: calculateSecurityScore(analytics),
        recommendations: generateSecurityRecommendations(analytics),
        timestamp: new Date()
      };

      if (includeDetails) {
        // Include detailed breakdowns
        metrics.detailedBreakdown = {
          hourlyTrends: await getHourlySecurityTrends(),
          topUserAgents: await getTopBlockedUserAgents(),
          geographicDistribution: await getGeographicDistribution(analytics.topBlockedIPs)
        };
      }

      res.json({
        success: true,
        data: metrics,
        timeframe,
        generatedAt: new Date()
      });

    } catch (error: any) {
      logger.error('Security analytics error', {
        error: error.message,
        userId: req.user?.id
      });

      res.status(500).json({
        error: 'ANALYTICS_ERROR',
        message: 'Failed to retrieve security analytics'
      });
    }
  }
);

// Get real-time security status
router.get('/status',
  RoleBasedAccessControl.requirePermission('security', 'read'),
  async (req: any, res: Response) => {
    try {
      const status = {
        systemHealth: 'healthy', // This would be determined by actual checks
        activeThreats: await getActiveThreats(),
        rateLimitStatus: await getRateLimitStatus(),
        apiKeyStats: await getAPIKeyStats(),
        lastSecurityScan: new Date(),
        securityFeatures: {
          ddosProtection: true,
          rateLimit: true,
          apiKeyValidation: false, // Configurable
          requestSigning: false,   // Configurable
          fraudDetection: true
        }
      };

      res.json({
        success: true,
        status,
        timestamp: new Date()
      });

    } catch (error: any) {
      logger.error('Security status error', {
        error: error.message,
        userId: req.user?.id
      });

      res.status(500).json({
        error: 'STATUS_ERROR',
        message: 'Failed to retrieve security status'
      });
    }
  }
);

// Create new API key
router.post('/api-keys',
  RoleBasedAccessControl.requirePermission('security', 'write', { logAccess: true }),
  validateRequestMiddleware(apiKeyCreateSchema),
  async (req: any, res: Response) => {
    try {
      const { name, permissions, rateLimit, expiresIn, description } = req.body;

      const apiKey = await createAPIKey({
        name,
        permissions,
        rateLimit,
        expiresIn,
        description,
        createdBy: req.user.id,
        tenantId: req.user.tenantId
      });

      res.json({
        success: true,
        apiKey: {
          id: apiKey.id,
          key: apiKey.key, // Only returned once
          name: apiKey.name,
          permissions: apiKey.permissions,
          rateLimit: apiKey.rateLimit,
          expiresAt: apiKey.expiresAt,
          createdAt: apiKey.createdAt
        },
        warning: 'Store this API key securely. It will not be shown again.'
      });

    } catch (error: any) {
      logger.error('API key creation error', {
        error: error.message,
        userId: req.user?.id
      });

      res.status(500).json({
        error: 'API_KEY_CREATION_ERROR',
        message: 'Failed to create API key'
      });
    }
  }
);

// List API keys (without revealing the actual keys)
router.get('/api-keys',
  RoleBasedAccessControl.requirePermission('security', 'read'),
  async (req: any, res: Response) => {
    try {
      const apiKeys = await getAPIKeys(req.user.tenantId);

      res.json({
        success: true,
        apiKeys: apiKeys.map(key => ({
          id: key.id,
          name: key.name,
          permissions: key.permissions,
          rateLimit: key.rateLimit,
          lastUsed: key.lastUsed,
          requestCount: key.requestCount,
          expiresAt: key.expiresAt,
          isActive: key.isActive,
          createdAt: key.createdAt
        })),
        total: apiKeys.length
      });

    } catch (error: any) {
      logger.error('API keys list error', {
        error: error.message,
        userId: req.user?.id
      });

      res.status(500).json({
        error: 'API_KEYS_LIST_ERROR',
        message: 'Failed to retrieve API keys'
      });
    }
  }
);

// Revoke API key
router.delete('/api-keys/:keyId',
  RoleBasedAccessControl.requirePermission('security', 'write', { logAccess: true }),
  async (req: any, res: Response) => {
    try {
      const { keyId } = req.params;

      const success = await revokeAPIKey(keyId, req.user.id);

      if (!success) {
        return res.status(404).json({
          error: 'API_KEY_NOT_FOUND',
          message: 'API key not found or already revoked'
        });
      }

      res.json({
        success: true,
        message: 'API key revoked successfully',
        revokedAt: new Date()
      });

    } catch (error: any) {
      logger.error('API key revocation error', {
        error: error.message,
        keyId: req.params.keyId,
        userId: req.user?.id
      });

      res.status(500).json({
        error: 'API_KEY_REVOCATION_ERROR',
        message: 'Failed to revoke API key'
      });
    }
  }
);

// Update rate limiting configuration
router.put('/rate-limits',
  RoleBasedAccessControl.requirePermission('security', 'write', { logAccess: true }),
  validateRequestMiddleware(rateLimitUpdateSchema),
  async (req: any, res: Response) => {
    try {
      const { endpoint, windowMs, maxRequests, enabled } = req.body;

      const updatedConfig = await updateRateLimitConfig({
        endpoint,
        windowMs,
        maxRequests,
        enabled,
        updatedBy: req.user.id
      });

      res.json({
        success: true,
        config: updatedConfig,
        message: 'Rate limit configuration updated successfully'
      });

    } catch (error: any) {
      logger.error('Rate limit config update error', {
        error: error.message,
        userId: req.user?.id
      });

      res.status(500).json({
        error: 'RATE_LIMIT_UPDATE_ERROR',
        message: 'Failed to update rate limit configuration'
      });
    }
  }
);

// Get current rate limiting configurations
router.get('/rate-limits',
  RoleBasedAccessControl.requirePermission('security', 'read'),
  async (req: any, res: Response) => {
    try {
      const configs = await getRateLimitConfigs();

      res.json({
        success: true,
        configs,
        defaults: {
          authentication: { windowMs: 15 * 60 * 1000, maxRequests: 5 },
          api: { windowMs: 60 * 1000, maxRequests: 100 },
          admin: { windowMs: 60 * 1000, maxRequests: 200 },
          download: { windowMs: 60 * 1000, maxRequests: 10 }
        }
      });

    } catch (error: any) {
      logger.error('Rate limit configs error', {
        error: error.message,
        userId: req.user?.id
      });

      res.status(500).json({
        error: 'RATE_LIMIT_CONFIG_ERROR',
        message: 'Failed to retrieve rate limit configurations'
      });
    }
  }
);

// Security incident response
router.post('/incidents/block-ip',
  RoleBasedAccessControl.requirePermission('security', 'write', { logAccess: true }),
  async (req: any, res: Response) => {
    try {
      const { ipAddress, duration, reason } = req.body;

      if (!ipAddress || !duration || !reason) {
        return res.status(400).json({
          error: 'INVALID_REQUEST',
          message: 'IP address, duration, and reason are required'
        });
      }

      const blockResult = await blockIPAddress({
        ipAddress,
        duration: parseInt(duration),
        reason,
        blockedBy: req.user.id
      });

      res.json({
        success: true,
        block: blockResult,
        message: `IP address ${ipAddress} blocked for ${duration} minutes`
      });

    } catch (error: any) {
      logger.error('IP blocking error', {
        error: error.message,
        userId: req.user?.id
      });

      res.status(500).json({
        error: 'IP_BLOCK_ERROR',
        message: 'Failed to block IP address'
      });
    }
  }
);

// Helper functions (would be implemented in a service layer)
async function calculateSecurityScore(analytics: any): Promise<number> {
  const blockedPercentage = analytics.totalRequests > 0 
    ? (analytics.blockedRequests / analytics.totalRequests) * 100 
    : 0;
  
  // Simple scoring algorithm (0-100)
  let score = 100;
  
  if (blockedPercentage > 20) score -= 30;
  else if (blockedPercentage > 10) score -= 20;
  else if (blockedPercentage > 5) score -= 10;
  
  // Factor in event types
  if (analytics.eventsByType.ddos_detected > 0) score -= 25;
  if (analytics.eventsByType.api_abuse > 10) score -= 15;
  
  return Math.max(0, score);
}

function generateSecurityRecommendations(analytics: any): string[] {
  const recommendations: string[] = [];
  
  if (analytics.blockedRequests > analytics.totalRequests * 0.1) {
    recommendations.push('Consider implementing additional IP whitelisting');
  }
  
  if (analytics.eventsByType.rate_limit > 50) {
    recommendations.push('Review rate limiting thresholds for better user experience');
  }
  
  if (analytics.topBlockedIPs.length > 5) {
    recommendations.push('Implement geographic filtering for suspicious regions');
  }
  
  return recommendations;
}

async function getHourlySecurityTrends(): Promise<any[]> {
  // This would query Redis/database for hourly security metrics
  return [];
}

async function getTopBlockedUserAgents(): Promise<any[]> {
  // This would analyze user agents from blocked requests
  return [];
}

async function getGeographicDistribution(topIPs: any[]): Promise<any> {
  // This would use IP geolocation to analyze geographic patterns
  return {};
}

async function getActiveThreats(): Promise<any[]> {
  // This would check for currently active security threats
  return [];
}

async function getRateLimitStatus(): Promise<any> {
  // This would check current rate limiting status
  return { healthy: true, activeRules: 5 };
}

async function getAPIKeyStats(): Promise<any> {
  // This would get API key usage statistics
  return { total: 0, active: 0, expired: 0 };
}

async function createAPIKey(data: any): Promise<any> {
  // This would create a new API key in the database
  const crypto = require('crypto');
  const key = crypto.randomBytes(32).toString('hex');
  
  return {
    id: crypto.randomUUID(),
    key,
    ...data,
    createdAt: new Date(),
    expiresAt: data.expiresIn ? new Date(Date.now() + data.expiresIn * 24 * 60 * 60 * 1000) : null
  };
}

async function getAPIKeys(tenantId: string): Promise<any[]> {
  // This would retrieve API keys from database
  return [];
}

async function revokeAPIKey(keyId: string, userId: string): Promise<boolean> {
  // This would revoke an API key
  return true;
}

async function updateRateLimitConfig(data: any): Promise<any> {
  // This would update rate limiting configuration
  return data;
}

async function getRateLimitConfigs(): Promise<any[]> {
  // This would get current rate limiting configurations
  return [];
}

async function blockIPAddress(data: any): Promise<any> {
  // This would block an IP address
  return {
    id: crypto.randomUUID(),
    ...data,
    blockedAt: new Date(),
    expiresAt: new Date(Date.now() + data.duration * 60 * 1000)
  };
}

export default router;