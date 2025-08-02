// Test routes for Enhanced Key Management System
import { Router } from 'express';
import { EnterpriseKeyManager, EnhancedDigitalKeyEncryption } from '../security/enhanced-key-manager';
import { logger } from '../lib/logger';

const router = Router();

// Test key generation and validation
router.get('/test/key-validation', async (req, res) => {
  try {
    const validation = EnterpriseKeyManager.validateKeyConfiguration();
    res.json({
      success: true,
      validation,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Key validation test failed', { error: error instanceof Error ? error.message : 'Unknown error' });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Test key derivation performance
router.get('/test/key-performance', async (req, res) => {
  try {
    const keyTypes = ['LICENSE', 'VAULT', 'JWT', 'SESSION'] as const;
    const results: any[] = [];

    for (const keyType of keyTypes) {
      const startTime = Date.now();
      const key = EnterpriseKeyManager.getEncryptionKey(keyType);
      const derivationTime = Date.now() - startTime;
      const fingerprint = EnterpriseKeyManager.getKeyFingerprint(key);

      results.push({
        keyType,
        derivationTime: `${derivationTime}ms`,
        fingerprint,
        keyLength: key.length
      });
    }

    const cacheStats = EnterpriseKeyManager.getCacheStats();

    res.json({
      success: true,
      results,
      cacheStats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Key performance test failed', { error: error instanceof Error ? error.message : 'Unknown error' });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Test license key encryption/decryption
router.post('/test/license-encryption', async (req, res) => {
  try {
    const { productId = 'TEST_PRODUCT', userId = 'TEST_USER' } = req.body;

    // Generate secure license key
    const startTime = Date.now();
    const licenseData = EnhancedDigitalKeyEncryption.generateSecureLicenseKey(productId, userId);
    const generationTime = Date.now() - startTime;

    // Test decryption
    const decryptStartTime = Date.now();
    const decryptedKey = EnhancedDigitalKeyEncryption.decryptLicenseKey(licenseData.encryptedKey);
    const decryptionTime = Date.now() - decryptStartTime;

    // Verify integrity
    const isValid = decryptedKey === licenseData.plainKey;

    res.json({
      success: true,
      test: {
        productId,
        userId,
        keyFingerprint: licenseData.keyFingerprint,
        keyVersion: licenseData.keyVersion,
        generationTime: `${generationTime}ms`,
        decryptionTime: `${decryptionTime}ms`,
        integrityCheck: isValid
      },
      // Don't return the actual keys in production
      keys: process.env.NODE_ENV === 'development' ? {
        plainKey: licenseData.plainKey,
        encryptedKey: licenseData.encryptedKey
      } : undefined,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('License encryption test failed', { error: error instanceof Error ? error.message : 'Unknown error' });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Test key rotation
router.post('/test/key-rotation', async (req, res) => {
  try {
    const { keyType = 'LICENSE', initiatedBy = 'test-system' } = req.body;

    if (!['LICENSE', 'VAULT', 'JWT', 'SESSION'].includes(keyType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid key type. Must be one of: LICENSE, VAULT, JWT, SESSION'
      });
    }

    const rotationResult = await EnterpriseKeyManager.rotateKeys(keyType as any, initiatedBy);

    res.json({
      success: rotationResult.success,
      rotation: rotationResult,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Key rotation test failed', { error: error instanceof Error ? error.message : 'Unknown error' });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Clear key cache (for testing)
router.post('/test/clear-cache', async (req, res) => {
  try {
    const statsBefore = EnterpriseKeyManager.getCacheStats();
    EnterpriseKeyManager.clearKeyCache();
    const statsAfter = EnterpriseKeyManager.getCacheStats();

    res.json({
      success: true,
      cacheCleared: true,
      statsBefore,
      statsAfter,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Cache clear test failed', { error: error instanceof Error ? error.message : 'Unknown error' });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Comprehensive security test
router.get('/test/comprehensive-security', async (req, res) => {
  try {
    const tests = [];

    // Test 1: Key validation
    const validation = EnterpriseKeyManager.validateKeyConfiguration();
    tests.push({
      name: 'Key Configuration Validation',
      passed: validation.isValid,
      details: validation
    });

    // Test 2: Performance test
    const startTime = Date.now();
    const testKey = EnterpriseKeyManager.getEncryptionKey('LICENSE');
    const keyDerivationTime = Date.now() - startTime;
    tests.push({
      name: 'Key Derivation Performance',
      passed: keyDerivationTime < 500, // Should be under 500ms
      details: { derivationTime: `${keyDerivationTime}ms` }
    });

    // Test 3: Encryption/Decryption integrity
    const licenseData = EnhancedDigitalKeyEncryption.generateSecureLicenseKey('TEST', 'USER');
    const decrypted = EnhancedDigitalKeyEncryption.decryptLicenseKey(licenseData.encryptedKey);
    const integrityTest = decrypted === licenseData.plainKey;
    tests.push({
      name: 'Encryption/Decryption Integrity',
      passed: integrityTest,
      details: { keyFingerprint: licenseData.keyFingerprint }
    });

    const allTestsPassed = tests.every(test => test.passed);

    res.json({
      success: allTestsPassed,
      overallResult: allTestsPassed ? 'ALL_TESTS_PASSED' : 'SOME_TESTS_FAILED',
      tests,
      cacheStats: EnterpriseKeyManager.getCacheStats(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Comprehensive security test failed', { error: error instanceof Error ? error.message : 'Unknown error' });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as securityTestRoutes };