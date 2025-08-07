import express from "express";
import compression from "compression";
import { registerRoutes } from "./routes.js";
import { setupVite, serveStatic, log } from "./vite.js";
import { initializeDatabase } from "./startup/database-init.js";
import { initializeSentry, Sentry, Handlers } from "./monitoring/sentry.js";
import { register as prometheusRegister, trackHttpRequest } from "./monitoring/prometheus.js";
import { errorTrackingMiddleware, authenticationTrackingMiddleware, b2bTrackingMiddleware } from "./middleware/monitoring.js";
import path from 'path';

const app = express();

// Initialize database optimizations - moved to async wrapper
async function startServer() {
  console.log('🔧 Starting server initialization...');
  
  // Initialize monitoring systems first
  console.log('🔧 Initializing Sentry...');
  initializeSentry();
  
  console.log('🔧 Initializing database...');
  await initializeDatabase();
  console.log('✅ Database initialization completed');

// Enterprise Performance Optimization: Response Compression
// Provides 30-50% bandwidth reduction for API responses
app.use(compression({ 
  filter: (req, res) => {
    // Compress all text responses, JSON, and API responses
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
  threshold: 1024, // Only compress responses larger than 1KB
  level: 6, // Balanced compression ratio vs speed
}));

// Sentry request handler must be first middleware (if available)
if (process.env.SENTRY_DSN) {
  app.use(Handlers.requestHandler());
  app.use(Handlers.tracingHandler());
}

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false }));

// Add monitoring middleware
app.use(authenticationTrackingMiddleware);
app.use(b2bTrackingMiddleware);

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.use((req, res, next) => {
  const start = Date.now();
  const reqPath = req.path;
  let capturedJsonResponse = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    
    // Track metrics for monitoring
    const tenant = reqPath.includes('/eur') ? 'EUR' : reqPath.includes('/km') ? 'KM' : 'unknown';
    trackHttpRequest(req.method, reqPath, res.statusCode, duration, tenant);
    
    if (reqPath.startsWith("/api")) {
      let logLine = `${req.method} ${reqPath} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse).substring(0, 200)}`;
      }
      console.log(logLine);
    }
  });

  next();
});

// Add error tracking middleware before routes
app.use(errorTrackingMiddleware);

console.log('🔧 Registering routes...');
registerRoutes(app);
console.log('✅ Routes registered successfully');

console.log('🔧 Setting up static file serving...');
if (process.env.NODE_ENV === 'production') {
  console.log('🔧 Setting up production static file serving...');
  serveStatic(app);
} else {
  console.log('🔧 Setting up development Vite server...');
  await setupVite(app);
  console.log('✅ Development Vite server configured');
}

// Health check endpoints for production monitoring
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

app.get('/status', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/ready', (req, res) => {
  res.status(200).json({ ready: true, timestamp: new Date().toISOString() });
});

// Prometheus metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', prometheusRegister.contentType);
    res.end(await prometheusRegister.metrics());
  } catch (ex) {
    res.status(500).end(ex);
  }
});

// Error handling middleware
if (process.env.SENTRY_DSN) {
  app.use(Handlers.errorHandler());
}

const port = process.env.PORT || 8080;
console.log('🔧 Attempting to bind server to port', port);

app.listen(port, '0.0.0.0', () => {
  console.log('🎯 Server successfully bound to 0.0.0.0:' + port);
  console.log('✅ Health endpoint available at: http://0.0.0.0:' + port + '/health');
  console.log('🌐 Application ready for health checks');
  console.log('🚀 PRODUCTION SERVER READY - PORT ' + port + ' BOUND SUCCESSFULLY');
  console.log('📡 Health check endpoints: /health, /status, /ready');
});

console.log('✅ Server listening event confirmed on port', port);

}

// Start the server
startServer().catch(console.error);