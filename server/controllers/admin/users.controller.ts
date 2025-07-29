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
        // B2B specific fields
        companyName: z.string().optional(),
        contactPerson: z.string().optional(),
        companyDescription: z.string().optional(),
        phone: z.string().optional(),
        country: z.string().optional(),
        city: z.string().optional(),
        address: z.string().optional(),
        vatOrRegistrationNo: z.string().optional(),
      });
      
      const updateData = updateUserSchema.parse(req.body);
      
      // Prevent self-deactivation
      if (req.user?.id === id && updateData.isActive === false) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Cannot deactivate your own account'
        });
      }
      
      const user = await userService.updateUser(id, updateData);
      
      // Remove password from response
      const { password, ...safeUser } = user;
      res.json({
        data: safeUser,
        message: 'User updated successfully'
      });
    } catch (error) {
      if (isServiceError(error)) {
        return res.status(error.statusCode).json(formatErrorResponse(error));
      }
      res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to update user'
      });
    }
  }

  // GET /api/admin/users/:id/orders
  async getUserOrders(req: Request, res: Response) {
    try {
      const { id } = userParamsSchema.parse(req.params);
      
      // Get user orders through storage or service
      const orders = await userService.getUserOrders(id);
      
      res.json({
        data: orders
      });
    } catch (error) {
      if (isServiceError(error)) {
        return res.status(error.statusCode).json(formatErrorResponse(error));
      }
      res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to get user orders'
      });
    }
  }

  // GET /api/admin/users/:id/transactions
  async getUserTransactions(req: Request, res: Response) {
    try {
      const { id } = userParamsSchema.parse(req.params);
      
      // Get user wallet transactions
      const transactions = await userService.getUserTransactions(id);
      
      res.json({
        data: transactions
      });
    } catch (error) {
      if (isServiceError(error)) {
        return res.status(error.statusCode).json(formatErrorResponse(error));
      }
      res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to get user transactions'
      });
    }
  }

  // GET /api/admin/users/:id/wallet
  async getUserWallet(req: Request, res: Response) {
    try {
      const { id } = userParamsSchema.parse(req.params);
      
      // Get user wallet data
      const wallet = await userService.getUserWallet(id);
      
      res.json({
        data: wallet
      });
    } catch (error) {
      if (isServiceError(error)) {
        return res.status(error.statusCode).json(formatErrorResponse(error));
      }
      res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to get user wallet'
      });
    }
  }

  // POST /api/admin/users/:id/deposit
  async addUserDeposit(req: Request, res: Response) {
    try {
      const { id } = userParamsSchema.parse(req.params);
      const depositSchema = z.object({
        amount: z.number().positive('Amount must be positive'),
      });
      const { amount } = depositSchema.parse(req.body);
      
      // Add deposit to user wallet
      const result = await userService.addUserDeposit(id, amount);
      
      res.json({
        data: result,
        message: 'Deposit added successfully'
      });
    } catch (error) {
      if (isServiceError(error)) {
        return res.status(error.statusCode).json(formatErrorResponse(error));
      }
      res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to add deposit'
      });
    }
  }

  // PATCH /api/admin/users/:id/credit-limit
  async updateUserCreditLimit(req: Request, res: Response) {
    try {
      const { id } = userParamsSchema.parse(req.params);
      const creditLimitSchema = z.object({
        creditLimit: z.number().min(0, 'Credit limit must be non-negative'),
      });
      const { creditLimit } = creditLimitSchema.parse(req.body);
      
      // Update user credit limit
      const result = await userService.updateUserCreditLimit(id, creditLimit);
      
      res.json({
        data: result,
        message: 'Credit limit updated successfully'
      });
    } catch (error) {
      if (isServiceError(error)) {
        return res.status(error.statusCode).json(formatErrorResponse(error));
      }
      res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to update credit limit'
      });
    }
  }
}

export const adminUsersController = new AdminUsersController();