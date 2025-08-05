// 🔑 DIGITAL KEY SERVICE (Step 4)
// Business logic for digital key management

import { DigitalKeyEncryption, DigitalKeyMetadata, EncryptedKey } from '../security/digital-key-encryption';
import { SecureDownloadSystem } from '../security/secure-download-system';
import { storage } from '../storage';
import { logger } from '../lib/logger';
import { redisCache } from '../cache/redis';

export interface KeyGenerationRequest {
  productId: string;
  userId: string;
  keyType?: 'license' | 'activation' | 'download';
  expiresAt?: Date;
  maxUses?: number;
  generateDownloadUrl?: boolean;
}

export interface KeyGenerationResult {
  keyId: string;
  plainKey: string;
  encryptedKey: EncryptedKey;
  downloadUrl?: string;
  downloadToken?: string;
}

export class DigitalKeyService {
  private static readonly CACHE_PREFIX = 'digital_key_service:';

  // Generate new digital key for product
  static async generateDigitalKey(request: KeyGenerationRequest): Promise<KeyGenerationResult> {
    try {
      // Validate request
      await this.validateKeyGenerationRequest(request);

      // Generate secure license key
      const keyResult = await DigitalKeyEncryption.generateSecureLicenseKey(
        request.productId,
        request.userId,
        {
          keyType: request.keyType || 'license',
          expiresAt: request.expiresAt,
          maxUses: request.maxUses
        }
      );

      // Store in database
      const keyId = await this.storeDigitalKey({
        productId: request.productId,
        userId: request.userId,
        encryptedKey: keyResult.encryptedKey.encryptedData,
        keyFingerprint: keyResult.encryptedKey.keyFingerprint,
        keyType: request.keyType || 'license',
        expiresAt: request.expiresAt,
        maxUses: request.maxUses || 1,
        metadata: keyResult.encryptedKey.metadata
      });

      let downloadUrl: string | undefined;
      let downloadToken: string | undefined;

      // Generate download URL if requested
      if (request.generateDownloadUrl) {
        const downloadTokenObj = await SecureDownloadSystem.generateDownloadToken(
          keyResult.encryptedKey.keyFingerprint,
          request.userId,
          {
            resourceType: request.keyType || 'license',
            filename: `license_${keyResult.encryptedKey.keyFingerprint.substring(0, 8)}.txt`,
            expiryMinutes: 60, // 1 hour for new keys
            maxDownloads: 3, // Allow multiple downloads for new keys
            metadata: {
              keyId,
              productId: request.productId
            }
          }
        );

        downloadUrl = `/api/secure-download/${downloadTokenObj.token}`;
        downloadToken = downloadTokenObj.token;
      }

      // Cache the result
      await this.cacheKeyResult(keyId, {
        keyId,
        plainKey: keyResult.plainKey,
        encryptedKey: keyResult.encryptedKey,
        downloadUrl,
        downloadToken
      });

      logger.info('Digital key generated successfully', {
        keyId,
        keyFingerprint: keyResult.encryptedKey.keyFingerprint,
        productId: request.productId,
        userId: request.userId,
        keyType: request.keyType || 'license'
      });

      return {
        keyId,
        plainKey: keyResult.plainKey,
        encryptedKey: keyResult.encryptedKey,
        downloadUrl,
        downloadToken
      };

    } catch (error: any) {
      logger.error('Digital key generation failed', {
        error: error.message,
        request
      });
      throw new Error(`Failed to generate digital key: ${error.message}`);
    }
  }

