import { storage } from '../storage';
import { 
  type Category, 
  type CategoryWithChildren,
  type InsertCategory,
  insertCategorySchema 
} from '@shared/schema';
// Error classes for the service
class ServiceError extends Error {
  constructor(message: string, public originalError?: any) {
    super(message);
    this.name = 'ServiceError';
  }
}

class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export interface CategoryService {
  // Hierarchy operations
  getCategoryHierarchy(): Promise<CategoryWithChildren[]>;
  getCategoryTree(parentId?: string): Promise<CategoryWithChildren[]>;
  getCategoryPath(categoryId: string): Promise<Category[]>;
  getCategoryBreadcrumbs(categoryId: string): Promise<string[]>;
  
  // CRUD operations
  getAllCategories(): Promise<Category[]>;
  getCategoriesByLevel(level: number): Promise<Category[]>;
  getCategoryById(id: string): Promise<Category>;
  createCategory(categoryData: InsertCategory): Promise<Category>;
  updateCategory(id: string, updateData: Partial<InsertCategory>): Promise<Category>;
  deleteCategory(id: string): Promise<void>;
  
  // Utility operations
  validateCategoryHierarchy(parentId: string, level: number): Promise<boolean>;
  updateCategoryPaths(categoryId: string): Promise<void>;
  moveCategoryToParent(categoryId: string, newParentId: string | null): Promise<Category>;
}

export class CategoryServiceImpl implements CategoryService {
  
  // Get complete category hierarchy (tree structure)
  async getCategoryHierarchy(): Promise<CategoryWithChildren[]> {
    try {
      const allCategories = await storage.getAllCategoriesHierarchy();
      return this.buildCategoryTree(allCategories);
    } catch (error) {
      throw new ServiceError('Failed to get category hierarchy', error);
    }
  }
  
  // Get category tree starting from specific parent
  async getCategoryTree(parentId?: string): Promise<CategoryWithChildren[]> {
    try {
      const categories = await storage.getCategoriesByParent(parentId);
      const categoriesWithChildren = await Promise.all(
        categories.map(async (category) => {
          const children = await this.getCategoryTree(category.id);
          const productCount = await storage.getCategoryProductCount(category.id);
          return {
            ...category,
            children: children.length > 0 ? children : undefined,
            productCount
          };
        })
      );
      return categoriesWithChildren;
    } catch (error) {
      throw new ServiceError('Failed to get category tree', error);
    }
  }
  
  // Get full path from root to category
  async getCategoryPath(categoryId: string): Promise<Category[]> {
    try {
      const category = await storage.getCategoryById(categoryId);
      if (!category) {
        throw new NotFoundError('Category not found');
      }
      
      const path: Category[] = [category];
      let currentCategory = category;
      
      while (currentCategory.parentId) {
        const parent = await storage.getCategoryById(currentCategory.parentId);
        if (!parent) break;
        path.unshift(parent);
        currentCategory = parent;
      }
      
      return path;
    } catch (error) {
      throw new ServiceError('Failed to get category path', error);
    }
  }
  
  // Get breadcrumb names for category
  async getCategoryBreadcrumbs(categoryId: string): Promise<string[]> {
    try {
      const path = await this.getCategoryPath(categoryId);
      return path.map(cat => cat.name);
    } catch (error) {
      throw new ServiceError('Failed to get category breadcrumbs', error);
    }
  }
  
  // Get all categories (flat list)
  async getAllCategories(): Promise<Category[]> {
    try {
      return await storage.getAllCategoriesHierarchy();
    } catch (error) {
      throw new ServiceError('Failed to get all categories', error);
    }
  }
  
  // Get categories by level (1, 2, or 3)
  async getCategoriesByLevel(level: number): Promise<Category[]> {
    try {
      if (level < 1 || level > 3) {
        throw new ValidationError('Level must be between 1 and 3');
      }
      return await storage.getCategoriesByLevel(level);
    } catch (error) {
      throw new ServiceError('Failed to get categories by level', error);
    }
  }
  
