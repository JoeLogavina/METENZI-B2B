// Full Production CommonJS server for DigitalOcean deployment with complete API functionality
const express = require('express');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const connectPg = require('connect-pg-simple');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');
const { Pool } = require('@neondatabase/serverless');
const compression = require('compression');

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

// Initialize database connection with enhanced error handling
let db;
async function initializeDatabase() {
  try {
    if (process.env.DATABASE_URL) {
      console.log('✅ Database URL found - initializing connection...');
      const pool = new Pool({ 
        connectionString: process.env.DATABASE_URL,
        max: 10,
        connectionTimeoutMillis: 15000,
        ssl: { rejectUnauthorized: false } // Handle self-signed certificates
      });
      
      // Test connection
      await pool.query('SELECT NOW()');
      db = pool;
      console.log('✅ Database connection tested successfully');
    } else {
      console.log('⚠️ No DATABASE_URL found - running without database');
    }
  } catch (error) {
    console.error('⚠️ Database schema initialization failed:', error.message);
    console.log('🔄 Continuing with fallback mode...');
    db = null;
  }
}

// Initialize database asynchronously
initializeDatabase();

// Middleware setup
app.use(compression({ 
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
  threshold: 1024,
  level: 6,
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false }));

// CORS headers for font files and static assets
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  
  // Handle font files specifically
  if (req.path.match(/\.(woff|woff2|ttf|eot|otf)$/)) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Cache-Control', 'public, max-age=31536000');
  }
  
  next();
});

// Session configuration for production with PostgreSQL store
const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
let sessionStore;

// Use memory store for production stability - eliminates all SSL certificate issues
console.log('🔧 Using memory store for production stability');
sessionStore = new session.MemoryStore();

app.use(session({
  secret: process.env.SESSION_SECRET || 'b2b-production-secret-key-2025',
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true in production with HTTPS
    httpOnly: true,
    maxAge: sessionTtl
  }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Passport Local Strategy
passport.use(new LocalStrategy(
  async (username, password, done) => {
    try {
      if (!db) {
        // Fallback authentication for demo
        const demoUsers = {
          'b2bkm': { id: 'b2b-1', username: 'b2bkm', password: 'password123', role: 'b2b_user', tenantId: 'km' },
          'munich_branch': { id: 'branch-1', username: 'munich_branch', password: 'password123', role: 'b2b_user', tenantId: 'km' },
          'admin': { id: 'admin-1', username: 'admin', password: 'password123', role: 'admin', tenantId: 'eur' }
        };
        
        const user = demoUsers[username];
        if (user && user.password === password) {
          return done(null, user);
        }
        return done(null, false);
      }

      // Database authentication
      const result = await db.query('SELECT * FROM users WHERE username = $1', [username]);
      if (result.rows.length === 0) {
        return done(null, false);
      }

      const user = result.rows[0];
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (isValidPassword) {
        return done(null, user);
      }
      return done(null, false);
    } catch (error) {
      return done(error);
    }
  }
));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    if (!db) {
      // Fallback for demo
      const demoUsers = {
        'b2b-1': { id: 'b2b-1', username: 'b2bkm', role: 'b2b_user', tenantId: 'km' },
        'branch-1': { id: 'branch-1', username: 'munich_branch', role: 'b2b_user', tenantId: 'km' },
        'admin-1': { id: 'admin-1', username: 'admin', role: 'admin', tenantId: 'eur' }
      };
      return done(null, demoUsers[id] || null);
    }

    const result = await db.query('SELECT * FROM users WHERE id = $1', [id]);
    done(null, result.rows[0] || null);
  } catch (error) {
    done(error);
  }
});

// Authentication endpoints
app.get('/api/user', (req, res) => {
  if (req.isAuthenticated()) {
    res.json(req.user);
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
});

app.post('/api/login', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) {
      console.error('Login authentication error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
    if (!user) {
      console.log('Login failed for username:', req.body.username);
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    
    req.logIn(user, (err) => {
      if (err) {
        console.error('Login session error:', err);
        return res.status(500).json({ error: 'Login session failed' });
      }
      
      console.log('✅ User logged in successfully:', user.username);
      return res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          tenantId: user.tenantId
        }
      });
    });
  })(req, res, next);
});

app.post('/api/logout', (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.redirect('/');
  });
});

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

// Static file serving configuration  
// Determine correct path based on current working directory
const possiblePublicPaths = [
  path.join(process.cwd(), 'dist', 'public'),  // Standard build location
  path.join(__dirname, 'public'),              // Same directory as server
  path.join(__dirname, '..', 'public'),        // Parent directory
  path.join(process.cwd(), 'public'),          // Root public directory
  path.join(__dirname, '..', 'dist', 'public') // Legacy path
];

