#!/bin/bash

# SiteGround Deployment Script
# Run this script to prepare your application for SiteGround deployment

echo "🚀 Preparing B2B License Platform for SiteGround deployment..."

# Step 1: Clean previous builds
echo "📁 Cleaning previous builds..."
rm -rf dist/
rm -rf node_modules/

# Step 2: Install dependencies
echo "📦 Installing dependencies..."
npm install

# Step 3: Build the application
echo "🔨 Building application..."
npm run build

# Step 4: Create production structure
echo "📋 Creating production file structure..."
mkdir -p deploy/
cp -r dist/ deploy/
cp -r server/ deploy/
cp -r uploads/ deploy/ || mkdir -p deploy/uploads/
cp package.json deploy/
cp package-lock.json deploy/

# Step 5: Create .htaccess for SiteGround
echo "⚙️  Creating SiteGround configuration files..."
cat > deploy/.htaccess << 'EOF'
# SiteGround Node.js Application Configuration
RewriteEngine On

# Handle React Router
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ /index.html [QSA,L]

# Security headers
Header always set X-Content-Type-Options nosniff
Header always set X-Frame-Options DENY
Header always set X-XSS-Protection "1; mode=block"
Header always set Referrer-Policy "strict-origin-when-cross-origin"

# Cache control
<filesMatch "\.(css|js|png|jpg|jpeg|gif|ico|svg)$">
  ExpiresActive On
  ExpiresDefault "access plus 1 month"
</filesMatch>
EOF

# Step 6: Create startup script for SiteGround
cat > deploy/app.js << 'EOF'
// SiteGround Node.js Entry Point
// This file is required by SiteGround's Node.js hosting

import './dist/index.js';
EOF

# Step 7: Create production environment template
cat > deploy/.env.example << 'EOF'
# SiteGround Production Environment Variables
# Set these in cPanel Node.js Environment Variables section

NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://username:password@host:port/database
SESSION_SECRET=your-secure-session-secret-here
SENTRY_DSN=your-sentry-dsn-here

# Optional monitoring
ENABLE_PROMETHEUS=false
ENABLE_GRAFANA=false
EOF

# Step 8: Create deployment README
cat > deploy/DEPLOYMENT_README.md << 'EOF'
# SiteGround Deployment Files

## Upload these files to your SiteGround hosting:

1. Upload all files to `/public_html/your-app-name/`
2. Set Node.js startup file to: `app.js`
3. Configure environment variables in cPanel
4. Run "NPM Install" in cPanel Node.js interface
5. Start the application

## Required Environment Variables:
- NODE_ENV=production
- DATABASE_URL=your_postgresql_connection
- SESSION_SECRET=secure_random_string
- SENTRY_DSN=your_sentry_dsn

## File Structure:
- `app.js` - SiteGround startup file
- `dist/` - Built frontend files
- `server/` - Backend source code
- `uploads/` - File upload directory
- `package.json` - Node.js dependencies
EOF

echo "✅ Deployment preparation complete!"
echo ""
echo "📂 Files ready in ./deploy/ directory"
echo "📋 Next steps:"
echo "   1. Upload ./deploy/* to your SiteGround cPanel File Manager"
echo "   2. Configure Node.js app in cPanel (startup file: app.js)"
echo "   3. Set environment variables in cPanel"
echo "   4. Install dependencies and start the app"
echo ""
echo "📖 See SITEGROUND_DEPLOYMENT_GUIDE.md for detailed instructions"