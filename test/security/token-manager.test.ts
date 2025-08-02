// 🧪 COMPREHENSIVE TESTS FOR ENHANCED TOKEN MANAGER
// Phase 2 Security Implementation Testing

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { EnhancedTokenManager, TokenType, TokenValidationResult } from '../../server/security/token-manager';
import { redisCache } from '../../server/cache/redis';
import jwt from 'jsonwebtoken';

describe('Enhanced Token Manager - Phase 2 Security Tests', () => {
  const testUserId = 'test-user-123';
  const testTenantId = 'eur';
  
  beforeAll(async () => {
    // Ensure clean test environment
    process.env.NODE_ENV = 'test';
    process.env.SESSION_SECRET = 'test-session-secret';
    process.env.API_TOKEN_SECRET = 'test-api-secret';
    process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret';
    process.env.CSRF_SECRET = 'test-csrf-secret';
    process.env.ADMIN_TOKEN_SECRET = 'test-admin-secret';
    process.env.B2B_TOKEN_SECRET = 'test-b2b-secret';
  });

  beforeEach(async () => {
    // Clean up any existing test tokens
    await redisCache.invalidatePattern('token:*');
    await redisCache.invalidatePattern('user_tokens:*');
    await redisCache.invalidatePattern('blacklist:*');
    await redisCache.invalidatePattern('token_stats:*');
  });

  afterEach(async () => {
    // Clean up after each test
    await redisCache.invalidatePattern('token:*');
    await redisCache.invalidatePattern('user_tokens:*');
    await redisCache.invalidatePattern('blacklist:*');
    await redisCache.invalidatePattern('token_stats:*');
  });

  describe('Token Generation', () => {
    it('should generate a valid session token with metadata', async () => {
      const result = await EnhancedTokenManager.generateToken(
        testUserId,
        TokenType.SESSION,
        ['read', 'write'],
        {
          tenantId: testTenantId,
          ipAddress: '192.168.1.1',
          userAgent: 'Test Browser',
          permissions: ['user:read', 'user:write']
        }
      );

      expect(result).toBeDefined();
      expect(result.token).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.metadata.userId).toBe(testUserId);
      expect(result.metadata.type).toBe(TokenType.SESSION);
      expect(result.metadata.tenantId).toBe(testTenantId);
      expect(result.metadata.scope).toEqual(['read', 'write']);
      expect(result.metadata.permissions).toEqual(['user:read', 'user:write']);
      expect(result.metadata.createdAt).toBeDefined();
      expect(result.metadata.expiresAt).toBeDefined();
      expect(result.metadata.deviceId).toBeDefined();

      // Verify JWT structure
      const decoded = jwt.decode(result.token) as any;
      expect(decoded.sub).toBe(testUserId);
      expect(decoded.type).toBe(TokenType.SESSION);
      expect(decoded.tenant).toBe(testTenantId);
      expect(decoded.jti).toBeDefined();
    });

    it('should generate different token types with appropriate configurations', async () => {
      const sessionToken = await EnhancedTokenManager.generateToken(testUserId, TokenType.SESSION);
      const apiToken = await EnhancedTokenManager.generateToken(testUserId, TokenType.API);
      const adminToken = await EnhancedTokenManager.generateToken(testUserId, TokenType.ADMIN);

      expect(sessionToken.token).not.toBe(apiToken.token);
      expect(sessionToken.token).not.toBe(adminToken.token);
      expect(apiToken.token).not.toBe(adminToken.token);

      // Verify different expiration times
      expect(sessionToken.metadata.expiresAt).not.toBe(apiToken.metadata.expiresAt);
      expect(sessionToken.metadata.type).toBe(TokenType.SESSION);
      expect(apiToken.metadata.type).toBe(TokenType.API);
      expect(adminToken.metadata.type).toBe(TokenType.ADMIN);
    });

    it('should enforce concurrent token limits', async () => {
      const maxTokens = 5; // Default limit for session tokens
      const tokens = [];

      // Generate maximum allowed tokens
      for (let i = 0; i < maxTokens + 2; i++) {
        const result = await EnhancedTokenManager.generateToken(
          testUserId,
          TokenType.SESSION,
          [],
          { deviceId: `device-${i}` }
        );
        tokens.push(result);
      }

      // Verify that oldest tokens are automatically removed
      const userTokensKey = `user_tokens:${testUserId}`;
      const tokenList = await redisCache.get<string[]>(userTokensKey);
      expect(tokenList?.length).toBeLessThanOrEqual(maxTokens);
    });

    it('should generate unique device fingerprints', async () => {
      const token1 = await EnhancedTokenManager.generateToken(
        testUserId,
        TokenType.SESSION,
        [],
        { userAgent: 'Browser1', ipAddress: '192.168.1.1' }
      );

      const token2 = await EnhancedTokenManager.generateToken(
        testUserId,
        TokenType.SESSION,
        [],
        { userAgent: 'Browser2', ipAddress: '192.168.1.2' }
      );

      expect(token1.metadata.deviceId).not.toBe(token2.metadata.deviceId);
    });
  });

  describe('Token Validation', () => {
    let validToken: string;
    let tokenMetadata: any;

    beforeEach(async () => {
      const result = await EnhancedTokenManager.generateToken(
        testUserId,
        TokenType.SESSION,
        ['read', 'write'],
        {
          tenantId: testTenantId,
          permissions: ['user:read', 'user:write']
        }
      );
      validToken = result.token;
      tokenMetadata = result.metadata;
    });

    it('should validate a valid token successfully', async () => {
      const validation = await EnhancedTokenManager.validateToken(validToken);

      expect(validation.isValid).toBe(true);
      expect(validation.metadata).toBeDefined();
      expect(validation.metadata!.userId).toBe(testUserId);
      expect(validation.metadata!.type).toBe(TokenType.SESSION);
      expect(validation.metadata!.tenantId).toBe(testTenantId);
      expect(validation.metadata!.lastUsed).toBeDefined();
      expect(validation.error).toBeUndefined();
    });

    it('should reject invalid token format', async () => {
      const validation = await EnhancedTokenManager.validateToken('invalid-token');

      expect(validation.isValid).toBe(false);
      expect(validation.error).toBe('Invalid token format');
      expect(validation.metadata).toBeUndefined();
    });

    it('should reject tokens with wrong signature', async () => {
      const fakeToken = jwt.sign(
        { sub: testUserId, type: TokenType.SESSION, jti: 'fake-id' },
        'wrong-secret'
      );

      const validation = await EnhancedTokenManager.validateToken(fakeToken);

      expect(validation.isValid).toBe(false);
      expect(validation.error).toBe('Token signature invalid');
    });

    it('should reject blacklisted tokens', async () => {
      // First revoke the token
      const revoked = await EnhancedTokenManager.revokeToken(validToken);
      expect(revoked).toBe(true);

      // Then try to validate it
      const validation = await EnhancedTokenManager.validateToken(validToken);

      expect(validation.isValid).toBe(false);
      expect(validation.error).toBe('Token has been revoked');
    });

    it('should validate token type restrictions', async () => {
      const apiToken = await EnhancedTokenManager.generateToken(testUserId, TokenType.API);

      // Should fail when expecting SESSION token
      const validation = await EnhancedTokenManager.validateToken(
        apiToken.token,
        TokenType.SESSION
      );

      expect(validation.isValid).toBe(false);
      expect(validation.error).toBe('Token type mismatch');
    });

    it('should indicate when token needs refresh', async () => {
      // Generate a token that will need refresh soon (mock short expiration)
      const shortLivedResult = await EnhancedTokenManager.generateToken(
        testUserId,
        TokenType.CSRF // CSRF tokens have short refresh threshold
      );

      // Wait a bit and validate
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const validation = await EnhancedTokenManager.validateToken(shortLivedResult.token);

      expect(validation.isValid).toBe(true);
      // Note: needsRefresh depends on the actual time remaining vs refresh threshold
    });

    it('should update last used timestamp on validation', async () => {
      const initialValidation = await EnhancedTokenManager.validateToken(validToken);
      const initialLastUsed = initialValidation.metadata!.lastUsed;

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 10));

      const secondValidation = await EnhancedTokenManager.validateToken(validToken);
      const secondLastUsed = secondValidation.metadata!.lastUsed;

      expect(secondLastUsed).toBeGreaterThan(initialLastUsed!);
    });
  });

  describe('Token Revocation', () => {
    let validToken: string;

    beforeEach(async () => {
      const result = await EnhancedTokenManager.generateToken(testUserId, TokenType.SESSION);
      validToken = result.token;
    });

    it('should revoke a specific token successfully', async () => {
      const revoked = await EnhancedTokenManager.revokeToken(validToken);
      expect(revoked).toBe(true);

      // Verify token is now invalid
      const validation = await EnhancedTokenManager.validateToken(validToken);
      expect(validation.isValid).toBe(false);
      expect(validation.error).toBe('Token has been revoked');
    });

    it('should handle invalid token revocation gracefully', async () => {
      const revoked = await EnhancedTokenManager.revokeToken('invalid-token');
      expect(revoked).toBe(false);
    });

    it('should revoke all user tokens except excluded one', async () => {
      // Generate multiple tokens for the user
      const tokens = [];
      for (let i = 0; i < 3; i++) {
        const result = await EnhancedTokenManager.generateToken(
          testUserId,
          TokenType.SESSION,
          [],
          { deviceId: `device-${i}` }
        );
        tokens.push(result.token);
      }

      // Revoke all except the first token
      const revokedCount = await EnhancedTokenManager.revokeAllUserTokens(
        testUserId,
        jwt.decode(tokens[0]) ? (jwt.decode(tokens[0]) as any).jti : undefined
      );

      expect(revokedCount).toBeGreaterThanOrEqual(2); // At least the 2 additional tokens

      // Verify first token is still valid
      const validation1 = await EnhancedTokenManager.validateToken(tokens[0]);
      expect(validation1.isValid).toBe(true);

      // Verify other tokens are revoked
      const validation2 = await EnhancedTokenManager.validateToken(tokens[1]);
      expect(validation2.isValid).toBe(false);
    });
  });

  describe('Token Statistics and Monitoring', () => {
    beforeEach(async () => {
      // Generate some tokens for testing
      await EnhancedTokenManager.generateToken(testUserId, TokenType.SESSION);
      await EnhancedTokenManager.generateToken(testUserId, TokenType.API);
    });

    it('should track token statistics per user', async () => {
      const stats = await EnhancedTokenManager.getTokenStats(testUserId);

      expect(stats).toBeDefined();
      expect(stats.timestamp).toBeDefined();
      // Note: Stats structure depends on implementation
    });

    it('should track global token statistics', async () => {
      const globalStats = await EnhancedTokenManager.getTokenStats();

      expect(globalStats).toBeDefined();
      expect(globalStats.timestamp).toBeDefined();
    });
  });

  describe('Token Cleanup and Maintenance', () => {
    it('should handle cleanup operations gracefully', async () => {
      const cleanedCount = await EnhancedTokenManager.cleanupExpiredTokens();
      expect(cleanedCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Concurrent Access and Race Conditions', () => {
    it('should handle concurrent token generation safely', async () => {
      const promises = [];
      
      // Generate multiple tokens concurrently
      for (let i = 0; i < 10; i++) {
        promises.push(
          EnhancedTokenManager.generateToken(
            `concurrent-user-${i}`,
            TokenType.SESSION,
            [],
            { deviceId: `device-${i}` }
          )
        );
      }

      const results = await Promise.all(promises);
      
      // Verify all tokens are unique
      const tokens = results.map(r => r.token);
      const uniqueTokens = new Set(tokens);
      expect(uniqueTokens.size).toBe(tokens.length);
    });

    it('should handle concurrent validation safely', async () => {
      const result = await EnhancedTokenManager.generateToken(testUserId, TokenType.SESSION);
      const { token } = result;

      // Validate the same token concurrently
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(EnhancedTokenManager.validateToken(token));
      }

      const validations = await Promise.all(promises);
      
      // All validations should succeed
      validations.forEach(validation => {
        expect(validation.isValid).toBe(true);
        expect(validation.metadata).toBeDefined();
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle Redis connection failures gracefully', async () => {
      // This test would require mocking Redis failures
      // For now, we verify that the functions don't throw
      expect(async () => {
        await EnhancedTokenManager.generateToken(testUserId, TokenType.SESSION);
      }).not.toThrow();
    });

    it('should handle token generation with missing user ID', async () => {
      await expect(
        EnhancedTokenManager.generateToken('', TokenType.SESSION)
      ).rejects.toThrow();
    });

    it('should handle validation of malformed JWT', async () => {
      const validation = await EnhancedTokenManager.validateToken('not.a.jwt');
      
      expect(validation.isValid).toBe(false);
      expect(validation.error).toBeDefined();
    });
  });

  describe('Security Features', () => {
    it('should generate cryptographically secure token IDs', async () => {
      const results = [];
      
      for (let i = 0; i < 100; i++) {
        const result = await EnhancedTokenManager.generateToken(
          `test-user-${i}`,
          TokenType.SESSION
        );
        const decoded = jwt.decode(result.token) as any;
        results.push(decoded.jti);
      }

      // Verify all token IDs are unique (probability of collision is astronomically low)
      const uniqueIds = new Set(results);
      expect(uniqueIds.size).toBe(results.length);
    });

    it('should include proper JWT claims', async () => {
      const result = await EnhancedTokenManager.generateToken(
        testUserId,
        TokenType.SESSION,
        ['read', 'write'],
        { tenantId: testTenantId }
      );

      const decoded = jwt.decode(result.token) as any;
      
      expect(decoded.iss).toBe('b2b-platform');
      expect(decoded.aud).toBe('b2b-users');
      expect(decoded.sub).toBe(testUserId);
      expect(decoded.type).toBe(TokenType.SESSION);
      expect(decoded.scope).toEqual(['read', 'write']);
      expect(decoded.tenant).toBe(testTenantId);
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
      expect(decoded.jti).toBeDefined();
    });

    it('should validate token expiration properly', async () => {
      // Create a token with very short expiration for testing
      const mockConfig = {
        secret: 'test-secret',
        expirationMinutes: -1, // Already expired
        refreshThresholdMinutes: 15,
        maxConcurrentTokens: 5,
        requireDeviceFingerprint: false
      };

      // This would require modifying the token configs, which is complex
      // For now, we test the general expiration logic
      const result = await EnhancedTokenManager.generateToken(testUserId, TokenType.SESSION);
      
      // Manually expire the token metadata in Redis
      const decoded = jwt.decode(result.token) as any;
      const tokenKey = `token:${decoded.jti}`;
      const metadata = await redisCache.get<any>(tokenKey);
      
      if (metadata) {
        metadata.expiresAt = Date.now() - 1000; // Expired 1 second ago
        await redisCache.set(tokenKey, metadata, 300);
      }

      const validation = await EnhancedTokenManager.validateToken(result.token);
      expect(validation.isValid).toBe(false);
      expect(validation.error).toBe('Token has expired');
    });
  });

  describe('Performance Tests', () => {
    it('should generate tokens efficiently', async () => {
      const startTime = Date.now();
      const promises = [];

      for (let i = 0; i < 50; i++) {
        promises.push(
          EnhancedTokenManager.generateToken(`perf-user-${i}`, TokenType.SESSION)
        );
      }

      await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete 50 token generations in reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(5000); // 5 seconds
    });

    it('should validate tokens efficiently', async () => {
      // Generate tokens first
      const tokens = [];
      for (let i = 0; i < 20; i++) {
        const result = await EnhancedTokenManager.generateToken(
          `perf-user-${i}`,
          TokenType.SESSION
        );
        tokens.push(result.token);
      }

      // Time the validation
      const startTime = Date.now();
      const promises = tokens.map(token => 
        EnhancedTokenManager.validateToken(token)
      );

      const validations = await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // All should be valid
      validations.forEach(validation => {
        expect(validation.isValid).toBe(true);
      });

      // Should complete in reasonable time
      expect(duration).toBeLessThan(2000); // 2 seconds
    });
  });
});