  // Get single category by ID
  async getCategoryById(id: string): Promise<Category> {
    try {
      const category = await storage.getCategoryById(id);
      if (!category) {
        throw new NotFoundError('Category not found');
      }
      return category;
    } catch (error) {
      throw new ServiceError('Failed to get category', error);
    }
  }
  
  // Create new category with hierarchy validation
  async createCategory(categoryData: InsertCategory): Promise<Category> {
    try {
      // Validate input
      const validatedData = insertCategorySchema.parse(categoryData);
      
      // Determine level and validate hierarchy
      let level = 1;
      let parentPath = '';
      let parentPathName = '';
      
      if (validatedData.parentId) {
        const parent = await storage.getCategoryById(validatedData.parentId);
        if (!parent) {
          throw new ValidationError('Parent category not found');
        }
        
        level = parent.level + 1;
        if (level > 3) {
          throw new ValidationError('Maximum category depth of 3 levels exceeded');
        }
        
        parentPath = parent.path;
        parentPathName = parent.pathName;
      }
      
      // Generate materialized paths
      const slug = this.generateSlug(validatedData.name);
      const path = parentPath + '/' + slug;
      const pathName = parentPathName ? parentPathName + ' > ' + validatedData.name : validatedData.name;
      
      // Create category with computed fields
      const categoryToCreate = {
        ...validatedData,
        level,
        path,
        pathName,
        sortOrder: validatedData.sortOrder || 0
      };
      
      return await storage.createCategoryHierarchy(categoryToCreate);
    } catch (error) {
      if (error instanceof ValidationError) throw error;
      throw new ServiceError('Failed to create category', error);
    }
  }
  
  // Update category and recalculate paths if needed
  async updateCategory(id: string, updateData: Partial<InsertCategory>): Promise<Category> {
    try {
      const existingCategory = await storage.getCategoryById(id);
      if (!existingCategory) {
        throw new NotFoundError('Category not found');
      }
      
      // If name is being updated, recalculate paths
      if (updateData.name && updateData.name !== existingCategory.name) {
        const slug = this.generateSlug(updateData.name);
        const pathParts = existingCategory.path.split('/');
        pathParts[pathParts.length - 1] = slug;
        updateData.path = pathParts.join('/');
        
        const pathNameParts = existingCategory.pathName.split(' > ');
        pathNameParts[pathNameParts.length - 1] = updateData.name;
        updateData.pathName = pathNameParts.join(' > ');
      }
      
      const updatedCategory = await storage.updateCategoryHierarchy(id, updateData);
      
      // Update child category paths if path changed
      if (updateData.path && updateData.path !== existingCategory.path) {
        await this.updateChildCategoryPaths(id, updateData.path, updateData.pathName!);
      }
      
      return updatedCategory;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new ServiceError('Failed to update category', error);
    }
  }
  
