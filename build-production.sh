#!/bin/bash

# DigitalOcean Production Build Script
echo "🚀 Starting DigitalOcean Production Build..."

# Build frontend
echo "📦 Building frontend..."
vite build

# Build ES Module server (fallback)
echo "🔧 Building ES Module server..."
esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

# Build CommonJS server (preferred for DigitalOcean)
echo "🔧 Building CommonJS server..."
esbuild server/index.ts --platform=node --packages=external --bundle --format=cjs --outfile=dist/index.cjs

echo "✅ Build complete - both ES Module and CommonJS servers ready"
echo "✅ DigitalOcean will use CommonJS server (preferred)"

ls -la dist/index.*