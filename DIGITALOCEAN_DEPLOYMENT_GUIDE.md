# DigitalOcean Deployment Guide - B2B License Platform

## Overview
This guide walks you through deploying your B2B License Management Platform to DigitalOcean using their App Platform service.

## Prerequisites
- DigitalOcean account
- Your Replit project files
- GitHub account (recommended for automated deployments)

## Deployment Options

### Option 1: DigitalOcean App Platform (Recommended)
**Best for:** Easy deployment, automatic scaling, managed database
**Cost:** ~$5-12/month for starter apps

### Option 2: DigitalOcean Droplet
**Best for:** Full control, custom configurations
**Cost:** ~$4-6/month for basic droplet + database

---

## METHOD 1: App Platform Deployment

### Step 1: Prepare Your Code Repository

1. **Push to GitHub:**
   - Download your Replit project as ZIP
   - Create new GitHub repository
   - Upload your project files to GitHub
   - Ensure these files are in the root:
     - `package.json`
     - `server/index.ts` or built version
     - Environment configuration

### Step 2: Create App Platform Application

1. **Login to DigitalOcean:**
   - Go to [cloud.digitalocean.com](https://cloud.digitalocean.com)
   - Navigate to "Apps" in the sidebar

2. **Create New App:**
   - Click "Create App"
   - Choose "GitHub" as source
   - Connect your GitHub account
   - Select your repository
   - Choose branch (usually `main` or `master`)

### Step 3: Configure Build Settings

1. **App Configuration:**
   ```
   Name: b2b-license-platform
   Region: Choose closest to your users
   Plan: Basic ($5/month to start)
   ```

2. **Build Settings:**
   ```
   Build Command: npm run build
   Run Command: npm start
   Output Directory: dist (if using build process)
   ```

3. **Environment Variables:**
   Add these in the App Platform interface:
   ```
   NODE_ENV=production
   PORT=8080
   DATABASE_URL=postgresql://username:password@host:port/database
   SESSION_SECRET=your_secure_session_secret_here
   SENTRY_DSN=your_sentry_dsn_if_available
   ```

### Step 4: Database Setup

1. **Create Managed Database:**
   - In DigitalOcean, go to "Databases"
   - Click "Create Database Cluster"
   - Choose PostgreSQL
   - Select plan (Basic $15/month for starter)
   - Choose same region as your app

2. **Configure Database Connection:**
   - Copy the connection string from database dashboard
   - Update `DATABASE_URL` in your app's environment variables

### Step 5: Deploy and Test

1. **Deploy:**
   - Click "Create Resources" in App Platform
   - Wait for deployment (5-10 minutes)
   - Check build logs for any errors

2. **Test Application:**
   - Access your app URL (provided after deployment)
   - Test login with: admin/password123
   - Verify B2B functionality works

---

## METHOD 2: Droplet Deployment

### Step 1: Create Droplet

1. **Create New Droplet:**
   - Choose Ubuntu 22.04 LTS
   - Basic plan: $4-6/month
   - Choose datacenter region
   - Add SSH key or password access

### Step 2: Initial Server Setup

1. **Connect via SSH:**
   ```bash
   ssh root@your_droplet_ip
   ```

2. **Install Node.js:**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   sudo apt-get install -y nginx
   ```

3. **Install PostgreSQL:**
   ```bash
   sudo apt update
   sudo apt install postgresql postgresql-contrib
   sudo systemctl start postgresql
   sudo systemctl enable postgresql
   ```

### Step 3: Deploy Application

1. **Upload Your Files:**
   - Use SCP, SFTP, or Git to upload your project
   - Extract to `/var/www/b2b-platform/`

2. **Install Dependencies:**
   ```bash
   cd /var/www/b2b-platform
   npm install --production
   npm run build
   ```

3. **Configure Environment:**
   ```bash
   sudo nano .env.production
   ```
   Add your environment variables

### Step 4: Setup Process Manager

1. **Install PM2:**
   ```bash
   sudo npm install -g pm2
   ```

2. **Start Application:**
   ```bash
   pm2 start dist/index.js --name b2b-platform
   pm2 startup
   pm2 save
   ```

### Step 5: Configure Nginx

1. **Create Nginx Configuration:**
   ```bash
   sudo nano /etc/nginx/sites-available/b2b-platform
   ```

2. **Add Configuration:**
   ```nginx
   server {
       listen 80;
       server_name your_domain.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

3. **Enable Site:**
   ```bash
   sudo ln -s /etc/nginx/sites-available/b2b-platform /etc/nginx/sites-enabled/
   sudo systemctl restart nginx
   ```

---

## Post-Deployment Configuration

### SSL Certificate (Let's Encrypt)
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your_domain.com
```

### Database Migration
1. Connect to your database
2. Run any necessary migrations
3. Import initial data if needed

### Monitoring Setup
- Configure Sentry for error tracking
- Set up DigitalOcean monitoring alerts
- Monitor application logs

---

## Cost Estimation

### App Platform (Recommended):
- App: $5-12/month
- Database: $15/month  
- **Total: ~$20-27/month**

### Droplet Method:
- Droplet: $4-6/month
- Managed Database: $15/month
- **Total: ~$19-21/month**

---

## Troubleshooting

**Build Failures:**
- Check Node.js version compatibility
- Verify all dependencies in package.json
- Check build logs in App Platform

**Database Connection Issues:**
- Verify DATABASE_URL format
- Check database firewall settings
- Ensure database is in same region

**Application Won't Start:**
- Check environment variables
- Verify port configuration (8080 for App Platform)
- Review application logs

---

## Support Resources
- [DigitalOcean Documentation](https://docs.digitalocean.com/)
- [App Platform Guides](https://docs.digitalocean.com/products/app-platform/)
- [Community Tutorials](https://www.digitalocean.com/community/tutorials)

Your B2B License Management Platform will be production-ready with automatic SSL, scaling, and monitoring on DigitalOcean!