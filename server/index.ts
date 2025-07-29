import express, { type Request, Response, NextFunction } from "express";
import compression from "compression";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initializeDatabase } from "./startup/database-init";
import path from 'path';

const app = express();

// Initialize database optimizations
await initializeDatabase();

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

// Add request body debugging middleware BEFORE body parsing
app.use('/api/admin/products/*/pricing', (req, res, next) => {
  console.log('🔍 RAW REQUEST DEBUG:', {
    method: req.method,
    url: req.url,
    headers: req.headers,
    rawBody: req.body,
    timestamp: new Date().toISOString()
  });
  
  // Capture raw body for debugging
  let rawData = '';
  req.on('data', chunk => {
    rawData += chunk;
  });
  req.on('end', () => {
    console.log('🔍 RAW BODY DATA:', rawData);
  });
  
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false }));

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

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

const httpServer = await registerRoutes(app);

if (process.env.NODE_ENV === "production") {
  serveStatic(app);
} else {
  await setupVite(app, httpServer);
}

const port = 5000;
httpServer.listen(port, "0.0.0.0", () => {
  log(`serving on port ${port}`);
});