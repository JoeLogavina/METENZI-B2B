#!/bin/bash

# Git Preparation Script for SiteGround Deployment
# This script prepares your repository for git-based deployment to SiteGround

echo "🔧 Preparing B2B License Platform for Git deployment to SiteGround..."

# Step 1: Check git status
echo "📊 Checking current git status..."
if [ -d ".git" ]; then
    echo "✅ Git repository detected"
else
    echo "❌ No git repository found. Initializing..."
    git init
    echo "✅ Git repository initialized"
fi

# Step 2: Create uploads directory structure
echo "📁 Creating upload directory structure..."
mkdir -p uploads
touch uploads/.gitkeep

# Step 3: Build the application
echo "🔨 Building application for production..."
npm run build

# Step 4: Create production environment file
echo "⚙️  Creating production environment template..."
cat > .env.production << 'EOF'
# Production Environment Variables for SiteGround
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://username:password@host:port/database
SESSION_SECRET=your-secure-session-secret-here
SENTRY_DSN=your-sentry-dsn-here
EOF

# Step 5: Update package.json for SiteGround compatibility
echo "📦 Ensuring SiteGround compatibility..."
# The package.json is already configured correctly

# Step 6: Add all necessary files to git
echo "➕ Adding files to git..."
git add .
git add .env.production
git add SITEGROUND_DEPLOYMENT_GUIDE.md
git add deploy-siteground.sh
git add prepare-git-deployment.sh

# Step 7: Check what will be committed
echo "📋 Files to be committed:"
git status --porcelain

# Step 8: Create commit
echo "💾 Creating commit..."
git commit -m "Prepare B2B License Platform for SiteGround production deployment

- Added SiteGround deployment guide and scripts
- Updated .gitignore for production deployment
- Built application for production
- Added environment configuration templates
- Configured Node.js entry points for SiteGround hosting
- Fixed Sentry integration for production monitoring
- Ready for git push to SiteGround repository"

echo ""
echo "✅ Repository prepared for SiteGround deployment!"
echo ""
echo "🚀 Next steps for SiteGround deployment:"
echo "   1. Push to your git repository:"
echo "      git push origin main"
echo ""
echo "   2. In SiteGround cPanel:"
echo "      - Go to Git tool"
echo "      - Connect your repository"
echo "      - Deploy to public_html/your-app-name"
echo ""
echo "   3. Configure Node.js in cPanel:"
echo "      - Create Node.js app"
echo "      - Set startup file: dist/index.js"
echo "      - Add environment variables from .env.production"
echo ""
echo "   4. Install dependencies and start:"
echo "      - Run 'NPM Install' in cPanel"
echo "      - Start the application"
echo ""
echo "📖 See SITEGROUND_DEPLOYMENT_GUIDE.md for detailed instructions"