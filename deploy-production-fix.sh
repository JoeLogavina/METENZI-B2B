#!/bin/bash

echo "🚀 Emergency Production Upload Fix Deployment"
echo "=============================================="

# Create production-ready version of the upload endpoints
echo "📦 Creating production upload server..."

# Make production upload fix executable
chmod +x production-upload-fix.js

# Create package.json for emergency server if it doesn't exist
if [ ! -f "package-emergency.json" ]; then
cat > package-emergency.json << 'EOF'
{
  "name": "emergency-upload-server",
  "version": "1.0.0",
  "description": "Emergency server for production upload fixes",
  "main": "production-upload-fix.js",
  "scripts": {
    "start": "node production-upload-fix.js",
    "emergency": "node production-upload-fix.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "multer": "^1.4.5-lts.1"
  }
}
EOF
echo "✅ Created emergency package.json"
fi

# Install dependencies for emergency server
echo "📦 Installing emergency server dependencies..."
npm install --production express multer

# Create uploads directory
mkdir -p uploads/products
chmod 755 uploads/products
echo "✅ Created uploads directory with proper permissions"

# Test emergency server locally first
echo "🧪 Testing emergency server locally..."
timeout 5s node production-upload-fix.js &
SERVER_PID=$!
sleep 2

# Test health endpoint
if curl -s http://localhost:5000/health > /dev/null; then
    echo "✅ Emergency server health check passed"
else
    echo "❌ Emergency server health check failed"
fi

# Kill test server
kill $SERVER_PID 2>/dev/null || true

echo ""
echo "🎯 Emergency Production Deployment Instructions:"
echo "================================================"
echo ""
echo "1. Upload this emergency server to your production environment:"
echo "   - production-upload-fix.js"
echo "   - package-emergency.json"
echo ""
echo "2. On production server, run:"
echo "   npm install express multer"
echo "   mkdir -p uploads/products"
echo "   chmod 755 uploads/products"
echo ""
echo "3. Start emergency server:"
echo "   node production-upload-fix.js"
echo ""
echo "4. Test the upload endpoints:"
echo "   curl -X POST https://your-domain.com/api/admin/upload-image -F 'image=@test.png'"
echo "   curl https://your-domain.com/api/admin/license-counts"
echo ""
echo "📍 The emergency server provides:"
echo "   ✅ Multiple upload routes: /api/admin/upload-image, /api/images/upload, /api/upload-image-fallback"
echo "   ✅ License counts endpoint: /api/admin/license-counts"
echo "   ✅ CSRF token endpoint: /api/csrf-token"
echo "   ✅ Health check: /health"
echo "   ✅ Static file serving: /uploads/*"
echo ""
echo "🔧 For DigitalOcean App Platform:"
echo "   - Set build command: 'npm install express multer'"
echo "   - Set run command: 'node production-upload-fix.js'"
echo "   - Ensure PORT environment variable is available"
echo ""
echo "⚡ This emergency server has minimal dependencies and maximum compatibility!"