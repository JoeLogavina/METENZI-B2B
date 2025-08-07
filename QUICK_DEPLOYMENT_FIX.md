# Quick Fix for DigitalOcean Deployment Error

## The Problem
Your deployment failed with this error:
```
npm ci can only install packages when your package.json and package-lock.json are in sync
```

## Simple Solution (Takes 2 minutes)

### Step 1: Remove the problematic lock file from Git
```bash
git rm package-lock.json
git commit -m "Remove package-lock.json to fix deployment"
```

### Step 2: Deploy the fixed files 
```bash
# Copy production files
cp production-deployment/index.js ./index.js  
cp production-deployment/package.json ./package.json

# Commit and deploy
git add index.js package.json
git commit -m "Production fix: eliminate MemoryStore warnings and restore uploads"
git push origin main
```

## What Happens
1. DigitalOcean will generate a fresh package-lock.json
2. All dependencies will install correctly  
3. Your production server will start with file-based sessions
4. No more MemoryStore warnings
5. Upload functionality restored

## Alternative: Change Build Command
Instead of removing package-lock.json, you can:
1. Go to DigitalOcean App Settings
2. Change build command from `npm ci && npm run build` 
3. To: `npm install && npm run build`

## Environment Variable
Don't forget to set in DigitalOcean:
```
SESSION_SECRET=042ed3bdf9db9119f62b9b2b9f8610c99310dca1227cf355538edcc7c156a7c6
```

This will fix the deployment immediately.