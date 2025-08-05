#!/bin/bash

echo "🚀 B2B License Platform - Direct Production Start"

# Set environment variables for production
export NODE_ENV=production
export PORT=${PORT:-8080}

echo "Environment: NODE_ENV=$NODE_ENV, PORT=$PORT"

# Install tsx if not available
echo "📦 Ensuring tsx is available..."
npm list -g tsx > /dev/null 2>&1 || npm install -g tsx

# Start the server directly
echo "🔧 Starting TypeScript server..."
exec npx tsx server/index.ts