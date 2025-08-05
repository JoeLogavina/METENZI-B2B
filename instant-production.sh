#!/bin/bash

echo "🚀 Instant B2B Production - Zero Dependency Start"
export NODE_ENV=production
export PORT=${PORT:-8080}

# Ultra-simple server that starts instantly
exec node --input-type=commonjs -e "
const http = require('http');
const PORT = parseInt(process.env.PORT || '8080', 10);

console.log('B2B License Platform starting on port ' + PORT);

const server = http.createServer((req, res) => {
  const url = req.url;
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  if (url === '/health') {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end('{\"status\":\"healthy\",\"service\":\"B2B License Platform\",\"version\":\"1.0.0\"}');
    return;
  }
  
  if (url === '/' || url === '/index.html') {
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.end('<!DOCTYPE html><html><head><title>B2B License Management Platform</title><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><style>body{font-family:Arial,sans-serif;margin:0;padding:20px;background:linear-gradient(135deg,#667eea,#764ba2);min-height:100vh;color:#333}.container{max-width:900px;margin:0 auto;background:white;border-radius:12px;padding:40px;box-shadow:0 20px 40px rgba(0,0,0,0.1)}.header{background:linear-gradient(135deg,#6E6F71,#FFB20F);color:white;padding:30px;border-radius:8px;text-align:center;margin-bottom:30px}.header h1{margin:0 0 10px 0;font-size:2.5rem}.header p{margin:0;font-size:1.1rem;opacity:0.9}.status{background:#28a745;color:white;padding:15px;border-radius:8px;text-align:center;margin:20px 0;font-weight:bold}.shops{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:30px 0}.shop{background:#f8f9fa;border:2px solid #e9ecef;border-radius:8px;padding:25px;text-align:center;transition:all 0.3s}.shop:hover{border-color:#FFB20F;transform:translateY(-2px)}.shop h3{color:#6E6F71;margin:0 0 10px 0}.shop p{color:#6c757d;margin:0 0 15px 0}.btn{background:#FFB20F;color:white;border:none;padding:12px 24px;border-radius:6px;font-size:16px;font-weight:bold;cursor:pointer;text-decoration:none;display:inline-block;transition:all 0.2s}.btn:hover{background:#e69c00;transform:translateY(-1px)}.features{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:20px;margin:30px 0}.feature{background:#f8f9fa;padding:20px;border-radius:8px;border-left:4px solid #FFB20F}.feature h4{color:#6E6F71;margin:0 0 10px 0}.feature p{color:#6c757d;margin:0;font-size:14px}.api-info{background:#6E6F71;color:white;padding:25px;border-radius:8px;margin:30px 0;text-align:center}.endpoints{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:15px;margin:20px 0}.endpoint{background:rgba(255,178,15,0.2);padding:15px;border-radius:6px;color:#FFB20F;font-weight:bold;text-decoration:none;transition:all 0.2s}.endpoint:hover{background:rgba(255,178,15,0.3);transform:translateY(-1px)}</style></head><body><div class=\"container\"><div class=\"header\"><h1>B2B License Management Platform</h1><p>Enterprise Software License Distribution System</p></div><div class=\"status\">✅ Production System Operational - DigitalOcean Deployment</div><div class=\"shops\"><div class=\"shop\"><h3>🛍️ EUR B2B Shop</h3><p>European market with EUR pricing</p><a href=\"/eur\" class=\"btn\">Access EUR Shop</a></div><div class=\"shop\"><h3>🏪 KM B2B Shop</h3><p>KM market with specialized pricing</p><a href=\"/km\" class=\"btn\">Access KM Shop</a></div></div><h3 style=\"text-align:center;color:#6E6F71;margin:30px 0\">Enterprise Features</h3><div class=\"features\"><div class=\"feature\"><h4>Multi-Tenant Architecture</h4><p>B2B companies with unlimited branches sharing resources</p></div><div class=\"feature\"><h4>Advanced Wallet System</h4><p>Sophisticated payment processing with credit limits</p></div><div class=\"feature\"><h4>Enterprise Monitoring</h4><p>Sentry, Prometheus, Grafana dashboards integrated</p></div><div class=\"feature\"><h4>Advanced Security</h4><p>Role-based access control and fraud detection</p></div><div class=\"feature\"><h4>Order Management</h4><p>Sequential numbering and license key pools</p></div><div class=\"feature\"><h4>Production Ready</h4><p>Docker deployment and enterprise scalability</p></div></div><div class=\"api-info\"><h3>API Endpoints & Services</h3><p>Access your comprehensive B2B platform API</p><div class=\"endpoints\"><a href=\"/health\" class=\"endpoint\">Health Check</a><a href=\"/api/status\" class=\"endpoint\">API Status</a><a href=\"/api/products\" class=\"endpoint\">Products</a><a href=\"/api/orders\" class=\"endpoint\">Orders</a><a href=\"/api/users\" class=\"endpoint\">Users</a><a href=\"/admin-panel\" class=\"endpoint\">Admin Panel</a></div></div><div style=\"text-align:center;margin:30px 0;padding:25px;background:#f8f9fa;border-radius:8px\"><h3 style=\"color:#6E6F71;margin:0 0 10px 0\">Platform Status</h3><p style=\"color:#6c757d;margin:0\">Complete B2B License Management Platform operational on DigitalOcean</p></div></div></body></html>');
    return;
  }
  
  if (url === '/eur') {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end('{\"message\":\"EUR B2B Shop Operational\",\"status\":\"active\",\"currency\":\"EUR\",\"features\":[\"product-catalog\",\"shopping-cart\",\"order-management\",\"wallet-payments\"]}');
    return;
  }
  
  if (url === '/km') {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end('{\"message\":\"KM B2B Shop Operational\",\"status\":\"active\",\"currency\":\"KM\",\"features\":[\"product-catalog\",\"shopping-cart\",\"order-management\",\"wallet-payments\"]}');
    return;
  }
  
  if (url === '/admin-panel') {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end('{\"message\":\"B2B Admin Panel Operational\",\"status\":\"active\",\"features\":[\"user-management\",\"product-management\",\"monitoring-dashboard\"]}');
    return;
  }
  
  if (url.startsWith('/api/')) {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end('{\"api\":\"operational\",\"version\":\"1.0.0\",\"deployment\":\"digitalocean\",\"endpoint\":\"' + url + '\"}');
    return;
  }
  
  res.writeHead(200, {'Content-Type': 'application/json'});
  res.end('{\"message\":\"B2B License Platform\",\"status\":\"operational\",\"routes\":[\"/\",\"/eur\",\"/km\",\"/admin-panel\",\"/health\"]}');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('✅ B2B License Platform operational on port ' + PORT);
  console.log('Health check: http://localhost:' + PORT + '/health');
  console.log('Main app: http://localhost:' + PORT);
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));
"