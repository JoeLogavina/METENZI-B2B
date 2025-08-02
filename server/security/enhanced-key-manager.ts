// 🔒 Enhanced Key Management System - Phase 1 Implementation
// Addresses critical security vulnerabilities in key storage and rotation

import crypto from 'crypto';
import { logger } from '../lib/logger';

export interface KeyRotationInfo {
  keyType: string;
  oldFingerprint?: string;
  newFingerprint: string;
  rotationDate: Date;
  initiatedBy: string;
  success: boolean;
  affectedRecords?: number;
}

export interface KeyDerivationConfig {
  iterations: number;
  keyLength: number;
  hashAlgorithm: string;
  saltPrefix: string;
}

/**
 * Enterprise Key Management System with proper key derivation and rotation
 * Replaces direct environment variable usage with secure key derivation
 */
export class EnterpriseKeyManager {
  private static readonly KEY_DERIVATION_CONFIG: KeyDerivationConfig = {
    iterations: 100000, // PBKDF2 iterations for security
    keyLength: 32,      // AES-256 key length
    hashAlgorithm: 'sha256',
    saltPrefix: 'B2B_LICENSE_PLATFORM_2024'
  };

  private static keyCache = new Map<string, { key: Buffer; expires: number }>();
  private static readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Derive encryption keys using PBKDF2 for enhanced security
   * Each key type gets a unique derived key from the master key
   */
  private static deriveKey(masterKey: string, keyType: string, version: string = 'v1'): Buffer {
    try {
      const salt = `${this.KEY_DERIVATION_CONFIG.saltPrefix}_${keyType}_${version}`;
      
      return crypto.pbkdf2Sync(
        masterKey,
        salt,
        this.KEY_DERIVATION_CONFIG.iterations,
        this.KEY_DERIVATION_CONFIG.keyLength,
        this.KEY_DERIVATION_CONFIG.hashAlgorithm
      );
    } catch (error) {
      logger.error('Key derivation failed', { 
        keyType, 
        version, 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error(`Failed to derive key for ${keyType}`);
    }
  }

  /**
   * Get encryption key for specific purpose with caching
   */
  static getEncryptionKey(keyType: 'LICENSE' | 'VAULT' | 'JWT' | 'SESSION', version: string = 'v1'): Buffer {
    const cacheKey = `${keyType}_${version}`;
    
    // Check cache first
    const cached = this.keyCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return cached.key;
    }

    // Get master key from environment
    const masterKey = this.getMasterKey();
    
    // Derive specific key
    const derivedKey = this.deriveKey(masterKey, keyType, version);
    
    // Cache the derived key
    this.keyCache.set(cacheKey, {
      key: derivedKey,
      expires: Date.now() + this.CACHE_TTL
    });

    logger.info('Encryption key generated', { 
      keyType, 
      version,
      fingerprint: this.getKeyFingerprint(derivedKey)
    });

    return derivedKey;
  }

  /**
   * Generate key fingerprint for identification and logging
   */
  static getKeyFingerprint(key: Buffer): string {
    return crypto.createHash('sha256').update(key).digest('hex').substring(0, 16);
  }

  /**
   * Get master key with proper error handling and fallbacks
   */
  private static getMasterKey(): string {
    const masterKey = process.env.MASTER_KEY_ROOT || process.env.DIGITAL_KEY_ENCRYPTION_MASTER;
    
    if (!masterKey) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Critical: Master key not configured in production environment');
      }
      
      logger.warn('Master key not configured, using development fallback');
      return crypto.randomBytes(32).toString('hex');
    }

    // Validate key format
    if (masterKey.length < 64) {
      throw new Error('Master key must be at least 64 characters (256 bits)');
    }

