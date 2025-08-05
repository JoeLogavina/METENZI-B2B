// 🔐 SECURE DOWNLOAD ROUTES (Step 4)
// API endpoints for secure download system

import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';
import { SecureDownloadSystem } from '../security/secure-download-system';
import { DigitalKeyEncryption } from '../security/digital-key-encryption';
// Authentication middleware
const isAuthenticated = (req: any, res: any, next: any) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
};
import path from 'path';
import fs from 'fs/promises';

const router = Router();

// Generate download token for authenticated users
router.post('/token', isAuthenticated, async (req: any, res: Response) => {
  try {
    const { resourceId, resourceType, filename, expiryMinutes, maxDownloads, metadata } = req.body;
    const userId = req.user.id;

    if (!resourceId) {
      return res.status(400).json({
        error: 'MISSING_RESOURCE_ID',
        message: 'Resource ID is required'
      });
    }

    // Validate user has access to this resource
    // This would typically check database permissions
    const hasAccess = await validateUserResourceAccess(userId, resourceId);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'ACCESS_DENIED',
        message: 'You do not have access to this resource'
      });
    }

    const downloadToken = await SecureDownloadSystem.generateDownloadToken(
      resourceId,
      userId,
      {
        resourceType: resourceType || 'license',
        filename,
        expiryMinutes: Math.min(expiryMinutes || 15, 60), // Max 1 hour
        maxDownloads: Math.min(maxDownloads || 1, 5), // Max 5 downloads
        metadata: metadata || {},
        userAgent: req.get('User-Agent')
      }
    );

    res.json({
      success: true,
      downloadToken: downloadToken.token,
      downloadUrl: `/api/secure-download/${downloadToken.token}`,
      expiresAt: downloadToken.expiresAt,
      maxDownloads: downloadToken.maxDownloads
    });

  } catch (error: any) {
    logger.error('Download token generation failed', {
      error: error.message,
      userId: req.user?.id,
      body: req.body
    });
    res.status(500).json({
      error: 'TOKEN_GENERATION_FAILED',
      message: 'Failed to generate download token'
    });
  }
});

// Download file using secure token
router.get('/:token', SecureDownloadSystem.protectDownload(), async (req: any, res: Response) => {
  const startTime = Date.now();
  let downloadedBytes = 0;

  try {
    const downloadToken = req.downloadToken;
    const { resourceId, resourceType, filename, checksumSHA256 } = downloadToken;

    // Get file path based on resource type and ID
    const filePath = await getResourceFilePath(resourceType, resourceId);
    
    if (!filePath) {
      return res.status(404).json({
        error: 'RESOURCE_NOT_FOUND',
        message: 'The requested resource could not be found'
      });
    }

    // Check file exists
    const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
    if (!fileExists) {
      return res.status(404).json({
        error: 'FILE_NOT_FOUND',
        message: 'The requested file is not available'
      });
    }

    // Get file stats
    const fileStats = await fs.stat(filePath);
    downloadedBytes = fileStats.size;

    // Set appropriate headers
    const displayFilename = filename || path.basename(filePath);
    res.setHeader('Content-Disposition', `attachment; filename="${displayFilename}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', fileStats.size);
    res.setHeader('X-Download-Token', req.params.token.substring(0, 8) + '...');
    
    // Add checksum header if available
    if (checksumSHA256) {
      res.setHeader('X-File-Checksum-SHA256', checksumSHA256);
    }

    // Handle range requests for large files
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileStats.size - 1;
      const chunksize = (end - start) + 1;
      
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${fileStats.size}`);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Length', chunksize);
      
      downloadedBytes = chunksize;
    }

    // Stream file to response
    const fileStream = await fs.readFile(filePath);
    res.send(fileStream);

    // Mark token as consumed
    const duration = Date.now() - startTime;
    await SecureDownloadSystem.consumeDownloadToken(
      req.params.token,
      downloadedBytes,
      duration
    );

    logger.info('Secure download completed', {
      token: req.params.token.substring(0, 8) + '...',
      resourceId,
      resourceType,
      filename: displayFilename,
      downloadedBytes,
      duration,
      userId: downloadToken.userId
    });

  } catch (error: any) {
    logger.error('Secure download failed', {
      error: error.message,
      token: req.params.token?.substring(0, 8) + '...',
      downloadedBytes,
      duration: Date.now() - startTime
    });

    res.status(500).json({
      error: 'DOWNLOAD_FAILED',
      message: 'The download could not be completed'
    });
  }
});

