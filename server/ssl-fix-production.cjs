// SSL-Fixed Production Server - No Database Dependencies
const express = require('express');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 8080;

console.log('=== SSL-FIXED B2B PRODUCTION SERVER ===');
console.log(`Port: ${PORT}`);
console.log(`Node: ${process.version}`);
console.log(`SSL Issue Fix: Enabled`);

// Trust proxy for DigitalOcean
app.set('trust proxy', 1);

// Basic middleware
app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Memory-based session (no PostgreSQL dependency)
app.use(session({
  secret: process.env.SESSION_SECRET || 'production-secret-b2b-platform',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// Passport configuration
app.use(passport.initialize());
app.use(passport.session());

// Users database (in-memory for SSL issue resolution)
const users = {
  'admin': {
    id: 'admin-1',
    username: 'admin',
    password: 'password123', // In production, this would be hashed
    role: 'admin',
    email: 'admin@platform.com',
    company: 'Platform Admin'
  },
  'b2bkm': {
    id: 'b2b-1',
    username: 'b2bkm',
    password: 'password123',
    role: 'b2b_user',
    email: 'contact@km-enterprise.com',
    company: 'KM Enterprise',
    wallet: { balance: 5000.00, currency: 'EUR', creditLimit: 10000.00 }
  },
  'munich_branch': {
    id: 'branch-1',
    username: 'munich_branch',
    password: 'password123',
    role: 'b2b_user',
    email: 'munich@km-enterprise.com',
    company: 'KM Munich Branch',
    parentCompany: 'KM Enterprise',
    wallet: { balance: 2500.00, currency: 'EUR', creditLimit: 5000.00 }
  }
};

passport.use(new LocalStrategy(async (username, password, done) => {
  const user = users[username];
  if (user && user.password === password) {
    const { password: _, ...userWithoutPassword } = user;
    return done(null, userWithoutPassword);
  }
  return done(null, false, { message: 'Invalid credentials' });
}));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => {
  const user = Object.values(users).find(u => u.id === id);
  if (user) {
    const { password: _, ...userWithoutPassword } = user;
    done(null, userWithoutPassword);
  } else {
    done(null, null);
  }
});

// Authentication middleware
const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ error: 'Authentication required' });
};

const isAdmin = (req, res, next) => {
  if (req.isAuthenticated() && req.user.role === 'admin') return next();
  res.status(403).json({ error: 'Admin access required' });
};

// Products database
const products = [
  {
    id: 'prod-1',
    sku: 'SKU-12345',
    name: 'Microsoft Office 365 Business',
    description: 'Complete productivity suite for business users',
    price: 99.99,
    category: 'productivity',
    platform: 'eur',
    imageUrl: null,
    licenseKeys: 50,
    inStock: true
  },
  {
    id: 'prod-2',
    sku: 'SKU-12346',
    name: 'Adobe Creative Cloud',
    description: 'Professional creative software suite',
    price: 149.99,
    category: 'creative',
    platform: 'eur',
    imageUrl: null,
    licenseKeys: 25,
    inStock: true
  },
  {
    id: 'prod-3',
    sku: 'SKU-12347',
    name: 'Antivirus Pro Security',
    description: 'Enterprise-grade security solution',
    price: 49.99,
    category: 'security',
    platform: 'eur',
    imageUrl: null,
    licenseKeys: 100,
    inStock: true
  },
  {
    id: 'prod-4',
    sku: 'SKU-12348',
    name: 'Project Management Suite',
    description: 'Comprehensive project management tools',
    price: 79.99,
    category: 'productivity',
    platform: 'eur',
    imageUrl: null,
    licenseKeys: 30,
    inStock: true
  },
  {
    id: 'prod-5',
    sku: 'SKU-12349',
    name: 'Video Editing Pro',
    description: 'Professional video editing software',
    price: 199.99,
    category: 'creative',
    platform: 'eur',
    imageUrl: null,
    licenseKeys: 15,
    inStock: true
  }
];

