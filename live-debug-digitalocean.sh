#!/bin/bash

echo "=== LIVE DIGITALOCEAN DEBUGGING SESSION ==="
echo "Timestamp: $(date)"
echo "Environment: ${NODE_ENV:-production}"
echo "Port: ${PORT:-8080}"

# Export essential environment variables
export NODE_ENV=production
export PORT=${PORT:-8080}

echo "Starting comprehensive debugging server..."

# Use exec to replace the shell process and ensure proper signal handling
exec node -e "
const http = require('http');
const PORT = parseInt(process.env.PORT || '8080', 10);
const HOST = '0.0.0.0';

console.log('=== LIVE DEBUGGING SESSION ACTIVE ===');
console.log('Port:', PORT);
console.log('Host:', HOST);
console.log('Node version:', process.version);
console.log('Environment:', process.env.NODE_ENV);
console.log('Process PID:', process.pid);
console.log('Available environment variables:');
console.log('- PORT:', process.env.PORT);
console.log('- NODE_ENV:', process.env.NODE_ENV);
console.log('- SESSION_SECRET:', process.env.SESSION_SECRET ? '[SET]' : '[NOT SET]');
console.log('- DATABASE_URL:', process.env.DATABASE_URL ? '[SET]' : '[NOT SET]');

const server = http.createServer((req, res) => {
  const requestUrl = req.url;
  const method = req.method;
  const timestamp = new Date().toISOString();
  const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';
  
  // Log EVERY request with maximum detail
  console.log('');
  console.log('=== INCOMING REQUEST ===');
  console.log('Time:', timestamp);
  console.log('Method:', method);
  console.log('URL:', requestUrl);
  console.log('Client IP:', clientIP);
  console.log('User Agent:', userAgent);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('========================');
  
  // Set comprehensive headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('X-Debug-Server', 'DigitalOcean-Live-Debug');
  res.setHeader('X-Debug-Timestamp', timestamp);
  res.setHeader('X-Debug-Port', PORT.toString());
  
  // Handle preflight requests
  if (method === 'OPTIONS') {
    console.log('RESPONSE: Sending OPTIONS preflight response');
    res.writeHead(200);
    res.end();
    return;
  }
  
  // Health checks with comprehensive debugging info
  if (requestUrl === '/health' || requestUrl === '/healthz' || requestUrl === '/ping' || requestUrl === '/status') {
    console.log('RESPONSE: Sending health check response');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      service: 'B2B License Management Platform - LIVE DEBUG',
      version: '1.0.0-debug',
      timestamp: timestamp,
      port: PORT,
      host: HOST,
      environment: process.env.NODE_ENV || 'production',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      process_pid: process.pid,
      request_details: {
        method: method,
        url: requestUrl,
        client_ip: clientIP,
        user_agent: userAgent
      },
      server_debug_info: {
        nodejs_version: process.version,
        platform: process.platform,
        architecture: process.arch,
        working_directory: process.cwd()
      },
      digitalocean_debug: {
        port_binding: '0.0.0.0:' + PORT,
        container_healthy: true,
        request_received: true,
        response_generated: true
      }
    }, null, 2));
    return;
  }
  
  // Root endpoint with extensive debugging
  if (requestUrl === '/' || requestUrl === '/index.html' || requestUrl === '/home') {
    console.log('RESPONSE: Sending main page with debug info');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    
    const debugHtml = '<!DOCTYPE html>' +
    '<html lang=en>' +
    '<head>' +
    '<meta charset=UTF-8>' +
    '<meta name=viewport content=\"width=device-width,initial-scale=1\">' +
    '<title>B2B Platform - LIVE DEBUG MODE</title>' +
    '<style>' +
    'body{font-family:Arial,sans-serif;margin:0;padding:20px;background:#f5f5f5;color:#333}' +
    '.debug-container{max-width:1000px;margin:0 auto;background:white;padding:30px;border-radius:10px;box-shadow:0 4px 6px rgba(0,0,0,0.1)}' +
    '.status-ok{background:#28a745;color:white;padding:15px;border-radius:5px;text-align:center;margin-bottom:20px;font-weight:bold}' +
    '.debug-section{background:#f8f9fa;padding:20px;margin:15px 0;border-radius:5px;border-left:4px solid #007bff}' +
    '.debug-section h3{margin:0 0 15px 0;color:#007bff}' +
    '.debug-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:15px;margin:15px 0}' +
    '.debug-item{background:white;padding:15px;border-radius:5px;border:1px solid #dee2e6}' +
    '.debug-label{font-weight:600;color:#495057;font-size:0.9rem}' +
    '.debug-value{color:#6c757d;font-size:1rem;margin-top:5px}' +
    '.test-links{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:20px 0}' +
    '.test-link{background:#007bff;color:white;padding:15px;text-align:center;text-decoration:none;border-radius:5px;font-weight:bold;transition:background 0.3s}' +
    '.test-link:hover{background:#0056b3;color:white}' +
    '.logs{background:#000;color:#00ff00;padding:20px;border-radius:5px;font-family:monospace;max-height:300px;overflow-y:auto;margin:20px 0}' +
    '</style>' +
    '</head>' +
    '<body>' +
    '<div class=debug-container>' +
    '<div class=status-ok>' +
    '✅ SERVER OPERATIONAL - DIGITALOCEAN DEPLOYMENT ACTIVE' +
    '</div>' +
    '<h1>🔍 B2B Platform - Live Debug Session</h1>' +
    '<p><strong>Status:</strong> Server is running successfully and responding to requests</p>' +
    '<div class=debug-section>' +
    '<h3>🌐 Server Information</h3>' +
    '<div class=debug-grid>' +
    '<div class=debug-item>' +
    '<div class=debug-label>Server Status</div>' +
    '<div class=debug-value>OPERATIONAL</div>' +
    '</div>' +
    '<div class=debug-item>' +
    '<div class=debug-label>Port</div>' +
    '<div class=debug-value>' + PORT + '</div>' +
    '</div>' +
    '<div class=debug-item>' +
    '<div class=debug-label>Host Binding</div>' +
    '<div class=debug-value>0.0.0.0 (External)</div>' +
    '</div>' +
    '<div class=debug-item>' +
    '<div class=debug-label>Node.js Version</div>' +
    '<div class=debug-value>' + process.version + '</div>' +
    '</div>' +
    '<div class=debug-item>' +
    '<div class=debug-label>Environment</div>' +
    '<div class=debug-value>' + (process.env.NODE_ENV || 'production') + '</div>' +
    '</div>' +
    '<div class=debug-item>' +
    '<div class=debug-label>Platform</div>' +
    '<div class=debug-value>' + process.platform + '</div>' +
    '</div>' +
    '</div>' +
    '</div>' +
    '<div class=debug-section>' +
    '<h3>📡 Request Information</h3>' +
    '<div class=debug-grid>' +
    '<div class=debug-item>' +
    '<div class=debug-label>Client IP</div>' +
    '<div class=debug-value>' + clientIP + '</div>' +
    '</div>' +
    '<div class=debug-item>' +
    '<div class=debug-label>Request Time</div>' +
    '<div class=debug-value>' + timestamp + '</div>' +
    '</div>' +
    '<div class=debug-item>' +
    '<div class=debug-label>Method</div>' +
    '<div class=debug-value>' + method + '</div>' +
    '</div>' +
    '<div class=debug-item>' +
    '<div class=debug-label>URL</div>' +
    '<div class=debug-value>' + requestUrl + '</div>' +
    '</div>' +
    '</div>' +
    '</div>' +
    '<div class=debug-section>' +
    '<h3>🧪 Test Endpoints</h3>' +
    '<div class=test-links>' +
    '<a href=/health class=test-link>Health Check</a>' +
    '<a href=/eur class=test-link>EUR Shop</a>' +
    '<a href=/km class=test-link>KM Shop</a>' +
    '<a href=/admin-panel class=test-link>Admin Panel</a>' +
    '<a href=/api/status class=test-link>API Status</a>' +
    '</div>' +
    '</div>' +
    '<div class=debug-section>' +
    '<h3>💡 Debugging Conclusions</h3>' +
    '<p><strong>✅ Server Starting:</strong> Confirmed working</p>' +
    '<p><strong>✅ Port Binding:</strong> Successfully bound to 0.0.0.0:' + PORT + '</p>' +
    '<p><strong>✅ Request Handling:</strong> This page loaded, proving requests work</p>' +
    '<p><strong>✅ HTML Rendering:</strong> Complete HTML response working</p>' +
    '<p><strong>If you see this page, the server is working perfectly.</strong></p>' +
    '<p><strong>Issue likely:</strong> DigitalOcean routing, DNS, or external access configuration.</p>' +
    '</div>' +
    '<div class=logs>' +
    '<strong>LIVE SERVER LOGS:</strong><br>' +
    'Server started at: ' + timestamp + '<br>' +
    'Listening on: 0.0.0.0:' + PORT + '<br>' +
    'Process ID: ' + process.pid + '<br>' +
    'Working Directory: ' + process.cwd() + '<br>' +
    'Request received and processed successfully<br>' +
    '✅ All systems operational' +
    '</div>' +
    '</div>' +
    '</body>' +
    '</html>';
    
    res.end(debugHtml);
    return;
  }
  
  // All other endpoints with debug logging
  console.log('RESPONSE: Sending JSON response for:', requestUrl);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    debug_mode: true,
    message: 'B2B License Management Platform - Live Debug',
    status: 'operational',
    requested_route: requestUrl,
    request_method: method,
    client_ip: clientIP,
    timestamp: timestamp,
    server_info: {
      port: PORT,
      host: HOST,
      nodejs_version: process.version,
      environment: process.env.NODE_ENV || 'production',
      uptime_seconds: process.uptime()
    },
    available_routes: [
      '/ - Debug interface',
      '/health - Health check',
      '/eur - EUR B2B Shop',
      '/km - KM B2B Shop', 
      '/admin-panel - Administration',
      '/api/* - API endpoints'
    ],
    debug_status: 'Server is working - if you see this, routing issue is external'
  }, null, 2));
});

