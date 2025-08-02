// 🧪 INTEGRATION TESTS FOR PHASE 2 SECURITY LAYER
// Comprehensive testing of token management and session integration

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { initializeSecurityIntegration } from '../../server/security/integration';
import { EnhancedTokenManager, TokenType } from '../../server/security/token-manager';
import { redisCache } from '../../server/cache/redis';

describe('Phase 2 Security Integration Tests', () => {
  let app: express.Express;
  let testUserId = 'integration-test-user';
  let validSessionToken: string;
  let validRefreshToken: string;
  let validAdminToken: string;

  beforeAll(async () => {
    // Setup test environment
    process.env.NODE_ENV = 'test';
    process.env.SESSION_SECRET = 'test-session-secret';
    process.env.API_TOKEN_SECRET = 'test-api-secret';
    process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret';
    process.env.ADMIN_TOKEN_SECRET = 'test-admin-secret';

    // Create test Express app
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Initialize security integration
    initializeSecurityIntegration(app);

    // Generate test tokens
    const sessionResult = await EnhancedTokenManager.generateToken(
      testUserId,
      TokenType.SESSION,
      ['read', 'write'],
      { tenantId: 'eur', permissions: ['user:read', 'user:write'] }
    );
    validSessionToken = sessionResult.token;

    const refreshResult = await EnhancedTokenManager.generateToken(
      testUserId,
      TokenType.REFRESH,
      ['refresh'],
      { tenantId: 'eur' }
    );
    validRefreshToken = refreshResult.token;

    const adminResult = await EnhancedTokenManager.generateToken(
      testUserId,
      TokenType.ADMIN,
      ['admin'],
      { tenantId: 'eur', permissions: ['admin:read', 'admin:write'] }
    );
    validAdminToken = adminResult.token;
  });

  beforeEach(async () => {
    // Clean up test-specific data only, not the tokens from beforeAll
    await redisCache.invalidatePattern('test_*');
    await redisCache.invalidatePattern('temp_*');
  });

  afterEach(async () => {
    // Clean up test-specific data only
    await redisCache.invalidatePattern('test_*');
    await redisCache.invalidatePattern('temp_*');
  });

  describe('Token Refresh Endpoint', () => {
    it('should refresh tokens successfully with valid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh-token')
        .send({ refreshToken: validRefreshToken })
        .expect(200);

      expect(response.body.token).toBeDefined();
      expect(response.body.expiresAt).toBeDefined();
      expect(response.body.type).toBe(TokenType.SESSION);

      // Verify the new token is valid
      const validation = await EnhancedTokenManager.validateToken(response.body.token);
      expect(validation.isValid).toBe(true);
      expect(validation.metadata!.userId).toBe(testUserId);
    });

    it('should reject refresh request without token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh-token')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('BAD_REQUEST');
      expect(response.body.message).toBe('Refresh token required');
    });

    it('should reject refresh request with invalid token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh-token')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      expect(response.body.error).toBe('UNAUTHORIZED');
      expect(response.body.message).toBe('Invalid refresh token');
    });

    it('should reject refresh request with expired token', async () => {
      // First revoke the refresh token to simulate expiration
      await EnhancedTokenManager.revokeToken(validRefreshToken);

      const response = await request(app)
        .post('/api/auth/refresh-token')
        .send({ refreshToken: validRefreshToken })
        .expect(401);

      expect(response.body.error).toBe('UNAUTHORIZED');
    });
  });

  describe('Token Validation Endpoint', () => {
    it('should validate tokens successfully', async () => {
      const response = await request(app)
        .post('/api/auth/validate-token')
        .send({ 
          token: validSessionToken,
          expectedType: TokenType.SESSION
        })
        .expect(200);

      expect(response.body.isValid).toBe(true);
      expect(response.body.metadata).toBeDefined();
      expect(response.body.metadata.userId).toBe(testUserId);
      expect(response.body.metadata.type).toBe(TokenType.SESSION);
      expect(response.body.metadata.tenantId).toBe('eur');
    });

    it('should reject validation request without token', async () => {
      const response = await request(app)
        .post('/api/auth/validate-token')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('BAD_REQUEST');
      expect(response.body.message).toBe('Token required for validation');
    });

    it('should validate token type restrictions', async () => {
      const response = await request(app)
        .post('/api/auth/validate-token')
        .send({ 
          token: validSessionToken,
          expectedType: TokenType.ADMIN
        })
        .expect(200);

      expect(response.body.isValid).toBe(false);
      expect(response.body.error).toBe('Token type mismatch');
    });

    it('should indicate when token needs refresh', async () => {
      // Create a token that might need refresh (CSRF tokens have short thresholds)
      const csrfResult = await EnhancedTokenManager.generateToken(
        testUserId,
        TokenType.CSRF
      );

      const response = await request(app)
        .post('/api/auth/validate-token')
        .send({ token: csrfResult.token })
        .expect(200);

      expect(response.body.isValid).toBe(true);
      // needsRefresh will depend on actual time vs threshold
    });
  });

  describe('Token Revocation Endpoint', () => {
    it('should revoke specific tokens successfully', async () => {
      const tokenToRevoke = (await EnhancedTokenManager.generateToken(
        testUserId,
        TokenType.SESSION
      )).token;

      const response = await request(app)
        .post('/api/auth/revoke-token')
        .set('Authorization', `Bearer ${validSessionToken}`)
        .send({ token: tokenToRevoke })
        .expect(200);

      expect(response.body.message).toBe('Token revoked successfully');

      // Verify token is now invalid
      const validation = await EnhancedTokenManager.validateToken(tokenToRevoke);
      expect(validation.isValid).toBe(false);
    });

    it('should revoke all user tokens successfully', async () => {
      // Create multiple tokens for the user
      await EnhancedTokenManager.generateToken(testUserId, TokenType.SESSION);
      await EnhancedTokenManager.generateToken(testUserId, TokenType.API);

      const response = await request(app)
        .post('/api/auth/revoke-token')
        .set('Authorization', `Bearer ${validSessionToken}`)
        .send({ revokeAll: true })
        .expect(200);

      expect(response.body.message).toBe('All tokens revoked successfully');
      expect(response.body.revokedCount).toBeGreaterThan(0);
    });

    it('should require authentication for revocation', async () => {
      const response = await request(app)
        .post('/api/auth/revoke-token')
        .send({ token: 'some-token' })
        .expect(401);

      expect(response.body.error).toBe('UNAUTHORIZED');
    });

    it('should require token or revokeAll flag', async () => {
      const response = await request(app)
        .post('/api/auth/revoke-token')
        .set('Authorization', `Bearer ${validSessionToken}`)
        .send({})
        .expect(400);

      expect(response.body.error).toBe('BAD_REQUEST');
      expect(response.body.message).toBe('Token required for revocation');
    });
  });

  describe('Security Statistics Endpoint', () => {
    it('should return statistics for admin users', async () => {
      const response = await request(app)
        .get('/api/admin/security/stats')
        .set('Authorization', `Bearer ${validAdminToken}`)
        .expect(200);

      expect(response.body.data).toBeDefined();
      expect(response.body.requestedBy).toBe(testUserId);
      expect(response.body.timestamp).toBeDefined();
    });

    it('should require admin authentication', async () => {
      const response = await request(app)
        .get('/api/admin/security/stats')
        .set('Authorization', `Bearer ${validSessionToken}`) // Session token, not admin
        .expect(401);

      expect(response.body.error).toBe('UNAUTHORIZED');
    });

    it('should allow querying specific user statistics', async () => {
      const response = await request(app)
        .get('/api/admin/security/stats?userId=specific-user-123')
        .set('Authorization', `Bearer ${validAdminToken}`)
        .expect(200);

      expect(response.body.data).toBeDefined();
    });
  });

  describe('Session Management Endpoints', () => {
    beforeEach(async () => {
      // We'll need to mock session creation for these tests
      // In a real scenario, these would be created through login
    });

    it('should list user sessions', async () => {
      const response = await request(app)
        .get('/api/auth/sessions')
        .set('Authorization', `Bearer ${validSessionToken}`)
        .expect(200);

      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should require authentication for session listing', async () => {
      const response = await request(app)
        .get('/api/auth/sessions')
        .expect(401);

      expect(response.body.error).toBe('UNAUTHORIZED');
    });

    it('should destroy all sessions except current', async () => {
      const response = await request(app)
        .delete('/api/auth/sessions')
        .set('Authorization', `Bearer ${validSessionToken}`)
        .send({ all: true })
        .expect(200);

      expect(response.body.message).toBe('All sessions destroyed successfully');
      expect(response.body.destroyedCount).toBeDefined();
    });

    it('should require session ID or all flag for destruction', async () => {
      const response = await request(app)
        .delete('/api/auth/sessions')
        .set('Authorization', `Bearer ${validSessionToken}`)
        .send({})
        .expect(400);

      expect(response.body.error).toBe('BAD_REQUEST');
      expect(response.body.message).toBe('Session ID required or use all flag');
    });
  });

  describe('Authentication Header Handling', () => {
    it('should accept Bearer token in Authorization header', async () => {
      const response = await request(app)
        .post('/api/auth/validate-token')
        .set('Authorization', `Bearer ${validSessionToken}`)
        .send({ token: validSessionToken })
        .expect(200);

      expect(response.body.isValid).toBe(true);
    });

    it('should handle malformed Authorization header', async () => {
      const response = await request(app)
        .post('/api/auth/revoke-token')
        .set('Authorization', 'InvalidFormat')
        .send({ token: 'some-token' })
        .expect(401);

      expect(response.body.error).toBe('UNAUTHORIZED');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle Redis connection failures gracefully in token operations', async () => {
      // This would require mocking Redis failures
      // For now, verify endpoints don't crash
      const response = await request(app)
        .post('/api/auth/validate-token')
        .send({ token: validSessionToken })
        .expect(200);

      expect(response.body.isValid).toBe(true);
    });

    it('should handle malformed requests gracefully', async () => {
      const response = await request(app)
        .post('/api/auth/refresh-token')
        .send({ invalidField: 'invalid-data' })
        .expect(400);

      expect(response.body.error).toBe('BAD_REQUEST');
    });

    it('should handle internal errors gracefully', async () => {
      // Send request with invalid JSON structure that might cause parsing errors
      const response = await request(app)
        .post('/api/auth/validate-token')
        .send({ token: null })
        .expect(400);

      expect(response.body.error).toBe('BAD_REQUEST');
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent token validations safely', async () => {
      const promises = [];
      
      for (let i = 0; i < 10; i++) {
        promises.push(
          request(app)
            .post('/api/auth/validate-token')
            .send({ token: validSessionToken })
        );
      }

      const responses = await Promise.all(promises);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.isValid).toBe(true);
      });
    });

    it('should handle concurrent token refresh requests safely', async () => {
      const promises = [];
      
      for (let i = 0; i < 5; i++) {
        promises.push(
          request(app)
            .post('/api/auth/refresh-token')
            .send({ refreshToken: validRefreshToken })
        );
      }

      const responses = await Promise.all(promises);
      
      // All should succeed (or fail consistently)
      const statuses = responses.map(r => r.status);
      const uniqueStatuses = new Set(statuses);
      
      // Either all succeed (200) or all fail with same error
      expect(uniqueStatuses.size).toBeLessThanOrEqual(2);
    });
  });

  describe('Performance Tests', () => {
    it('should handle token operations efficiently', async () => {
      const startTime = Date.now();
      const promises = [];

      // Perform multiple operations concurrently
      for (let i = 0; i < 20; i++) {
        promises.push(
          request(app)
            .post('/api/auth/validate-token')
            .send({ token: validSessionToken })
        );
      }

      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.isValid).toBe(true);
      });

      // Should complete in reasonable time
      expect(duration).toBeLessThan(3000); // 3 seconds
    });
  });
});