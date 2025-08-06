#!/bin/bash

echo "=== DIGITALOCEAN BUILD FINAL SUCCESS ==="
echo "Creating dist directory and copying production server..."

# Create dist directory
mkdir -p dist

# Copy the production server with proper CommonJS handling
cp index.js dist/index.cjs

# Create a simple redirection to the CommonJS version
cat > dist/index.js << 'EOF'
// DigitalOcean redirect to CommonJS version
const { spawn } = require('child_process');
const path = require('path');

console.log('🔄 Redirecting to CommonJS server...');
const server = spawn('node', [path.join(__dirname, 'index.cjs')], {
  stdio: 'inherit',
  env: process.env
});

server.on('exit', (code) => {
  console.log(`Server exited with code ${code}`);
  process.exit(code);
});
EOF

# Also create a package.json in dist to force CommonJS mode
cat > dist/package.json << 'EOF'
{
  "type": "commonjs"
}
EOF

echo "✅ dist/index.cjs created successfully"
echo "✅ Ready for CommonJS deployment"

# Install dependencies
npm install

echo "✅ Build complete - server ready for deployment"