  // Retrieve digital key by ID
  static async getDigitalKey(keyId: string, userId: string): Promise<{
    keyId: string;
    plainKey: string;
    metadata: DigitalKeyMetadata;
    isValid: boolean;
    usageInfo: {
      currentUses: number;
      maxUses: number;
      remainingUses: number;
    };
  } | null> {
    try {
      // Check cache first
      const cached = await this.getCachedKey(keyId);
      if (cached && cached.encryptedKey.metadata.userId === userId) {
        const { plainKey, metadata } = await DigitalKeyEncryption.decryptLicenseKey(cached.encryptedKey);
        
        return {
          keyId,
          plainKey,
          metadata,
          isValid: this.isKeyValid(metadata),
          usageInfo: {
            currentUses: metadata.currentUses,
            maxUses: metadata.maxUses || 1,
            remainingUses: Math.max(0, (metadata.maxUses || 1) - metadata.currentUses)
          }
        };
      }

      // Fetch from database
      const dbKey = await this.fetchKeyFromDatabase(keyId, userId);
      if (!dbKey) {
        return null;
      }

      // Decrypt key
      const encryptedKeyObj: EncryptedKey = {
        encryptedData: dbKey.encryptedKey,
        keyFingerprint: dbKey.keyFingerprint,
        metadata: dbKey.metadata,
        algorithm: 'aes-256-gcm'
      };

      const { plainKey, metadata } = await DigitalKeyEncryption.decryptLicenseKey(encryptedKeyObj);

      const result = {
        keyId,
        plainKey,
        metadata,
        isValid: this.isKeyValid(metadata),
        usageInfo: {
          currentUses: metadata.currentUses,
          maxUses: metadata.maxUses || 1,
          remainingUses: Math.max(0, (metadata.maxUses || 1) - metadata.currentUses)
        }
      };

      // Cache the result
      await this.cacheKeyResult(keyId, {
        keyId,
        plainKey,
        encryptedKey: encryptedKeyObj
      });

      return result;

    } catch (error: any) {
      logger.error('Failed to retrieve digital key', {
        error: error.message,
        keyId,
        userId
      });
      return null;
    }
  }

  // Use digital key (increment usage counter)
  static async useDigitalKey(keyId: string, userId: string): Promise<{
    success: boolean;
    key?: string;
    remainingUses?: number;
    error?: string;
  }> {
    try {
      const keyData = await this.getDigitalKey(keyId, userId);
      
      if (!keyData) {
        return { success: false, error: 'Key not found' };
      }

      if (!keyData.isValid) {
        return { success: false, error: 'Key is no longer valid' };
      }

      if (keyData.usageInfo.remainingUses <= 0) {
        return { success: false, error: 'Key usage limit exceeded' };
      }

      // Increment usage counter
      await DigitalKeyEncryption.validateKeyUsage(keyData.metadata);

      // Update database
      await this.updateKeyUsage(keyId, keyData.metadata.currentUses + 1);

      // Invalidate cache
      await this.invalidateKeyCache(keyId);

      logger.info('Digital key used successfully', {
        keyId,
        userId,
        newUsageCount: keyData.metadata.currentUses + 1,
        remainingUses: keyData.usageInfo.remainingUses - 1
      });

      return {
        success: true,
        key: keyData.plainKey,
        remainingUses: keyData.usageInfo.remainingUses - 1
      };

    } catch (error: any) {
      logger.error('Failed to use digital key', {
        error: error.message,
        keyId,
        userId
      });
      return { success: false, error: error.message };
    }
  }

