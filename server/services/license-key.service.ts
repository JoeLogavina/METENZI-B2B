import { db } from "../db";
import { licenseKeys, products } from "@shared/schema";
import { eq, and, count } from "drizzle-orm";
import type { InsertLicenseKey, LicenseKey } from "@shared/schema";
import { EnhancedDigitalKeyEncryption, EnterpriseKeyManager } from '../security/enhanced-key-manager';
import { logger } from '../lib/logger';

class ServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ServiceError";
  }
}

export interface ILicenseKeyService {
  getProductKeys(productId: string, tenantId?: string, userRole?: string): Promise<LicenseKey[]>;
  addKeys(productId: string, keyValues: string[], tenantId?: string): Promise<{ added: LicenseKey[], duplicates: string[] }>;
  removeKey(keyId: string): Promise<void>;
  getKeyStats(productId: string, tenantId?: string): Promise<{ total: number, used: number, available: number }>;
  validateKeys(keyValues: string[]): string[];
  // Enhanced Key Management integration
  encryptLicenseKey(licenseKey: string, userId?: string): { encryptedKey: string, keyFingerprint: string, keyVersion: string };
  decryptLicenseKey(encryptedKey: string): string;
  generateSecureLicenseKey(productId: string, userId: string): { plainKey: string, encryptedKey: string, keyFingerprint: string, keyVersion: string };
}

export class LicenseKeyServiceImpl implements ILicenseKeyService {
  async getProductKeys(productId: string, tenantId?: string, userRole?: string): Promise<LicenseKey[]> {
    try {
      let whereConditions = [eq(licenseKeys.productId, productId)];
      
      // CRITICAL SECURITY FIX: Enforce tenant isolation at service level
      if (userRole === 'admin' || userRole === 'super_admin') {

      } else if (tenantId) {
        whereConditions.push(eq(licenseKeys.tenantId, tenantId));

      }
      
      const keys = await db
        .select()
        .from(licenseKeys)
        .where(and(...whereConditions))
        .orderBy(licenseKeys.createdAt);
        
      console.log(`📊 SERVICE RESULT: Returned ${keys.length} license keys for product ${productId}`);
      return keys;
    } catch (error) {
      console.error("Error fetching license keys:", error);
      throw new ServiceError("Failed to fetch license keys");
    }
  }

  async addKeys(productId: string, keyValues: string[], tenantId?: string): Promise<{ added: LicenseKey[], duplicates: string[] }> {
    try {
      console.log('DEBUG Service: addKeys called with productId:', productId);
      console.log('DEBUG Service: Raw key values:', keyValues);
      console.log('DEBUG Service: Number of raw keys:', keyValues.length);
      
      // Get product settings to check if duplicates are allowed
      const [product] = await db
        .select({ allowDuplicateKeys: products.allowDuplicateKeys })
        .from(products)
        .where(eq(products.id, productId));
      
      const allowDuplicates = product?.allowDuplicateKeys || false;
      console.log('DEBUG Service: Allow duplicate keys for this product:', allowDuplicates);
      
      // Validate keys format
      const validatedKeys = this.validateKeys(keyValues);
      console.log('DEBUG Service: Valid keys after validation:', validatedKeys);
      console.log('DEBUG Service: Number of valid keys:', validatedKeys.length);
      
      let newKeys: string[] = [];
      let duplicates: string[] = [];
      
      if (allowDuplicates) {
        // If duplicates are allowed, add all validated keys
        newKeys = validatedKeys;
        console.log('DEBUG Service: Duplicate keys allowed - adding all keys');
      } else {
        // Check for existing keys only if duplicates are not allowed
        const existingKeys = await db
          .select({ keyValue: licenseKeys.keyValue })
          .from(licenseKeys)
          .where(eq(licenseKeys.productId, productId));
        
        console.log('DEBUG Service: Existing keys in DB:', existingKeys);
        const existingKeyValues = new Set(existingKeys.map(k => k.keyValue));
        
        for (const key of validatedKeys) {
          if (existingKeyValues.has(key)) {
            duplicates.push(key);
          } else {
            newKeys.push(key);
          }
        }
      }
      
      console.log('DEBUG Service: New keys to add:', newKeys);
      console.log('DEBUG Service: Duplicate keys found:', duplicates);
      
      // Insert new keys
      const added: LicenseKey[] = [];
      if (newKeys.length > 0) {
        const insertData = newKeys.map(keyValue => ({
          productId,
          keyValue,
          isUsed: false,
          tenantId: tenantId || 'eur', // Default to EUR tenant if not specified
        }));
        
        const insertedKeys = await db
          .insert(licenseKeys)
          .values(insertData)
          .returning();
        
        added.push(...insertedKeys);

        // Update product stock to reflect available license keys
        const keyStats = await this.getKeyStats(productId);
        await db
          .update(products)
          .set({ stockCount: keyStats.available })
          .where(eq(products.id, productId));
      }
      
      return { added, duplicates };
    } catch (error) {
      console.error("Error adding license keys:", error);
      throw new ServiceError("Failed to add license keys");
    }
  }

