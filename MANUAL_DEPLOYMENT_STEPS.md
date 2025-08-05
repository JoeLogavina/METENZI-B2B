# Manual SiteGround Deployment Steps

## Quick Deployment Checklist

### 1. Prepare Repository
```bash
# Run the preparation script
./prepare-git-deployment.sh

# Or manually:
npm install
npm run build
git add .
git commit -m "Prepare for production deployment"
git push origin main
```

### 2. SiteGround cPanel Setup

#### A. Git Repository Connection
1. Login to SiteGround cPanel
2. Find "Git" tool in cPanel
3. Click "Create Repository" or "Connect Repository"
4. Enter your repository URL
5. Set deploy path: `/public_html/your-app-name`
6. Deploy the repository

#### B. Node.js Application Setup
1. Go to "Node.js" in cPanel
2. Click "Create Application"
3. Configure:
   - **Node.js Version**: 18.x or 20.x
   - **Application Mode**: Production
   - **Application Root**: `/public_html/your-app-name`
   - **Application URL**: your-domain.com (or subdomain)
   - **Startup File**: `dist/index.js`

#### C. Environment Variables
In Node.js app settings, add these environment variables:
```
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://your_db_credentials
SESSION_SECRET=your_secure_random_string
SENTRY_DSN=your_sentry_dsn_if_available
```

#### D. Database Setup
1. Create PostgreSQL database in cPanel
2. Note the connection details
3. Update DATABASE_URL with your credentials
4. Import your database schema if needed

### 3. Install Dependencies & Start
1. In Node.js app interface, click "Run NPM Install"
2. Wait for installation to complete
3. Click "Start Application"
4. Monitor logs for any errors

### 4. Verify Deployment
- Visit your domain to test the frontend
- Check `/api/health` endpoint
- Test login functionality
- Verify database connectivity

## Troubleshooting Common Issues

### App Won't Start
- Check Node.js logs in cPanel
- Verify startup file path: `dist/index.js`
- Ensure all environment variables are set
- Check database connection string

### Frontend Not Loading
- Verify files deployed correctly
- Check if `.htaccess` rules are applied
- Ensure `dist/` directory contains built files

### Database Connection Issues
- Double-check DATABASE_URL format
- Test database credentials in cPanel
- Ensure PostgreSQL service is running

### Permission Issues
- Set directory permissions to 755
- Set file permissions to 644
- Ensure Node.js app has read/write access

## Support
- Check SiteGround Node.js documentation
- Monitor application logs in cPanel
- Test locally first to isolate issues