  // Soft delete category (set isActive = false)
  async deleteCategory(id: string): Promise<void> {
    try {
      const category = await storage.getCategoryById(id);
      if (!category) {
        throw new NotFoundError('Category not found');
      }
      
      // Check if category has children
      const children = await storage.getCategoriesByParent(id);
      if (children.length > 0) {
        throw new ValidationError('Cannot delete category with subcategories');
      }
      
      // Check if category has products
      const productCount = await storage.getCategoryProductCount(id);
      if (productCount > 0) {
        throw new ValidationError('Cannot delete category with products');
      }
      
      await storage.updateCategoryHierarchy(id, { isActive: false });
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) throw error;
      throw new ServiceError('Failed to delete category', error);
    }
  }
  
  // Validate category hierarchy constraints
  async validateCategoryHierarchy(parentId: string, level: number): Promise<boolean> {
    try {
      if (level > 3) return false;
      
      const parent = await storage.getCategoryById(parentId);
      if (!parent) return false;
      
      return parent.level === level - 1;
    } catch (error) {
      return false;
    }
  }
  
  // Update materialized paths for category and its children
  async updateCategoryPaths(categoryId: string): Promise<void> {
    try {
      const category = await storage.getCategoryById(categoryId);
      if (!category) return;
      
      await this.updateChildCategoryPaths(categoryId, category.path, category.pathName);
    } catch (error) {
      throw new ServiceError('Failed to update category paths', error);
    }
  }
  
  // Move category to new parent
  async moveCategoryToParent(categoryId: string, newParentId: string | null): Promise<Category> {
    try {
      const category = await storage.getCategoryById(categoryId);
      if (!category) {
        throw new NotFoundError('Category not found');
      }
      
      let newLevel = 1;
      let newPath = '';
      let newPathName = '';
      
      if (newParentId) {
        const newParent = await storage.getCategoryById(newParentId);
        if (!newParent) {
          throw new ValidationError('New parent category not found');
        }
        
        newLevel = newParent.level + 1;
        if (newLevel > 3) {
          throw new ValidationError('Move would exceed maximum depth of 3 levels');
        }
        
        newPath = newParent.path;
        newPathName = newParent.pathName;
      }
      
      // Generate new paths
      const slug = this.generateSlug(category.name);
      const finalPath = newPath ? newPath + '/' + slug : '/' + slug;
      const finalPathName = newPathName ? newPathName + ' > ' + category.name : category.name;
      
      // Update category
      const updateData = {
        parentId: newParentId,
        level: newLevel,
        path: finalPath,
        pathName: finalPathName
      };
      
      const updatedCategory = await storage.updateCategoryHierarchy(categoryId, updateData);
      
      // Update all descendant paths
      await this.updateChildCategoryPaths(categoryId, finalPath, finalPathName);
      
      return updatedCategory;
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) throw error;
      throw new ServiceError('Failed to move category', error);
    }
  }
  
  // Helper: Build category tree from flat array
  private buildCategoryTree(categories: Category[]): CategoryWithChildren[] {
    const categoryMap = new Map<string, CategoryWithChildren>();
    const rootCategories: CategoryWithChildren[] = [];
    
    // Create map of all categories
    categories.forEach(cat => {
      categoryMap.set(cat.id, { ...cat, children: [] });
    });
    
    // Build tree structure
    categories.forEach(cat => {
      const categoryWithChildren = categoryMap.get(cat.id)!;
      
      if (cat.parentId && categoryMap.has(cat.parentId)) {
        const parent = categoryMap.get(cat.parentId)!;
        parent.children = parent.children || [];
        parent.children.push(categoryWithChildren);
      } else {
        rootCategories.push(categoryWithChildren);
      }
    });
    
    // Sort by sortOrder
    const sortCategories = (cats: CategoryWithChildren[]) => {
      cats.sort((a, b) => a.sortOrder - b.sortOrder);
      cats.forEach(cat => {
        if (cat.children) {
          sortCategories(cat.children);
        }
      });
    };
    
    sortCategories(rootCategories);
    return rootCategories;
  }
  
  // Helper: Generate URL-friendly slug
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }
  
  // Helper: Update paths for all child categories
  private async updateChildCategoryPaths(parentId: string, parentPath: string, parentPathName: string): Promise<void> {
    const children = await storage.getCategoriesByParent(parentId);
    
    for (const child of children) {
      const slug = this.generateSlug(child.name);
      const newPath = parentPath + '/' + slug;
      const newPathName = parentPathName + ' > ' + child.name;
      
      await storage.updateCategoryHierarchy(child.id, {
        path: newPath,
        pathName: newPathName
      });
      
      // Recursively update children
      await this.updateChildCategoryPaths(child.id, newPath, newPathName);
    }
  }
}

export const categoryService = new CategoryServiceImpl();