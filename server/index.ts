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
  // Initialize monitoring systems first
  initializeSentry();
  
  await initializeDatabase();

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
  app.use(Handlers.requestHandler);
  app.use(Handlers.tracingHandler);
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

  // Sentry error handler must be after routes but before other error handlers
  const httpServer = await registerRoutes(app);
  
  // Add monitoring error handler before Sentry
  app.use(errorTrackingMiddleware);
  
  // Add Sentry error handler (if available)
  if (process.env.SENTRY_DSN) {
    app.use(Handlers.errorHandler);
  }

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    await setupVite(app, httpServer);
  }

  const port = 5000;
  httpServer.listen(port, "0.0.0.0", () => {
    log(`serving on port ${port}`);
  });
}

// Start the server
startServer().catch(console.error);