  async removeKey(keyId: string): Promise<void> {
    try {
      await db
        .delete(licenseKeys)
        .where(eq(licenseKeys.id, keyId));
    } catch (error) {
      console.error("Error removing license key:", error);
      throw new ServiceError("Failed to remove license key");
    }
  }

  async getKeyStats(productId: string, tenantId?: string): Promise<{ total: number, used: number, available: number }> {
    try {
      let totalConditions = [eq(licenseKeys.productId, productId)];
      let usedConditions = [eq(licenseKeys.productId, productId), eq(licenseKeys.isUsed, true)];
      
      // Add tenant filtering for non-admin users
      if (tenantId) {
        totalConditions.push(eq(licenseKeys.tenantId, tenantId));
        usedConditions.push(eq(licenseKeys.tenantId, tenantId));
      }
      
      const [totalResult] = await db
        .select({ count: count() })
        .from(licenseKeys)
        .where(and(...totalConditions));
      
      const [usedResult] = await db
        .select({ count: count() })
        .from(licenseKeys)
        .where(and(...usedConditions));
      
      const total = totalResult.count;
      const used = usedResult.count;
      const available = total - used;
      
      return { total, used, available };
    } catch (error) {
      console.error("Error getting key stats:", error);
      throw new ServiceError("Failed to get key statistics");
    }
  }

  validateKeys(keyValues: string[]): string[] {
    const validKeys: string[] = [];
    
    for (const key of keyValues) {
      const trimmedKey = key.trim();
      if (!trimmedKey) continue;
      
      console.log('DEBUG: Validating key:', trimmedKey);
      
      // Check if key has valid format (letters, numbers, dashes, spaces)
      const keyPattern = /^[A-Z0-9\-\s]+$/i;
      if (!keyPattern.test(trimmedKey)) {
        console.warn(`Invalid key format (invalid characters): ${trimmedKey}`);
        continue;
      }
      
      // Handle both dash-separated and space-separated formats
      const blocks = trimmedKey.includes('-') 
        ? trimmedKey.split('-')
        : trimmedKey.split(/\s+/);
      
      console.log('DEBUG: Key blocks:', blocks, 'Count:', blocks.length);
      
      if (blocks.length >= 3 && blocks.length <= 6) {
        const validBlocks = blocks.every(block => {
          const trimmedBlock = block.trim();
          const isValid = trimmedBlock.length >= 4 && trimmedBlock.length <= 7;
          console.log('DEBUG: Block validation:', trimmedBlock, 'Length:', trimmedBlock.length, 'Valid:', isValid);
          return isValid;
        });
        
        if (validBlocks) {
          // Normalize to dash format for consistency
          const normalizedKey = blocks.map(b => b.trim().toUpperCase()).join('-');
          validKeys.push(normalizedKey);
          console.log('DEBUG: Valid key added:', normalizedKey);
        } else {
          console.warn(`Invalid key blocks: ${trimmedKey}`);
        }
      } else {
        console.warn(`Invalid key block count (${blocks.length}): ${trimmedKey}`);
      }
    }
    
    console.log('DEBUG: Total valid keys:', validKeys.length);
    return validKeys;
  }

