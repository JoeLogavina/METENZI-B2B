import { Router } from 'express';
import { adminProductsRouter } from './products.routes';
import { adminUsersRouter } from './users.routes';
import licenseKeysRoutes from './license-keys.routes';
import walletRoutes from './wallet.routes';
import { authenticate, requireRole, rateLimit } from '../../middleware/auth.middleware';

const router = Router();

// Apply rate limiting to all admin routes
router.use(rateLimit(15 * 60 * 1000, 200)); // 200 requests per 15 minutes

// Apply authentication to all admin routes
router.use(authenticate);

// Apply admin role requirement to all admin routes
router.use(requireRole('admin', 'super_admin'));

// Dashboard endpoint
router.get('/dashboard', async (req, res) => {
  try {
    // For now, return mock data that matches what's expected
    const dashboardStats = {
      totalUsers: 2,
      totalSales: "€0",
      activeKeys: 0,
      totalProducts: 3
    };
    res.json(dashboardStats);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch dashboard stats" });
  }
});

// Mount sub-routers
router.use('/products', adminProductsRouter);
router.use('/users', adminUsersRouter);
router.use('/license-keys', licenseKeysRoutes);
router.use('/wallets', walletRoutes);

export { router as adminRouter };