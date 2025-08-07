// Backup production server entry point for DigitalOcean deployment
// This file loads the main production server from the root directory

const path = require('path');
const fs = require('fs');

console.log('🔧 Loading production server from server directory...');

// Look for the main production server file
const possibleFiles = [
  '../index.cjs',
  '../server.cjs',
  '../dist/index.cjs'
];

let serverFile = null;
for (const file of possibleFiles) {
  const fullPath = path.join(__dirname, file);
  if (fs.existsSync(fullPath)) {
    console.log(`✅ Found server file: ${file}`);
    serverFile = fullPath;
    break;
  }
}

if (!serverFile) {
  console.error('❌ No production server file found');
  process.exit(1);
}

try {
  console.log(`🚀 Loading production server from: ${serverFile}`);
  require(serverFile);
} catch (error) {
  console.error('❌ Failed to load production server:', error);
  process.exit(1);
}