#!/bin/bash

echo "🚀 Setting up and starting B2B Microservices..."

# Set environment variables
export NODE_ENV=development
export INTERNAL_SERVICE_KEY=dev-service-key
export DATABASE_URL=$DATABASE_URL
export SESSION_SECRET=$SESSION_SECRET

# Setup node_modules for each service
echo "Setting up dependencies..."
cp -r ../node_modules admin-service/
cp -r ../node_modules b2b-service/
cp -r ../node_modules core-api-service/

# Start Core API Service
echo "Starting Core API Service on port 5003..."
cd core-api-service
PORT=5003 npx tsx server/index.ts &
CORE_PID=$!
cd ..

# Wait for Core API to start
echo "Waiting for Core API to initialize..."
sleep 10

# Start Admin Service
echo "Starting Admin Service on port 5001..."
cd admin-service
PORT=5001 npx tsx server/index.ts &
ADMIN_PID=$!
cd ..

# Start B2B Service
echo "Starting B2B Service on port 5002..."
cd b2b-service
PORT=5002 npx tsx server/index.ts &
B2B_PID=$!
cd ..

echo "✅ All services started!"
echo "- Admin Portal: http://localhost:5001"
echo "- B2B Portal: http://localhost:5002"
echo "- Core API: http://localhost:5003"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for all processes
wait $CORE_PID $ADMIN_PID $B2B_PID