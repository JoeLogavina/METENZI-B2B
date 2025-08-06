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
const productionCjsPath = path.join(__dirname, 'server', 'production-server.cjs');
const esPath = path.join(__dirname, 'dist', 'index.js');

console.log(`🔍 Checking for built CommonJS server: ${cjsPath}`);
console.log(`🔍 Checking for production CommonJS server: ${productionCjsPath}`);
console.log(`🔍 Checking for ES Module server: ${esPath}`);

const cjsExists = fs.existsSync(cjsPath);
const productionCjsExists = fs.existsSync(productionCjsPath);
const esExists = fs.existsSync(esPath);

console.log(`✅ Built CommonJS server exists: ${cjsExists}`);
console.log(`✅ Production CommonJS server exists: ${productionCjsExists}`);
console.log(`✅ ES Module server exists: ${esExists}`);

// Add startup delay for DigitalOcean health checks
console.log('⏳ Initializing server startup...');

// Set production environment explicitly
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
process.env.PORT = process.env.PORT || '8080';

console.log(`🔧 PORT configured: ${process.env.PORT}`);
console.log(`🔧 NODE_ENV configured: ${process.env.NODE_ENV}`);

if (productionCjsExists) {
  console.log('🎯 Starting production CommonJS server (reliable)...');
  const { createRequire } = await import('module');
  const require = createRequire(import.meta.url);
  require('./server/production-server.cjs');
} else if (cjsExists) {
  console.log('🎯 Starting built CommonJS server (fallback)...');
  const { createRequire } = await import('module');
  const require = createRequire(import.meta.url);
  require('./dist/index.cjs');
} else if (esExists) {
  console.log('🎯 Starting ES Module server (development only)...');
  const { createRequire } = await import('module');
  const require = createRequire(import.meta.url);
  require('./server/production-server.cjs');
} else {
  console.error('❌ No server files found');
  console.error('💡 Make sure to run: npm run build');
  process.exit(1);
}

// Add delay to ensure server binds completely before health checks start
console.log('⏳ Waiting for server to bind completely...');
await new Promise(resolve => setTimeout(resolve, 2000));
console.log('✅ Server startup sequence completed');