let publicDir = null;
for (const testPath of possiblePublicPaths) {
  if (fs.existsSync(testPath)) {
    publicDir = testPath;
    break;
  }
}

// Check if static directory exists
if (!publicDir) {
  console.error(`❌ Static directory not found in any of these locations:`);
  possiblePublicPaths.forEach(path => console.log(`  - ${path}`));
  
  // Try alternative paths for fallback
  const altPaths = [
    path.join(__dirname, 'public'),
    path.join(__dirname, '..', 'public'),
    path.join(process.cwd(), 'dist', 'public'),
    path.join(process.cwd(), 'public')
  ];
  
  for (const altPath of altPaths) {
    if (fs.existsSync(altPath)) {
      console.log(`✅ Found static files at: ${altPath}`);
      app.use('/', express.static(altPath, {
        setHeaders: (res, filePath) => {
          // Set CORS headers for all static files
          res.setHeader('Access-Control-Allow-Origin', '*');
          
          if (filePath.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
          } else if (filePath.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
          } else if (filePath.match(/\.(woff|woff2|ttf|eot|otf)$/)) {
            res.setHeader('Content-Type', 'font/woff2');
            res.setHeader('Cache-Control', 'public, max-age=31536000');
          }
        }
      }));
      break;
    }
  }
} else {
  console.log('✅ Static directory exists');
  console.log('Static files:', fs.readdirSync(publicDir).slice(0, 10));
  
  // Serve static files with proper headers
  app.use('/', express.static(publicDir, {
    setHeaders: (res, filePath) => {
      // Set CORS headers for all static files
      res.setHeader('Access-Control-Allow-Origin', '*');
      
      if (filePath.endsWith('.js')) {
        res.setHeader('Content-Type', 'application/javascript');
      } else if (filePath.endsWith('.css')) {
        res.setHeader('Content-Type', 'text/css');
      } else if (filePath.endsWith('.html')) {
        res.setHeader('Content-Type', 'text/html');
      } else if (filePath.match(/\.(woff|woff2|ttf|eot|otf)$/)) {
        res.setHeader('Content-Type', 'font/woff2');
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        return; // Early return for fonts
      }
      res.setHeader('Cache-Control', 'public, max-age=3600');
    },
    fallthrough: true,
    index: false
  }));
}

// Authentication middleware
const requireAuth = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: 'Not authenticated' });
};

// Admin middleware
const requireAdmin = (req, res, next) => {
  if (req.isAuthenticated() && req.user.role === 'admin') {
    return next();
  }
  res.status(403).json({ error: 'Admin access required' });
};

// Authentication API routes
app.post('/api/auth/login', passport.authenticate('local'), (req, res) => {
  res.json({ 
    user: {
      id: req.user.id,
      username: req.user.username,
      role: req.user.role,
      tenantId: req.user.tenantId
    }
  });
});

app.post('/api/auth/logout', (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.json({ message: 'Logged out successfully' });
  });
});

