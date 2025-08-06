#!/usr/bin/env node
// Simplified production starter for DigitalOcean - Ultimate fix
const fs = require('fs');
const path = require('path');

// File paths
const distDir = path.join(__dirname, 'dist');
const targetFile = path.join(distDir, 'index.cjs');
const sourceFile = path.join(__dirname, 'index.js');

console.log('=== B2B PLATFORM DIGITALOCEAN STARTER ===');
console.log(`Environment: ${process.env.NODE_ENV}`);
console.log(`Port: ${process.env.PORT || 'not set'}`);

// Ensure dist directory and file exist
if (!fs.existsSync(distDir)) {
  console.log('Creating dist directory...');
  fs.mkdirSync(distDir, { recursive: true });
}

if (!fs.existsSync(targetFile)) {
  if (fs.existsSync(sourceFile)) {
    console.log('Copying index.js to dist/index.cjs...');
    fs.copyFileSync(sourceFile, targetFile);
    console.log('✅ dist/index.cjs created');
  } else {
    console.error('❌ index.js not found');
    process.exit(1);
  }
} else {
  console.log('✅ dist/index.cjs exists');
}

// Simple environment-based detection
// If PORT is set, we're in runtime (DigitalOcean sets this automatically)
if (process.env.PORT) {
  console.log('🚀 RUNTIME: Starting server...');
  console.log(`📍 Target port: ${process.env.PORT}`);
  console.log(`📂 Loading: ${path.resolve(targetFile)}`);
  
  try {
    // Add event handling for server startup
    process.on('uncaughtException', (error) => {
      console.error('💥 Uncaught Exception:', error);
      process.exit(1);
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });
    
    console.log('⏳ Starting server module...');
    require('./dist/index.cjs');
    
    // Give the server a moment to start
    setTimeout(() => {
      console.log('✅ Server startup initiated successfully');
    }, 1000);
    
  } catch (error) {
    console.error('❌ Server startup failed:', error.message);
    console.error('📋 Full error:', error);
    process.exit(1);
  }
} else {
  console.log('✅ BUILD: Files prepared, ready for runtime');
  process.exit(0);
}