#!/bin/bash

echo "🚀 Production Deployment Package Creator"
echo "======================================"

# Create deployment directory
mkdir -p production-deployment
cd production-deployment

# Copy production server file as index.js
cp ../production-session-fix.cjs index.js
echo "✅ Copied production-session-fix.cjs as index.js"

# Copy production package file as package.json  
cp ../package-production-fix.json package.json
echo "✅ Copied package-production-fix.json as package.json"

# Create deployment readme
cat > DEPLOYMENT_README.txt << 'EOF'
PRODUCTION DEPLOYMENT PACKAGE
============================

This package contains the complete production server replacement that fixes:
- MemoryStore session warnings 
- Authentication 401 errors
- Upload functionality 404 errors

FILES INCLUDED:
- index.js (production server with file-based sessions)
- package.json (production dependencies)

DEPLOYMENT STEPS:
1. Backup current production files:
   cp index.js index.js.backup
   cp package.json package.json.backup

2. Upload these files to replace existing:
   - index.js (replaces your current main server file)
   - package.json (replaces current package.json)

3. Install dependencies:
   npm install

4. Create directories:
   mkdir -p sessions uploads/products
   chmod 755 sessions uploads/products

5. Set environment variables:
   export SESSION_SECRET="your-secure-secret"
   export NODE_ENV="production"

6. Restart server:
   pkill -f node
   node index.js

CREDENTIALS (configured in server):
- admin / password123 (super_admin)
- b2bkm / password123 (b2b_user)  
- munich_branch / password123 (b2b_user)

ENDPOINTS FIXED:
- /api/admin/upload-image (image uploads)
- /api/admin/license-counts (license data)
- /api/login, /api/logout (authentication)
- /health (health check)

This will eliminate all MemoryStore warnings and restore full functionality.
EOF

echo "✅ Created deployment readme"

# Create environment template
cat > .env.production.template << 'EOF'
# Production Environment Variables
# Copy this to .env on production server

SESSION_SECRET=your-secure-session-secret-change-this
NODE_ENV=production
PORT=5000

# Optional: Database URL if using PostgreSQL
# DATABASE_URL=postgresql://user:pass@host:port/db
EOF

echo "✅ Created environment template"

# List deployment package contents
echo ""
echo "📦 Production Deployment Package Ready:"
echo "======================================="
ls -la
echo ""
echo "🎯 Upload these files to your production server:"
echo "   - index.js (replace existing)"
echo "   - package.json (replace existing)"
echo "   - .env.production.template (configure as .env)"
echo ""
echo "📋 Follow instructions in DEPLOYMENT_README.txt"
echo ""
echo "✅ Package created in: ./production-deployment/"