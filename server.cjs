// Alternative production server entry point
// This can be used instead of npm start by setting run command to: node server.js

const { spawn } = require('child_process');

console.log('B2B License Platform - Alternative Production Entry');

// Set production environment
process.env.NODE_ENV = 'production';
const port = process.env.PORT || 8080;

console.log(`Starting on port ${port}`);

// Start the TypeScript server
const server = spawn('npx', ['tsx', 'server/index.ts'], {
  stdio: 'inherit',
  env: { ...process.env, PORT: port }
});

server.on('error', (error) => {
  console.error('Server error:', error);
  process.exit(1);
});

server.on('close', (code) => {
  console.log(`Server exited with code ${code}`);
  process.exit(code || 0);
});

// Graceful shutdown
process.on('SIGTERM', () => server.kill('SIGTERM'));
process.on('SIGINT', () => server.kill('SIGINT'));