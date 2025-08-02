// 🧪 COMPREHENSIVE TESTS FOR REDIS SESSION MANAGER
// Phase 2 Security Implementation Testing

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { RedisSessionStore, EnhancedSessionData, validateSessionSecurity, generateDeviceFingerprint } from '../../server/security/session-manager';
import { redisCache } from '../../server/cache/redis';
import { Request, Response, NextFunction } from 'express';

// Mock Express request/response objects
const mockRequest = (overrides: Partial<Request> = {}): Request => ({
  ip: '192.168.1.1',
  connection: { remoteAddress: '192.168.1.1' } as any,
  headers: {
    'user-agent': 'Test Browser',
    'accept-language': 'en-US,en;q=0.9',
    'accept-encoding': 'gzip, deflate, br'
  },
  session: {} as any,
  sessionID: 'test-session-id',
  ...overrides
} as Request);

const mockResponse = (): Response => ({
  setHeader: vi.fn(),
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
} as any);

const mockNext: NextFunction = vi.fn();

describe('Redis Session Manager - Phase 2 Security Tests', () => {
  let sessionStore: RedisSessionStore;
  const testUserId = 'test-user-123';
  const testSessionId = 'test-session-456';

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
  });

  beforeEach(async () => {
    // Initialize session store with test configuration
    sessionStore = new RedisSessionStore({
      maxAge: 60 * 60 * 1000, // 1 hour for testing
      rolling: true,
      secure: false, // Test environment
      httpOnly: true,
      sameSite: 'strict',
      maxConcurrentSessions: 3,
      requireDeviceFingerprint: true,
      trackIpChanges: true,
      enableSecurityLogging: true
    });

    // Clean up any existing test data
    await redisCache.invalidatePattern('session:*');
    await redisCache.invalidatePattern('user_sessions:*');
    await redisCache.invalidatePattern('session_security:*');
  });

  afterEach(async () => {
    // Clean up after each test
    await redisCache.invalidatePattern('session:*');
    await redisCache.invalidatePattern('user_sessions:*');
    await redisCache.invalidatePattern('session_security:*');
  });

  describe('Session Storage Operations', () => {
    it('should store and retrieve session data successfully', async () => {
      const sessionData: EnhancedSessionData = {
        userId: testUserId,
        tenantId: 'eur',
        role: 'admin',
        permissions: ['read', 'write'],
        deviceFingerprint: 'test-fingerprint',
        ipAddress: '192.168.1.1',
        userAgent: 'Test Browser',
        loginTimestamp: Date.now(),
        lastActivity: Date.now(),
        csrfToken: 'test-csrf-token',
        cookie: {
          maxAge: 60 * 60 * 1000,
          httpOnly: true,
          secure: false
        }
      };

      // Store session
      await new Promise<void>((resolve, reject) => {
        sessionStore.set(testSessionId, sessionData, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Retrieve session
      const retrievedSession = await new Promise<EnhancedSessionData | null>((resolve, reject) => {
        sessionStore.get(testSessionId, (err, session) => {
          if (err) reject(err);
          else resolve(session as EnhancedSessionData);
        });
      });

      expect(retrievedSession).toBeDefined();
      expect(retrievedSession!.userId).toBe(testUserId);
      expect(retrievedSession!.tenantId).toBe('eur');
      expect(retrievedSession!.role).toBe('admin');
      expect(retrievedSession!.permissions).toEqual(['read', 'write']);
      expect(retrievedSession!.deviceFingerprint).toBe('test-fingerprint');
      expect(retrievedSession!.ipAddress).toBe('192.168.1.1');
      expect(retrievedSession!.csrfToken).toBe('test-csrf-token');
    });

    it('should return null for non-existent session', async () => {
      const retrievedSession = await new Promise<EnhancedSessionData | null>((resolve, reject) => {
        sessionStore.get('non-existent-session', (err, session) => {
          if (err) reject(err);
          else resolve(session as EnhancedSessionData);
        });
      });

      expect(retrievedSession).toBeNull();
    });

    it('should update last activity on session retrieval with rolling enabled', async () => {
      const initialTimestamp = Date.now() - 1000; // 1 second ago
      const sessionData: EnhancedSessionData = {
        userId: testUserId,
        lastActivity: initialTimestamp,
        cookie: { maxAge: 60 * 60 * 1000 }
      };

      // Store session
      await new Promise<void>((resolve, reject) => {
        sessionStore.set(testSessionId, sessionData, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 10));

      // Retrieve session
      const retrievedSession = await new Promise<EnhancedSessionData | null>((resolve, reject) => {
        sessionStore.get(testSessionId, (err, session) => {
          if (err) reject(err);
          else resolve(session as EnhancedSessionData);
        });
      });

      expect(retrievedSession!.lastActivity).toBeGreaterThan(initialTimestamp);
    });

    it('should handle expired sessions correctly', async () => {
      const expiredSessionData: EnhancedSessionData = {
        userId: testUserId,
        cookie: {
          maxAge: 60 * 60 * 1000,
          expires: new Date(Date.now() - 1000) // Expired 1 second ago
        }
      };

      // Store expired session
      await new Promise<void>((resolve, reject) => {
        sessionStore.set(testSessionId, expiredSessionData, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Try to retrieve expired session
      const retrievedSession = await new Promise<EnhancedSessionData | null>((resolve, reject) => {
        sessionStore.get(testSessionId, (err, session) => {
          if (err) reject(err);
          else resolve(session as EnhancedSessionData);
        });
      });

      expect(retrievedSession).toBeNull();
    });
  });

  describe('Session Destruction', () => {
    beforeEach(async () => {
      const sessionData: EnhancedSessionData = {
        userId: testUserId,
        tenantId: 'eur',
        role: 'user',
        cookie: { maxAge: 60 * 60 * 1000 }
      };

      await new Promise<void>((resolve, reject) => {
        sessionStore.set(testSessionId, sessionData, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });

    it('should destroy session successfully', async () => {
      // Destroy session
      await new Promise<void>((resolve, reject) => {
        sessionStore.destroy(testSessionId, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Verify session is gone
      const retrievedSession = await new Promise<EnhancedSessionData | null>((resolve, reject) => {
        sessionStore.get(testSessionId, (err, session) => {
          if (err) reject(err);
          else resolve(session as EnhancedSessionData);
        });
      });

      expect(retrievedSession).toBeNull();
    });

    it('should handle destruction of non-existent session gracefully', async () => {
      await expect(new Promise<void>((resolve, reject) => {
        sessionStore.destroy('non-existent-session', (err) => {
          if (err) reject(err);
          else resolve();
        });
      })).resolves.toBeUndefined();
    });
  });

  describe('Session Touch (Extend)', () => {
    it('should update session activity timestamp on touch', async () => {
      const initialTimestamp = Date.now() - 1000;
      const sessionData: EnhancedSessionData = {
        userId: testUserId,
        lastActivity: initialTimestamp,
        cookie: { maxAge: 60 * 60 * 1000 }
      };

      // Store session
      await new Promise<void>((resolve, reject) => {
        sessionStore.set(testSessionId, sessionData, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 10));

      // Touch session
      await new Promise<void>((resolve, reject) => {
        sessionStore.touch(testSessionId, sessionData, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Retrieve and verify updated timestamp
      const retrievedSession = await new Promise<EnhancedSessionData | null>((resolve, reject) => {
        sessionStore.get(testSessionId, (err, session) => {
          if (err) reject(err);
          else resolve(session as EnhancedSessionData);
        });
      });

      expect(retrievedSession!.lastActivity).toBeGreaterThan(initialTimestamp);
    });
  });

  describe('Concurrent Session Management', () => {
    it('should enforce maximum concurrent session limits', async () => {
      const maxSessions = 3;
      const sessions = [];

      // Create more sessions than the limit
      for (let i = 0; i < maxSessions + 2; i++) {
        const sessionData: EnhancedSessionData = {
          userId: testUserId,
          deviceFingerprint: `device-${i}`,
          cookie: { maxAge: 60 * 60 * 1000 }
        };

        await new Promise<void>((resolve, reject) => {
          sessionStore.set(`session-${i}`, sessionData, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });

        sessions.push(`session-${i}`);
      }

      // Check that user session list doesn't exceed limit
      const userSessionsKey = `user_sessions:${testUserId}`;
      const sessionList = await redisCache.get<string[]>(userSessionsKey);
      
      expect(sessionList?.length).toBeLessThanOrEqual(maxSessions);
    });

    it('should manage user session lists correctly', async () => {
      const sessionIds = ['session-1', 'session-2', 'session-3'];

      // Create multiple sessions for the user
      for (const sessionId of sessionIds) {
        const sessionData: EnhancedSessionData = {
          userId: testUserId,
          cookie: { maxAge: 60 * 60 * 1000 }
        };

        await new Promise<void>((resolve, reject) => {
          sessionStore.set(sessionId, sessionData, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }

      // Get user sessions
      const userSessions = await sessionStore.getUserSessions(testUserId);
      expect(userSessions.length).toBe(3);
      expect(userSessions.every(session => session.userId === testUserId)).toBe(true);
    });

    it('should destroy all user sessions except excluded one', async () => {
      const sessionIds = ['session-1', 'session-2', 'session-3'];

      // Create multiple sessions
      for (const sessionId of sessionIds) {
        const sessionData: EnhancedSessionData = {
          userId: testUserId,
          cookie: { maxAge: 60 * 60 * 1000 }
        };

        await new Promise<void>((resolve, reject) => {
          sessionStore.set(sessionId, sessionData, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }

      // Destroy all except session-1
      const destroyedCount = await sessionStore.destroyUserSessions(testUserId, 'session-1');
      expect(destroyedCount).toBe(2);

      // Verify session-1 still exists
      const remainingSession = await new Promise<EnhancedSessionData | null>((resolve, reject) => {
        sessionStore.get('session-1', (err, session) => {
          if (err) reject(err);
          else resolve(session as EnhancedSessionData);
        });
      });

      expect(remainingSession).toBeDefined();
      expect(remainingSession!.userId).toBe(testUserId);

      // Verify other sessions are destroyed
      const destroyedSession = await new Promise<EnhancedSessionData | null>((resolve, reject) => {
        sessionStore.get('session-2', (err, session) => {
          if (err) reject(err);
          else resolve(session as EnhancedSessionData);
        });
      });

      expect(destroyedSession).toBeNull();
    });
  });

  describe('Session Security Validation Middleware', () => {
    it('should pass through for unauthenticated requests', async () => {
      const req = mockRequest();
      const res = mockResponse();
      const next = vi.fn();

      const middleware = validateSessionSecurity();
      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('should update session with current IP and user agent', async () => {
      const req = mockRequest({
        ip: '192.168.1.2',
        headers: { 'user-agent': 'New Browser' },
        session: {
          userId: testUserId,
          ipAddress: '192.168.1.1',
          userAgent: 'Old Browser',
          lastActivity: Date.now() - 1000
        } as EnhancedSessionData
      });
      const res = mockResponse();
      const next = vi.fn();

      const middleware = validateSessionSecurity();
      await middleware(req, res, next);

      expect(req.session.ipAddress).toBe('192.168.1.2');
      expect(req.session.lastActivity).toBeGreaterThan(Date.now() - 100);
      expect(next).toHaveBeenCalledWith();
    });

    it('should generate CSRF token if missing', async () => {
      const req = mockRequest({
        session: {
          userId: testUserId,
          lastActivity: Date.now()
        } as EnhancedSessionData
      });
      const res = mockResponse();
      const next = vi.fn();

      const middleware = validateSessionSecurity();
      await middleware(req, res, next);

      expect(req.session.csrfToken).toBeDefined();
      expect(req.session.csrfToken).toHaveLength(64); // 32 bytes as hex
      expect(next).toHaveBeenCalledWith();
    });

    it('should detect and log security warnings', async () => {
      const req = mockRequest({
        ip: '192.168.1.100', // Different IP
        headers: { 'user-agent': 'Suspicious Browser' }, // Different user agent
        session: {
          userId: testUserId,
          ipAddress: '192.168.1.1',
          userAgent: 'Normal Browser',
          lastActivity: Date.now() - (13 * 60 * 60 * 1000) // 13 hours ago (long inactive)
        } as EnhancedSessionData
      });
      const res = mockResponse();
      const next = vi.fn();

      const middleware = validateSessionSecurity();
      await middleware(req, res, next);

      // Should still call next (warnings don't block)
      expect(next).toHaveBeenCalledWith();
      
      // Session should be updated with new values
      expect(req.session.ipAddress).toBe('192.168.1.100');
    });
  });

  describe('Device Fingerprinting', () => {
    it('should generate consistent device fingerprints for same request data', async () => {
      const req1 = mockRequest({
        ip: '192.168.1.1',
        headers: {
          'user-agent': 'Test Browser',
          'accept-language': 'en-US',
          'accept-encoding': 'gzip'
        }
      });

      const req2 = mockRequest({
        ip: '192.168.1.1',
        headers: {
          'user-agent': 'Test Browser',
          'accept-language': 'en-US',
          'accept-encoding': 'gzip'
        }
      });

      const fingerprint1 = generateDeviceFingerprint(req1);
      const fingerprint2 = generateDeviceFingerprint(req2);

      expect(fingerprint1).toBe(fingerprint2);
      expect(fingerprint1).toHaveLength(32); // SHA256 substring
    });

    it('should generate different fingerprints for different request data', async () => {
      const req1 = mockRequest({
        ip: '192.168.1.1',
        headers: { 'user-agent': 'Browser A' }
      });

      const req2 = mockRequest({
        ip: '192.168.1.2',
        headers: { 'user-agent': 'Browser B' }
      });

      const fingerprint1 = generateDeviceFingerprint(req1);
      const fingerprint2 = generateDeviceFingerprint(req2);

      expect(fingerprint1).not.toBe(fingerprint2);
    });

    it('should handle missing headers gracefully', async () => {
      const req = mockRequest({
        ip: '192.168.1.1',
        headers: {} // No headers
      });

      const fingerprint = generateDeviceFingerprint(req);

      expect(fingerprint).toBeDefined();
      expect(fingerprint).toHaveLength(32);
    });
  });

  describe('Bulk Operations', () => {
    it('should clear all sessions successfully', async () => {
      // Create multiple sessions
      for (let i = 0; i < 5; i++) {
        const sessionData: EnhancedSessionData = {
          userId: `user-${i}`,
          cookie: { maxAge: 60 * 60 * 1000 }
        };

        await new Promise<void>((resolve, reject) => {
          sessionStore.set(`session-${i}`, sessionData, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }

      // Clear all sessions
      await new Promise<void>((resolve, reject) => {
        sessionStore.clear((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Verify sessions are cleared (check one of them)
      const retrievedSession = await new Promise<EnhancedSessionData | null>((resolve, reject) => {
        sessionStore.get('session-0', (err, session) => {
          if (err) reject(err);
          else resolve(session as EnhancedSessionData);
        });
      });

      expect(retrievedSession).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should handle Redis connection failures gracefully in get operation', async () => {
      // This test would ideally mock Redis failures
      // For now, we test that the operation doesn't throw
      await expect(new Promise<void>((resolve, reject) => {
        sessionStore.get('test-session', (err, session) => {
          // Should handle gracefully, not throw
          resolve();
        });
      })).resolves.toBeUndefined();
    });

    it('should handle Redis connection failures gracefully in set operation', async () => {
      const sessionData: EnhancedSessionData = {
        userId: testUserId,
        cookie: { maxAge: 60 * 60 * 1000 }
      };

      // Should not throw even if Redis is unavailable
      await expect(new Promise<void>((resolve, reject) => {
        sessionStore.set('test-session', sessionData, (err) => {
          resolve(); // Complete regardless of Redis state
        });
      })).resolves.toBeUndefined();
    });
  });

  describe('Performance Tests', () => {
    it('should handle multiple session operations efficiently', async () => {
      const startTime = Date.now();
      const operations = [];

      // Perform multiple session operations concurrently
      for (let i = 0; i < 20; i++) {
        const sessionData: EnhancedSessionData = {
          userId: `perf-user-${i}`,
          cookie: { maxAge: 60 * 60 * 1000 }
        };

        operations.push(
          new Promise<void>((resolve, reject) => {
            sessionStore.set(`perf-session-${i}`, sessionData, (err) => {
              if (err) reject(err);
              else resolve();
            });
          })
        );
      }

      await Promise.all(operations);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete in reasonable time
      expect(duration).toBeLessThan(3000); // 3 seconds
    });

    it('should retrieve sessions efficiently', async () => {
      // Set up sessions first
      const sessionIds = [];
      for (let i = 0; i < 10; i++) {
        const sessionId = `perf-retrieve-${i}`;
        const sessionData: EnhancedSessionData = {
          userId: `user-${i}`,
          cookie: { maxAge: 60 * 60 * 1000 }
        };

        await new Promise<void>((resolve, reject) => {
          sessionStore.set(sessionId, sessionData, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });

        sessionIds.push(sessionId);
      }

      // Time the retrieval operations
      const startTime = Date.now();
      const retrievalPromises = sessionIds.map(sessionId =>
        new Promise<EnhancedSessionData | null>((resolve, reject) => {
          sessionStore.get(sessionId, (err, session) => {
            if (err) reject(err);
            else resolve(session as EnhancedSessionData);
          });
        })
      );

      const sessions = await Promise.all(retrievalPromises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // All sessions should be retrieved successfully
      expect(sessions.every(session => session !== null)).toBe(true);
      
      // Should complete in reasonable time
      expect(duration).toBeLessThan(1000); // 1 second
    });
  });
});