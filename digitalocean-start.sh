#!/bin/bash

echo "🚀 DigitalOcean B2B License Platform - Ultimate Production Start"

# Set production environment
export NODE_ENV=production
export PORT=${PORT:-8080}

echo "Environment: NODE_ENV=$NODE_ENV, PORT=$PORT"

# Create a clean working directory
echo "📁 Creating clean startup environment..."
mkdir -p /tmp/b2b-production
cd /tmp/b2b-production

# Copy only essential files (NO vite.config.ts)
echo "📋 Copying essential files..."
cp ${PWD}/production-server.ts ./
cp ${PWD}/package.json ./ 2>/dev/null || true

# Create minimal package.json for production
cat > package.json << 'EOF'
{
  "name": "b2b-license-platform",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "express": "^4.18.2"
  }
}
EOF

# Install minimal dependencies
echo "📦 Installing minimal production dependencies..."
npm install

# Install tsx globally
echo "🔧 Installing tsx runtime..."
npm install -g tsx

# Start the isolated server
echo "🚀 Starting B2B License Platform..."
exec npx tsx production-server.ts