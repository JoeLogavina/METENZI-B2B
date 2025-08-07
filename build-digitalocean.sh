#!/bin/bash

# Production Build Script for DigitalOcean
echo "🔧 Starting DigitalOcean production build..."

# Install missing build dependencies
echo "🔧 Installing build dependencies..."
npm install @vitejs/plugin-react vite esbuild typescript @types/node

# Build frontend with production config
echo "🔧 Building frontend..."
npx vite build --config vite.config.production.ts

# Build backend
echo "🔧 Building backend..."
npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

# Create ES module config
echo "🔧 Creating package.json for ES modules..."
echo '{"type":"module"}' > dist/package.json

# Copy static assets if they exist
if [ -d "public" ]; then
    echo "🔧 Copying static assets..."
    cp -r public/* dist/client/ 2>/dev/null || true
fi

echo "✅ DigitalOcean build completed successfully!"