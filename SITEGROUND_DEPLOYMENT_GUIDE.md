# SiteGround Deployment Guide

## Prerequisites
- SiteGround hosting account with Node.js support
- Git repository access
- cPanel access for configuration

## Deployment Steps

### 1. Repository Preparation
```bash
# Clone the repository to your local machine
git clone <your-repo-url>
cd <project-directory>

# Install dependencies (for build process)
npm install

# Build the application
npm run build
```

### 2. SiteGround cPanel Configuration

#### Node.js Setup:
1. Log into SiteGround cPanel
2. Navigate to "Node.js"
3. Create new Node.js app:
   - Node.js version: 18.x or higher
   - Application mode: Production
   - Application root: `/public_html/your-app-name`
   - Application URL: your-domain.com (or subdomain)
   - Application startup file: `server/index.js`

#### Environment Variables:
Set these in cPanel Node.js environment variables:
```
NODE_ENV=production
DATABASE_URL=your_postgresql_connection_string
SENTRY_DSN=your_sentry_dsn
SESSION_SECRET=your_secure_session_secret
PORT=3000
```

### 3. Database Setup
- Create PostgreSQL database in cPanel
- Import your database schema
- Update DATABASE_URL with SiteGround credentials

### 4. File Upload via Git/FTP
Upload these essential files to your application root:
- `server/` directory (entire backend)
- `dist/` directory (built frontend)
- `package.json`
- `package-lock.json`
- `uploads/` directory (for file storage)

### 5. Dependencies Installation
In cPanel Node.js interface:
1. Click "Run NPM Install"
2. Wait for installation to complete

### 6. Start Application
1. In cPanel Node.js, click "Start"
2. Monitor logs for any errors

## File Structure for SiteGround
```
/public_html/your-app/
├── server/
│   ├── index.js (main entry point)
│   ├── routes.js
│   ├── storage.ts
│   └── ... (all server files)
├── dist/ (built frontend)
│   ├── index.html
│   ├── assets/
│   └── ...
├── uploads/
├── package.json
├── package-lock.json
└── node_modules/ (auto-generated)
```

## Important Notes
- SiteGround requires the main file to be `.js` not `.ts`
- Build the TypeScript to JavaScript before deployment
- Ensure all paths are relative and work in production
- Test database connections with SiteGround credentials
- Monitor application logs in cPanel for debugging

## Troubleshooting
- If app won't start, check Node.js logs in cPanel
- Verify all environment variables are set
- Ensure database connectivity
- Check file permissions (755 for directories, 644 for files)