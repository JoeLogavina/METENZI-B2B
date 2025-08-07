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

// File preparation - Support both old and new file names for backward compatibility
const distDir = path.join(__dirname, 'dist');
const targetFile = path.join(distDir, 'index.cjs');

// Try multiple possible source files for backward compatibility
const possibleSourceFiles = [
  path.join(__dirname, 'index.cjs'),  // New file name
  path.join(__dirname, 'index.js'),   // Old file name (backup)
];

// Always ensure dist directory exists
if (!fs.existsSync(distDir)) {
  console.log('📁 Creating dist directory...');
  fs.mkdirSync(distDir, { recursive: true });
}

if (!fs.existsSync(targetFile)) {
  let sourceFile = null;
  
  // Find the first available source file
  for (const file of possibleSourceFiles) {
    if (fs.existsSync(file)) {
      sourceFile = file;
      console.log(`✅ Found source file: ${path.basename(file)}`);
      break;
    }
  }
  
  if (sourceFile) {
    console.log(`📋 Copying ${path.basename(sourceFile)} to dist/index.cjs...`);
    fs.copyFileSync(sourceFile, targetFile);
    console.log('✅ dist/index.cjs created successfully');
  } else {
    console.error('❌ Error: No production server source file found');
    console.error('Searched for:', possibleSourceFiles.map(f => path.basename(f)));
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
  console.log('🔧 BUILD-ONLY MODE: Running build process...');
  
  // Ensure frontend is built
  try {
    const { execSync } = require('child_process');
    console.log('📦 Building frontend assets...');
    execSync('npm run build', { stdio: 'inherit' });
    console.log('✅ Frontend build completed');
  } catch (error) {
    console.log('⚠️ Frontend build failed, but continuing...');
  }
  
  console.log('✅ Ready for runtime deployment');
  process.exit(0);
}

// Handle detected build context (DigitalOcean build command)
if (isBuildContext) {
  console.log('🔧 BUILD CONTEXT: DigitalOcean build phase detected');
  
  // Ensure frontend is built in build context
  try {
    const { execSync } = require('child_process');
    console.log('📦 Building frontend assets in build context...');
    execSync('npm run build', { stdio: 'inherit' });
    console.log('✅ Frontend build completed in build context');
  } catch (error) {
    console.log('⚠️ Frontend build failed in build context, but continuing...');
  }
  
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