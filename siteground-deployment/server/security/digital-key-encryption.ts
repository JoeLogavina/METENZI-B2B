// 🔒 DIGITAL KEY ENCRYPTION SYSTEM (Step 4)
// Enterprise-grade AES-256-GCM encryption for license keys with versioning

import crypto from 'crypto';
import { logger } from '../lib/logger';
import { redisCache } from '../cache/redis';

export interface DigitalKeyMetadata {
  productId?: string;
  userId?: string;
  keyType: 'license' | 'activation' | 'download';
  version: 'v1' | 'v2';
  createdAt: Date;
  expiresAt?: Date;
  maxUses?: number;
  currentUses: number;
}

export interface EncryptedKey {
  encryptedData: string;
  keyFingerprint: string;
  metadata: DigitalKeyMetadata;
  algorithm: 'aes-256-gcm';
}

export class DigitalKeyEncryption {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly KEY_LENGTH = 32;
  private static readonly IV_LENGTH = 16;
  private static readonly TAG_LENGTH = 16;
  private static readonly CACHE_PREFIX = 'digital_key:';
  private static readonly VERSION = 'v2'; // Enhanced version with metadata

  // Encrypt digital license keys with enhanced security
  static async encryptLicenseKey(
    licenseKey: string, 
    metadata: Partial<DigitalKeyMetadata> = {},
    masterKey?: string
  ): Promise<EncryptedKey> {
    try {
      const key = masterKey ? Buffer.from(masterKey, 'hex') : this.getMasterKey();
      const iv = crypto.randomBytes(this.IV_LENGTH);
      const cipher = crypto.createCipherGCM(this.ALGORITHM, key, iv);
      
      // Enhanced authenticated data with metadata
      const aadData = JSON.stringify({
        version: this.VERSION,
        timestamp: Date.now(),
        keyType: metadata.keyType || 'license'
      });
      cipher.setAAD(Buffer.from(aadData));
      
      let encrypted = cipher.update(licenseKey, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const tag = cipher.getAuthTag();
      
      // Enhanced format: version:iv:tag:encrypted:metadata_hash
      const metadataHash = crypto.createHash('sha256').update(aadData).digest('hex').substring(0, 16);
      const encryptedData = `${this.VERSION}:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}:${metadataHash}`;
      
      // Generate key fingerprint for tracking
      const keyFingerprint = crypto.createHash('sha256')
        .update(licenseKey + aadData)
        .digest('hex')
        .substring(0, 32);

      const fullMetadata: DigitalKeyMetadata = {
        productId: metadata.productId,
        userId: metadata.userId,
        keyType: metadata.keyType || 'license',
        version: this.VERSION,
        createdAt: new Date(),
        expiresAt: metadata.expiresAt,
        maxUses: metadata.maxUses,
        currentUses: 0
      };

      const result: EncryptedKey = {
        encryptedData,
        keyFingerprint,
        metadata: fullMetadata,
        algorithm: this.ALGORITHM
      };

      // Cache for performance
      await this.cacheKey(keyFingerprint, result);

      logger.info('Digital key encrypted successfully', {
        keyFingerprint,
        keyType: fullMetadata.keyType,
        userId: metadata.userId
      });

      return result;
    } catch (error: any) {
      logger.error('Digital key encryption failed', { 
        error: error.message,
        keyType: metadata.keyType 
      });
      throw new Error('Failed to encrypt digital key');
    }
  }

  // Decrypt digital license keys with validation
  static async decryptLicenseKey(
    encryptedKey: EncryptedKey | string,
    masterKey?: string
  ): Promise<{ plainKey: string; metadata: DigitalKeyMetadata }> {
    try {
      const key = masterKey ? Buffer.from(masterKey, 'hex') : this.getMasterKey();
      
      // Handle both EncryptedKey object and legacy string format
      const encryptedData = typeof encryptedKey === 'string' ? encryptedKey : encryptedKey.encryptedData;
      const metadata = typeof encryptedKey === 'object' ? encryptedKey.metadata : null;
      
      const parts = encryptedData.split(':');
      if (parts.length < 4) {
        throw new Error('Invalid encrypted key format');
      }

      const [version, ivHex, tagHex, encrypted, metadataHash] = parts;
      
      if (!['v1', 'v2'].includes(version)) {
        throw new Error('Unsupported key version');
      }

      const iv = Buffer.from(ivHex, 'hex');
      const tag = Buffer.from(tagHex, 'hex');
      const decipher = crypto.createDecipherGCM(this.ALGORITHM, key, iv);
      
      // Reconstruct AAD for v2 keys
      if (version === 'v2' && metadata) {
        const aadData = JSON.stringify({
          version,
          timestamp: new Date(metadata.createdAt).getTime(),
          keyType: metadata.keyType
        });
        decipher.setAAD(Buffer.from(aadData));
      } else if (version === 'v1') {
        // Legacy v1 format
        decipher.setAAD(Buffer.from('license-key-v1'));
      }
      
      decipher.setAuthTag(tag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      // Validate usage limits
      if (metadata) {
        await this.validateKeyUsage(metadata);
      }

      logger.info('Digital key decrypted successfully', {
        keyFingerprint: typeof encryptedKey === 'object' ? encryptedKey.keyFingerprint : 'legacy',
        version
      });

      return {
        plainKey: decrypted,
        metadata: metadata || {
          keyType: 'license',
          version: 'v1' as const,
          createdAt: new Date(),
          currentUses: 0
        }
      };
    } catch (error: any) {
      logger.error('Digital key decryption failed', { error: error.message });
      throw new Error('Failed to decrypt digital key');
    }
  }

  // Generate new secure license key
  static async generateSecureLicenseKey(
    productId: string,
    userId: string,
    options: {
      keyType?: 'license' | 'activation' | 'download';
      expiresAt?: Date;
      maxUses?: number;
    } = {}
  ): Promise<{
    plainKey: string;
    encryptedKey: EncryptedKey;
    downloadUrl?: string;
  }> {
    const timestamp = Date.now();
    const randomBytes = crypto.randomBytes(16).toString('hex');
    const keyPrefix = options.keyType === 'download' ? 'DWN' : 
                     options.keyType === 'activation' ? 'ACT' : 'LIC';
    
    const plainKey = `${keyPrefix}-${productId}-${userId}-${timestamp}-${randomBytes}`.toUpperCase();
    
    const metadata: Partial<DigitalKeyMetadata> = {
      productId,
      userId,
      keyType: options.keyType || 'license',
      expiresAt: options.expiresAt,
      maxUses: options.maxUses
    };

    const encryptedKey = await this.encryptLicenseKey(plainKey, metadata);
    
    // Generate secure download URL for download keys
    let downloadUrl: string | undefined;
    if (options.keyType === 'download') {
      downloadUrl = await this.generateSecureDownloadUrl(encryptedKey.keyFingerprint);
    }

    logger.info('Secure license key generated', {
      keyFingerprint: encryptedKey.keyFingerprint,
      keyType: options.keyType || 'license',
      userId,
      productId
    });

    return { plainKey, encryptedKey, downloadUrl };
  }

  // Validate key usage and increment counter
  static async validateKeyUsage(metadata: DigitalKeyMetadata): Promise<void> {
    // Check expiration
    if (metadata.expiresAt && new Date() > metadata.expiresAt) {
      throw new Error('Digital key has expired');
    }

    // Check usage limits
    if (metadata.maxUses && metadata.currentUses >= metadata.maxUses) {
      throw new Error('Digital key usage limit exceeded');
    }

    // Increment usage counter
    metadata.currentUses++;
    
    // Update cache if key exists
    const cacheKey = `${this.CACHE_PREFIX}${metadata.userId}:${metadata.productId}`;
    const cached = await redisCache.get(cacheKey);
    if (cached) {
      await redisCache.set(cacheKey, { ...cached, metadata }, 3600); // 1 hour TTL
    }
  }

  // Generate secure download URL with time-limited token
  private static async generateSecureDownloadUrl(keyFingerprint: string): Promise<string> {
    const downloadToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + (15 * 60 * 1000); // 15 minutes
    
    const tokenData = {
      keyFingerprint,
      expiresAt,
      used: false,
      createdAt: Date.now()
    };

    await redisCache.set(`download_token:${downloadToken}`, tokenData, 900); // 15 minutes

    return `/api/secure-download/${downloadToken}`;
  }

  // Get master encryption key
  private static getMasterKey(): Buffer {
    const keyHex = process.env.DIGITAL_KEY_ENCRYPTION_MASTER;
    if (!keyHex) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Critical: DIGITAL_KEY_ENCRYPTION_MASTER not configured');
      }
      // Development fallback
      logger.warn('Using development fallback encryption key');
      return crypto.createHash('sha256').update('dev-master-key').digest();
    }
    return Buffer.from(keyHex, 'hex');
  }

