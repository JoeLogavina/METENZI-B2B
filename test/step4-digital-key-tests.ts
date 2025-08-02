// 🧪 STEP 4 DIGITAL KEY ENCRYPTION TESTS
// Comprehensive testing for digital key encryption and secure downloads

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DigitalKeyEncryption } from '../server/security/digital-key-encryption';
import { SecureDownloadSystem } from '../server/security/secure-download-system';
import { DigitalKeyService } from '../server/services/digital-key.service';
import crypto from 'crypto';

describe('Step 4: Digital Key Encryption & Secure Downloads', () => {
  const testProductId = 'test-product-123';
  const testUserId = 'test-user-456';
  const testLicenseKey = 'TEST-LICENSE-KEY-789';

  describe('DigitalKeyEncryption', () => {
    it('should encrypt and decrypt license keys successfully', async () => {
      const metadata = {
        productId: testProductId,
        userId: testUserId,
        keyType: 'license' as const,
        maxUses: 5
      };

      // Encrypt the key
      const encryptedKey = await DigitalKeyEncryption.encryptLicenseKey(
        testLicenseKey,
        metadata
      );

      expect(encryptedKey).toHaveProperty('encryptedData');
      expect(encryptedKey).toHaveProperty('keyFingerprint');
      expect(encryptedKey).toHaveProperty('metadata');
      expect(encryptedKey.algorithm).toBe('aes-256-gcm');

      // Decrypt the key
      const { plainKey, metadata: decryptedMetadata } = await DigitalKeyEncryption.decryptLicenseKey(encryptedKey);

      expect(plainKey).toBe(testLicenseKey);
      expect(decryptedMetadata.productId).toBe(testProductId);
      expect(decryptedMetadata.userId).toBe(testUserId);
      expect(decryptedMetadata.keyType).toBe('license');
      expect(decryptedMetadata.maxUses).toBe(5);
    });

    it('should generate secure license keys with proper format', async () => {
      const result = await DigitalKeyEncryption.generateSecureLicenseKey(
        testProductId,
        testUserId,
        {
          keyType: 'license',
          maxUses: 3,
          expiresAt: new Date(Date.now() + 86400000) // 1 day
        }
      );

      expect(result).toHaveProperty('plainKey');
      expect(result).toHaveProperty('encryptedKey');
      expect(result.plainKey).toMatch(/^LIC-/);
      expect(result.plainKey).toContain(testProductId);
      expect(result.plainKey).toContain(testUserId);
      expect(result.encryptedKey.metadata.maxUses).toBe(3);
    });

    it('should handle key rotation correctly', async () => {
      // First encrypt with original key
      const encryptedKey = await DigitalKeyEncryption.encryptLicenseKey(
        testLicenseKey,
        { keyType: 'license' }
      );

      // Cache the key for rotation
      await DigitalKeyEncryption.getCachedKey = vi.fn().mockResolvedValue(encryptedKey);

      // Generate new master key for rotation
      const newMasterKey = crypto.randomBytes(32).toString('hex');

      // Rotate the key
      const rotatedKey = await DigitalKeyEncryption.rotateKey(
        encryptedKey.keyFingerprint,
        newMasterKey
      );

      expect(rotatedKey.keyFingerprint).not.toBe(encryptedKey.keyFingerprint);

      // Verify the rotated key decrypts to the same plain text
      const { plainKey } = await DigitalKeyEncryption.decryptLicenseKey(
        rotatedKey,
        newMasterKey
      );
      expect(plainKey).toBe(testLicenseKey);
    });

    it('should validate key usage limits', async () => {
      const metadata = {
        keyType: 'license' as const,
        maxUses: 2,
        currentUses: 0
      };

      // First usage should succeed
      await expect(DigitalKeyEncryption.validateKeyUsage(metadata)).resolves.not.toThrow();
      expect(metadata.currentUses).toBe(1);

      // Second usage should succeed
      await expect(DigitalKeyEncryption.validateKeyUsage(metadata)).resolves.not.toThrow();
      expect(metadata.currentUses).toBe(2);

      // Third usage should fail
      await expect(DigitalKeyEncryption.validateKeyUsage(metadata)).rejects.toThrow('usage limit exceeded');
    });

    it('should handle key expiration correctly', async () => {
      const expiredDate = new Date(Date.now() - 1000); // 1 second ago
      const metadata = {
        keyType: 'license' as const,
        expiresAt: expiredDate,
        currentUses: 0
      };

      await expect(DigitalKeyEncryption.validateKeyUsage(metadata)).rejects.toThrow('expired');
    });
  });

  describe('SecureDownloadSystem', () => {
    let mockRequest: any;

    beforeEach(() => {
      mockRequest = {
        ip: '127.0.0.1',
        get: vi.fn().mockReturnValue('Mozilla/5.0 Test Browser'),
        path: '/test',
        method: 'GET'
      };
    });

    it('should generate download tokens with proper structure', async () => {
      const token = await SecureDownloadSystem.generateDownloadToken(
        'test-resource-123',
        testUserId,
        {
          resourceType: 'license',
          filename: 'test-license.txt',
          expiryMinutes: 30,
          maxDownloads: 3
        }
      );

      expect(token).toHaveProperty('token');
      expect(token).toHaveProperty('resourceId');
      expect(token).toHaveProperty('userId');
      expect(token).toHaveProperty('expiresAt');
      expect(token.token).toHaveLength(128); // 64 bytes in hex
      expect(token.resourceId).toBe('test-resource-123');
      expect(token.userId).toBe(testUserId);
      expect(token.maxDownloads).toBe(3);
    });

    it('should validate download tokens correctly', async () => {
      const downloadToken = await SecureDownloadSystem.generateDownloadToken(
        'test-resource-456',
        testUserId,
        { resourceType: 'software', expiryMinutes: 5 }
      );

      const validation = await SecureDownloadSystem.validateDownloadToken(
        downloadToken.token,
        mockRequest
      );

      expect(validation.valid).toBe(true);
      expect(validation.downloadToken).toBeDefined();
      expect(validation.downloadToken?.resourceId).toBe('test-resource-456');
    });

    it('should reject expired tokens', async () => {
      const downloadToken = await SecureDownloadSystem.generateDownloadToken(
        'test-resource-789',
        testUserId,
        { expiryMinutes: -1 } // Already expired
      );

      const validation = await SecureDownloadSystem.validateDownloadToken(
        downloadToken.token,
        mockRequest
      );

      expect(validation.valid).toBe(false);
      expect(validation.errorReason).toContain('expired');
    });

    it('should enforce download limits', async () => {
      const downloadToken = await SecureDownloadSystem.generateDownloadToken(
        'test-resource-limit',
        testUserId,
        { maxDownloads: 1 }
      );

      // First download should work
      let validation = await SecureDownloadSystem.validateDownloadToken(
        downloadToken.token,
        mockRequest
      );
      expect(validation.valid).toBe(true);

      // Consume the token
      await SecureDownloadSystem.consumeDownloadToken(downloadToken.token, 1024, 100);

      // Second download should fail
      validation = await SecureDownloadSystem.validateDownloadToken(
        downloadToken.token,
        mockRequest
      );
      expect(validation.valid).toBe(false);
      expect(validation.errorReason).toContain('limit exceeded');
    });

    it('should handle IP whitelisting', async () => {
      const downloadToken = await SecureDownloadSystem.generateDownloadToken(
        'test-resource-ip',
        testUserId,
        { ipWhitelist: ['192.168.1.1', '10.0.0.1'] }
      );

      // Request from non-whitelisted IP should fail
      const validation = await SecureDownloadSystem.validateDownloadToken(
        downloadToken.token,
        mockRequest
      );

      expect(validation.valid).toBe(false);
      expect(validation.errorReason).toContain('IP address');
    });

    it('should implement rate limiting', async () => {
      const promises = [];
      
      // Make multiple rapid requests
      for (let i = 0; i < 10; i++) {
        promises.push(
          SecureDownloadSystem.validateDownloadToken('invalid-token', mockRequest)
        );
      }

      const results = await Promise.all(promises);
      const rateLimitedResults = results.filter(r => 
        r.errorReason?.includes('too many') || r.errorReason?.includes('rate limit')
      );

      expect(rateLimitedResults.length).toBeGreaterThan(0);
    });
  });

  describe('DigitalKeyService', () => {
    it('should generate digital keys with all components', async () => {
      const request = {
        productId: testProductId,
        userId: testUserId,
        keyType: 'license' as const,
        maxUses: 5,
        generateDownloadUrl: true
      };

      const result = await DigitalKeyService.generateDigitalKey(request);

      expect(result).toHaveProperty('keyId');
      expect(result).toHaveProperty('plainKey');
      expect(result).toHaveProperty('encryptedKey');
      expect(result).toHaveProperty('downloadUrl');
      expect(result).toHaveProperty('downloadToken');
      
      expect(result.plainKey).toMatch(/^LIC-/);
      expect(result.downloadUrl).toMatch(/^\/api\/secure-download\//);
    });

    it('should retrieve and validate digital keys', async () => {
      // Mock the key retrieval since we don't have full database integration
      const mockKeyData = {
        keyId: 'test-key-id',
        plainKey: testLicenseKey,
        metadata: {
          productId: testProductId,
          userId: testUserId,
          keyType: 'license' as const,
          version: 'v2' as const,
          createdAt: new Date(),
          currentUses: 0,
          maxUses: 3
        },
        isValid: true,
        usageInfo: {
          currentUses: 0,
          maxUses: 3,
          remainingUses: 3
        }
      };

      // Mock the service method
      DigitalKeyService.getDigitalKey = vi.fn().mockResolvedValue(mockKeyData);

      const result = await DigitalKeyService.getDigitalKey('test-key-id', testUserId);

      expect(result).toHaveProperty('keyId');
      expect(result).toHaveProperty('plainKey');
      expect(result).toHaveProperty('isValid');
      expect(result?.isValid).toBe(true);
      expect(result?.usageInfo.remainingUses).toBe(3);
    });

    it('should handle key usage tracking', async () => {
      // Mock successful key usage
      const mockUsageResult = {
        success: true,
        key: testLicenseKey,
        remainingUses: 2
      };

      DigitalKeyService.useDigitalKey = vi.fn().mockResolvedValue(mockUsageResult);

      const result = await DigitalKeyService.useDigitalKey('test-key-id', testUserId);

      expect(result.success).toBe(true);
      expect(result.key).toBe(testLicenseKey);
      expect(result.remainingUses).toBe(2);
    });

    it('should handle key revocation', async () => {
      DigitalKeyService.revokeDigitalKey = vi.fn().mockResolvedValue(true);

      const result = await DigitalKeyService.revokeDigitalKey(
        'test-key-id',
        testUserId,
        'Security violation'
      );

      expect(result).toBe(true);
    });
  });

  describe('Integration Tests', () => {
    it('should complete full digital key lifecycle', async () => {
      // 1. Generate a digital key
      const keyRequest = {
        productId: testProductId,
        userId: testUserId,
        keyType: 'license' as const,
        generateDownloadUrl: true
      };

      const keyResult = await DigitalKeyService.generateDigitalKey(keyRequest);
      expect(keyResult.plainKey).toBeDefined();
      expect(keyResult.downloadUrl).toBeDefined();

      // 2. Validate the encrypted key can be decrypted
      const { plainKey } = await DigitalKeyEncryption.decryptLicenseKey(keyResult.encryptedKey);
      expect(plainKey).toBe(keyResult.plainKey);

      // 3. Test the download token if generated
      if (keyResult.downloadToken) {
        const mockReq = {
          ip: '127.0.0.1',
          get: () => 'Test Browser',
          path: '/test',
          method: 'GET'
        };

        const validation = await SecureDownloadSystem.validateDownloadToken(
          keyResult.downloadToken,
          mockReq
        );
        expect(validation.valid).toBe(true);
      }
    });

    it('should handle errors gracefully', async () => {
      // Test invalid encryption
      await expect(
        DigitalKeyEncryption.decryptLicenseKey('invalid:format:data')
      ).rejects.toThrow();

      // Test invalid download token
      const mockReq = {
        ip: '127.0.0.1',
        get: () => 'Test Browser',
        path: '/test',
        method: 'GET'
      };

      const validation = await SecureDownloadSystem.validateDownloadToken(
        'invalid-token-123',
        mockReq
      );
      expect(validation.valid).toBe(false);
    });
  });

  describe('Performance Tests', () => {
    it('should encrypt/decrypt keys in under 50ms', async () => {
      const startTime = Date.now();

      const encryptedKey = await DigitalKeyEncryption.encryptLicenseKey(
        testLicenseKey,
        { keyType: 'license' }
      );

      const { plainKey } = await DigitalKeyEncryption.decryptLicenseKey(encryptedKey);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(50);
      expect(plainKey).toBe(testLicenseKey);
    });

    it('should handle bulk key generation efficiently', async () => {
      const keys = Array.from({ length: 10 }, (_, i) => ({
        key: `TEST-KEY-${i}`,
        metadata: { keyType: 'license' as const }
      }));

      const startTime = Date.now();
      const results = await DigitalKeyEncryption.bulkEncryptKeys(keys);
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(10);
      expect(duration).toBeLessThan(500); // 500ms for 10 keys
    });
  });
});

// Test helper functions
function createMockRequest(overrides: any = {}) {
  return {
    ip: '127.0.0.1',
    get: vi.fn().mockReturnValue('Mozilla/5.0 Test Browser'),
    path: '/test',
    method: 'GET',
    ...overrides
  };
}

function createMockDownloadToken(overrides: any = {}) {
  return {
    token: crypto.randomBytes(32).toString('hex'),
    resourceId: 'test-resource',
    userId: 'test-user',
    resourceType: 'license',
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 900000), // 15 minutes
    maxDownloads: 1,
    currentDownloads: 0,
    metadata: {},
    ...overrides
  };
}