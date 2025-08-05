#!/bin/bash

# Production startup script for DigitalOcean
# This replaces the problematic dist/index.js with direct TypeScript execution

echo "🚀 Starting B2B License Platform in production mode..."

# Set production environment
export NODE_ENV=production

# Check if tsx is available
if ! command -v npx &> /dev/null; then
    echo "❌ npx not found, installing tsx..."
    npm install -g tsx
fi

echo "✅ Starting server with TypeScript runtime..."

# Start the TypeScript server directly
exec npx tsx server/index.ts