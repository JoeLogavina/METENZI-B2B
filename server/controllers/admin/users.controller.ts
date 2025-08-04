import { Request, Response } from 'express';
import { z } from 'zod';
import { userService } from '../../services/user.service';
import { isServiceError, formatErrorResponse } from '../../services/errors';

// Request validation schemas
const getUsersQuerySchema = z.object({
  role: z.enum(['b2b_user', 'admin', 'super_admin']).optional(),
  isActive: z.coerce.boolean().optional(),
  search: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

const userParamsSchema = z.object({
  id: z.string().min(1, 'User ID is required'),
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

export class AdminUsersController {
  // GET /api/admin/users
  async getAllUsers(req: Request, res: Response) {
    try {
      const query = getUsersQuerySchema.parse(req.query);
      const { page, limit, ...filters } = query;
      
      // This would need to be implemented in userService
      const users = await userService.getAllUsers();
      
      // Apply filters
      let filteredUsers = users;
      if (filters.role) {
        filteredUsers = filteredUsers.filter(user => user.role === filters.role);
      }
      if (filters.isActive !== undefined) {
        filteredUsers = filteredUsers.filter(user => user.isActive === filters.isActive);
      }
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        filteredUsers = filteredUsers.filter(user => 
          user.username.toLowerCase().includes(searchLower) ||
          (user.email && user.email.toLowerCase().includes(searchLower)) ||
          (user.firstName && user.firstName.toLowerCase().includes(searchLower)) ||
          (user.lastName && user.lastName.toLowerCase().includes(searchLower))
        );
      }
      
      // Implement pagination
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedUsers = filteredUsers.slice(startIndex, endIndex);
      
      // Remove password from response
      const safeUsers = paginatedUsers.map(user => {
        const { password, ...safeUser } = user;
        return safeUser;
      });
      
      res.json({
        data: safeUsers,
        pagination: {
          page,
          limit,
          total: filteredUsers.length,
          totalPages: Math.ceil(filteredUsers.length / limit),
          hasNext: endIndex < filteredUsers.length,
          hasPrev: page > 1,
        },
        meta: {
          totalUsers: users.length,
          activeUsers: users.filter(u => u.isActive).length,
          usersByRole: {
            b2b_user: users.filter(u => u.role === 'b2b_user').length,
            admin: users.filter(u => u.role === 'admin').length,
            super_admin: users.filter(u => u.role === 'super_admin').length,
          }
        }
      });
    } catch (error) {
      if (isServiceError(error)) {
        return res.status(error.statusCode).json(formatErrorResponse(error));
      }
      res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch users'
      });
    }
  }

  // GET /api/admin/users/:id
  async getUserById(req: Request, res: Response) {
    try {
      const { id } = userParamsSchema.parse(req.params);
      const user = await userService.getUserById(id);
      
      // Remove password from response
      const { password, ...safeUser } = user;
      res.json({ data: safeUser });
    } catch (error) {
      if (isServiceError(error)) {
        return res.status(error.statusCode).json(formatErrorResponse(error));
      }
      res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch user'
      });
    }
  }

  // POST /api/admin/users
  async createUser(req: Request, res: Response) {
    try {
      const userData = createUserSchema.parse(req.body);
      const user = await userService.createUser(userData);
      
      // Remove password from response
      const { password, ...safeUser } = user;
      res.status(201).json({
        data: safeUser,
        message: 'User created successfully'
      });
    } catch (error) {
      if (isServiceError(error)) {
        return res.status(error.statusCode).json(formatErrorResponse(error));
      }
      res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create user'
      });
    }
  }

  // PUT /api/admin/users/:id/role
  async updateUserRole(req: Request, res: Response) {
    try {
      const { id } = userParamsSchema.parse(req.params);
      const { role } = updateRoleSchema.parse(req.body);
      
      await userService.updateUserRole(id, role);
      
      res.json({
        message: `User role updated to ${role} successfully`
      });
    } catch (error) {
      if (isServiceError(error)) {
        return res.status(error.statusCode).json(formatErrorResponse(error));
      }
      res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to update user role'
      });
    }
  }

  // PATCH /api/admin/users/:id/deactivate
  async deactivateUser(req: Request, res: Response) {
    try {
      const { id } = userParamsSchema.parse(req.params);
      
      // Prevent self-deactivation
      if (req.user?.id === id) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Cannot deactivate your own account'
        });
      }
      
      await userService.deactivateUser(id);
      
      res.json({
        message: 'User deactivated successfully'
      });
    } catch (error) {
      if (isServiceError(error)) {
        return res.status(error.statusCode).json(formatErrorResponse(error));
      }
      res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to deactivate user'
      });
    }
  }

  // PATCH /api/admin/users/:id/reactivate
  async reactivateUser(req: Request, res: Response) {
    try {
      const { id } = userParamsSchema.parse(req.params);
      await userService.reactivateUser(id);
      
      res.json({
        message: 'User reactivated successfully'
      });
    } catch (error) {
      if (isServiceError(error)) {
        return res.status(error.statusCode).json(formatErrorResponse(error));
      }
      res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to reactivate user'
      });
    }
  }

  // GET /api/admin/users/analytics
  async getUserAnalytics(req: Request, res: Response) {
    try {
      const analytics = await userService.getUserAnalytics();
      
      res.json({
        data: analytics,
        generatedAt: new Date().toISOString()
      });
    } catch (error) {
      if (isServiceError(error)) {
        return res.status(error.statusCode).json(formatErrorResponse(error));
      }
      res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to get user analytics'
      });
    }
  }

  // PATCH /api/admin/users/:id/status
  async updateUserStatus(req: Request, res: Response) {
    try {
      const { id } = userParamsSchema.parse(req.params);
      const { isActive } = z.object({ isActive: z.boolean() }).parse(req.body);
      
      // Prevent self-deactivation
      if (req.user?.id === id && !isActive) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Cannot deactivate your own account'
        });
      }
      
      if (isActive) {
        await userService.reactivateUser(id);
      } else {
        await userService.deactivateUser(id);
      }
      
      res.json({
        message: `User ${isActive ? 'activated' : 'deactivated'} successfully`
      });
    } catch (error) {
      if (isServiceError(error)) {
        return res.status(error.statusCode).json(formatErrorResponse(error));
      }
      res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to update user status'
      });
    }
  }

  // PATCH /api/admin/users/:id
  async updateUser(req: Request, res: Response) {
    try {
      const { id } = userParamsSchema.parse(req.params);
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
      
      console.log('🔍 DEBUG ADMIN CONTROLLER: Raw request body:', JSON.stringify(req.body, null, 2));
      const updateData = updateUserSchema.parse(req.body);
      console.log('🔍 DEBUG ADMIN CONTROLLER: Parsed update data:', JSON.stringify(updateData, null, 2));
      
      // Prevent self-deactivation
      if (req.user?.id === id && updateData.isActive === false) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Cannot deactivate your own account'
        });
      }
      
      const user = await userService.updateUser(id, updateData);
      console.log('🔍 DEBUG ADMIN CONTROLLER: Updated user:', {
        companyName: user.companyName,
        phone: user.phone,
        country: user.country
      });
      
      // Remove password from response
      const { password, ...safeUser } = user;
      res.json({
        data: safeUser,
        message: 'User updated successfully'
      });
    } catch (error) {
      console.error('🔍 DEBUG ADMIN CONTROLLER: Update error:', error);
      if (isServiceError(error)) {
        return res.status(error.statusCode).json(formatErrorResponse(error));
      }
      res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to update user'
      });
    }
  }

  // Branch Management Methods

  async getUserBranches(req: Request, res: Response) {
    try {
      const { id } = userParamsSchema.parse(req.params);
      
      const storage = await import('../../storage');
      const branches = await storage.storage.getUserBranches(id);
      
      // Remove passwords from response
      const branchesWithoutPasswords = branches.map(({ password, ...branch }) => branch);
      
      res.json({
        data: branchesWithoutPasswords,
        message: 'Branches retrieved successfully'
      });
    } catch (error) {
      if (isServiceError(error)) {
        return res.status(error.statusCode).json(formatErrorResponse(error));
      }
      res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to get user branches'
      });
    }
  }

  async createBranch(req: Request, res: Response) {
    try {
      console.log('🔍 createBranch - Request params:', req.params);
      console.log('🔍 createBranch - Request body:', req.body);
      
      const { id: parentCompanyId } = userParamsSchema.parse(req.params);
      const branchSchema = z.object({
        username: z.string().min(3, 'Username must be at least 3 characters'),
        password: z.string().min(6, 'Password must be at least 6 characters'),
        email: z.string().email().optional(),
        branchName: z.string().min(1, 'Branch name is required'),
        branchCode: z.string().optional(),
        companyName: z.string().optional(),
        tenantId: z.string().default('eur'),
      });
      
      console.log('🔍 createBranch - Parsing branch data...');
      const branchData = branchSchema.parse(req.body);
      console.log('🔍 createBranch - Branch data validated:', branchData);

      // Hash password
      const bcrypt = await import('bcrypt');
      const hashedPassword = await bcrypt.hash(branchData.password, 10);
      
      console.log('🔍 createBranch - Creating branch user in storage...');
      const storage = await import('../../storage');
      const branch = await storage.storage.createBranchUser(parentCompanyId, {
        ...branchData,
        password: hashedPassword
      });
      
      console.log('🔍 createBranch - Branch created successfully:', branch.id);
      const { password, ...branchWithoutPassword } = branch;
      res.status(201).json({
        data: branchWithoutPassword,
        message: 'Branch created successfully'
      });
    } catch (error) {
      console.error('❌ createBranch - Error:', error);
      if (error instanceof z.ZodError) {
        console.error('❌ createBranch - Validation error details:', error.errors);
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid input data',
          details: error.errors
        });
      }
      if (isServiceError(error)) {
        return res.status(error.statusCode).json(formatErrorResponse(error));
      }
      res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create branch'
      });
    }
  }

  async getCompanyHierarchy(req: Request, res: Response) {
    try {
      const { id } = userParamsSchema.parse(req.params);
      
      const storage = await import('../../storage');
      const hierarchy = await storage.storage.getCompanyHierarchy(id);
      
      if (!hierarchy) {
        return res.status(404).json({
          error: 'NOT_FOUND',
          message: 'Company hierarchy not found'
        });
      }
      
      // Remove passwords from response
      const { password: mainPassword, ...mainCompanyWithoutPassword } = hierarchy.mainCompany;
      const branchesWithoutPasswords = hierarchy.branches.map(({ password, ...branch }) => branch);
      
      res.json({
        data: {
          mainCompany: mainCompanyWithoutPassword,
          branches: branchesWithoutPasswords
        },
        message: 'Company hierarchy retrieved successfully'
      });
    } catch (error) {
      if (isServiceError(error)) {
        return res.status(error.statusCode).json(formatErrorResponse(error));
      }
      res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to get company hierarchy'
      });
    }
  }
}

export const adminUsersController = new AdminUsersController();