// Stream license key download
router.get('/license/:keyFingerprint', isAuthenticated, async (req: any, res: Response) => {
  try {
    const { keyFingerprint } = req.params;
    const userId = req.user.id;

    // Get encrypted key from cache/database
    const encryptedKey = await DigitalKeyEncryption.getCachedKey(keyFingerprint);
    if (!encryptedKey || encryptedKey.metadata.userId !== userId) {
      return res.status(404).json({
        error: 'LICENSE_NOT_FOUND',
        message: 'License key not found or access denied'
      });
    }

    // Decrypt the license key
    const { plainKey, metadata } = await DigitalKeyEncryption.decryptLicenseKey(encryptedKey);

    // Generate download token specifically for this license
    const downloadToken = await SecureDownloadSystem.generateDownloadToken(
      keyFingerprint,
      userId,
      {
        resourceType: 'license',
        filename: `license_${keyFingerprint.substring(0, 8)}.txt`,
        expiryMinutes: 5, // Short expiry for license keys
        maxDownloads: 1,
        metadata: { licenseKey: plainKey, keyType: metadata.keyType }
      }
    );

    // Create license file content
    const licenseContent = generateLicenseFileContent(plainKey, metadata, encryptedKey);

    // Set headers for license file download
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="license_${keyFingerprint.substring(0, 8)}.txt"`);
    res.setHeader('X-License-Fingerprint', keyFingerprint);

    res.send(licenseContent);

    // Consume the download token
    await SecureDownloadSystem.consumeDownloadToken(
      downloadToken.token,
      Buffer.byteLength(licenseContent, 'utf8'),
      0
    );

    logger.info('License key downloaded', {
      keyFingerprint,
      userId,
      keyType: metadata.keyType
    });

  } catch (error: any) {
    logger.error('License download failed', {
      error: error.message,
      keyFingerprint: req.params.keyFingerprint,
      userId: req.user?.id
    });

    res.status(500).json({
      error: 'LICENSE_DOWNLOAD_FAILED',
      message: 'Failed to download license key'
    });
  }
});

// Revoke download token (admin only)
router.delete('/token/:token', isAuthenticated, async (req: any, res: Response) => {
  try {
    const { token } = req.params;
    const { reason } = req.body;
    const user = req.user;

    // Check admin permissions
    if (!['admin', 'super_admin'].includes(user.role)) {
      return res.status(403).json({
        error: 'INSUFFICIENT_PERMISSIONS',
        message: 'Admin access required'
      });
    }

    const revoked = await SecureDownloadSystem.revokeDownloadToken(
      token,
      reason || `Revoked by admin: ${user.username}`
    );

    if (!revoked) {
      return res.status(404).json({
        error: 'TOKEN_NOT_FOUND',
        message: 'Download token not found'
      });
    }

    res.json({
      success: true,
      message: 'Download token revoked successfully'
    });

  } catch (error: any) {
    logger.error('Token revocation failed', {
      error: error.message,
      token: req.params.token?.substring(0, 8) + '...',
      adminUser: req.user?.username
    });

    res.status(500).json({
      error: 'REVOCATION_FAILED',
      message: 'Failed to revoke download token'
    });
  }
});

// Get download statistics (admin only)
router.get('/stats/overview', isAuthenticated, async (req: any, res: Response) => {
  try {
    const user = req.user;
    const { timeRange } = req.query;

    // Check admin permissions
    if (!['admin', 'super_admin'].includes(user.role)) {
      return res.status(403).json({
        error: 'INSUFFICIENT_PERMISSIONS',
        message: 'Admin access required'
      });
    }

    const stats = await SecureDownloadSystem.getDownloadStats(
      timeRange as 'hour' | 'day' | 'week' || 'day'
    );

    res.json({
      success: true,
      stats,
      timeRange: timeRange || 'day'
    });

  } catch (error: any) {
    logger.error('Failed to get download stats', {
      error: error.message,
      adminUser: req.user?.username
    });

    res.status(500).json({
      error: 'STATS_FAILED',
      message: 'Failed to retrieve download statistics'
    });
  }
});

// Helper function to validate user access to resource
async function validateUserResourceAccess(userId: string, resourceId: string): Promise<boolean> {
  // This would typically check database permissions
  // For now, return true for authenticated users
  // In production, implement proper authorization logic
  return true;
}

// Helper function to get file path for resource
async function getResourceFilePath(resourceType: string, resourceId: string): Promise<string | null> {
  // This would typically map resource IDs to file paths
  // For now, return a placeholder path
  switch (resourceType) {
    case 'license':
      return path.join(process.cwd(), 'uploads', 'licenses', `${resourceId}.lic`);
    case 'software':
      return path.join(process.cwd(), 'uploads', 'software', `${resourceId}.zip`);
    case 'document':
      return path.join(process.cwd(), 'uploads', 'documents', `${resourceId}.pdf`);
    default:
      return null;
  }
}

// Helper function to generate license file content
function generateLicenseFileContent(
  licenseKey: string,
  metadata: any,
  encryptedKey: any
): string {
  const timestamp = new Date().toISOString();
  
  return `====================================
SOFTWARE LICENSE KEY
====================================

License Key: ${licenseKey}
Product ID: ${metadata.productId || 'N/A'}
User ID: ${metadata.userId || 'N/A'}
Key Type: ${metadata.keyType || 'license'}
Version: ${metadata.version || 'v1'}
Created: ${metadata.createdAt || 'N/A'}
Expires: ${metadata.expiresAt || 'Never'}

Key Fingerprint: ${encryptedKey.keyFingerprint}
Algorithm: ${encryptedKey.algorithm}

Generated: ${timestamp}

IMPORTANT: Keep this license key secure and do not share it.
This key is for your exclusive use only.

====================================`;
}

export default router;