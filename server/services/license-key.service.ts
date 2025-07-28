import { db } from "../db";
import { licenseKeys, products } from "@shared/schema";
import { eq, and, count } from "drizzle-orm";
import type { InsertLicenseKey, LicenseKey } from "@shared/schema";

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
}

export class LicenseKeyServiceImpl implements ILicenseKeyService {
  async getProductKeys(productId: string, tenantId?: string, userRole?: string): Promise<LicenseKey[]> {
    try {
      let whereConditions = [eq(licenseKeys.productId, productId)];
      
      // CRITICAL SECURITY FIX: Enforce tenant isolation at service level
      if (userRole === 'admin' || userRole === 'super_admin') {
        console.log(`🔑 ADMIN SERVICE ACCESS: User with role ${userRole} accessing all license keys for product ${productId}`);
      } else if (tenantId) {
        whereConditions.push(eq(licenseKeys.tenantId, tenantId));
        console.log(`🛡️ TENANT SERVICE ISOLATION: Filtering license keys for tenant ${tenantId} and product ${productId}`);
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
      
      // Validate keys format
      const validatedKeys = this.validateKeys(keyValues);
      console.log('DEBUG Service: Valid keys after validation:', validatedKeys);
      console.log('DEBUG Service: Number of valid keys:', validatedKeys.length);
      
      // Check for existing keys
      const existingKeys = await db
        .select({ keyValue: licenseKeys.keyValue })
        .from(licenseKeys)
        .where(eq(licenseKeys.productId, productId));
      
      console.log('DEBUG Service: Existing keys in DB:', existingKeys);
      const existingKeyValues = new Set(existingKeys.map(k => k.keyValue));
      
      const newKeys: string[] = [];
      const duplicates: string[] = [];
      
      for (const key of validatedKeys) {
        if (existingKeyValues.has(key)) {
          duplicates.push(key);
        } else {
          newKeys.push(key);
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
}

export const licenseKeyService = new LicenseKeyServiceImpl();