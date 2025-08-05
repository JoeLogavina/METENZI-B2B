// Isolated production server - no Vite dependencies
import express from 'express';

// Environment setup
const PORT = parseInt(process.env.PORT || '8080', 10);
const NODE_ENV = process.env.NODE_ENV || 'production';

console.log('🚀 B2B License Platform - Isolated Production Server');
console.log(`Environment: ${NODE_ENV}, Port: ${PORT}`);

const app = express();

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    port: PORT
  });
});

// Basic status endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'B2B License Platform API',
    status: 'running',
    environment: NODE_ENV
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/health`);
});

export default app;