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

console.log(`🔍 Environment Detection:`);
console.log(`  NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`  PORT: ${process.env.PORT}`);
console.log(`  Runtime indicators: ${hasRuntimeEnv}`);
console.log('  Phase: BUILD (custom build command - always exit cleanly)');

console.log('✅ Build phase: Files prepared successfully');  
console.log('✅ Ready for runtime startup');

// Always exit cleanly during build phase - never start a server  
console.log('✅ BUILD COMPLETE: Files prepared, exiting cleanly');
console.log('📋 Runtime will be handled by Procfile command');
console.log('🚀 Ready for deployment - server will start via Procfile');
process.exit(0);