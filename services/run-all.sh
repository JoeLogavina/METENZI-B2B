#!/bin/bash

# Run all microservices concurrently
echo "🚀 Starting B2B Microservices Architecture..."

# Export environment variables
export NODE_ENV=development
export INTERNAL_SERVICE_KEY=dev-service-key

# Start Core API Service
echo "Starting Core API Service on port 5003..."
cd core-api-service && npm run dev &
CORE_PID=$!

# Wait for Core API to start
sleep 5

# Start Admin Service
echo "Starting Admin Service on port 5001..."
cd ../admin-service && npm run dev &
ADMIN_PID=$!

# Start B2B Service
echo "Starting B2B Service on port 5002..."
cd ../b2b-service && npm run dev &
B2B_PID=$!

echo "✅ All services started!"
echo "- Admin Portal: http://localhost:5001"
echo "- B2B Portal: http://localhost:5002"
echo "- Core API: http://localhost:5003"

# Wait for all processes
wait $CORE_PID $ADMIN_PID $B2B_PID