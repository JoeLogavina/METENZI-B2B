#!/bin/bash

# Override package.json start script for DigitalOcean deployment
echo "=== DIGITALOCEAN PRODUCTION FIX ==="
echo "Overriding npm start to use production standalone server..."
echo "Timestamp: $(date)"

# Create a temporary package.json with correct start script
cp package.json package.json.backup
cat package.json | sed 's/"start": "NODE_ENV=production node dist\/index.js"/"start": "node start-production.js"/' > package.json.temp
mv package.json.temp package.json

echo "Updated package.json start script"
echo "Now starting the production server..."

# Start the production server directly
exec node start-production.js