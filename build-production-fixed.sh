#!/bin/bash

echo "🔧 Fixed production build..."

# Create dist directory
mkdir -p dist

# Copy clean JavaScript version
echo "🔧 Copying clean JavaScript server..."
cp index.js dist/index.js

# Create ES module config
echo '{"type":"module"}' > dist/package.json

echo "✅ Fixed build completed!"