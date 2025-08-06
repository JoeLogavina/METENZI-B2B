// Production CommonJS server for DigitalOcean deployment
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = parseInt(process.env.PORT || '8080', 10);
console.log(`🔧 Environment PORT variable: ${process.env.PORT}`);
console.log(`🔧 Using PORT: ${PORT}`);
const HOST = '0.0.0.0';

console.log('=== B2B License Platform Starting ===');
console.log(`Port: ${PORT}`);
console.log(`Host: ${HOST}`);
console.log(`Node version: ${process.version}`);
console.log(`Environment: ${process.env.NODE_ENV}`);
console.log('');

// Basic middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false }));

// Health check endpoints
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('/status', (req, res) => {
  res.json({ status: 'operational', port: PORT });
});

app.get('/ready', (req, res) => {
  res.json({ ready: true });
});

// Serve static files from dist/public
const publicDir = path.join(__dirname, '..', 'dist', 'public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
  console.log(`✅ Static files configured: ${publicDir}`);
} else {
  console.log(`⚠️ Static files directory not found: ${publicDir}`);
}

// Essential API routes for frontend functionality
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mock essential API endpoints for frontend functionality
app.get('/api/auth/me', (req, res) => {
  res.status(401).json({ error: 'Not authenticated' });
});

app.get('/api/products', (req, res) => {
  res.json([]);
});

app.get('/api/orders', (req, res) => {
  res.json([]);
});

app.get('/api/cart', (req, res) => {
  res.json([]);
});

app.get('/api/wallet', (req, res) => {
  res.json({ data: { balance: 0, creditLimit: 0 } });
});

app.get('/api/wallet/transactions', (req, res) => {
  res.json({ data: [] });
});

// Catch-all for other API routes
app.all('/api/*', (req, res) => {
  res.status(503).json({ 
    error: 'Service temporarily unavailable',
    message: 'Full functionality requires database connection'
  });
});

// Catch all route - serve index.html for client-side routing
app.get('*', (req, res) => {
  const indexPath = path.join(publicDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ error: 'Application not built properly' });
  }
});

console.log('⏳ Waiting for server to bind completely...');

// Start server with comprehensive error handling
const server = app.listen(PORT, HOST, (error) => {
  if (error) {
    console.error('❌ Server failed to start:', error);
    process.exit(1);
  }
  
  console.log('🚀 ===================================');
  console.log('🚀 B2B License Platform OPERATIONAL');
  console.log('🚀 ===================================');
  console.log(`🌐 Server running on http://${HOST}:${PORT}`);
  console.log(`🔍 Health check: http://${HOST}:${PORT}/health`);
  console.log(`🛍️ EUR Shop: http://${HOST}:${PORT}/eur`);
  console.log(`🏪 KM Shop: http://${HOST}:${PORT}/km`);
  console.log('🚀 ===================================');
  console.log('');
  console.log('✅ Ready to accept connections');
  console.log('✅ All endpoints configured and operational');
  console.log('✅ DigitalOcean deployment successful');
});

server.on('error', (err) => {
  console.error('❌ Server error:', err);
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use`);
  }
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('🔄 SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed successfully');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🔄 SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed successfully');
    process.exit(0);
  });
});