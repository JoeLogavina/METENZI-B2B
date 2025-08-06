#!/bin/bash

echo "=== DIGITALOCEAN BUILD FINAL SUCCESS ==="
echo "Creating dist directory and copying production server..."

# Create dist directory
mkdir -p dist

# Copy the production server with proper CommonJS handling
cp index.js dist/index.cjs

# Create a proper ES module wrapper for index.js
cat > dist/index.js << 'EOF'
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

// Load and execute the CommonJS server
const fs = require('fs');
const serverCode = fs.readFileSync(path.join(__dirname, 'index.cjs'), 'utf8');
eval(serverCode);
EOF

echo "✅ dist/index.cjs created successfully"
echo "✅ Ready for CommonJS deployment"

# Install dependencies
npm install

echo "✅ Build complete - server ready for deployment"