#!/bin/bash

echo "=== DIGITALOCEAN BUILD FINAL SUCCESS ==="
echo "Creating dist directory and copying production server..."

# Create dist directory
mkdir -p dist

# Copy the production server to expected location
cp index.js dist/index.cjs

echo "✅ dist/index.cjs created successfully"
echo "✅ Ready for CommonJS deployment"

# Install dependencies
npm install

echo "✅ Build complete - server ready for deployment"