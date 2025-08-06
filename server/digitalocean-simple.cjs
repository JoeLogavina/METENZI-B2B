const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';

// Basic middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Minimal security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// API endpoints with minimal functionality
app.get('/api/user', (req, res) => {
  res.json(null); // Not authenticated
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  // Simple authentication check
  if ((username === 'admin' && password === 'password123') ||
      (username === 'b2bkm' && password === 'password123') ||
      (username === 'munich_branch' && password === 'password123')) {
    res.json({ 
      success: true, 
      user: { 
        id: username === 'admin' ? 'admin-1' : username,
        username,
        role: username === 'admin' ? 'admin' : 'b2b_user'
      }
    });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

app.post('/api/logout', (req, res) => {
  res.json({ success: true });
});

// Products endpoint
app.get('/api/products', (req, res) => {
  res.json([
    {
      id: 'prod-1',
      name: 'Microsoft Office 365',
      category: 'Productivity',
      price: 99.99,
      currency: 'EUR',
      imageUrl: '/images/office365.jpg',
      description: 'Complete office suite'
    },
    {
      id: 'prod-2', 
      name: 'Adobe Creative Cloud',
      category: 'Design',
      price: 149.99,
      currency: 'EUR',
      imageUrl: '/images/adobe.jpg',
      description: 'Creative design tools'
    }
  ]);
});

// Static file serving - try multiple possible locations
const possibleStaticDirs = [
  path.join(__dirname, '..', 'dist', 'public'),
  path.join(__dirname, 'dist', 'public'),
  path.join(process.cwd(), 'dist', 'public'),
  path.join(__dirname, '..', 'public'),
  path.join(__dirname, 'public')
];

let staticDir = null;
for (const dir of possibleStaticDirs) {
  if (fs.existsSync(dir)) {
    staticDir = dir;
    console.log(`📁 Found static files at: ${dir}`);
    break;
  }
}

if (staticDir) {
  app.use(express.static(staticDir, {
    maxAge: '1d',
    etag: false
  }));
} else {
  console.warn('⚠️ No static directory found');
}

// Catch-all route for SPA
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }

  const indexPaths = [
    path.join(__dirname, '..', 'dist', 'public', 'index.html'),
    path.join(__dirname, 'dist', 'public', 'index.html'),
    path.join(process.cwd(), 'dist', 'public', 'index.html')
  ];

  for (const indexPath of indexPaths) {
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
  }

  res.status(404).send(`
    <!DOCTYPE html>
    <html>
    <head><title>B2B Platform</title></head>
    <body>
      <h1>B2B License Platform</h1>
      <p>Application loading...</p>
      <p>Health check: <a href="/health">/health</a></p>
    </body>
    </html>
  `);
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const server = app.listen(PORT, HOST, () => {
  console.log(`🚀 Simple B2B Platform running on http://${HOST}:${PORT}`);
  console.log(`🔍 Health check: http://${HOST}:${PORT}/health`);
  console.log(`📁 Static directory: ${staticDir || 'NOT FOUND'}`);
});

server.on('error', (err) => {
  console.error('❌ Server error:', err);
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('🔄 SIGTERM received, shutting down...');
  server.close(() => process.exit(0));
});