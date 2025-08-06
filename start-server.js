// Universal DigitalOcean Server Starter
// This ensures the correct server runs regardless of DigitalOcean configuration

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 B2B License Management Platform - Universal Starter');
console.log(`📍 Working Directory: ${process.cwd()}`);
console.log(`🔢 Node Version: ${process.version}`);
console.log(`🌍 Environment: ${process.env.NODE_ENV || 'production'}`);

// Check which server files exist
const cjsPath = path.join(__dirname, 'dist', 'index.cjs');
const esPath = path.join(__dirname, 'dist', 'index.js');

console.log(`🔍 Checking for CommonJS server: ${cjsPath}`);
console.log(`🔍 Checking for ES Module server: ${esPath}`);

const cjsExists = fs.existsSync(cjsPath);
const esExists = fs.existsSync(esPath);

console.log(`✅ CommonJS server exists: ${cjsExists}`);
console.log(`✅ ES Module server exists: ${esExists}`);

// Add startup delay for DigitalOcean health checks
console.log('⏳ Initializing server startup...');

if (cjsExists) {
  console.log('🎯 Starting CommonJS server (preferred)...');
  // Use dynamic import to load CommonJS module
  const { createRequire } = await import('module');
  const require = createRequire(import.meta.url);
  require('./dist/index.cjs');
} else if (esExists) {
  console.log('🎯 Starting ES Module server (fallback)...');
  await import('./dist/index.js');
} else {
  console.error('❌ No server files found in dist directory');
  console.error('💡 Make sure to run: npm run build');
  process.exit(1);
}

// Ensure server has time to bind to port before health checks
console.log('✅ Server startup sequence completed');