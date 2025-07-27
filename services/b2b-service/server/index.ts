import express from 'express';
import { setupB2BAuth } from './auth';
import { registerB2BRoutes } from './routes';
import { setupVite } from './vite';

const PORT = process.env.B2B_PORT || 5002;
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
  res.json({ status: 'healthy', service: 'b2b-service', port: PORT });
});

async function startServer() {
  try {
    // Setup authentication
    setupB2BAuth(app);

    // Setup B2B routes
    const httpServer = registerB2BRoutes(app);

    // Setup Vite for development
    if (process.env.NODE_ENV === 'development') {
      await setupVite(app, httpServer);
    } else {
      // Serve static files in production
      app.use(express.static('dist/public'));
    }

    httpServer.listen(PORT, () => {
      console.log(`🚀 B2B Service running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start B2B service:', error);
    process.exit(1);
  }
}

startServer();