#!/bin/bash

# Production Build Script for DigitalOcean
echo "🔧 Starting DigitalOcean production build..."

# Create dist directory
mkdir -p dist

# Install missing build dependencies globally to ensure availability
echo "🔧 Installing build dependencies globally..."
npm install -g @vitejs/plugin-react@latest vite@latest esbuild@latest typescript@latest

# Also install locally to be safe
npm install @vitejs/plugin-react@latest vite@latest esbuild@latest typescript@latest

# Build frontend with inline config to avoid import issues
echo "🔧 Building frontend..."
cat > vite.config.inline.mjs << 'EOF'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client/src'),
      '@assets': path.resolve(__dirname, './attached_assets'),
      '@shared': path.resolve(__dirname, './shared')
    }
  },
  root: './client',
  publicDir: '../public'
})
EOF

vite build --config vite.config.inline.mjs

# Build backend
echo "🔧 Building backend..."
esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

# Create ES module config
echo "🔧 Creating package.json for ES modules..."
echo '{"type":"module"}' > dist/package.json

echo "✅ DigitalOcean build completed successfully!"