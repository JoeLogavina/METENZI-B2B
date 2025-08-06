#!/usr/bin/env node
// DIGITALOCEAN PRODUCTION SERVER - FINAL VERSION
const fs = require('fs');
const path = require('path');

console.log('=== DIGITALOCEAN PRODUCTION SERVER FINAL ===');
console.log(`🕐 Timestamp: ${new Date().toISOString()}`);
console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
console.log(`🔌 Port: ${process.env.PORT || 'not set'}`);
console.log(`⚙️  Node version: ${process.version}`);

// File preparation
const distDir = path.join(__dirname, 'dist');
const targetFile = path.join(distDir, 'server.cjs');
const sourceFile = path.join(__dirname, 'index.js');

// Ensure dist directory and files exist
if (!fs.existsSync(distDir)) {
  console.log('📁 Creating dist directory...');
  fs.mkdirSync(distDir, { recursive: true });
}

if (!fs.existsSync(targetFile)) {
  if (fs.existsSync(sourceFile)) {
    console.log('📋 Copying server file...');
    fs.copyFileSync(sourceFile, targetFile);
    console.log('✅ Server file prepared successfully');
  } else {
    console.error('❌ Source file not found');
    process.exit(1);
  }
} else {
  console.log('✅ Server file already exists');
}

// Build vs Runtime detection
const isBuildOnly = process.argv.includes('--build-only');
const hasRuntimeEnv = process.env.WEB_CONCURRENCY || process.env.DYNO;

console.log('🔍 Deployment Phase Detection:');
console.log(`  - Build-only flag: ${isBuildOnly}`);
console.log(`  - Runtime environment: ${hasRuntimeEnv || 'none'}`);

if (isBuildOnly) {
  console.log('🔧 BUILD PHASE: Files prepared, exiting for runtime startup');
  console.log('✅ Ready for production deployment');
  process.exit(0);
}

if (!hasRuntimeEnv && process.env.NODE_ENV === 'production' && process.env.PORT) {
  console.log('🔧 BUILD CONTEXT: Detected build environment, preparing files only');
  console.log('✅ Files ready, exiting to prevent port conflicts');
  console.log('🚀 Server will start in runtime phase');
  process.exit(0);
}

// Runtime phase - start the server
console.log('🚀 RUNTIME PHASE: Starting B2B License Platform...');
console.log(`📍 Loading server from: ${targetFile}`);

try {
  require(targetFile);
  console.log('✅ Server started successfully');
} catch (error) {
  console.error('❌ Server startup error:', error.message);
  process.exit(1);
}