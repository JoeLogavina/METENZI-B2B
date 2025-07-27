# Testing Microservices vs Monolith

## Current Monolith Test (What You Have Now)

1. Open http://localhost:5000
2. Login as admin (admin/Kalendar1)
3. Notice you can access BOTH:
   - Admin Panel at /admin-panel
   - B2B Shop at /b2b-shop
4. Single session works for everything

## Microservices Test (The New Architecture)

### Step 1: Stop Current App
Press Ctrl+C in terminal to stop the monolith

### Step 2: Start Microservices
```bash
cd services
chmod +x run-all.sh
./run-all.sh
```

### Step 3: Test Complete Isolation

#### Admin Portal Test:
1. Open http://localhost:5001 (Admin Service)
2. Login with admin/Kalendar1
3. You'll see ONLY admin features
4. Try to access http://localhost:5001/b2b-shop - Won't exist!

#### B2B Portal Test:
1. Open http://localhost:5002 (B2B Service) 
2. Login with b2buser/Kalendar1
3. You'll see ONLY customer features
4. Try to access http://localhost:5002/admin-panel - Won't exist!

#### Core API Test:
1. Try http://localhost:5003/health
2. Try http://localhost:5003/api/core/products - Blocked! (needs service auth)

## Key Differences You'll See:

1. **Different URLs**:
   - Monolith: Everything on :5000
   - Microservices: Admin on :5001, B2B on :5002

2. **Separate Login Pages**:
   - Admin has special secure login design
   - B2B has customer-friendly login

3. **No Cross-Access**:
   - Admin login won't work on B2B portal
   - B2B users can't access admin even if they know the URL

4. **Independent Sessions**:
   - Login to admin doesn't affect B2B
   - Can be logged into both simultaneously with different users

5. **API Isolation**:
   - Admin uses /api/admin/* endpoints
   - B2B uses /api/* endpoints
   - Core API is internal only

## Visual Differences:

- Admin Portal: More security warnings, admin-specific branding
- B2B Portal: Customer-focused, no admin menu items
- Different session timeouts (24h admin, 7 days B2B)