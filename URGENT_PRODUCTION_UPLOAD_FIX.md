# URGENT: Production Upload Fix

## Problem Analysis
Production site (starnek.com) showing 404 errors for:
- `POST /api/admin/upload-image` - 404 (Not Found)
- `GET /api/admin/license-counts` - 404 (Not Found)
- Multiple authentication 401 errors

## Root Cause
The production deployment is missing the updated routes that include:
1. The new `/api/admin/license-counts` endpoint
2. The enhanced upload endpoints with proper authentication
3. Updated route registration

## Immediate Solution

### Option 1: Emergency Server Deployment
Use the standalone emergency server (`production-upload-fix.cjs`) that contains ONLY the missing endpoints:

```bash
# On production server:
node production-upload-fix.cjs
```

This provides:
- `/api/admin/upload-image` (primary upload route)
- `/api/images/upload` (secondary upload route) 
- `/api/upload-image-fallback` (emergency fallback)
- `/api/admin/license-counts` (required for admin panel)
- `/api/csrf-token` (authentication support)

### Option 2: Quick Route Update
If you can modify the production code directly, ensure these routes are properly registered:

1. **In `server/routes/admin/index.ts`** - Add license-counts endpoint:
```javascript
router.get('/license-counts', async (req, res) => {
  try {
    const storage = await import('../../storage');
    const licenseCounts = await storage.storageSystem.getLicenseCounts();
    res.json({ success: true, data: licenseCounts });
  } catch (error) {
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: 'Failed to get license counts', data: {} });
  }
});
```

2. **In `server/routes.ts`** - Add upload fallback:
```javascript
app.post('/api/upload-image-fallback', uploadMiddleware.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image file provided' });
  }
  const imageUrl = `/uploads/products/${req.file.filename}`;
  res.json({ 
    imageUrl, 
    filename: req.file.filename, 
    message: 'Image uploaded successfully via fallback route' 
  });
});
```

## Testing Commands
```bash
# Test upload endpoint
curl -X POST https://starnek.com/api/admin/upload-image \
  -F "image=@test.png" \
  -H "Content-Type: multipart/form-data"

# Test license counts
curl https://starnek.com/api/admin/license-counts

# Test health
curl https://starnek.com/health
```

## Expected Results
- Upload endpoints return JSON with `imageUrl` field
- License counts returns data structure with product counts
- No more 404 errors for these endpoints
- Admin panel image upload functionality restored

## Files to Deploy
- `production-upload-fix.cjs` (emergency standalone server)
- `package-emergency.json` (minimal dependencies)

The emergency server approach is recommended as it requires minimal changes to the existing production environment and provides immediate functionality restoration.