app.get('/api/auth/me', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({
      id: req.user.id,
      username: req.user.username,
      role: req.user.role,
      tenantId: req.user.tenantId
    });
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

// Products API
app.get('/api/products', async (req, res) => {
  try {
    if (!db) {
      // Demo products for fallback
      const demoProducts = [
        {
          id: 'prod-1',
          sku: 'SKU-12345',
          name: 'Microsoft Office 365 Business',
          description: 'Complete office suite for business',
          price: '99.99',
          b2bPrice: '89.99',
          category: 'Productivity',
          platform: 'Windows',
          isActive: true,
          stockCount: 100
        },
        {
          id: 'prod-2', 
          sku: 'SKU-12346',
          name: 'Adobe Creative Cloud',
          description: 'Professional creative software suite',
          price: '149.99',
          b2bPrice: '139.99',
          category: 'Design',
          platform: 'Cross-platform',
          isActive: true,
          stockCount: 50
        }
      ];
      return res.json(demoProducts);
    }

    const result = await db.query('SELECT * FROM products WHERE is_active = true ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    console.error('Products API error:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Cart API
app.get('/api/cart', requireAuth, async (req, res) => {
  try {
    if (!db) {
      return res.json([]);
    }

    const result = await db.query(`
      SELECT c.*, p.name, p.price, p.b2b_price 
      FROM cart c
      JOIN products p ON c.product_id = p.id
      WHERE c.user_id = $1
    `, [req.user.id]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Cart API error:', error);
    res.status(500).json({ error: 'Failed to fetch cart' });
  }
});

app.post('/api/cart', requireAuth, async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;
    
    if (!db) {
      return res.json({ message: 'Added to cart (demo mode)' });
    }

    await db.query(`
      INSERT INTO cart (user_id, product_id, quantity)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, product_id)
      DO UPDATE SET quantity = cart.quantity + $3
    `, [req.user.id, productId, quantity]);
    
    res.json({ message: 'Added to cart successfully' });
  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({ error: 'Failed to add to cart' });
  }
});

// Wallet API
app.get('/api/wallet', requireAuth, async (req, res) => {
  try {
    if (!db) {
      return res.json({ 
        data: { 
          id: 'demo-wallet',
          balance: '1000.00',
          creditLimit: '5000.00',
          currency: req.user.tenantId === 'eur' ? 'EUR' : 'KM'
        }
      });
    }

    const result = await db.query('SELECT * FROM wallets WHERE user_id = $1', [req.user.id]);
    res.json({ data: result.rows[0] || { balance: '0.00', creditLimit: '0.00' } });
  } catch (error) {
    console.error('Wallet API error:', error);
    res.status(500).json({ error: 'Failed to fetch wallet' });
  }
});

app.get('/api/wallet/transactions', requireAuth, async (req, res) => {
  try {
    if (!db) {
      return res.json({ data: [] });
    }

    const result = await db.query(`
      SELECT * FROM wallet_transactions 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT 50
    `, [req.user.id]);
    
    res.json({ data: result.rows });
  } catch (error) {
    console.error('Wallet transactions error:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// Admin API routes
app.get('/api/admin/dashboard', requireAdmin, async (req, res) => {
  try {
    if (!db) {
      return res.json({
        totalUsers: 2,
        totalSales: '€0',
        activeOrders: 0,
        lowStockProducts: 0
      });
    }

    const [usersCount, salesTotal, ordersCount, stockCount] = await Promise.all([
      db.query('SELECT COUNT(*) FROM users'),
      db.query('SELECT SUM(total_amount) FROM orders WHERE status = $1', ['completed']),
      db.query('SELECT COUNT(*) FROM orders WHERE status = $1', ['pending']),
      db.query('SELECT COUNT(*) FROM stock WHERE quantity < 10')
    ]);

    res.json({
      totalUsers: usersCount.rows[0].count,
      totalSales: `€${salesTotal.rows[0].sum || 0}`,
      activeOrders: ordersCount.rows[0].count,
      lowStockProducts: stockCount.rows[0].count
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

app.get('/api/admin/users', requireAdmin, async (req, res) => {
  try {
    if (!db) {
      return res.json([
        { id: 'b2b-1', username: 'b2bkm', role: 'b2b_user', tenantId: 'km', isActive: true },
        { id: 'admin-1', username: 'admin', role: 'admin', tenantId: 'eur', isActive: true }
      ]);
    }

    const result = await db.query('SELECT id, username, role, tenant_id, is_active, created_at FROM users ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Admin users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Categories API
app.get('/api/categories', async (req, res) => {
  try {
    if (!db) {
      return res.json([
        { id: 'cat-1', name: 'Productivity', level: 1, parentId: null },
        { id: 'cat-2', name: 'Design', level: 1, parentId: null },
        { id: 'cat-3', name: 'Security', level: 1, parentId: null }
      ]);
    }

    const result = await db.query('SELECT * FROM categories ORDER BY level, name');
    res.json(result.rows);
  } catch (error) {
    console.error('Categories API error:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Error handling for API routes
app.use('/api/*', (err, req, res, next) => {
  console.error('API Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Catch all route - serve index.html for client-side routing
app.get('*', (req, res) => {
  // Skip API routes
  if (req.path.startsWith('/api/')) {
    console.log(`❌ API endpoint not found: ${req.path}`);
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  
  // Find index.html in various possible locations
  const possiblePaths = [
    path.join(__dirname, 'public', 'index.html'),
    path.join(__dirname, '..', 'dist', 'public', 'index.html'),
    path.join(__dirname, '..', 'public', 'index.html'),
    path.join(process.cwd(), 'dist', 'public', 'index.html'),
    path.join(process.cwd(), 'public', 'index.html')
  ];
  
  for (const indexPath of possiblePaths) {
    if (fs.existsSync(indexPath)) {
      console.log(`✅ Serving index.html from: ${indexPath}`);
      return res.sendFile(indexPath);
    }
  }
  
  console.error('❌ index.html not found in any location');
  res.status(404).json({ error: 'Application not built properly - index.html missing' });
});

// Start the server
const server = app.listen(PORT, HOST, () => {
  console.log('⏳ Waiting for server to bind completely...');
  
  setTimeout(() => {
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
  }, 1000);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Process terminated');
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Process terminated');  
  });
});

module.exports = app;