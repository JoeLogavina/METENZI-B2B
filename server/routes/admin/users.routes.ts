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
import { insertBranchSchema } from '@shared/schema';

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

const createBranchSchema = insertBranchSchema.extend({
  // Add any additional validation for branch creation
  username: z.string().min(3, 'Username must be at least 3 characters'),
});

const branchParamsSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  branchId: z.string().min(1, 'Branch ID is required'),
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

// PATCH /api/admin/users/:id/status - Update user status
const updateStatusSchema = z.object({
  isActive: z.boolean(),
});

router.patch('/:id/status',
  authorize(Permissions.USER_UPDATE),
  validateRequest({ 
    params: userParamsSchema,
    body: updateStatusSchema
  }),
  auditLog('admin:users:update-status'),
  adminUsersController.updateUserStatus.bind(adminUsersController)
);

// PATCH /api/admin/users/:id - Update user
const updateUserSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').optional(),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  email: z.string().email().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  role: z.enum(['b2b_user', 'admin', 'super_admin']).optional(),
  isActive: z.boolean().optional(),
  // B2B Profile fields
  companyName: z.string().optional(),
  contactPerson: z.string().optional(),
  companyDescription: z.string().optional(),
  phone: z.string().optional(),
  country: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  vatOrRegistrationNo: z.string().optional(),
});

router.patch('/:id',
  authorize(Permissions.USER_UPDATE),
  validateRequest({ 
    params: userParamsSchema,
    body: updateUserSchema
  }),
  auditLog('admin:users:update'),
  adminUsersController.updateUser.bind(adminUsersController)
);

// Branch Management Routes

// GET /api/admin/users/:userId/branches - Get branches for a user
router.get('/:userId/branches',
  authorize(Permissions.USER_READ),
  validateRequest({ params: z.object({ userId: z.string() }) }),
  auditLog('admin:branches:list'),
  adminUsersController.getUserBranches.bind(adminUsersController)
);

// POST /api/admin/users/:userId/branches - Create a new branch
router.post('/:userId/branches',
  authorize(Permissions.USER_CREATE),
  validateRequest({ 
    params: z.object({ userId: z.string() }),
    body: createBranchSchema
  }),
  auditLog('admin:branches:create'),
  adminUsersController.createBranch.bind(adminUsersController)
);

// PUT /api/admin/users/:userId/branches/:branchId - Update branch details
router.put('/:userId/branches/:branchId',
  authorize(Permissions.USER_UPDATE),
  validateRequest({ 
    params: branchParamsSchema,
    body: createBranchSchema.partial()
  }),
  auditLog('admin:branches:update'),
  adminUsersController.updateBranch.bind(adminUsersController)
);

// DELETE /api/admin/users/:userId/branches/:branchId - Delete a branch
router.delete('/:userId/branches/:branchId',
  authorize(Permissions.USER_DELETE),
  validateRequest({ params: branchParamsSchema }),
  auditLog('admin:branches:delete'),
  adminUsersController.deleteBranch.bind(adminUsersController)
);

export { router as adminUsersRouter };