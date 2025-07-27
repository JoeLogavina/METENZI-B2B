#!/usr/bin/env node
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🚀 Starting B2B Microservices Architecture...');

// Set environment variables
process.env.NODE_ENV = 'development';
process.env.INTERNAL_SERVICE_KEY = 'dev-service-key';

// Start Core API Service
console.log('Starting Core API Service on port 5003...');
const coreProcess = spawn('node', ['--loader', 'tsx', 'server/index.ts'], {
  cwd: join(__dirname, 'services/core-api-service'),
  env: { ...process.env, PORT: '5003' },
  stdio: 'inherit'
});

// Wait a bit for Core API to start
setTimeout(() => {
  // Start Admin Service
  console.log('Starting Admin Service on port 5001...');
  const adminProcess = spawn('node', ['--loader', 'tsx', 'server/index.ts'], {
    cwd: join(__dirname, 'services/admin-service'),
    env: { ...process.env, PORT: '5001' },
    stdio: 'inherit'
  });

  // Start B2B Service
  console.log('Starting B2B Service on port 5002...');
  const b2bProcess = spawn('node', ['--loader', 'tsx', 'server/index.ts'], {
    cwd: join(__dirname, 'services/b2b-service'),
    env: { ...process.env, PORT: '5002' },
    stdio: 'inherit'
  });

  console.log('✅ All services started!');
  console.log('- Admin Portal: http://localhost:5001');
  console.log('- B2B Portal: http://localhost:5002');
  console.log('- Core API: http://localhost:5003');

  // Handle cleanup
  process.on('SIGINT', () => {
    console.log('\n⏹️ Stopping all services...');
    coreProcess.kill();
    adminProcess.kill();
    b2bProcess.kill();
    process.exit(0);
  });
}, 5000);