// Enhanced error handling with detailed logging
server.on('error', (err) => {
  console.error('');
  console.error('❌ SERVER ERROR DETECTED ❌');
  console.error('Error message:', err.message);
  console.error('Error code:', err.code);
  console.error('Error stack:', err.stack);
  console.error('');
  
  if (err.code === 'EADDRINUSE') {
    console.error('PORT CONFLICT: Port ' + PORT + ' is already in use');
    console.error('This should not happen in DigitalOcean - investigating...');
    process.exit(1);
  } else if (err.code === 'EACCES') {
    console.error('PERMISSION ERROR: Cannot bind to port ' + PORT);
    console.error('This indicates a permissions issue');
    process.exit(1);
  } else {
    console.error('UNKNOWN ERROR: Exiting...');
    process.exit(1);
  }
});

server.on('clientError', (err, socket) => {
  console.error('CLIENT ERROR:', err.message);
  socket.end('HTTP/1.1 400 Bad Request\\r\\n\\r\\n');
});

server.on('listening', () => {
  console.log('');
  console.log('🔍 ===================================');
  console.log('🔍 LIVE DEBUG SESSION ACTIVE');
  console.log('🔍 ===================================');
  console.log('🌐 Server URL: http://' + HOST + ':' + PORT);
  console.log('🧪 Debug interface: http://' + HOST + ':' + PORT + '/');
  console.log('🔍 Health check: http://' + HOST + ':' + PORT + '/health');
  console.log('📊 Request logging: ENABLED');
  console.log('🔍 ===================================');
  console.log('');
  console.log('✅ Server successfully bound to ' + HOST + ':' + PORT);
  console.log('✅ Ready to receive and log all requests');
  console.log('✅ If you can see this, the server is working');
  console.log('');
  console.log('WAITING FOR REQUESTS...');
});

// Start the server with comprehensive logging
console.log('Attempting to bind server to ' + HOST + ':' + PORT + '...');
server.listen(PORT, HOST);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\\nReceived SIGTERM, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\\nReceived SIGINT, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

console.log('Debug server initialization complete');
"