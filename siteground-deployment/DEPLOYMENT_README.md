# SiteGround Deployment Package

## Ready for Upload to SiteGround

This directory contains your B2B License Management Platform ready for SiteGround deployment.

### File Structure:
```
siteground-deployment/
├── app.js                    # SiteGround Node.js startup file
├── dist/                     # Built frontend application
│   ├── index.js             # Compiled backend server
│   └── public/              # Static frontend assets
├── server/                   # Backend source code
├── uploads/                  # File upload directory
├── package.json             # Dependencies
├── package-lock.json        # Locked dependency versions
├── .env.production          # Environment variables template
├── .htaccess               # Apache configuration
└── DEPLOYMENT_README.md     # This file
```

## Deployment Steps:

### 1. Upload Files
Upload all files in this directory to your SiteGround hosting account via:
- Site Tools File Manager
- FTP/SFTP
- Git repository (if using SiteGround Git integration)

### 2. SiteGround Site Tools Configuration

#### Node.js Application Setup:
1. Login to SiteGround Site Tools dashboard
2. Navigate to "Dev" → "Node.js"
3. Create new application:
   - **Node.js Version**: 18.x or 20.x
   - **Application Mode**: Production
   - **Application Root**: `/public_html/your-app-name`
   - **Application URL**: your-domain.com
   - **Startup File**: `app.js`

#### Environment Variables:
Copy from `.env.production` and set in Site Tools:
```
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://your_credentials
SESSION_SECRET=your_secure_secret
SENTRY_DSN=your_sentry_dsn
```

### 3. Database Setup
1. Create PostgreSQL database in Site Tools
2. Update DATABASE_URL with your credentials
3. Import database schema if needed

### 4. Install & Start
1. Click "Install NPM Packages" in Site Tools Node.js
2. Click "Start App"
3. Monitor logs for any issues

## Production Features Ready:
- ✅ Multi-tenant B2B system (EUR/KM shops)
- ✅ Complete admin panel with monitoring
- ✅ Sentry error tracking
- ✅ Order processing and wallet system
- ✅ Role-based access control
- ✅ Enterprise monitoring dashboard

## Support:
- Check SITEGROUND_DEPLOYMENT_GUIDE.md for detailed instructions
- Monitor application logs in Site Tools for troubleshooting