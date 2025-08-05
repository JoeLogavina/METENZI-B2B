# Step-by-Step SiteGround Deployment Guide

## PART 1: Download Your Files from Replit

### Step 1: Download the Deployment Package
1. In your Replit workspace, look for the file `siteground-deployment.tar.gz` in the main directory
2. Right-click on `siteground-deployment.tar.gz`
3. Select "Download" from the menu
4. Save the file to your computer (747KB)

### Step 2: Extract the Files
1. On your computer, find the downloaded `siteground-deployment.tar.gz` file
2. Extract it using:
   - **Windows**: Right-click → "Extract All" or use 7-Zip/WinRAR
   - **Mac**: Double-click the file to extract
   - **Linux**: Run `tar -xzf siteground-deployment.tar.gz`
3. You'll get a folder with these files:
   ```
   siteground-deployment/
   ├── app.js                    # Main startup file
   ├── dist/                     # Built application
   ├── server/                   # Backend code
   ├── uploads/                  # File storage
   ├── package.json             # Dependencies
   ├── .env.production          # Environment setup
   ├── .htaccess               # Web server config
   └── DEPLOYMENT_README.md     # Instructions
   ```

## PART 2: Prepare Your SiteGround Account

### Step 3: Access SiteGround Site Tools
1. Go to your SiteGround account at [siteground.com](https://siteground.com)
2. Log in to your account
3. Click on your hosting plan
4. Click "Site Tools" button to open the dashboard

### Step 4: Create Database (If Needed)
1. In Site Tools, go to "Site" → "MySQL"
2. Click "Create Database"
3. Enter database name (example: `b2b_platform`)
4. Create a database user with full permissions
5. **Write down**: Database name, username, password, and host

## PART 3: Upload Your Application

### Step 5: Upload Files via File Manager
1. In Site Tools, go to "Site" → "File Manager"
2. Navigate to your domain folder (usually `public_html/your-domain.com`)
3. Create a new folder for your app (example: `b2b-platform`)
4. Enter that folder
5. Upload ALL files from your extracted `siteground-deployment` folder:
   - Select all files from the extracted folder
   - Drag and drop them into the File Manager
   - Wait for upload to complete

### Step 6: Set File Permissions
1. In File Manager, select the `uploads` folder
2. Right-click → "Change Permissions"
3. Set to 755 or 775 (read, write, execute for owner)

## PART 4: Configure Node.js Application

### Step 7: Create Node.js App
1. In Site Tools, go to "Dev" → "Node.js"
2. Click "Create Application"
3. Fill in the details:
   - **Node.js Version**: 18.x or 20.x
   - **Application Mode**: Production
   - **Application Root**: `/public_html/your-domain.com/b2b-platform`
   - **Application URL**: `your-domain.com/b2b` (or your preferred path)
   - **Startup File**: `app.js`
4. Click "Create"

### Step 8: Set Environment Variables
1. In the Node.js app settings, find "Environment Variables"
2. Add these variables one by one:

   **Required Variables:**
   ```
   NODE_ENV = production
   PORT = 3000
   DATABASE_URL = postgresql://username:password@host:5432/database_name
   SESSION_SECRET = your_very_secure_random_string_here
   ```

   **Optional (for monitoring):**
   ```
   SENTRY_DSN = your_sentry_project_dsn_if_you_have_one
   ```

3. For `DATABASE_URL`, replace with your actual database details from Step 4
4. For `SESSION_SECRET`, use a long random string (at least 32 characters)

### Step 9: Install Dependencies
1. In the Node.js app interface, click "Install NPM Packages"
2. Wait for installation to complete (may take 2-3 minutes)
3. Check for any error messages

## PART 5: Start Your Application

### Step 10: Launch the App
1. In the Node.js interface, click "Start App"
2. Wait for the status to change to "Running"
3. If there are errors, check the logs by clicking "Show Logs"

### Step 11: Test Your Application
1. Visit your application URL (from Step 7)
2. You should see the login page
3. Test with these accounts:
   - **Admin**: username `admin`, password `password123`
   - **B2B User**: username `b2bkm`, password `password123`

## PART 6: Import Database (If Starting Fresh)

### Step 12: Database Setup
1. If you need to import your database:
   - In Site Tools, go to "Site" → "phpPgAdmin" (for PostgreSQL)
   - Connect using your database credentials
   - Import your database schema/data if you have a backup

### Step 13: Run Database Migrations
1. If your app includes database migrations:
   - In Site Tools Node.js, open the terminal/console
   - Run: `npm run db:push` (if available)
   - Check logs for any errors

## TROUBLESHOOTING

### Common Issues:

**App Won't Start:**
- Check environment variables are set correctly
- Verify DATABASE_URL format: `postgresql://user:pass@host:port/dbname`
- Check file permissions on uploads folder

**Database Connection Failed:**
- Verify database credentials
- Ensure database exists and user has permissions
- Check if PostgreSQL is enabled on your hosting plan

**File Upload Issues:**
- Set uploads folder permissions to 755 or 775
- Check disk space availability

**Need Help:**
- Check application logs in Site Tools Node.js interface
- Contact SiteGround support for hosting-specific issues
- Refer to `DEPLOYMENT_README.md` in your uploaded files

## SUCCESS CHECKLIST

✅ Files uploaded to SiteGround
✅ Node.js application created
✅ Environment variables set
✅ Dependencies installed
✅ Application started and running
✅ Database connected
✅ Login page accessible
✅ Admin and B2B accounts working

Your B2B License Management Platform is now live on SiteGround!