  // Enhanced Key Management System Integration
  encryptLicenseKey(licenseKey: string, userId: string = 'SYSTEM'): { encryptedKey: string, keyFingerprint: string, keyVersion: string } {
    try {
      logger.info('Encrypting license key with Enhanced Key Management', { 
        keyLength: licenseKey.length,
        userId,
        environment: process.env.NODE_ENV 
      });

      // Use the direct encryption method, not the key generation method
      const encryptedKey = EnhancedDigitalKeyEncryption.encryptLicenseKey(licenseKey);
      const encryptionKey = EnterpriseKeyManager.getEncryptionKey('LICENSE');
      const keyFingerprint = EnterpriseKeyManager.getKeyFingerprint(encryptionKey);
      
      const result = {
        encryptedKey,
        keyFingerprint,
        keyVersion: 'v1'
      };
      
      logger.info('License key encrypted successfully', { 
        keyFingerprint: result.keyFingerprint,
        keyVersion: result.keyVersion,
        userId 
      });

      return {
        encryptedKey: result.encryptedKey,
        keyFingerprint: result.keyFingerprint,
        keyVersion: result.keyVersion
      };
    } catch (error) {
      logger.error('Enhanced license key encryption failed', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        keyLength: licenseKey.length
      });
      throw new ServiceError('Failed to encrypt license key with enhanced security');
    }
  }

  decryptLicenseKey(encryptedKey: string): string {
    try {
      logger.info('Decrypting license key with Enhanced Key Management', { 
        encryptedKeyPrefix: encryptedKey.substring(0, 20) + '...',
        environment: process.env.NODE_ENV 
      });

      const decryptedKey = EnhancedDigitalKeyEncryption.decryptLicenseKey(encryptedKey);
      
      logger.info('License key decrypted successfully', { 
        decryptedKeyLength: decryptedKey.length 
      });

      return decryptedKey;
    } catch (error) {
      logger.error('Enhanced license key decryption failed', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        encryptedKeyPrefix: encryptedKey.substring(0, 20) + '...'
      });
      throw new ServiceError('Failed to decrypt license key');
    }
  }

  generateSecureLicenseKey(productId: string, userId: string): { plainKey: string, encryptedKey: string, keyFingerprint: string, keyVersion: string } {
    try {
      logger.info('Generating secure license key', { 
        productId, 
        userId,
        environment: process.env.NODE_ENV 
      });

      // Generate a secure license key pattern
      const keyBlocks = [];
      for (let i = 0; i < 5; i++) {
        const block = Math.random().toString(36).substring(2, 8).toUpperCase();
        keyBlocks.push(block);
      }
      const plainKey = keyBlocks.join('-');

      // Encrypt the generated key using the direct encryption method
      const encryptedKey = EnhancedDigitalKeyEncryption.encryptLicenseKey(plainKey);
      const encryptionKey = EnterpriseKeyManager.getEncryptionKey('LICENSE');
      const keyFingerprint = EnterpriseKeyManager.getKeyFingerprint(encryptionKey);
      
      logger.info('Secure license key generated successfully', { 
        productId,
        userId,
        keyFingerprint,
        keyVersion: 'v1'
      });

      return {
        plainKey,
        encryptedKey,
        keyFingerprint,
        keyVersion: 'v1'
      };
    } catch (error) {
      logger.error('Secure license key generation failed', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        productId,
        userId
      });
      throw new ServiceError('Failed to generate secure license key');
    }
  }
}

export const licenseKeyService = new LicenseKeyServiceImpl();