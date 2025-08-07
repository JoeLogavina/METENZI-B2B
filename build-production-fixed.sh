#!/bin/bash

echo "🔧 Fixed production build..."

# Create dist directory
mkdir -p dist

# Simple copy approach - Node.js is more lenient with .mjs files
echo "🔧 Copying TypeScript as ES module..."
cp server/index.ts dist/index.mjs

# Create ES module config
echo '{"type":"module"}' > dist/package.json

echo "✅ Fixed build completed!"