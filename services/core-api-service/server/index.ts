import express from 'express';
import { registerCoreRoutes } from './routes';

const PORT = process.env.CORE_API_PORT || 5003;
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS configuration for internal microservices only
const allowedOrigins = [
  'http://localhost:5001', // Admin service
  'http://localhost:5002', // B2B service
];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Service-Auth');
  }
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
  } else {
    next();
  }
});

// Service authentication middleware
app.use((req, res, next) => {
  const serviceAuth = req.headers['x-service-auth'];
  if (!serviceAuth || serviceAuth !== process.env.INTERNAL_SERVICE_KEY) {
    return res.status(401).json({ error: 'Unauthorized service request' });
  }
  next();
});

// Health check endpoint (public)
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'core-api-service', port: PORT });
});

async function startServer() {
  try {
    // Setup core API routes
    const httpServer = registerCoreRoutes(app);

    httpServer.listen(PORT, () => {
      console.log(`🚀 Core API Service running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start Core API service:', error);
    process.exit(1);
  }
}

startServer();