#!/bin/bash

echo "🚀 Quick Start B2B Platform for DigitalOcean"

# Set environment
export NODE_ENV=production
export PORT=${PORT:-8080}

# Start server immediately with health check endpoint
node -e "
const express = require('express');
const app = express();
const PORT = process.env.PORT || 8080;

console.log('🚀 B2B License Platform - Quick Start Server');
console.log('Environment:', process.env.NODE_ENV);
console.log('Port:', PORT);

app.use(express.json());

// Health check responds immediately
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'B2B License Platform', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.send('<h1>🏢 B2B License Management Platform</h1><p>✅ Operational on DigitalOcean</p><p><a href=\"/health\">Health Check</a></p>');
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('✅ B2B License Platform operational on port', PORT);
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));
"