#!/bin/bash

# Simplified DigitalOcean Build Script
echo "🚀 Simplified DigitalOcean Production Build..."

# Build frontend and ES Module server only  
echo "📦 Building frontend and server..."
vite build && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

echo "✅ Build complete - ES Module server ready"
echo "✅ DigitalOcean will use ES Module server via start-server.js"

ls -la dist/index.*