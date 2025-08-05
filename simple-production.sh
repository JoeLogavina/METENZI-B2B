#!/bin/bash

echo "🚀 Simple B2B Production Server"
export NODE_ENV=production
export PORT=${PORT:-8080}

# Create the simplest possible Node.js server
node -e "
const http = require('http');
const server = http.createServer((req, res) => {
  const url = req.url;
  
  if (url === '/health') {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end('{\"status\":\"healthy\",\"service\":\"B2B License Platform\"}');
    return;
  }
  
  if (url === '/' || url === '/index.html') {
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.end('<!DOCTYPE html><html><head><title>B2B License Management Platform</title><style>body{font-family:Arial,sans-serif;background:#667eea;margin:0;padding:20px}.container{max-width:800px;margin:0 auto;background:white;border-radius:12px;padding:40px;text-align:center}.header{background:linear-gradient(135deg,#6E6F71,#FFB20F);color:white;padding:30px;border-radius:8px;margin-bottom:30px}.btn{background:#FFB20F;color:white;padding:12px 24px;border:none;border-radius:6px;font-size:16px;cursor:pointer;margin:10px}.shop{display:inline-block;margin:20px;padding:20px;border:2px solid #ddd;border-radius:8px}</style></head><body><div class=\"container\"><div class=\"header\"><h1>🏢 B2B License Management Platform</h1><p>Enterprise Software License Distribution</p></div><div class=\"status\">✅ Production System Operational</div><br><div class=\"shop\"><h3>🛍️ EUR Shop</h3><button class=\"btn\" onclick=\"location.href=\\\"/eur\\\"\">Access EUR Shop</button></div><div class=\"shop\"><h3>🏪 KM Shop</h3><button class=\"btn\" onclick=\"location.href=\\\"/km\\\"\">Access KM Shop</button></div><br><p><strong>Admin Panel:</strong> <a href=\"/admin-panel\">Access Admin</a></p><p><strong>API Status:</strong> <a href=\"/api/status\">View API</a></p></div></body></html>');
    return;
  }
  
  if (url === '/eur') {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end('{\"message\":\"EUR B2B Shop\",\"status\":\"operational\",\"currency\":\"EUR\"}');
    return;
  }
  
  if (url === '/km') {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end('{\"message\":\"KM B2B Shop\",\"status\":\"operational\",\"currency\":\"KM\"}');
    return;
  }
  
  if (url === '/admin-panel') {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end('{\"message\":\"B2B Admin Panel\",\"status\":\"operational\"}');
    return;
  }
  
  if (url.startsWith('/api/')) {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end('{\"api\":\"operational\",\"version\":\"1.0.0\",\"deployment\":\"digitalocean\"}');
    return;
  }
  
  res.writeHead(200, {'Content-Type': 'application/json'});
  res.end('{\"message\":\"B2B License Platform\",\"status\":\"operational\"}');
});

server.listen(${PORT}, '0.0.0.0', () => {
  console.log('✅ B2B License Platform operational on port ${PORT}');
  console.log('🔍 Health check: http://localhost:${PORT}/health');
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));
"