  // Cache encrypted key for performance
  private static async cacheKey(keyFingerprint: string, encryptedKey: EncryptedKey): Promise<void> {
    const cacheKey = `${this.CACHE_PREFIX}fingerprint:${keyFingerprint}`;
    await redisCache.set(cacheKey, encryptedKey, 3600); // 1 hour TTL
  }

  // Get cached key by fingerprint
  static async getCachedKey(keyFingerprint: string): Promise<EncryptedKey | null> {
    const cacheKey = `${this.CACHE_PREFIX}fingerprint:${keyFingerprint}`;
    return await redisCache.get(cacheKey);
  }

  // Key rotation functionality
  static async rotateKey(oldKeyFingerprint: string, newMasterKey?: string): Promise<EncryptedKey> {
    const oldKey = await this.getCachedKey(oldKeyFingerprint);
    if (!oldKey) {
      throw new Error('Key not found for rotation');
    }

    // Decrypt with old key
    const { plainKey, metadata } = await this.decryptLicenseKey(oldKey);
    
    // Re-encrypt with new key
    const newEncryptedKey = await this.encryptLicenseKey(plainKey, metadata, newMasterKey);
    
    logger.info('Digital key rotated successfully', {
      oldFingerprint: oldKeyFingerprint,
      newFingerprint: newEncryptedKey.keyFingerprint
    });

    return newEncryptedKey;
  }

