import express from 'express';
import { setupAdminAuth } from './auth';
import { registerAdminRoutes } from './routes';
import { setupVite } from './vite';

const PORT = process.env.ADMIN_PORT || 5001;
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS configuration for microservices
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
  } else {
    next();
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'admin-service', port: PORT });
});

async function startServer() {
  try {
    // Setup authentication
    setupAdminAuth(app);

    // Setup admin routes
    const httpServer = registerAdminRoutes(app);

    // Setup Vite for development
    if (process.env.NODE_ENV === 'development') {
      await setupVite(app, httpServer);
    } else {
      // Serve static files in production
      app.use(express.static('dist/public'));
    }

    httpServer.listen(PORT, () => {
      console.log(`🚀 Admin Service running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start admin service:', error);
    process.exit(1);
  }
}

startServer();