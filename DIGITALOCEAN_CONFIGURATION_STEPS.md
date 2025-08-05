# DigitalOcean App Platform Configuration

## Current Status
✅ App created: `metenzi-b2b2`  
✅ Resource type: Web Service  
✅ Port: 8080 configured  

## Required Configuration Changes

### 1. Deployment Settings (Click "Edit" next to Deployment settings)

**Build Strategy:**
- Change from "Buildpack" to **"Dockerfile"**
- **Dockerfile Path:** `Dockerfile.digitalocean`

**Build Command:**
- **Build Command:** `npm run build`
- **Run Command:** `npm start`

### 2. Environment Variables (Click "Edit" next to Environment variables)

Add these environment variables:

```
NODE_ENV = production
PORT = 8080
DATABASE_URL = ${db.DATABASE_URL}
SESSION_SECRET = [Generate a secure 32-character random string]
```

**For SESSION_SECRET, use a string like:**
```
your_very_secure_random_32_char_key_123456789
```

**Optional (if you have Sentry):**
```
SENTRY_DSN = [Your Sentry DSN if available]
```

### 3. Database Setup

1. **Create Database:**
   - In DigitalOcean dashboard, go to "Databases"
   - Click "Create Database Cluster"
   - Choose **PostgreSQL**
   - Select **Basic plan ($15/month)**
   - Choose **same region** as your app

2. **Connect Database:**
   - Once database is created, copy the **Connection String**
   - In your app's Environment Variables, set:
   ```
   DATABASE_URL = postgresql://username:password@host:port/database_name
   ```

### 4. Upload Required Files

Make sure your GitHub repository contains these files:

✅ `Dockerfile.digitalocean` (already created)  
✅ `.dockerignore` (already created)  
✅ `package.json` with correct scripts  
✅ Source code  

### 5. Deploy

1. Click **"Save"** on all configuration changes
2. DigitalOcean will automatically trigger a new deployment
3. Wait 5-10 minutes for deployment to complete
4. Check the **"Runtime Logs"** for any errors

## Testing Your Deployment

Once deployed, your app will be available at:
```
https://metenzi-b2b2-[random].ondigitalocean.app
```

**Test these URLs:**
- `https://your-app-url.ondigitalocean.app/health` (Should return "healthy")
- `https://your-app-url.ondigitalocean.app/` (Should show login page)

**Test Login:**
- Admin: `admin` / `password123`
- B2B User: `b2bkm` / `password123`

## Troubleshooting

**If deployment fails:**
1. Check **"Build Logs"** for build errors
2. Check **"Runtime Logs"** for startup errors
3. Verify environment variables are set correctly
4. Ensure DATABASE_URL format is correct

**Common Issues:**
- **Port binding**: App must listen on `process.env.PORT || 8080`
- **Database connection**: Verify DATABASE_URL format
- **Build errors**: Check if all dependencies are in package.json

## Cost Estimate
- **App Platform**: $5/month (Basic plan)
- **PostgreSQL Database**: $15/month (Basic plan)
- **Total**: ~$20/month

Your B2B License Management Platform will be production-ready with automatic SSL, scaling, and monitoring!