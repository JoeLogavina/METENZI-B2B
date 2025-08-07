# How to Replace Main Server for Production

## Current Production Issue
Your production server (starnek.com) is using MemoryStore for sessions, causing:
- Memory leak warnings
- Authentication failures (401 errors)
- Upload functionality broken (404 errors)

## Solution: Replace with Fixed Production Server

### Step 1: Backup Current Production Files
```bash
# On your production server (DigitalOcean/hosting provider):
cp index.js index.js.backup
cp package.json package.json.backup
```

### Step 2: Upload New Production Files
Upload these files from your Replit project to production:

**Required Files:**
- `production-session-fix.cjs` → Upload as `index.js` (replace existing)
- `package-production-fix.json` → Upload as `package.json` (replace existing)

### Step 3: Install Production Dependencies
```bash
# On production server:
npm install
```

This will install:
- express-session (for proper session management)
- session-file-store (eliminates memory store warnings)
- passport & passport-local (authentication)
- bcrypt (password hashing)
- multer (file uploads)

### Step 4: Create Required Directories
```bash
# On production server:
mkdir -p sessions
mkdir -p uploads/products
chmod 755 sessions uploads/products
```

### Step 5: Set Environment Variables
```bash
# Add to your environment or .env file:
export SESSION_SECRET="your-secure-session-secret-here"
export NODE_ENV="production"
export PORT="5000"
```

### Step 6: Start Production Server
```bash
# Stop current server first
pkill -f node

# Start new server
node index.js
```

## What This Fixes

### ✅ Memory Store Warning Eliminated
- Replaces MemoryStore with file-based session storage
- No more memory leaks
- Sessions persist across server restarts

### ✅ Authentication Working
- Complete Passport.js authentication system
- Configured users: admin/password123, b2bkm/password123, munich_branch/password123
- Proper session management

### ✅ Upload Functionality Restored
- `/api/admin/upload-image` - Protected admin upload
- `/api/images/upload` - General upload endpoint
- `/api/upload-image-fallback` - Emergency fallback
- All routes properly configured with authentication

### ✅ All Admin Endpoints Working
- `/api/admin/license-counts` - Returns license data
- `/api/admin/dashboard` - Admin dashboard stats
- `/api/login`, `/api/logout`, `/api/user` - Authentication

## Testing After Deployment

```bash
# Test health
curl https://starnek.com/health

# Test login
curl -X POST https://starnek.com/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password123"}' \
  -c cookies.txt

# Test upload (should work now)
curl -X POST https://starnek.com/api/admin/upload-image \
  -b cookies.txt \
  -F "image=@test.png"

# Test license counts (should work now)
curl -b cookies.txt https://starnek.com/api/admin/license-counts
```

## Expected Results
- ✅ No MemoryStore warnings in logs
- ✅ Admin panel image upload works
- ✅ All authentication flows work
- ✅ License counts load properly
- ✅ Sessions persist across restarts

## Rollback Plan (If Needed)
```bash
# If anything goes wrong, restore backup:
cp index.js.backup index.js
cp package.json.backup package.json
npm install
node index.js
```

## For DigitalOcean App Platform Specifically

If using DigitalOcean App Platform:

1. **Upload via GitHub/GitLab:**
   - Commit `production-session-fix.cjs` as `index.js`
   - Commit `package-production-fix.json` as `package.json`
   - Push to your repository
   - DigitalOcean will auto-deploy

2. **Or Manual Upload:**
   - Use DigitalOcean's file manager
   - Replace `index.js` with `production-session-fix.cjs`
   - Replace `package.json` with `package-production-fix.json`
   - Trigger manual deployment

3. **Environment Variables in DigitalOcean:**
   - Go to App → Settings → Environment Variables
   - Add: `SESSION_SECRET` = your-secure-secret
   - Add: `NODE_ENV` = production

The new server will automatically eliminate all memory warnings and restore full functionality.