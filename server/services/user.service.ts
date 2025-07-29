import { storage } from '../storage';
import { 
  type User, 
  type UpsertUser,
} from '@shared/schema';
import { ServiceError, ValidationError, NotFoundError, ConflictError } from './errors';
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

export interface UserService {
  // Authentication methods
  authenticateUser(username: string, password: string): Promise<User | null>;
  createUser(userData: UpsertUser): Promise<User>;
  
  // User management methods
  getUserById(id: string): Promise<User>;
  getUserByUsername(username: string): Promise<User | null>;
  updateUserRole(id: string, role: "b2b_user" | "admin" | "super_admin"): Promise<void>;
  
  // Admin methods
  getAllUsers(): Promise<User[]>;
  deactivateUser(id: string): Promise<void>;
  reactivateUser(id: string): Promise<void>;
  updateUser(id: string, updateData: Partial<UpsertUser>): Promise<User>;
  
  // Analytics methods
  getUserAnalytics(): Promise<any>;
}

export class UserServiceImpl implements UserService {
  async authenticateUser(username: string, password: string): Promise<User | null> {
    if (!username || !password) {
      throw new ValidationError('Username and password are required');
    }

    try {
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return null;
      }

      if (!user.isActive) {
        throw new ValidationError('User account is deactivated');
      }

      const isPasswordValid = await this.comparePasswords(password, user.password);
      if (!isPasswordValid) {
        return null;
      }

      return user;
    } catch (error) {
      if (error instanceof ValidationError) throw error;
      throw new ServiceError('Authentication failed', error);
    }
  }

  async createUser(userData: UpsertUser): Promise<User> {
    try {
      // Validate required fields
      if (!userData.username || !userData.password) {
        throw new ValidationError('Username and password are required');
      }

      // Check if username already exists
      const existingUser = await storage.getUserByUsername(userData.username);
      if (existingUser) {
        throw new ConflictError('Username already exists');
      }

      // Check if email already exists (if provided)
      if (userData.email) {
        // For now, we'll skip email uniqueness check as it's not implemented in storage
        // In a full implementation, you'd check email uniqueness here
      }

      // Hash password
      const hashedPassword = await this.hashPassword(userData.password);
      
      // Create user with hashed password
      const userToCreate = {
        ...userData,
        password: hashedPassword,
        role: userData.role || 'b2b_user',
        isActive: userData.isActive ?? true,
      };

      return await storage.createUser(userToCreate);
    } catch (error) {
      if (error instanceof ValidationError || error instanceof ConflictError) {
        throw error;
      }
      throw new ServiceError('Failed to create user', error);
    }
  }

  async getUserById(id: string): Promise<User> {
    if (!id) {
      throw new ValidationError('User ID is required');
    }

    try {
      const user = await storage.getUser(id);
      if (!user) {
        throw new NotFoundError('User not found');
      }
      return user;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new ServiceError('Failed to fetch user', error);
    }
  }

  async getUserByUsername(username: string): Promise<User | null> {
    if (!username) {
      throw new ValidationError('Username is required');
    }

    try {
      const user = await storage.getUserByUsername(username);
      return user || null;
    } catch (error) {
      throw new ServiceError('Failed to fetch user by username', error);
    }
  }

  async updateUserRole(id: string, role: "b2b_user" | "admin" | "super_admin"): Promise<void> {
    if (!id) {
      throw new ValidationError('User ID is required');
    }

    if (!['b2b_user', 'admin', 'super_admin'].includes(role)) {
      throw new ValidationError('Invalid role specified');
    }

    try {
      // Check if user exists
      await this.getUserById(id);
      
      await storage.updateUserRole(id, role);
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      throw new ServiceError('Failed to update user role', error);
    }
  }

  async getAllUsers(): Promise<User[]> {
    try {
      return await storage.getAllUsers();
    } catch (error) {
      throw new ServiceError('Failed to fetch all users', error);
    }
  }

  async deactivateUser(id: string): Promise<void> {
    if (!id) {
      throw new ValidationError('User ID is required');
    }

    try {
      const user = await this.getUserById(id);
      
      if (!user.isActive) {
        throw new ValidationError('User is already deactivated');
      }

      await storage.updateUser(id, { isActive: false });
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      throw new ServiceError('Failed to deactivate user', error);
    }
  }

  async reactivateUser(id: string): Promise<void> {
    if (!id) {
      throw new ValidationError('User ID is required');
    }

    try {
      const user = await this.getUserById(id);
      
      if (user.isActive) {
        throw new ValidationError('User is already active');
      }

      await storage.updateUser(id, { isActive: true });
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      throw new ServiceError('Failed to reactivate user', error);
    }
  }

  async updateUser(id: string, updateData: Partial<UpsertUser>): Promise<User> {
    if (!id) {
      throw new ValidationError('User ID is required');
    }

    try {
      // Validate that user exists
      await this.getUserById(id);

      // If password is provided, hash it
      if (updateData.password) {
        updateData.password = await this.hashPassword(updateData.password);
      }

      // If username is being updated, check for conflicts
      if (updateData.username) {
        const existingUser = await storage.getUserByUsername(updateData.username);
        if (existingUser && existingUser.id !== id) {
          throw new ConflictError('Username already exists');
        }
      }

      const updatedUser = await storage.updateUser(id, updateData);
      return updatedUser;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError || error instanceof ConflictError) {
        throw error;
      }
      throw new ServiceError('Failed to update user', error);
    }
  }

  async getUserAnalytics(): Promise<any> {
    try {
      const allUsers = await storage.getAllUsers();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const analytics = {
        totalUsers: allUsers.length,
        activeUsers: allUsers.filter(u => u.isActive).length,
        usersByRole: {
          b2b_user: allUsers.filter(u => u.role === 'b2b_user').length,
          admin: allUsers.filter(u => u.role === 'admin').length,
          super_admin: allUsers.filter(u => u.role === 'super_admin').length,
        },
        recentRegistrations: allUsers.filter(u => 
          u.createdAt && new Date(u.createdAt) >= thirtyDaysAgo
        ).length,
        userGrowth: {
          thisMonth: allUsers.filter(u => {
            if (!u.createdAt) return false;
            const createdDate = new Date(u.createdAt);
            const now = new Date();
            return createdDate.getMonth() === now.getMonth() && 
                   createdDate.getFullYear() === now.getFullYear();
          }).length,
          lastMonth: allUsers.filter(u => {
            if (!u.createdAt) return false;
            const createdDate = new Date(u.createdAt);
            const lastMonth = new Date();
            lastMonth.setMonth(lastMonth.getMonth() - 1);
            return createdDate.getMonth() === lastMonth.getMonth() && 
                   createdDate.getFullYear() === lastMonth.getFullYear();
          }).length,
        }
      };

      return analytics;
    } catch (error) {
      throw new ServiceError('Failed to get user analytics', error);
    }
  }

  // User-specific data methods for admin panel
  async getUserOrders(userId: string): Promise<any[]> {
    if (!userId) {
      throw new ValidationError('User ID is required');
    }

    try {
      // Check if user exists
      await this.getUserById(userId);
      
      // Get user orders through storage
      return await storage.getUserOrders(userId);
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      throw new ServiceError('Failed to get user orders', error);
    }
  }

  async getUserTransactions(userId: string): Promise<any[]> {
    if (!userId) {
      throw new ValidationError('User ID is required');
    }

    try {
      // Check if user exists
      await this.getUserById(userId);
      
      // Get user wallet transactions
      return await storage.getUserTransactions(userId);
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      throw new ServiceError('Failed to get user transactions', error);
    }
  }

  async getUserWallet(userId: string): Promise<any> {
    if (!userId) {
      throw new ValidationError('User ID is required');
    }

    try {
      // Check if user exists
      await this.getUserById(userId);
      
      // Get user wallet data
      return await storage.getUserWallet(userId);
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      throw new ServiceError('Failed to get user wallet', error);
    }
  }

  async addUserDeposit(userId: string, amount: number): Promise<any> {
    if (!userId) {
      throw new ValidationError('User ID is required');
    }

    if (!amount || amount <= 0) {
      throw new ValidationError('Amount must be positive');
    }

    try {
      // Check if user exists
      await this.getUserById(userId);
      
      // Add deposit to user wallet
      return await storage.addUserDeposit(userId, amount);
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      throw new ServiceError('Failed to add user deposit', error);
    }
  }

  async updateUserCreditLimit(userId: string, creditLimit: number): Promise<any> {
    if (!userId) {
      throw new ValidationError('User ID is required');
    }

    if (creditLimit < 0) {
      throw new ValidationError('Credit limit must be non-negative');
    }

    try {
      // Check if user exists
      await this.getUserById(userId);
      
      // Update user credit limit
      return await storage.updateUserCreditLimit(userId, creditLimit);
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      throw new ServiceError('Failed to update user credit limit', error);
    }
  }

  // Private helper methods
  private async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16).toString("hex");
    const buf = (await scryptAsync(password, salt, 64)) as Buffer;
    return `${buf.toString("hex")}.${salt}`;
  }

  private async comparePasswords(supplied: string, stored: string): Promise<boolean> {
    const [hashed, salt] = stored.split(".");
    const hashedBuf = Buffer.from(hashed, "hex");
    const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
    return timingSafeEqual(hashedBuf, suppliedBuf);
  }
}

export const userService = new UserServiceImpl();