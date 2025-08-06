import express, { type Request, Response, NextFunction } from "express";
import compression from "compression";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initializeDatabase } from "./startup/database-init";
import { initializeSentry, Sentry, Handlers } from "./monitoring/sentry";
import { register as prometheusRegister, trackHttpRequest } from "./monitoring/prometheus";
import { errorTrackingMiddleware, authenticationTrackingMiddleware, b2bTrackingMiddleware } from "./middleware/monitoring";
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
  filter: (req: any, res: any) => {
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
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    
    // Track metrics for monitoring
    const tenant = path.includes('/eur') ? 'EUR' : path.includes('/km') ? 'KM' : 'unknown';
    trackHttpRequest(req.method, path, res.statusCode, duration, tenant);
    
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

  // Add Prometheus metrics endpoint
  app.get('/metrics', async (req, res) => {
    try {
      res.set('Content-Type', prometheusRegister.contentType);
      res.end(await prometheusRegister.metrics());
    } catch (error) {
      res.status(500).end(error);
    }
  });

  console.log('🔧 Registering routes...');
  // Sentry error handler must be after routes but before other error handlers
  const httpServer = await registerRoutes(app);
  console.log('✅ Routes registered successfully');
  
  // Add monitoring error handler before Sentry
  app.use(errorTrackingMiddleware);
  
  // Add Sentry error handler (if available)
  if (process.env.SENTRY_DSN) {
    app.use(Handlers.errorHandler());
  }
  
  console.log('🔧 Setting up static file serving...');

  if (process.env.NODE_ENV === "production") {
    console.log('🔧 Setting up production static file serving...');
    serveStatic(app);
    console.log('✅ Production static files configured');
  } else {
    console.log('🔧 Setting up development Vite server...');
    await setupVite(app, httpServer);
    console.log('✅ Development Vite server configured');
  }

  const port = parseInt(process.env.PORT || '8080', 10);
  console.log(`🔧 Attempting to bind server to port ${port}`);
  
  // Add comprehensive error handling for server startup
  httpServer.on('error', (err: any) => {
    console.error('❌ Server binding error:', err);
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ Port ${port} is already in use`);
    } else if (err.code === 'EACCES') {
      console.error(`❌ Permission denied to bind to port ${port}`);
    }
    process.exit(1);
  });

  return new Promise((resolve, reject) => {
    const server = httpServer.listen(port, "0.0.0.0", (error?: Error) => {
      if (error) {
        console.error('❌ Server listen callback error:', error);
        reject(error);
        return;
      }
      
      console.log(`🎯 Server successfully bound to 0.0.0.0:${port}`);
      console.log(`✅ Health endpoint available at: http://0.0.0.0:${port}/health`);
      console.log(`🌐 Application ready for health checks`);
      console.log(`🚀 PRODUCTION SERVER READY - PORT ${port} BOUND SUCCESSFULLY`);
      console.log(`📡 Health check endpoints: /health, /status, /ready`);
      log(`serving on port ${port}`);
      resolve(server);
    });

    server.on('listening', () => {
      console.log(`✅ Server listening event confirmed on port ${port}`);
    });
  });
}

// Start the server with enhanced error handling
startServer().catch((error) => {
  console.error('❌ CRITICAL: Server startup failed:', error);
  console.error('Stack trace:', error.stack);
  process.exit(1);
});