#!/bin/bash

echo "🚀 Complete B2B License Platform - DigitalOcean Production Deploy"

# Set production environment
export NODE_ENV=production  
export PORT=${PORT:-8080}

echo "Environment: NODE_ENV=$NODE_ENV, PORT=$PORT"

# Create clean directory and copy files
echo "📁 Setting up production environment..."
PROD_DIR="/tmp/b2b-production-$(date +%s)"
mkdir -p "$PROD_DIR"

# Copy all B2B platform files
echo "📋 Copying B2B License Platform files..."
cp -r server "$PROD_DIR/" 2>/dev/null || echo "Server files not found"
cp -r shared "$PROD_DIR/" 2>/dev/null || echo "Shared files not found"
cp -r client "$PROD_DIR/" 2>/dev/null || echo "Client files not found"
cp full-production-server.ts "$PROD_DIR/" 2>/dev/null || echo "Production server not found"
cp package.json "$PROD_DIR/" 2>/dev/null || echo "Package.json not found"
cp -r node_modules "$PROD_DIR/" 2>/dev/null || echo "Will install dependencies"

# Check if we have the full platform files
if [ -f "$PROD_DIR/full-production-server.ts" ]; then
  echo "🚀 Using complete B2B License Platform server"
  USE_FULL_SERVER=true
else
  echo "⚠️ Full server not found, creating fallback server"
  USE_FULL_SERVER=false
  
  # Create fallback server with basic functionality
  cat > "$PROD_DIR/app.js" << 'EOF'
// Fallback B2B License Platform Server
const express = require('express');
const path = require('path');
const app = express();

const PORT = parseInt(process.env.PORT || '8080', 10);
const NODE_ENV = process.env.NODE_ENV || 'production';

console.log('🚀 B2B License Platform (Fallback Mode)');
console.log(`Environment: ${NODE_ENV}, Port: ${PORT}`);

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'B2B License Platform',
    environment: NODE_ENV,
    port: PORT
  });
});

// Root endpoint with proper B2B interface
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>B2B License Management Platform</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
            .container { max-width: 800px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            h1 { color: #333; margin-bottom: 30px; }
            .links { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 30px 0; }
            .link-card { padding: 20px; border: 1px solid #ddd; border-radius: 6px; text-decoration: none; color: #333; }
            .link-card:hover { background: #f8f9fa; }
            .status { color: #28a745; font-weight: bold; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🏢 B2B License Management Platform</h1>
            <p class="status">✅ Status: Operational</p>
            <p>Welcome to your enterprise software license management portal.</p>
            
            <div class="links">
                <a href="/health" class="link-card">
                    <h3>🔍 System Health</h3>
                    <p>Check system status and monitoring</p>
                </a>
                <a href="/api/status" class="link-card">
                    <h3>📊 API Status</h3>
                    <p>View API endpoints and services</p>
                </a>
            </div>
            
            <h3>🎯 Next Steps:</h3>
            <ol>
                <li>Deploy the complete application with all TypeScript files</li>
                <li>Configure database connections</li>
                <li>Set up authentication system</li>
                <li>Access the full B2B platform interface</li>
            </ol>
            
            <p><strong>Environment:</strong> ${NODE_ENV} | <strong>Version:</strong> 1.0.0</p>
        </div>
    </body>
    </html>
  `);
});

// API endpoints
app.get('/api/status', (req, res) => {
  res.status(200).json({
    api: 'active',
    mode: 'fallback',
    services: ['health-check', 'basic-routing'],
    timestamp: new Date().toISOString(),
    message: 'Deploy complete TypeScript application for full functionality'
  });
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ B2B License Platform (Fallback) running on port ${PORT}`);
  console.log(`🌐 Application: http://localhost:${PORT}`);
  console.log(`🔍 Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('📡 Received SIGTERM, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server shutdown complete');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('📡 Received SIGINT, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server shutdown complete');
    process.exit(0);
  });
});

module.exports = app;
EOF
fi

# Create minimal package.json
cat > "$PROD_DIR/package.json" << 'EOF'
{
  "name": "b2b-license-platform",
  "version": "1.0.0",
  "main": "app.js",
  "dependencies": {
    "express": "^4.18.2"
  },
  "scripts": {
    "start": "node app.js"
  }
}
EOF

# Change to production directory
cd "$PROD_DIR"

# Install dependencies
echo "📦 Installing production dependencies..."
npm install --production

# Start the appropriate server
if [ "$USE_FULL_SERVER" = true ]; then
  echo "🚀 Starting complete B2B License Platform..."
  # Install tsx for TypeScript execution
  npm install -g tsx
  exec npx tsx full-production-server.ts
else
  echo "🚀 Starting B2B License Platform (Fallback Mode)..."
  exec node app.js
fi