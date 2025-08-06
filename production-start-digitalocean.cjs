// DigitalOcean production start script - uses CommonJS
// This script bypasses the package.json "type": "module" restriction

const fs = require('fs');
const path = require('path');

// Ensure dist directory exists and has the required file
const distDir = path.join(__dirname, 'dist');
const targetFile = path.join(distDir, 'index.cjs');
const sourceFile = path.join(__dirname, 'index.js');

if (!fs.existsSync(distDir)) {
  console.log('Creating dist directory...');
  fs.mkdirSync(distDir, { recursive: true });
}

if (!fs.existsSync(targetFile)) {
  if (fs.existsSync(sourceFile)) {
    console.log('Copying index.js to dist/index.cjs...');
    fs.copyFileSync(sourceFile, targetFile);
    console.log('✅ dist/index.cjs created successfully');
  } else {
    console.error('Error: index.js source file not found');
    process.exit(1);
  }
} else {
  console.log('✅ dist/index.cjs already exists');
}

// Now require the CommonJS server
console.log('Starting B2B License Platform server...');

// Enhanced runtime detection for DigitalOcean App Platform
const hasRuntimeEnv = process.env.DYNO || 
                      process.env.WEB_CONCURRENCY || 
                      process.env.RUNTIME_PHASE ||
                      process.env.DO_APP_NAME ||
                      process.env.APP_URL ||
                      process.argv.includes('--runtime');

// More specific build phase detection
const isBuildPhase = process.env.NODE_ENV === 'production' && 
                     !hasRuntimeEnv &&
                     !process.env.PORT;

console.log(`🔍 Environment Detection:`);
console.log(`  NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`  PORT: ${process.env.PORT}`);
console.log(`  Runtime indicators: ${hasRuntimeEnv}`);
console.log(`  Detected phase: ${isBuildPhase ? 'BUILD' : 'RUNTIME'}`);

if (isBuildPhase) {
  // Build phase - just prepare files and exit cleanly
  console.log('✅ Build phase: Files prepared successfully');  
  console.log('✅ Ready for runtime startup');
  process.exit(0);
}

// Runtime phase - start the server with comprehensive error handling
console.log('🚀 Runtime phase: Starting server...');
console.log(`🚀 Will bind to port: ${process.env.PORT || '8080'}`);

try {
  // Ensure we have the target file before requiring
  if (!fs.existsSync(targetFile)) {
    console.error('❌ dist/index.cjs not found during runtime!');
    console.log('📝 Creating it now...');
    if (fs.existsSync(sourceFile)) {
      fs.copyFileSync(sourceFile, targetFile);
      console.log('✅ dist/index.cjs created for runtime');
    } else {
      console.error('❌ Source file index.js not found!');
      process.exit(1);
    }
  }
  
  console.log('📂 Loading CommonJS server from dist/index.cjs...');
  require('./dist/index.cjs');
  
} catch (error) {
  console.error('❌ Server startup failed:', error.message);
  console.error('📋 Error details:', error);
  
  if (error.code === 'EADDRINUSE') {
    console.log('⚠️  Port conflict - may be build/runtime interference');
    console.log('🔄 Attempting graceful exit...');
    process.exit(1); // Exit with error code for DigitalOcean to retry
  } else {
    console.error('💥 Fatal server error - exiting');
    process.exit(1);
  }
}