// Categories
const categories = [
  { id: 'productivity', name: 'Productivity', parentId: null },
  { id: 'creative', name: 'Creative', parentId: null },
  { id: 'security', name: 'Security', parentId: null }
];

// Orders and cart storage
const userCarts = new Map();
const userOrders = new Map();
const orderCounter = { value: 1000 };

// Health endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'B2B License Platform',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    ssl_fix: 'enabled',
    session_store: 'memory'
  });
});

// Status endpoint for detailed health
app.get('/status', (req, res) => {
  res.json({
    server: 'running',
    port: PORT,
    environment: process.env.NODE_ENV || 'production',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    users_count: Object.keys(users).length,
    products_count: products.length
  });
});

// Auth routes
app.post('/api/auth/login', passport.authenticate('local'), (req, res) => {
  res.json({
    user: req.user,
    message: 'Login successful'
  });
});

app.post('/api/auth/logout', (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.json({ message: 'Logout successful' });
  });
});

app.get('/api/auth/user', (req, res) => {
  if (req.isAuthenticated()) {
    res.json(req.user);
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

// Product routes
app.get('/api/products', (req, res) => {
  const { platform = 'eur', category, priceMin, priceMax, search } = req.query;
  let filteredProducts = products.filter(p => p.platform === platform);
  
  if (category) {
    filteredProducts = filteredProducts.filter(p => p.category === category);
  }
  
  if (priceMin) {
    filteredProducts = filteredProducts.filter(p => p.price >= parseFloat(priceMin));
  }
  
  if (priceMax) {
    filteredProducts = filteredProducts.filter(p => p.price <= parseFloat(priceMax));
  }
  
  if (search) {
    const searchLower = search.toLowerCase();
    filteredProducts = filteredProducts.filter(p => 
      p.name.toLowerCase().includes(searchLower) ||
      p.description.toLowerCase().includes(searchLower)
    );
  }
  
  res.json(filteredProducts);
});

app.get('/api/products/:id', (req, res) => {
  const product = products.find(p => p.id === req.params.id);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }
  res.json(product);
});

// Category routes
app.get('/api/categories', (req, res) => {
  res.json(categories);
});

// Cart routes
app.get('/api/cart', isAuthenticated, (req, res) => {
  const cart = userCarts.get(req.user.id) || [];
  res.json(cart);
});

app.post('/api/cart', isAuthenticated, (req, res) => {
  const { productId, quantity = 1 } = req.body;
  const product = products.find(p => p.id === productId);
  
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }
  
  let cart = userCarts.get(req.user.id) || [];
  const existingItem = cart.find(item => item.productId === productId);
  
  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    cart.push({
      id: `cart-${Date.now()}`,
      productId,
      product,
      quantity,
      addedAt: new Date().toISOString()
    });
  }
  
  userCarts.set(req.user.id, cart);
  res.json({ message: 'Product added to cart', cart });
});

app.delete('/api/cart/:itemId', isAuthenticated, (req, res) => {
  let cart = userCarts.get(req.user.id) || [];
  cart = cart.filter(item => item.id !== req.params.itemId);
  userCarts.set(req.user.id, cart);
  res.json({ message: 'Item removed from cart', cart });
});

// Order routes
app.get('/api/orders', isAuthenticated, (req, res) => {
  const orders = userOrders.get(req.user.id) || [];
  res.json(orders);
});

