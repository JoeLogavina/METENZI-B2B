import { Router } from 'express';
import { adminProductsRouter } from './products.routes';
import { adminUsersRouter } from './users.routes';
import { authenticate, requireRole, rateLimit } from '../../middleware/auth.middleware';

const router = Router();

// Apply rate limiting to all admin routes
router.use(rateLimit(15 * 60 * 1000, 200)); // 200 requests per 15 minutes

// Apply authentication to all admin routes
router.use(authenticate);

// Apply admin role requirement to all admin routes
router.use(requireRole('admin', 'super_admin'));

// Mount sub-routers
router.use('/products', adminProductsRouter);
router.use('/users', adminUsersRouter);

export { router as adminRouter };