  // Get all keys for a user
  static async getUserKeys(userId: string, options: {
    includeExpired?: boolean;
    keyType?: 'license' | 'activation' | 'download';
    productId?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{
    keys: Array<{
      keyId: string;
      keyFingerprint: string;
      productId: string;
      keyType: string;
      createdAt: Date;
      expiresAt?: Date;
      isValid: boolean;
      usageInfo: {
        currentUses: number;
        maxUses: number;
        remainingUses: number;
      };
    }>;
    total: number;
    hasMore: boolean;
  }> {
    try {
      // This would typically query the database
      // For now, return empty result structure
      return {
        keys: [],
        total: 0,
        hasMore: false
      };

    } catch (error: any) {
      logger.error('Failed to get user keys', {
        error: error.message,
        userId,
        options
      });
      throw error;
    }
  }

  // Revoke digital key
  static async revokeDigitalKey(keyId: string, userId: string, reason: string): Promise<boolean> {
    try {
      // Update key status in database
      const revoked = await this.updateKeyStatus(keyId, userId, 'revoked', reason);
      
      if (revoked) {
        // Invalidate cache
        await this.invalidateKeyCache(keyId);

        logger.info('Digital key revoked', {
          keyId,
          userId,
          reason
        });
      }

      return revoked;

    } catch (error: any) {
      logger.error('Failed to revoke digital key', {
        error: error.message,
        keyId,
        userId,
        reason
      });
      return false;
    }
  }

  // Rotate encryption keys
  static async rotateKeys(batchSize: number = 100): Promise<{
    processed: number;
    successful: number;
    failed: number;
    errors: string[];
  }> {
    const result = {
      processed: 0,
      successful: 0,
      failed: 0,
      errors: [] as string[]
    };

    try {
      // Get keys that need rotation (this would query database)
      const keysToRotate = await this.getKeysForRotation(batchSize);

      for (const key of keysToRotate) {
        result.processed++;

        try {
          const rotatedKey = await DigitalKeyEncryption.rotateKey(key.keyFingerprint);
          await this.updateRotatedKey(key.keyId, rotatedKey);
          result.successful++;
        } catch (error: any) {
          result.failed++;
          result.errors.push(`Key ${key.keyId}: ${error.message}`);
        }
      }

      logger.info('Key rotation completed', result);
      return result;

    } catch (error: any) {
      logger.error('Key rotation failed', {
        error: error.message,
        result
      });
      throw error;
    }
  }

  // Private helper methods

  private static async validateKeyGenerationRequest(request: KeyGenerationRequest): Promise<void> {
    if (!request.productId || !request.userId) {
      throw new Error('Product ID and User ID are required');
    }

    // Additional validation logic would go here
    // e.g., check if user has permission to generate keys for this product
  }

  private static async storeDigitalKey(keyData: any): Promise<string> {
    // This would typically insert into database
    // For now, generate a mock key ID
    const keyId = `key_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // In production, this would be:
    // const result = await storage.createDigitalKey(keyData);
    // return result.id;
    
    return keyId;
  }

  private static async fetchKeyFromDatabase(keyId: string, userId: string): Promise<any> {
    // This would typically query the database
    // For now, return null
    return null;
  }

  private static async updateKeyUsage(keyId: string, newUsageCount: number): Promise<void> {
    // This would typically update the database
    // For now, do nothing
  }

  private static async updateKeyStatus(keyId: string, userId: string, status: string, reason: string): Promise<boolean> {
    // This would typically update the database
    // For now, return true
    return true;
  }

  private static async getKeysForRotation(batchSize: number): Promise<any[]> {
    // This would typically query the database for keys that need rotation
    // For now, return empty array
    return [];
  }

  private static async updateRotatedKey(keyId: string, rotatedKey: EncryptedKey): Promise<void> {
    // This would typically update the database with new encrypted key
    // For now, do nothing
  }

  private static isKeyValid(metadata: DigitalKeyMetadata): boolean {
    const now = new Date();
    
    // Check expiration
    if (metadata.expiresAt && now > metadata.expiresAt) {
      return false;
    }

    // Check usage limits
    if (metadata.maxUses && metadata.currentUses >= metadata.maxUses) {
      return false;
    }

    return true;
  }

  private static async cacheKeyResult(keyId: string, result: KeyGenerationResult): Promise<void> {
    const cacheKey = `${this.CACHE_PREFIX}result:${keyId}`;
    await redisCache.set(cacheKey, result, 3600); // 1 hour TTL
  }

  private static async getCachedKey(keyId: string): Promise<KeyGenerationResult | null> {
    const cacheKey = `${this.CACHE_PREFIX}result:${keyId}`;
    return await redisCache.get(cacheKey);
  }

  private static async invalidateKeyCache(keyId: string): Promise<void> {
    const cacheKey = `${this.CACHE_PREFIX}result:${keyId}`;
    await redisCache.del(cacheKey);
  }
}