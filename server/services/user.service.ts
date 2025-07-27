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
  
  // Analytics methods
  getUserAnalytics(): Promise<any>;
}

class UserServiceImpl implements UserService {
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
      // This would need to be implemented in storage
      // For now, we'll throw an error indicating it's not implemented
      throw new ServiceError('Get all users not implemented in storage layer');
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

      // This would need to be implemented in storage
      // await storage.updateUser(id, { isActive: false });
      throw new ServiceError('User deactivation not implemented in storage layer');
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

      // This would need to be implemented in storage
      // await storage.updateUser(id, { isActive: true });
      throw new ServiceError('User reactivation not implemented in storage layer');
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      throw new ServiceError('Failed to reactivate user', error);
    }
  }

  async getUserAnalytics(): Promise<any> {
    try {
      // This would require implementing user counting in storage
      const analytics = {
        totalUsers: 0,
        activeUsers: 0,
        usersByRole: {
          b2b_user: 0,
          admin: 0,
          super_admin: 0,
        },
        recentRegistrations: 0, // Last 30 days
      };

      // Implementation would go here when storage methods are available
      return analytics;
    } catch (error) {
      throw new ServiceError('Failed to get user analytics', error);
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