    return masterKey;
  }

  /**
   * Rotate encryption keys - maintains backward compatibility
   */
  static async rotateKeys(keyType: 'LICENSE' | 'VAULT' | 'JWT' | 'SESSION', initiatedBy: string): Promise<KeyRotationInfo> {
    try {
      const oldVersion = 'v1';
      const newVersion = `v${Date.now()}`;
      
      // Get current key fingerprint
      const oldKey = this.getEncryptionKey(keyType, oldVersion);
      const oldFingerprint = this.getKeyFingerprint(oldKey);
      
      // Generate new key
      const newKey = this.getEncryptionKey(keyType, newVersion);
      const newFingerprint = this.getKeyFingerprint(newKey);
      
      // Clear old cache
      this.keyCache.delete(`${keyType}_${oldVersion}`);
      
      const rotationInfo: KeyRotationInfo = {
        keyType,
        oldFingerprint,
        newFingerprint,
        rotationDate: new Date(),
        initiatedBy,
        success: true
      };

      logger.info('Key rotation completed', rotationInfo);
      
      // TODO: Update database records with new key version
      // This would be implemented with your specific database operations
      
      return rotationInfo;
      
    } catch (error) {
      const rotationInfo: KeyRotationInfo = {
        keyType,
        rotationDate: new Date(),
        initiatedBy,
        success: false,
        newFingerprint: 'FAILED'
      };
      
      logger.error('Key rotation failed', { 
        ...rotationInfo, 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return rotationInfo;
    }
  }

  /**
   * Validate key health and configuration
   */
  static validateKeyConfiguration(): {
    isValid: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check master key configuration
    try {
      this.getMasterKey();
    } catch (error) {
      issues.push(`Master key configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
      recommendations.push('Set MASTER_KEY_ROOT environment variable with 64+ character hex string');
    }

    // Check key derivation performance
    const startTime = Date.now();
    try {
      this.getEncryptionKey('LICENSE');
      const derivationTime = Date.now() - startTime;
      
      if (derivationTime > 1000) {
        issues.push(`Key derivation too slow: ${derivationTime}ms`);
        recommendations.push('Consider reducing PBKDF2 iterations for better performance');
      }
    } catch (error) {
      issues.push(`Key derivation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Check environment security
    if (process.env.NODE_ENV !== 'production') {
      recommendations.push('Ensure proper key security measures for production deployment');
    }

    return {
      isValid: issues.length === 0,
      issues,
      recommendations
    };
  }

  /**
   * Clear key cache (useful for testing and security)
   */
  static clearKeyCache(): void {
    this.keyCache.clear();
    logger.info('Key cache cleared');
  }

  /**
   * Get cache statistics for monitoring
   */
  static getCacheStats(): {
    cacheSize: number;
    cachedKeys: string[];
    totalHits: number;
  } {
    return {
      cacheSize: this.keyCache.size,
      cachedKeys: Array.from(this.keyCache.keys()),
      totalHits: 0 // TODO: Implement hit counting if needed
    };
  }
}

/**
 * Enhanced Digital Key Encryption using the new key manager
 */
export class EnhancedDigitalKeyEncryption {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly IV_LENGTH = 16;
  private static readonly TAG_LENGTH = 16;

  /**
   * Encrypt license key using enhanced key management
   */
  static encryptLicenseKey(licenseKey: string, keyVersion: string = 'v1'): string {
    try {
      const encryptionKey = EnterpriseKeyManager.getEncryptionKey('LICENSE', keyVersion);
      const iv = crypto.randomBytes(this.IV_LENGTH);
      
      const cipher = crypto.createCipheriv(this.ALGORITHM, encryptionKey, iv);
      cipher.setAAD(Buffer.from(`license-key-${keyVersion}`));
      
      let encrypted = cipher.update(licenseKey, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const tag = cipher.getAuthTag();
      
      // Format: version:iv:tag:encrypted
      return `${keyVersion}:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
      
    } catch (error) {
      logger.error('Enhanced license key encryption failed', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        keyVersion 
      });
      throw new Error('Failed to encrypt license key');
    }
  }

  /**
   * Decrypt license key with version support
   */
  static decryptLicenseKey(encryptedKey: string): string {
    try {
      const [version, ivHex, tagHex, encrypted] = encryptedKey.split(':');
      
      if (!version || !ivHex || !tagHex || !encrypted) {
        throw new Error('Invalid encrypted key format');
      }

      const encryptionKey = EnterpriseKeyManager.getEncryptionKey('LICENSE', version);
      const iv = Buffer.from(ivHex, 'hex');
      const tag = Buffer.from(tagHex, 'hex');
      
      const decipher = crypto.createDecipheriv(this.ALGORITHM, encryptionKey, iv);
      decipher.setAAD(Buffer.from(`license-key-${version}`));
      decipher.setAuthTag(tag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
      
    } catch (error) {
      logger.error('Enhanced license key decryption failed', { 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error('Failed to decrypt license key');
    }
  }

  /**
   * Generate secure license key with enhanced encryption
   */
  static generateSecureLicenseKey(productId: string, userId: string): {
    plainKey: string;
    encryptedKey: string;
    keyFingerprint: string;
    keyVersion: string;
  } {
    const timestamp = Date.now();
    const randomBytes = crypto.randomBytes(16).toString('hex');
    const plainKey = `LIC-${productId}-${userId}-${timestamp}-${randomBytes}`;
    const keyVersion = 'v1';
    
    const encryptedKey = this.encryptLicenseKey(plainKey, keyVersion);
    const keyFingerprint = crypto.createHash('sha256').update(plainKey).digest('hex').substring(0, 16);
    
    return { plainKey, encryptedKey, keyFingerprint, keyVersion };
  }
}