import { Router } from 'express';
import { adminUsersController } from '../../controllers/admin/users.controller';
import { 
  authenticate, 
  authorize, 
  validateRequest, 
  auditLog,
  Permissions 
} from '../../middleware/auth.middleware';
import { z } from 'zod';

const router = Router();

// All admin user routes require authentication
router.use(authenticate);

// Validation schemas
const userParamsSchema = z.object({
  id: z.string().min(1, 'User ID is required'),
});

const getUsersQuerySchema = z.object({
  role: z.enum(['b2b_user', 'admin', 'super_admin']).optional(),
  isActive: z.coerce.boolean().optional(),
  search: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

const updateRoleSchema = z.object({
  role: z.enum(['b2b_user', 'admin', 'super_admin']),
});

const createUserSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  email: z.string().email().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  role: z.enum(['b2b_user', 'admin', 'super_admin']).default('b2b_user'),
  isActive: z.boolean().default(true),
});

// GET /api/admin/users - Get all users (with filters and pagination)
router.get('/',
  authorize(Permissions.USER_READ),
  validateRequest({ query: getUsersQuerySchema }),
  auditLog('admin:users:list'),
  adminUsersController.getAllUsers.bind(adminUsersController)
);

// GET /api/admin/users/analytics - Get user analytics
router.get('/analytics',
  authorize(Permissions.REPORT_READ),
  auditLog('admin:users:analytics'),
  adminUsersController.getUserAnalytics.bind(adminUsersController)
);

// GET /api/admin/users/:id - Get specific user
router.get('/:id',
  authorize(Permissions.USER_READ),
  validateRequest({ params: userParamsSchema }),
  auditLog('admin:users:view'),
  adminUsersController.getUserById.bind(adminUsersController)
);

// POST /api/admin/users - Create new user
router.post('/',
  authorize(Permissions.USER_CREATE),
  validateRequest({ body: createUserSchema }),
  auditLog('admin:users:create'),
  adminUsersController.createUser.bind(adminUsersController)
);

// PUT /api/admin/users/:id/role - Update user role
router.put('/:id/role',
  authorize(Permissions.USER_UPDATE),
  validateRequest({ 
    params: userParamsSchema,
    body: updateRoleSchema
  }),
  auditLog('admin:users:update-role'),
  adminUsersController.updateUserRole.bind(adminUsersController)
);

// PATCH /api/admin/users/:id/deactivate - Deactivate user
router.patch('/:id/deactivate',
  authorize(Permissions.USER_UPDATE),
  validateRequest({ params: userParamsSchema }),
  auditLog('admin:users:deactivate'),
  adminUsersController.deactivateUser.bind(adminUsersController)
);

// PATCH /api/admin/users/:id/reactivate - Reactivate user
router.patch('/:id/reactivate',
  authorize(Permissions.USER_UPDATE),
  validateRequest({ params: userParamsSchema }),
  auditLog('admin:users:reactivate'),
  adminUsersController.reactivateUser.bind(adminUsersController)
);

export { router as adminUsersRouter };