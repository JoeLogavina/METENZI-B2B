#!/usr/bin/env node
// Build-only script for DigitalOcean - prepares files without starting server
const fs = require('fs');
const path = require('path');

// File paths
const distDir = path.join(__dirname, 'dist');
const targetFile = path.join(distDir, 'index.cjs');
const sourceFile = path.join(__dirname, 'index.js');

console.log('=== B2B PLATFORM BUILD PHASE ===');
console.log(`Environment: ${process.env.NODE_ENV}`);

// Ensure dist directory exists
if (!fs.existsSync(distDir)) {
  console.log('Creating dist directory...');
  fs.mkdirSync(distDir, { recursive: true });
}

// Copy server file to target location
if (fs.existsSync(sourceFile)) {
  console.log('Copying index.js to dist/index.cjs...');
  fs.copyFileSync(sourceFile, targetFile);
  console.log('✅ dist/index.cjs created successfully');
} else {
  console.error('❌ index.js not found');
  process.exit(1);
}

console.log('✅ BUILD COMPLETE: Files prepared for runtime');
console.log('📋 Runtime will use: node production-start-clean.cjs');
process.exit(0);