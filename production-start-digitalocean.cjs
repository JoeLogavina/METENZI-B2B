#!/usr/bin/env node
// Unified DigitalOcean production script - handles both build and runtime
const fs = require('fs');
const path = require('path');

// File paths
const distDir = path.join(__dirname, 'dist');
const targetFile = path.join(distDir, 'index.cjs');
const sourceFile = path.join(__dirname, 'index.js');

console.log('=== B2B PLATFORM DIGITALOCEAN UNIFIED ===');
console.log(`Environment: ${process.env.NODE_ENV}`);
console.log(`Port: ${process.env.PORT || 'not set'}`);
const isBuildOnly = process.argv.includes('--build-only');
console.log(`Build Command Context: ${isBuildOnly ? 'BUILD' : 'RUNTIME'}`);

// Always ensure dist directory and file exist
if (!fs.existsSync(distDir)) {
  console.log('📁 Creating dist directory...');
  fs.mkdirSync(distDir, { recursive: true });
}

if (!fs.existsSync(targetFile)) {
  if (fs.existsSync(sourceFile)) {
    console.log('📋 Copying index.js to dist/index.cjs...');
    fs.copyFileSync(sourceFile, targetFile);
    console.log('✅ dist/index.cjs created successfully');
  } else {
    console.error('❌ index.js source file not found');
    process.exit(1);
  }
} else {
  console.log('✅ dist/index.cjs already exists');
}

// If build-only flag is set, exit immediately after file prep
if (isBuildOnly) {
  console.log('📦 BUILD PHASE: Files prepared successfully');
  console.log('✅ Ready for runtime startup');
  console.log('📋 Next: DigitalOcean will start server with PORT environment set');
  process.exit(0);
}

// Enhanced build phase detection for DigitalOcean
// During build: PORT is set but process is running as build command
// During runtime: PORT is set and process is running as Procfile command
const isBuildContext = process.env.NODE_ENV === 'production' && 
                       process.env.PORT &&
                       process.argv[1] && process.argv[1].includes('production-start-digitalocean.cjs') &&
                       !process.env.DYNO &&  // Heroku/DO runtime indicator
                       !process.env.WEB_CONCURRENCY; // Runtime indicator

console.log('🔍 Advanced phase detection:');
console.log(`  - isBuildContext: ${isBuildContext}`);
console.log(`  - argv[1]: ${process.argv[1] || 'undefined'}`);
console.log(`  - DYNO: ${process.env.DYNO || 'undefined'}`);
console.log(`  - WEB_CONCURRENCY: ${process.env.WEB_CONCURRENCY || 'undefined'}`);

if (isBuildContext) {
  console.log('📦 BUILD CONTEXT DETECTED: Exiting cleanly to avoid port conflicts');
  console.log('✅ Files prepared successfully for runtime phase');  
  console.log('📋 Runtime server will start via Procfile');
  process.exit(0);
}

// Determine if this is runtime phase
const isRuntimePhase = process.env.PORT && process.env.NODE_ENV === 'production';

if (isRuntimePhase) {
  console.log('🚀 RUNTIME PHASE: Starting server...');
  console.log(`📍 Target port: ${process.env.PORT}`);
  console.log(`📂 Loading: ${path.resolve(targetFile)}`);
  
  // Add comprehensive error handling
  process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error);
    process.exit(1);
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
  });
  
  try {
    console.log('⏳ Starting server module...');
    require(targetFile);
    console.log('✅ Server startup initiated successfully');
  } catch (error) {
    console.error('❌ Server startup failed:', error.message);
    console.error('📋 Error details:', error);
    process.exit(1);
  }
} else {
  console.log('📦 BUILD PHASE: Files prepared successfully - no PORT detected');
  console.log('✅ Ready for runtime startup');
  console.log('📋 Next: DigitalOcean will start server with PORT environment set');
  
  // If no PORT is set, assume this is build context and exit cleanly
  setTimeout(() => {
    console.log('🔄 No PORT detected after delay - assuming build context, exiting cleanly');
    process.exit(0);
  }, 1000);
}