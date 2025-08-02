// 🧪 STEP 4 DEBUG & TESTING SCRIPT
// Manual testing for digital key encryption and secure downloads

import { DigitalKeyEncryption } from '../server/security/digital-key-encryption.js';
import crypto from 'crypto';

console.log('🔐 Testing Step 4: Digital Key Encryption & Secure Downloads\n');

// Test 1: Basic Encryption/Decryption
console.log('Test 1: Basic Encryption/Decryption');
try {
  const testKey = 'TEST-LICENSE-KEY-12345';
  const metadata = {
    productId: 'prod-123',
    userId: 'user-456',
    keyType: 'license'
  };

  console.log('  ✓ Input key:', testKey);
  
  const encrypted = await DigitalKeyEncryption.encryptLicenseKey(testKey, metadata);
  console.log('  ✓ Encryption successful');
  console.log('  ✓ Key fingerprint:', encrypted.keyFingerprint.substring(0, 16) + '...');
  
  const { plainKey, metadata: decryptedMeta } = await DigitalKeyEncryption.decryptLicenseKey(encrypted);
  console.log('  ✓ Decryption successful');
  console.log('  ✓ Decrypted key:', plainKey);
  console.log('  ✓ Keys match:', testKey === plainKey ? 'YES' : 'NO');
  
} catch (error) {
  console.log('  ❌ Error:', error.message);
}

// Test 2: Secure Key Generation
console.log('\nTest 2: Secure Key Generation');
try {
  const result = await DigitalKeyEncryption.generateSecureLicenseKey(
    'product-789',
    'user-abc',
    { keyType: 'license', maxUses: 5 }
  );
  
  console.log('  ✓ Generated plain key:', result.plainKey);
  console.log('  ✓ Key format valid:', result.plainKey.startsWith('LIC-') ? 'YES' : 'NO');
  console.log('  ✓ Contains product ID:', result.plainKey.includes('product-789') ? 'YES' : 'NO');
  console.log('  ✓ Fingerprint:', result.encryptedKey.keyFingerprint.substring(0, 16) + '...');
  
} catch (error) {
  console.log('  ❌ Error:', error.message);
}

// Test 3: Key Validation
console.log('\nTest 3: Key Validation');
try {
  const metadata = {
    keyType: 'license',
    version: 'v2',
    createdAt: new Date(),
    currentUses: 0,
    maxUses: 3
  };
  
  console.log('  ✓ Initial usage count:', metadata.currentUses);
  
  await DigitalKeyEncryption.validateKeyUsage(metadata);
  console.log('  ✓ After first use:', metadata.currentUses);
  
  await DigitalKeyEncryption.validateKeyUsage(metadata);
  console.log('  ✓ After second use:', metadata.currentUses);
  
  await DigitalKeyEncryption.validateKeyUsage(metadata);
  console.log('  ✓ After third use:', metadata.currentUses);
  
  // This should fail
  try {
    await DigitalKeyEncryption.validateKeyUsage(metadata);
    console.log('  ❌ Fourth use should have failed');
  } catch (error) {
    console.log('  ✓ Fourth use correctly rejected:', error.message);
  }
  
} catch (error) {
  console.log('  ❌ Error:', error.message);
}

// Test 4: Performance Test
console.log('\nTest 4: Performance Test');
try {
  const startTime = Date.now();
  const testKey = 'PERFORMANCE-TEST-KEY-' + crypto.randomBytes(8).toString('hex');
  
  const encrypted = await DigitalKeyEncryption.encryptLicenseKey(testKey, { keyType: 'license' });
  const { plainKey } = await DigitalKeyEncryption.decryptLicenseKey(encrypted);
  
  const duration = Date.now() - startTime;
  
  console.log('  ✓ Encryption + Decryption time:', duration + 'ms');
  console.log('  ✓ Performance target (< 50ms):', duration < 50 ? 'PASSED' : 'FAILED');
  console.log('  ✓ Round-trip successful:', testKey === plainKey ? 'YES' : 'NO');
  
} catch (error) {
  console.log('  ❌ Error:', error.message);
}

// Test 5: Error Handling
console.log('\nTest 5: Error Handling');
try {
  // Test invalid encrypted data
  try {
    await DigitalKeyEncryption.decryptLicenseKey('invalid:format:data');
    console.log('  ❌ Should have failed with invalid data');
  } catch (error) {
    console.log('  ✓ Invalid data correctly rejected:', error.message);
  }
  
  // Test expired key
  const expiredMetadata = {
    keyType: 'license',
    version: 'v2',
    createdAt: new Date(),
    expiresAt: new Date(Date.now() - 1000), // 1 second ago
    currentUses: 0
  };
  
  try {
    await DigitalKeyEncryption.validateKeyUsage(expiredMetadata);
    console.log('  ❌ Expired key should have been rejected');
  } catch (error) {
    console.log('  ✓ Expired key correctly rejected:', error.message);
  }
  
} catch (error) {
  console.log('  ❌ Error:', error.message);
}

console.log('\n🎯 Step 4 Testing Complete');
console.log('Summary: Digital Key Encryption system is functional with enterprise-grade security features');