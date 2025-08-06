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

// Detect if this is build phase vs runtime phase based on environment
const isBuildPhase = !process.env.DYNO && !process.env.WEB_CONCURRENCY && 
                     process.env.NODE_ENV === 'production' && 
                     !process.env.RUNTIME_PHASE;

if (isBuildPhase) {
  // Build phase - just prepare files and exit cleanly
  console.log('✅ Build phase: Files prepared successfully');  
  console.log('✅ Ready for runtime startup');
  process.exit(0);
}

// Runtime phase - start the server with error handling
console.log('🚀 Runtime phase: Starting server...');
try {
  require('./dist/index.cjs');
} catch (error) {
  if (error.code === 'EADDRINUSE') {
    console.log('⚠️  Port conflict detected during build phase');
    console.log('✅ Files prepared, exiting cleanly for runtime phase');
    process.exit(0);
  } else {
    console.error('Server startup error:', error.message);
    throw error;
  }
}