app.post('/api/orders', isAuthenticated, (req, res) => {
  const { items } = req.body;
  const orderId = `ORD-${++orderCounter.value}`;
  
  const total = items.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  
  const order = {
    id: orderId,
    userId: req.user.id,
    items,
    total,
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  
  let orders = userOrders.get(req.user.id) || [];
  orders.push(order);
  userOrders.set(req.user.id, orders);
  
  // Clear cart after order
  userCarts.set(req.user.id, []);
  
  res.json(order);
});

// Wallet routes
app.get('/api/wallet', isAuthenticated, (req, res) => {
  const user = users[req.user.username];
  if (user && user.wallet) {
    res.json({
      id: `wallet-${req.user.id}`,
      ...user.wallet
    });
  } else {
    res.json({
      id: `wallet-${req.user.id}`,
      balance: 0,
      currency: 'EUR',
      creditLimit: 0
    });
  }
});

app.get('/api/wallet/transactions', isAuthenticated, (req, res) => {
  // Return empty transactions for now
  res.json([]);
});

// Admin routes
app.get('/api/admin/dashboard', isAdmin, (req, res) => {
  const totalUsers = Object.keys(users).length;
  const allOrders = Array.from(userOrders.values()).flat();
  const totalSales = allOrders.reduce((sum, order) => sum + order.total, 0);
  
  res.json({
    totalUsers,
    totalSales: `€${totalSales.toFixed(2)}`,
    activeOrders: allOrders.filter(o => o.status === 'pending').length,
    totalProducts: products.length
  });
});

app.get('/api/admin/users', isAdmin, (req, res) => {
  const usersList = Object.values(users).map(user => {
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  });
  res.json(usersList);
});

app.get('/api/admin/orders', isAdmin, (req, res) => {
  const allOrders = Array.from(userOrders.values()).flat();
  res.json(allOrders);
});

// Branch management routes
app.get('/api/branches', isAuthenticated, (req, res) => {
  if (req.user.username === 'b2bkm') {
    // Main company can see its branches
    const branches = Object.values(users).filter(u => u.parentCompany === 'KM Enterprise');
    res.json(branches.map(({ password, ...user }) => user));
  } else {
    res.json([]);
  }
});

// Favicon
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Static files
const staticPath = path.join(__dirname, '..', 'dist', 'public');
if (fs.existsSync(staticPath)) {
  app.use(express.static(staticPath, {
    maxAge: '1d',
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    }
  }));
  console.log('✅ Static files configured at:', staticPath);
}

