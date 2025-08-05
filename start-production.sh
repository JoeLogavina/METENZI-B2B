#!/bin/bash

echo "🚀 B2B License Platform - Production Start (Alternative Method)"

# Set environment variables
export NODE_ENV=production
export PORT=${PORT:-8080}

echo "Environment: NODE_ENV=$NODE_ENV, PORT=$PORT"

# Create temporary directory without vite config
mkdir -p /tmp/server
cp production-server.ts /tmp/server/
cp -r server /tmp/server/ 2>/dev/null || true
cp -r shared /tmp/server/ 2>/dev/null || true
cp package.json /tmp/server/
cd /tmp/server

# Install only production dependencies
echo "📦 Installing production dependencies..."
npm install --production

# Install tsx
npm install -g tsx

# Start server from clean directory
echo "🔧 Starting server from isolated environment..."
exec npx tsx production-server.ts