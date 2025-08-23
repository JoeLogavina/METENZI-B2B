import { Router } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { authenticate } from '../middleware/auth.middleware';
import bcrypt from 'bcrypt';

const router = Router();

// All user routes require authentication
router.use(authenticate);

// Validation schemas
const userParamsSchema = z.object({
  id: z.string().min(1, 'User ID is required'),
});

const createBranchSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  email: z.string().email().optional(),
  branchName: z.string().min(1, 'Branch name is required'),
  branchCode: z.string().optional(),
  companyName: z.string().optional(),
  tenantId: z.string().default('eur'),
});

// GET /api/users/:id/hierarchy - Get company hierarchy (main company + all branches)
router.get('/:id/hierarchy', async (req, res) => {
  try {
    const { id: userId } = userParamsSchema.parse(req.params);
    
    // Verify user is authenticated
    if (!req.user) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }
    
    // Verify user has access to this data
    if (req.user.id !== userId && req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      // Allow if user is requesting their parent company hierarchy
      const user = await storage.getUser(req.user.id);
      if (!user || user.parentCompanyId !== userId) {
        return res.status(403).json({
          error: 'FORBIDDEN',
          message: 'You can only access your own company hierarchy'
        });
      }
    }
    
    const hierarchy = await storage.getCompanyHierarchy(userId);
    
    if (!hierarchy) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Company hierarchy not found'
      });
    }
    
    // Filter branches based on user role and permissions
    let filteredBranches = hierarchy.branches;
    
    // If requesting user is not admin/super_admin and is not the main company
    if (req.user.id !== userId && req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      const requestingUser = await storage.getUser(req.user.id);
      
      // If requesting user is a branch, they should only see their own branch
      if (requestingUser && requestingUser.branchType === 'branch') {
        filteredBranches = hierarchy.branches.filter(branch => branch.id === req.user!.id);
      }
    }
    
    // Remove passwords from response
    const { password: mainPassword, ...mainCompanyWithoutPassword } = hierarchy.mainCompany;
    const branchesWithoutPasswords = filteredBranches.map(({ password, ...branch }) => branch);
    
    res.json({
      data: {
        mainCompany: mainCompanyWithoutPassword,
        branches: branchesWithoutPasswords
      },
      message: 'Company hierarchy retrieved successfully'
    });
  } catch (error) {
    console.error('Error getting company hierarchy:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid input data',
        details: error.errors
      });
    }
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to get company hierarchy'
    });
  }
});

// GET /api/users/:id/branches - Get all branches for a company
router.get('/:id/branches', async (req, res) => {
  try {
    const { id: parentCompanyId } = userParamsSchema.parse(req.params);
    
    // Verify user is authenticated
    if (!req.user) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }
    
    // Verify user has access to this data
    if (req.user.id !== parentCompanyId && req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      // Allow if user is requesting their parent company branches
      const user = await storage.getUser(req.user.id);
      if (!user || user.parentCompanyId !== parentCompanyId) {
        return res.status(403).json({
          error: 'FORBIDDEN',
          message: 'You can only access your own company branches'
        });
      }
    }
    
    const branches = await storage.getUserBranches(parentCompanyId);
    
    // Remove passwords from response
    const branchesWithoutPasswords = branches.map(({ password, ...branch }) => branch);
    
    res.json({
      data: branchesWithoutPasswords,
      message: 'Branches retrieved successfully'
    });
  } catch (error) {
    console.error('Error getting user branches:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid input data',
        details: error.errors
      });
    }
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to get user branches'
    });
  }
});

// POST /api/users/:id/branches - Create new branch for a company
router.post('/:id/branches', async (req, res) => {
  try {
    const { id: parentCompanyId } = userParamsSchema.parse(req.params);
    const branchData = createBranchSchema.parse(req.body);
    
    // Verify user is authenticated
    if (!req.user) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }
    
    // Verify user has permission to create branches for this company
    // Only the main company user or admins can create branches
    if (req.user.id !== parentCompanyId && req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'You can only create branches for your own company'
      });
    }
    
    // Verify the parent company exists and is a main company
    const parentCompany = await storage.getUser(parentCompanyId);
    if (!parentCompany) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Parent company not found'
      });
    }
    
    if (parentCompany.branchType === 'branch') {
      return res.status(400).json({
        error: 'INVALID_PARENT',
        message: 'Cannot create branches under a branch user'
      });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(branchData.password, 10);
    
    const branch = await storage.createBranchUser(parentCompanyId, {
      ...branchData,
      password: hashedPassword
    });
    
    const { password, ...branchWithoutPassword } = branch;
    res.status(201).json({
      data: branchWithoutPassword,
      message: 'Branch created successfully'
    });
  } catch (error) {
    console.error('Error creating branch:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid input data',
        details: error.errors
      });
    }
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to create branch'
    });
  }
});

export { router as usersRouter };