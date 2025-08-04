import { Request, Response } from 'express';
import { z } from 'zod';
import { userService } from '../../services/user.service';
import { isServiceError, formatErrorResponse } from '../../services/errors';
import { db } from '../../db';
import { users } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import bcrypt from 'bcrypt';

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

  // GET /api/admin/users/:userId/branches
  async getUserBranches(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      
      const branches = await db
        .select()
        .from(users)
        .where(and(
          eq(users.parentCompanyId, userId),
          eq(users.branchType, 'branch')
        ));

      // Remove passwords from response
      const safeBranches = branches.map(branch => {
        const { password, ...safeBranch } = branch;
        return safeBranch;
      });

      res.json({
        data: safeBranches,
        total: safeBranches.length
      });
    } catch (error) {
      console.error('Error fetching user branches:', error);
      res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch user branches'
      });
    }
  }

  // POST /api/admin/users/:userId/branches
  async createBranch(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const branchData = req.body;

      // Check if parent company exists
      const [parentCompany] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!parentCompany) {
        return res.status(404).json({
          error: 'NOT_FOUND',
          message: 'Parent company not found'
        });
      }

      // Check if branch code is unique within the tenant
      const [existingBranch] = await db
        .select()
        .from(users)
        .where(and(
          eq(users.branchCode, branchData.branchCode),
          eq(users.tenantId, parentCompany.tenantId)
        ))
        .limit(1);

      if (existingBranch) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Branch code already exists'
        });
      }

      // Create branch user
      const [newBranch] = await db
        .insert(users)
        .values({
          ...branchData,
          parentCompanyId: userId,
          branchType: 'branch',
          tenantId: parentCompany.tenantId,
          role: 'b2b_user',
          isActive: true,
          // Copy company details from parent
          companyName: branchData.companyName || parentCompany.companyName,
          country: branchData.country || parentCompany.country,
          city: branchData.city || parentCompany.city,
          address: branchData.address || parentCompany.address,
          vatOrRegistrationNo: branchData.vatOrRegistrationNo || parentCompany.vatOrRegistrationNo,
        })
        .returning();

      // Remove password from response
      const { password, ...safeBranch } = newBranch;

      res.status(201).json({
        data: safeBranch,
        message: 'Branch created successfully'
      });
    } catch (error) {
      console.error('Error creating branch:', error);
      res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create branch'
      });
    }
  }

  // PUT /api/admin/users/:userId/branches/:branchId
  async updateBranch(req: Request, res: Response) {
    try {
      const { userId, branchId } = req.params;
      const updateData = req.body;

      // Verify branch belongs to parent company
      const [existingBranch] = await db
        .select()
        .from(users)
        .where(and(
          eq(users.id, branchId),
          eq(users.parentCompanyId, userId),
          eq(users.branchType, 'branch')
        ))
        .limit(1);

      if (!existingBranch) {
        return res.status(404).json({
          error: 'NOT_FOUND',
          message: 'Branch not found or does not belong to this company'
        });
      }

      // Check if branch code is unique (if being updated)
      if (updateData.branchCode && updateData.branchCode !== existingBranch.branchCode) {
        const [existingWithCode] = await db
          .select()
          .from(users)
          .where(and(
            eq(users.branchCode, updateData.branchCode),
            eq(users.tenantId, existingBranch.tenantId)
          ))
          .limit(1);

        if (existingWithCode) {
          return res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: 'Branch code already exists'
          });
        }
      }

      // Update branch
      const [updatedBranch] = await db
        .update(users)
        .set({
          ...updateData,
          updatedAt: new Date()
        })
        .where(eq(users.id, branchId))
        .returning();

      // Remove password from response
      const { password, ...safeBranch } = updatedBranch;

      res.json({
        data: safeBranch,
        message: 'Branch updated successfully'
      });
    } catch (error) {
      console.error('Error updating branch:', error);
      res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to update branch'
      });
    }
  }

  // DELETE /api/admin/users/:userId/branches/:branchId
  async deleteBranch(req: Request, res: Response) {
    try {
      const { userId, branchId } = req.params;

      // Verify branch belongs to parent company
      const [existingBranch] = await db
        .select()
        .from(users)
        .where(and(
          eq(users.id, branchId),
          eq(users.parentCompanyId, userId),
          eq(users.branchType, 'branch')
        ))
        .limit(1);

      if (!existingBranch) {
        return res.status(404).json({
          error: 'NOT_FOUND',
          message: 'Branch not found or does not belong to this company'
        });
      }

      // Soft delete by deactivating
      await db
        .update(users)
        .set({
          isActive: false,
          updatedAt: new Date()
        })
        .where(eq(users.id, branchId));

      res.json({
        message: 'Branch deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting branch:', error);
      res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to delete branch'
      });
    }
  }
}

export const adminUsersController = new AdminUsersController();