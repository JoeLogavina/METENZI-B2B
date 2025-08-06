// CRITICAL: This file should NOT be used for production
// DigitalOcean should use: npm start (which runs dist/index.js)

console.log('❌ ERROR: Using wrong server file');
console.log('✅ Proper command: npm start');
console.log('✅ Proper server: dist/index.js');
console.log('⚠️  Check app.yaml configuration');

setTimeout(() => {
  console.log('🚨 EXITING - Use proper build process');
  process.exit(1);
}, 2000);