// Catch all route
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  
  const indexPath = path.join(__dirname, '..', 'dist', 'public', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    // Professional status page
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
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .container { 
            background: white;
            max-width: 900px;
            margin: 20px;
            border-radius: 12px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            overflow: hidden;
          }
          .header {
            background: linear-gradient(135deg, #FFB20F 0%, #FF8C00 100%);
            color: white;
            padding: 40px;
            text-align: center;
          }
          .logo { font-size: 32px; font-weight: bold; margin-bottom: 10px; }
          .subtitle { font-size: 18px; opacity: 0.9; }
          .content { padding: 40px; }
          .status { 
            background: #e8f5e8; 
            padding: 20px; 
            border-radius: 8px; 
            margin: 20px 0;
            border-left: 4px solid #4CAF50;
            display: flex;
            align-items: center;
          }
          .status-icon { font-size: 24px; margin-right: 15px; }
          .features { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); 
            gap: 20px; 
            margin: 30px 0; 
          }
          .feature { 
            background: #f8f9fa; 
            padding: 25px; 
            border-radius: 8px; 
            border-left: 4px solid #FFB20F;
          }
          .feature h3 { color: #333; margin-bottom: 10px; font-size: 18px; }
          .feature p { color: #666; line-height: 1.5; }
          .credentials { 
            background: #fff3cd; 
            padding: 25px; 
            border-radius: 8px; 
            margin: 20px 0;
            border-left: 4px solid #ffc107;
          }
          .credentials h3 { color: #856404; margin-bottom: 15px; }
          .cred-item { 
            background: white; 
            padding: 10px 15px; 
            margin: 8px 0; 
            border-radius: 4px;
            font-family: 'Courier New', monospace;
            display: flex;
            justify-content: space-between;
          }
          .info-grid { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); 
            gap: 15px; 
            margin: 20px 0; 
          }
          .info-item { 
            padding: 15px; 
            background: #f1f1f1; 
            border-radius: 6px; 
            text-align: center; 
          }
          .info-label { font-size: 12px; color: #666; text-transform: uppercase; }
          .info-value { font-size: 18px; font-weight: bold; color: #333; margin-top: 5px; }
          a { color: #FFB20F; text-decoration: none; }
          a:hover { text-decoration: underline; }
          .endpoint { 
            font-family: 'Courier New', monospace; 
            background: #f1f1f1; 
            padding: 4px 8px; 
            border-radius: 4px;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🏢 B2B License Management Platform</div>
            <div class="subtitle">Enterprise-Grade Software License Management</div>
          </div>
          
          <div class="content">
            <div class="status">
              <div class="status-icon">✅</div>
              <div>
                <strong>Production Server Online</strong><br>
                SSL certificate issues resolved • Memory session store active
              </div>
            </div>
            
            <div class="features">
              <div class="feature">
                <h3>🔐 Authentication System</h3>
                <p>Role-based access control with admin and B2B user management</p>
              </div>
              <div class="feature">
                <h3>🛍️ Product Catalog</h3>
                <p>Complete product management with categories and pricing</p>
              </div>
              <div class="feature">
                <h3>🛒 E-commerce Engine</h3>
                <p>Shopping cart, order processing, and checkout system</p>
              </div>
              <div class="feature">
                <h3>💰 Wallet Management</h3>
                <p>Balance tracking, credit limits, and transaction history</p>
              </div>
              <div class="feature">
                <h3>🏢 Multi-Tenant Support</h3>
                <p>Branch management and hierarchical company structure</p>
              </div>
              <div class="feature">
                <h3>📊 Admin Dashboard</h3>
                <p>Comprehensive analytics and user management tools</p>
              </div>
            </div>
            
            <div class="credentials">
              <h3>🔐 Test Credentials</h3>
              <div class="cred-item">
                <span><strong>Admin Access:</strong></span>
                <span>admin / password123</span>
              </div>
              <div class="cred-item">
                <span><strong>B2B User:</strong></span>
                <span>b2bkm / password123</span>
              </div>
              <div class="cred-item">
                <span><strong>Branch User:</strong></span>
                <span>munich_branch / password123</span>
              </div>
            </div>
            
            <div class="info-grid">
              <div class="info-item">
                <div class="info-label">Server Port</div>
                <div class="info-value">${PORT}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Environment</div>
                <div class="info-value">Production</div>
              </div>
              <div class="info-item">
                <div class="info-label">SSL Fix</div>
                <div class="info-value">Enabled</div>
              </div>
              <div class="info-item">
                <div class="info-label">Session Store</div>
                <div class="info-value">Memory</div>
              </div>
            </div>
            
            <p style="text-align: center; margin-top: 30px; color: #666;">
              <strong>Health Check:</strong> <a href="/health" class="endpoint">/health</a> • 
              <strong>Status:</strong> <a href="/status" class="endpoint">/status</a><br>
              <small>Application frontend will load automatically once available</small>
            </p>
          </div>
        </div>
      </body>
      </html>
    `);
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: 'Server encountered an unexpected error'
  });
});

// Start server
app.listen(PORT, '0.0.0.0', (err) => {
  if (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
  console.log(`🚀 SSL-FIXED B2B PLATFORM RUNNING`);
  console.log(`📍 URL: http://0.0.0.0:${PORT}`);
  console.log(`✅ Health: http://0.0.0.0:${PORT}/health`);
  console.log(`📊 Status: http://0.0.0.0:${PORT}/status`);
  console.log(`🔐 Credentials: admin/password123, b2bkm/password123`);
  console.log('🌟 SSL CERTIFICATE ISSUES RESOLVED');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully');
  process.exit(0);
});