  // Bulk encryption for license key migration
  static async bulkEncryptKeys(
    keys: Array<{ key: string; metadata: Partial<DigitalKeyMetadata> }>
  ): Promise<EncryptedKey[]> {
    const results: EncryptedKey[] = [];
    
    for (const { key, metadata } of keys) {
      try {
        const encrypted = await this.encryptLicenseKey(key, metadata);
        results.push(encrypted);
      } catch (error) {
        logger.error('Bulk encryption failed for key', { error, metadata });
      }
    }

    logger.info('Bulk encryption completed', {
      total: keys.length,
      successful: results.length,
      failed: keys.length - results.length
    });

    return results;
  }

  // Get encryption statistics
  static async getEncryptionStats(): Promise<{
    totalKeys: number;
    keysByType: Record<string, number>;
    recentActivity: number;
    cacheHitRate: number;
  }> {
    // This would typically query the database for actual stats
    // For now, return cache-based approximation
    const cacheKeys = await redisCache.keys(`${this.CACHE_PREFIX}*`);
    
    return {
      totalKeys: cacheKeys.length,
      keysByType: {
        license: 0, // Would be calculated from actual data
        activation: 0,
        download: 0
      },
      recentActivity: 0, // Keys accessed in last hour
      cacheHitRate: 95.5 // Placeholder - would be calculated from metrics
    };
  }
}