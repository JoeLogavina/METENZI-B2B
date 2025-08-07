// Production server entry point for DigitalOcean deployment
// This file ensures CommonJS module loading regardless of package.json settings

const path = require('path');
const fs = require('fs');

console.log('🔧 Production server entry point - Loading main server...');

// Check for main server file in multiple locations
const possibleServerFiles = [
  './index.cjs',
  './dist/index.cjs',
  './index.js',
  './server/index.js'
];

let serverFile = null;
for (const file of possibleServerFiles) {
  if (fs.existsSync(file)) {
    console.log(`✅ Found server file: ${file}`);
    serverFile = file;
    break;
  }
}

if (!serverFile) {
  console.error('❌ No server file found in:', possibleServerFiles);
  process.exit(1);
}

// Load the main server
try {
  console.log(`🚀 Loading server from: ${serverFile}`);
  require(serverFile);
} catch (error) {
  console.error('❌ Failed to load server:', error);
  process.exit(1);
}