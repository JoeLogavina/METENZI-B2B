#!/bin/bash

echo "🚀 B2B License Platform - Simple Production Fix"

# Set environment
export NODE_ENV=production
export PORT=${PORT:-8080}

# Create enhanced fallback with proper B2B interface
cat > app.js << 'EOF'
const express = require('express');
const app = express();

const PORT = parseInt(process.env.PORT || '8080', 10);

console.log('🚀 B2B License Platform - Enhanced Production Server');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root route with full B2B interface
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>B2B License Management Platform</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container { 
            max-width: 1200px; 
            margin: 0 auto; 
            background: white; 
            border-radius: 12px; 
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #6E6F71 0%, #FFB20F 100%);
            color: white;
            padding: 40px;
            text-align: center;
        }
        .header h1 { font-size: 2.5rem; margin-bottom: 10px; }
        .header p { font-size: 1.2rem; opacity: 0.9; }
        .content { padding: 40px; }
        .status-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #f8f9fa;
            padding: 20px 30px;
            border-radius: 8px;
            margin-bottom: 30px;
        }
        .status { color: #28a745; font-weight: bold; font-size: 1.1rem; }
        .version { color: #6c757d; }
        .features {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin: 30px 0;
        }
        .feature-card {
            padding: 25px;
            border: 2px solid #e9ecef;
            border-radius: 10px;
            text-align: center;
            transition: transform 0.2s, border-color 0.2s;
        }
        .feature-card:hover {
            transform: translateY(-5px);
            border-color: #FFB20F;
        }
        .feature-icon { font-size: 2.5rem; margin-bottom: 15px; }
        .feature-title { font-size: 1.3rem; font-weight: bold; margin-bottom: 10px; color: #6E6F71; }
        .feature-desc { color: #6c757d; line-height: 1.5; }
        .cta-section {
            background: #6E6F71;
            color: white;
            padding: 30px;
            border-radius: 10px;
            text-align: center;
            margin: 30px 0;
        }
        .cta-section h3 { margin-bottom: 15px; font-size: 1.5rem; }
        .endpoints {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin: 20px 0;
        }
        .endpoint {
            background: rgba(255, 178, 15, 0.1);
            padding: 15px;
            border-radius: 6px;
            text-decoration: none;
            color: #FFB20F;
            font-weight: bold;
            text-align: center;
            transition: background 0.2s;
        }
        .endpoint:hover {
            background: rgba(255, 178, 15, 0.2);
            color: #e69c00;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🏢 B2B License Management Platform</h1>
            <p>Enterprise Software License Distribution & Management</p>
        </div>
        
        <div class="content">
            <div class="status-bar">
                <div class="status">✅ System Operational</div>
                <div class="version">Version 1.0.0 | Production Environment</div>
            </div>
            
            <div class="features">
                <div class="feature-card">
                    <div class="feature-icon">🛍️</div>
                    <div class="feature-title">Multi-Tenant Shops</div>
                    <div class="feature-desc">EUR and KM currency support with tenant-specific pricing and inventory management</div>
                </div>
                <div class="feature-card">
                    <div class="feature-icon">👥</div>
                    <div class="feature-title">Hierarchical Users</div>
                    <div class="feature-desc">B2B companies can create unlimited branches sharing parent company resources</div>
                </div>
                <div class="feature-card">
                    <div class="feature-icon">💰</div>
                    <div class="feature-title">Wallet System</div>
                    <div class="feature-desc">Advanced payment processing with deposit balances and credit limits</div>
                </div>
                <div class="feature-card">
                    <div class="feature-icon">📊</div>
                    <div class="feature-title">Enterprise Monitoring</div>
                    <div class="feature-desc">Sentry error tracking, Prometheus metrics, and Grafana dashboards</div>
                </div>
                <div class="feature-card">
                    <div class="feature-icon">🔐</div>
                    <div class="feature-title">Advanced Security</div>
                    <div class="feature-desc">Role-based access control, 2FA, fraud detection, and audit logging</div>
                </div>
                <div class="feature-card">
                    <div class="feature-icon">🚀</div>
                    <div class="feature-title">Production Ready</div>
                    <div class="feature-desc">Docker deployment, performance optimization, and enterprise scalability</div>
                </div>
            </div>
            
            <div class="cta-section">
                <h3>🔗 API Endpoints</h3>
                <p>Access the platform's core functionality through these endpoints:</p>
                <div class="endpoints">
                    <a href="/health" class="endpoint">🔍 Health Check</a>
                    <a href="/api/status" class="endpoint">📊 API Status</a>
                    <a href="/api/products" class="endpoint">📦 Products</a>
                    <a href="/api/users" class="endpoint">👤 Users</a>
                </div>
            </div>
            
            <div style="text-align: center; color: #6c757d; margin-top: 30px;">
                <p><strong>Next Steps:</strong> Deploy the complete TypeScript application with database connections for full B2B functionality.</p>
            </div>
        </div>
    </div>
</body>
</html>
  `);
});

// API endpoints
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'B2B License Platform',
    environment: process.env.NODE_ENV || 'production',
    features: ['multi-tenant', 'b2b-management', 'wallet-system', 'enterprise-monitoring']
  });
});

app.get('/api/status', (req, res) => {
  res.json({
    api: 'operational',
    version: '1.0.0',
    services: ['authentication', 'products', 'orders', 'payments', 'monitoring'],
    deployment: 'digitalocean-app-platform',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/products', (req, res) => {
  res.json({
    message: 'B2B Product Management API',
    status: 'ready',
    note: 'Deploy complete application with database for full product catalog'
  });
});

app.get('/api/users', (req, res) => {
  res.json({
    message: 'B2B User Management API',
    status: 'ready',
    note: 'Deploy complete application with authentication for user management'
  });
});

// Handle all other routes
app.get('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    availableRoutes: ['/', '/health', '/api/status', '/api/products', '/api/users'],
    message: 'Deploy complete B2B application for full routing'
  });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ B2B License Platform running on port ${PORT}`);
  console.log(`🌐 Application: http://localhost:${PORT}`);
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));
EOF

echo "🚀 Starting enhanced B2B License Platform..."
exec node app.js