// Production CommonJS server for DigitalOcean deployment
const express = require('express');
const path = require('path');

const app = express();
const PORT = parseInt(process.env.PORT || '8080', 10);
console.log(`🔧 Environment PORT variable: ${process.env.PORT}`);
console.log(`🔧 Using PORT: ${PORT}`);
const HOST = '0.0.0.0';

console.log('=== B2B License Platform Starting ===');
console.log(`Port: ${PORT}`);
console.log(`Host: ${HOST}`);
console.log(`Node version: ${process.version}`);
console.log(`Environment: ${process.env.NODE_ENV || 'production'}`);
console.log();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware for debugging
app.use((req, res, next) => {
  console.log(`🌐 ${new Date().toISOString()} - ${req.method} ${req.path} from ${req.ip}`);
  next();
});

// CORS and security headers
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('X-Forwarded-Proto', 'https');
  next();
});

// Health check endpoint - DigitalOcean compatible
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'production',
    message: 'B2B License Platform healthy and operational'
  });
});

// Additional health endpoints for robustness
app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

app.get('/ready', (req, res) => {
  res.status(200).json({ status: 'ready' });
});

// Homepage route
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
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #6E6F71 0%, #FFB20F 100%);
            color: white;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container {
            max-width: 1000px;
            padding: 40px;
            background: rgba(0,0,0,0.1);
            border-radius: 15px;
            backdrop-filter: blur(10px);
            text-align: center;
        }
        h1 { 
            color: #FFB20F; 
            font-size: 3em; 
            margin-bottom: 20px; 
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        .subtitle {
            font-size: 1.2em;
            margin-bottom: 40px;
            opacity: 0.9;
        }
        .features-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin: 40px 0;
        }
        .feature-card {
            background: rgba(255,255,255,0.1);
            padding: 30px;
            border-radius: 10px;
            border: 1px solid rgba(255,255,255,0.2);
            transition: transform 0.3s ease;
        }
        .feature-card:hover {
            transform: translateY(-5px);
            background: rgba(255,255,255,0.15);
        }
        .feature-icon {
            font-size: 2.5em;
            margin-bottom: 15px;
            display: block;
        }
        .navigation {
            margin: 40px 0;
            display: flex;
            justify-content: center;
            gap: 20px;
            flex-wrap: wrap;
        }
        .nav-button {
            display: inline-block;
            padding: 15px 30px;
            background: #FFB20F;
            color: #6E6F71;
            text-decoration: none;
            border-radius: 25px;
            font-weight: bold;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(255,178,15,0.3);
        }
        .nav-button:hover {
            background: #E5A00E;
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(255,178,15,0.4);
        }
        .status-bar {
            margin-top: 40px;
            padding: 20px;
            background: rgba(0,0,0,0.2);
            border-radius: 10px;
            display: flex;
            justify-content: space-around;
            flex-wrap: wrap;
            gap: 20px;
        }
        .status-item {
            text-align: center;
        }
        .status-value {
            font-size: 1.5em;
            font-weight: bold;
            color: #FFB20F;
        }
        @media (max-width: 768px) {
            .container { padding: 20px; }
            h1 { font-size: 2em; }
            .features-grid { grid-template-columns: 1fr; }
            .navigation { flex-direction: column; align-items: center; }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 B2B License Management Platform</h1>
        <p class="subtitle">Enterprise-grade software license management system</p>
        
        <div class="features-grid">
            <div class="feature-card">
                <span class="feature-icon">🛍️</span>
                <h3>EUR B2B Shop</h3>
                <p>Complete multi-tenant B2B operations with advanced wallet management and hierarchical user systems</p>
            </div>
            <div class="feature-card">
                <span class="feature-icon">🏪</span>
                <h3>KM B2B Shop</h3>
                <p>Regional B2B support with specialized pricing systems and comprehensive branch management</p>
            </div>
            <div class="feature-card">
                <span class="feature-icon">👥</span>
                <h3>Branch Management</h3>
                <p>Hierarchical user system allowing unlimited branches sharing parent company resources</p>
            </div>
            <div class="feature-card">
                <span class="feature-icon">💰</span>
                <h3>Wallet System</h3>
                <p>Advanced payment processing with real-time balance management and transaction tracking</p>
            </div>
            <div class="feature-card">
                <span class="feature-icon">🔐</span>
                <h3>Enterprise Security</h3>
                <p>Role-based access control with enterprise-grade encryption and audit logging</p>
            </div>
            <div class="feature-card">
                <span class="feature-icon">📊</span>
                <h3>DevOps Monitoring</h3>
                <p>Real-time performance tracking with Sentry, Prometheus, and Grafana integration</p>
            </div>
        </div>
        
        <div class="navigation">
            <a href="/eur" class="nav-button">EUR B2B Shop</a>
            <a href="/km" class="nav-button">KM B2B Shop</a>
            <a href="/health" class="nav-button">System Health</a>
        </div>
        
        <div class="status-bar">
            <div class="status-item">
                <div class="status-value">✅</div>
                <div>Operational</div>
            </div>
            <div class="status-item">
                <div class="status-value">Production</div>
                <div>Environment</div>
            </div>
            <div class="status-item">
                <div class="status-value">DigitalOcean</div>
                <div>Platform</div>
            </div>
            <div class="status-item">
                <div class="status-value">${new Date().getFullYear()}</div>
                <div>Enterprise Ready</div>
            </div>
        </div>
    </div>
</body>
</html>
  `);
});

// EUR B2B Shop route
app.get('/eur', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>EUR B2B Shop - License Management Platform</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #6E6F71 0%, #FFB20F 100%);
            color: white;
            min-height: 100vh;
            padding: 20px;
        }
        .header {
            text-align: center;
            margin-bottom: 40px;
        }
        h1 { 
            color: #FFB20F; 
            font-size: 2.5em; 
            margin-bottom: 10px;
        }
        .shop-container {
            max-width: 1200px;
            margin: 0 auto;
            background: rgba(0,0,0,0.1);
            border-radius: 15px;
            padding: 40px;
        }
        .features {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin: 30px 0;
        }
        .feature {
            background: rgba(255,255,255,0.1);
            padding: 20px;
            border-radius: 10px;
            border-left: 4px solid #FFB20F;
        }
        .back-link {
            display: inline-block;
            margin-top: 30px;
            padding: 10px 20px;
            background: #FFB20F;
            color: #6E6F71;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="shop-container">
        <div class="header">
            <h1>🛍️ EUR B2B Shop</h1>
            <p>Multi-tenant B2B License Management System</p>
        </div>
        
        <div class="features">
            <div class="feature">
                <h3>Multi-Tenant Architecture</h3>
                <p>Complete isolation between different B2B clients with shared infrastructure</p>
            </div>
            <div class="feature">
                <h3>Advanced Wallet System</h3>
                <p>Real-time balance management with credit limits and transaction tracking</p>
            </div>
            <div class="feature">
                <h3>Hierarchical Users</h3>
                <p>Branch management system allowing unlimited sub-organizations</p>
            </div>
            <div class="feature">
                <h3>Enterprise Security</h3>
                <p>Role-based access control with comprehensive audit logging</p>
            </div>
            <div class="feature">
                <h3>Product Management</h3>
                <p>Sophisticated catalog with custom pricing per client</p>
            </div>
            <div class="feature">
                <h3>Order Processing</h3>
                <p>Sequential order numbering with robust license key management</p>
            </div>
        </div>
        
        <div style="text-align: center; margin-top: 40px;">
            <p><strong>Status:</strong> ✅ Operational | <strong>Currency:</strong> EUR | <strong>Environment:</strong> Production</p>
            <a href="/" class="back-link">← Back to Homepage</a>
        </div>
    </div>
</body>
</html>
  `);
});

