#!/usr/bin/env node
// DigitalOcean Production Script - Cache Refreshed Version
const fs = require('fs');
const path = require('path');

// Enhanced logging to identify which script is running
console.log('=== B2B PLATFORM FINAL DEPLOYMENT (CACHE REFRESH) ===');
console.log(`🕐 Timestamp: ${new Date().toISOString()}`);
console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
console.log(`🔌 Port: ${process.env.PORT || 'not set'}`);
console.log(`⚙️  Node version: ${process.version}`);

// File paths
const distDir = path.join(__dirname, 'dist');
const targetFile = path.join(distDir, 'index.cjs');
const sourceFile = path.join(__dirname, 'index.js');

const isBuildOnly = process.argv.includes('--build-only');
console.log(`🔧 Mode: ${isBuildOnly ? 'BUILD-ONLY' : 'AUTO-DETECT'}`);

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
    console.error('❌ Error: index.js source file not found');
    process.exit(1);
  }
} else {
  console.log('✅ dist/index.cjs already exists');
}

// Enhanced build/runtime detection with multiple methods
const hasRuntimeEnvs = process.env.WEB_CONCURRENCY || process.env.DYNO || process.env.PM2_HOME;
const isBuildContext = process.env.NODE_ENV === 'production' && 
                       process.env.PORT &&
                       !hasRuntimeEnvs &&
                       !isBuildOnly;

console.log('🔍 Phase Detection Analysis:');
console.log(`  - Build-only flag: ${isBuildOnly}`);
console.log(`  - Runtime environments: ${hasRuntimeEnvs || 'none'}`);
console.log(`  - Build context detected: ${isBuildContext}`);
console.log(`  - Current process: ${process.argv[1] || 'undefined'}`);

// Handle explicit build-only flag
if (isBuildOnly) {
  console.log('🔧 BUILD-ONLY MODE: Files prepared, exiting cleanly');
  console.log('✅ Ready for runtime deployment');
  process.exit(0);
}

// Handle detected build context (DigitalOcean build command without runtime env vars)
if (isBuildContext) {
  console.log('🔧 BUILD CONTEXT DETECTED: DigitalOcean build phase identified');
  console.log('✅ Files prepared successfully');
  console.log('📋 Exiting cleanly to prevent port conflicts');
  console.log('🚀 Runtime server will start via Procfile command');
  process.exit(0);
}

// This is runtime phase - start the server
const isRuntimePhase = true;

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