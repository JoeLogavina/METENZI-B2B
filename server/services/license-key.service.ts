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
  getProductKeys(productId: string): Promise<LicenseKey[]>;
  addKeys(productId: string, keyValues: string[]): Promise<{ added: LicenseKey[], duplicates: string[] }>;
  removeKey(keyId: string): Promise<void>;
  getKeyStats(productId: string): Promise<{ total: number, used: number, available: number }>;
  validateKeys(keyValues: string[]): string[];
}

export class LicenseKeyServiceImpl implements ILicenseKeyService {
  async getProductKeys(productId: string): Promise<LicenseKey[]> {
    try {
      return await db
        .select()
        .from(licenseKeys)
        .where(eq(licenseKeys.productId, productId))
        .orderBy(licenseKeys.createdAt);
    } catch (error) {
      console.error("Error fetching license keys:", error);
      throw new ServiceError("Failed to fetch license keys");
    }
  }

  async addKeys(productId: string, keyValues: string[]): Promise<{ added: LicenseKey[], duplicates: string[] }> {
    try {
      // Validate keys format
      const validatedKeys = this.validateKeys(keyValues);
      
      // Check for existing keys
      const existingKeys = await db
        .select({ keyValue: licenseKeys.keyValue })
        .from(licenseKeys)
        .where(eq(licenseKeys.productId, productId));
      
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
      
      // Insert new keys
      const added: LicenseKey[] = [];
      if (newKeys.length > 0) {
        const insertData = newKeys.map(keyValue => ({
          productId,
          keyValue,
          isUsed: false,
        }));
        
        const insertedKeys = await db
          .insert(licenseKeys)
          .values(insertData)
          .returning();
        
        added.push(...insertedKeys);
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

  async getKeyStats(productId: string): Promise<{ total: number, used: number, available: number }> {
    try {
      const [totalResult] = await db
        .select({ count: count() })
        .from(licenseKeys)
        .where(eq(licenseKeys.productId, productId));
      
      const [usedResult] = await db
        .select({ count: count() })
        .from(licenseKeys)
        .where(and(
          eq(licenseKeys.productId, productId),
          eq(licenseKeys.isUsed, true)
        ));
      
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
      
      // Basic validation: 3-6 blocks of 5-6 characters
      // Allow spaces between blocks, normalize to remove extra spaces
      const normalizedKey = trimmedKey.replace(/\s+/g, ' ').trim();
      
      // Check if key has valid format (letters, numbers, dashes)
      const keyPattern = /^[A-Z0-9\-\s]+$/i;
      if (!keyPattern.test(normalizedKey)) {
        console.warn(`Invalid key format: ${normalizedKey}`);
        continue;
      }
      
      // Split by spaces and check block count and length
      const blocks = normalizedKey.split(/\s+/);
      if (blocks.length >= 3 && blocks.length <= 6) {
        const validBlocks = blocks.every(block => 
          block.length >= 4 && block.length <= 7 // Allow 4-7 characters per block
        );
        
        if (validBlocks) {
          validKeys.push(normalizedKey.toUpperCase());
        }
      }
    }
    
    return validKeys;
  }
}

export const licenseKeyService = new LicenseKeyServiceImpl();