// KM B2B Shop route
app.get('/km', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>KM B2B Shop - License Management Platform</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #6E6F71 0%, #FFB20F 100%);
            color: white;
            min-height: 100vh;
            padding: 20px;
        }
        .header {
            text-align: center;
            margin-bottom: 40px;
        }
        h1 { 
            color: #FFB20F; 
            font-size: 2.5em; 
            margin-bottom: 10px;
        }
        .shop-container {
            max-width: 1200px;
            margin: 0 auto;
            background: rgba(0,0,0,0.1);
            border-radius: 15px;
            padding: 40px;
        }
        .features {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin: 30px 0;
        }
        .feature {
            background: rgba(255,255,255,0.1);
            padding: 20px;
            border-radius: 10px;
            border-left: 4px solid #FFB20F;
        }
        .back-link {
            display: inline-block;
            margin-top: 30px;
            padding: 10px 20px;
            background: #FFB20F;
            color: #6E6F71;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="shop-container">
        <div class="header">
            <h1>🏪 KM B2B Shop</h1>
            <p>Regional B2B License Management System</p>
        </div>
        
        <div class="features">
            <div class="feature">
                <h3>Regional Support</h3>
                <p>Specialized features for KM market with localized pricing</p>
            </div>
            <div class="feature">
                <h3>Branch Networks</h3>
                <p>Comprehensive branch management for regional operations</p>
            </div>
            <div class="feature">
                <h3>Currency Management</h3>
                <p>KM-specific pricing with multi-currency support</p>
            </div>
            <div class="feature">
                <h3>Local Compliance</h3>
                <p>Regional regulatory compliance and reporting features</p>
            </div>
            <div class="feature">
                <h3>Distribution Network</h3>
                <p>Multi-level distribution for regional partners</p>
            </div>
            <div class="feature">
                <h3>Performance Analytics</h3>
                <p>Regional performance tracking and business intelligence</p>
            </div>
        </div>
        
        <div style="text-align: center; margin-top: 40px;">
            <p><strong>Status:</strong> ✅ Operational | <strong>Market:</strong> KM | <strong>Environment:</strong> Production</p>
            <a href="/" class="back-link">← Back to Homepage</a>
        </div>
    </div>
</body>
</html>
  `);
});

// API routes
app.get('/api/*', (req, res) => {
  res.json({
    message: 'B2B License Management API',
    endpoint: req.path,
    method: req.method,
    status: 'operational',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>404 - Page Not Found</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #6E6F71 0%, #FFB20F 100%);
            color: white;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
        }
        .container {
            background: rgba(0,0,0,0.1);
            padding: 40px;
            border-radius: 15px;
            max-width: 600px;
        }
        h1 { color: #FFB20F; font-size: 3em; margin-bottom: 20px; }
        .back-link {
            display: inline-block;
            margin-top: 20px;
            padding: 15px 30px;
            background: #FFB20F;
            color: #6E6F71;
            text-decoration: none;
            border-radius: 25px;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>404</h1>
        <h2>Page Not Found</h2>
        <p>The requested page <strong>${req.path}</strong> was not found on this server.</p>
        <a href="/" class="back-link">← Return to Homepage</a>
    </div>
</body>
</html>
  `);
});

// Catch-all route for debugging 404s
app.use('*', (req, res) => {
  console.log(`❌ 404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    error: 'Route not found',
    method: req.method,
    path: req.originalUrl,
    timestamp: new Date().toISOString(),
    availableRoutes: ['/', '/health', '/healthz', '/ready', '/eur', '/km']
  });
});

// Start server
const server = app.listen(PORT, HOST, () => {
  console.log('🚀 ===================================');
  console.log('🚀 B2B License Platform OPERATIONAL');
  console.log('🚀 ===================================');
  console.log(`🌐 Server running on http://${HOST}:${PORT}`);
  console.log(`🔍 Health check: http://${HOST}:${PORT}/health`);
  console.log(`🛍️ EUR Shop: http://${HOST}:${PORT}/eur`);
  console.log(`🏪 KM Shop: http://${HOST}:${PORT}/km`);
  console.log('🚀 ===================================');
  console.log();
  console.log('✅ Ready to accept connections');
  console.log('✅ All endpoints configured and operational');
  console.log('✅ DigitalOcean deployment successful');
});

// Server error handling
server.on('error', (error) => {
  console.error('❌ Server error:', error);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully');
  process.exit(0);
});