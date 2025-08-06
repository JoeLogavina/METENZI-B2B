#!/usr/bin/env node
// DigitalOcean Production Deployment Script - Final Version
// Handles both build and runtime phases with enhanced detection

const fs = require('fs');
const path = require('path');

console.log('=== B2B PLATFORM FINAL DEPLOYMENT ===');
console.log(`🕐 Timestamp: ${new Date().toISOString()}`);
console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
console.log(`🔌 Port: ${process.env.PORT || 'not set'}`);
console.log(`⚙️  Node version: ${process.version}`);

// File preparation
const distDir = path.join(__dirname, 'dist');
const targetFile = path.join(distDir, 'index.cjs');
const sourceFile = path.join(__dirname, 'index.js');

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

// Enhanced build/runtime detection
const isBuildOnly = process.argv.includes('--build-only');
const hasRuntimeEnvs = process.env.WEB_CONCURRENCY || process.env.DYNO;
const isBuildContext = process.env.NODE_ENV === 'production' && 
                       process.env.PORT &&
                       !hasRuntimeEnvs &&
                       !isBuildOnly;

console.log('🔍 Phase Detection:');
console.log(`  - Build-only flag: ${isBuildOnly}`);
console.log(`  - Runtime environments: ${hasRuntimeEnvs || 'none'}`);
console.log(`  - Build context detected: ${isBuildContext}`);

// Handle build-only flag
if (isBuildOnly) {
  console.log('🔧 BUILD-ONLY MODE: Files prepared, exiting cleanly');
  console.log('✅ Ready for runtime deployment');
  process.exit(0);
}

// Handle detected build context (DigitalOcean build command)
if (isBuildContext) {
  console.log('🔧 BUILD CONTEXT: DigitalOcean build phase detected');
  console.log('✅ Files prepared successfully');
  console.log('📋 Exiting cleanly to avoid port conflicts');
  console.log('🚀 Runtime server will start via Procfile');
  process.exit(0);
}

// Runtime phase - start the server
console.log('🚀 RUNTIME PHASE: Starting B2B License Platform...');
console.log(`📍 Target port: ${process.env.PORT}`);
console.log('📂 Loading production server module...');

try {
  const serverModule = require(targetFile);
  console.log('✅ Server module loaded successfully');
} catch (error) {
  console.error('❌ Error loading server module:', error.message);
  process.exit(1);
}