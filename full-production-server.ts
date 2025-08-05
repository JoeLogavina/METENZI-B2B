// Complete B2B License Platform Production Server
// Includes all enterprise features: auth, database, routes, frontend serving

import express from 'express';
import compression from 'compression';
import { registerRoutes } from './server/routes';
import { initializeDatabase } from './server/startup/database-init';
import { initializeSentry } from './server/monitoring/sentry';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '8080', 10);
const NODE_ENV = process.env.NODE_ENV || 'production';

console.log('🚀 B2B License Platform - Complete Production Server');
console.log(`Environment: ${NODE_ENV}, Port: ${PORT}`);

async function startServer() {
  try {
    // Initialize monitoring systems first
    console.log('📊 Initializing monitoring systems...');
    initializeSentry();
    
    // Initialize database
    console.log('🗄️ Initializing database...');
    await initializeDatabase();

    // Compression middleware
    app.use(compression({ 
      filter: (req: any, res: any) => {
        if (req.headers['x-no-compression']) return false;
        return compression.filter(req, res);
      },
      threshold: 1024,
      level: 6,
    }));

    // Body parsing
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ extended: false }));

    // Serve static files
    app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

    // Register all B2B platform routes
    console.log('🔗 Registering application routes...');
    const server = await registerRoutes(app);

    // Serve frontend in production
    if (NODE_ENV === 'production') {
      console.log('🌐 Serving static frontend files...');
      app.use(express.static(path.join(__dirname, 'dist')));
      
      // Handle client-side routing
      app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, 'dist', 'index.html'));
      });
    }

    // Start the server
    server.listen(PORT, '0.0.0.0', () => {
      console.log('✅ B2B License Platform fully operational');
      console.log(`🌐 Application: http://localhost:${PORT}`);
      console.log(`🔍 Health check: http://localhost:${PORT}/health`);
      console.log(`📊 Admin panel: http://localhost:${PORT}/admin-panel`);
      console.log(`🛍️ EUR Shop: http://localhost:${PORT}/eur`);
      console.log(`🏪 KM Shop: http://localhost:${PORT}/km`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('📡 Received SIGTERM, shutting down gracefully');
      server.close(() => {
        console.log('✅ Server shutdown complete');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('📡 Received SIGINT, shutting down gracefully');
      server.close(() => {
        console.log('✅ Server shutdown complete');
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('❌ Failed to start B2B License Platform:', error);
    process.exit(1);
  }
}

// Start the server
startServer().catch(console.error);