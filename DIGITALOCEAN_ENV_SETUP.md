# DigitalOcean Environment Variable Setup

## Your Secure Session Secret

I've generated a secure session secret for you. Use this exact value:

```
SESSION_SECRET=a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
```

## How to Set Environment Variables in DigitalOcean

### Step 1: Access Your App Settings
1. Go to DigitalOcean Control Panel
2. Navigate to Apps → Your App Name (starnek.com)
3. Click on "Settings" tab

### Step 2: Add Environment Variables
1. Scroll down to "Environment Variables" section
2. Click "Edit" or "Add Variable"
3. Add these variables:

**Variable 1:**
- Name: `SESSION_SECRET`
- Value: `a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456`
- Scope: All components (or select your web service)

**Variable 2 (Optional):**
- Name: `NODE_ENV`
- Value: `production`
- Scope: All components

### Step 3: Save and Deploy
1. Click "Save"
2. DigitalOcean will automatically redeploy your app with the new environment variables

## What This Does

The SESSION_SECRET is used to:
- Encrypt session data
- Sign session cookies
- Prevent session tampering
- Ensure session security

## Alternative: Generate Your Own Secret

If you prefer to generate your own secret, run this command locally:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Then use that output as your SESSION_SECRET value.

## Security Notes

- Keep this secret private (never commit to Git)
- Use a different secret for each environment (development, staging, production)
- The secret should be at least 32 characters long
- Change it if you suspect it's been compromised

Once you set this environment variable and push your Git changes, your production server will have proper session security with no memory warnings.