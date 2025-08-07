# Git Deployment to DigitalOcean - Simple Steps

## What You Need to Do

### 1. Replace Your Main Files
Copy these files from the `production-deployment` folder to your main project:

```bash
# Copy the production server as your main index.js
cp production-deployment/index.js ./index.js

# Copy the production package.json  
cp production-deployment/package.json ./package.json
```

### 2. Commit and Push to Git
```bash
git add index.js package.json
git commit -m "Fix: Replace server with production session fix - eliminates MemoryStore warnings and fixes uploads"
git push origin main
```

### 3. DigitalOcean Will Automatically:
- Pull your changes from Git
- Run `npm install` (installs the new session dependencies)
- Create the build
- Deploy the new server
- Start with the fixed session storage

## What Gets Fixed Automatically

✅ **MemoryStore Warning Eliminated**
- No more "MemoryStore is not designed for production" warnings
- Uses file-based session storage instead

✅ **Authentication Fixed** 
- All 401 errors resolved
- Proper Passport.js authentication
- Session persistence

✅ **Upload Functionality Restored**
- `/api/admin/upload-image` works again
- `/api/images/upload` fallback available
- `/api/upload-image-fallback` emergency route

✅ **Admin Panel Working**
- `/api/admin/license-counts` returns data
- `/api/admin/dashboard` loads properly
- Image uploads in admin panel functional

## Environment Variables (Set in DigitalOcean)
In your DigitalOcean App Settings → Environment Variables, add:
- `SESSION_SECRET` = "your-secure-secret-key-here"
- `NODE_ENV` = "production"

## Expected Deployment Time
- Build: ~2-3 minutes
- Deploy: ~1-2 minutes
- Total: ~5 minutes until live

## Verification After Deployment
Once deployed, test these endpoints:
- `https://starnek.com/health` - Should show healthy status
- Admin panel login should work without 401 errors
- Image upload in admin panel should work without 404 errors

That's it! The Git push triggers automatic deployment with all fixes included.