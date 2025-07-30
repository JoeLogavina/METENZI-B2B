import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, ChevronRight, ChevronDown, Folder, FolderOpen, Package, FileText } from 'lucide-react';
import { type Category, type CategoryWithChildren } from '@shared/schema';

interface CategoryFormData {
  name: string;
  description: string;
  parentId: string | null;
  level: number;
  sortOrder: number;
  isActive: boolean;
}

export function CategoryManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['software-cat']));
  const [categoryFormData, setCategoryFormData] = useState<CategoryFormData>({
    name: '',
    description: '',
    parentId: null,
    level: 1,
    sortOrder: 1,
    isActive: true
  });

  // Fetch all categories
  const { data: allCategories = [], isLoading, refetch } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
    staleTime: 2 * 60 * 1000,
  });

  // Build hierarchy from flat array
  const buildHierarchy = (categories: Category[]): CategoryWithChildren[] => {
    const categoryMap = new Map<string, CategoryWithChildren>();
    const rootCategories: CategoryWithChildren[] = [];

    // Create map of all categories
    categories.forEach((cat) => {
      categoryMap.set(cat.id, { ...cat, children: [] });
    });

    // Build tree structure
    categories.forEach((cat) => {
      const categoryWithChildren = categoryMap.get(cat.id)!;
      
      if (cat.parentId && categoryMap.has(cat.parentId)) {
        const parent = categoryMap.get(cat.parentId)!;
        if (!parent.children) parent.children = [];
        parent.children.push(categoryWithChildren);
      } else {
        rootCategories.push(categoryWithChildren);
      }
    });

    // Sort by sortOrder
    const sortCategories = (cats: CategoryWithChildren[]) => {
      cats.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
      cats.forEach(cat => {
        if (cat.children) {
          sortCategories(cat.children);
        }
      });
    };

    sortCategories(rootCategories);
    return rootCategories;
  };

  const hierarchy = buildHierarchy(allCategories.filter((cat) => cat.isActive !== false));

  // Create category mutation
  const createCategoryMutation = useMutation({
    mutationFn: async (data: CategoryFormData) => {
      const response = await fetch('/api/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create category: ${response.statusText}`);
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Category created successfully" });
      setShowCategoryForm(false);
      resetForm();
      refetch();
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error?.message || "Failed to create category",
        variant: "destructive" 
      });
    },
  });

  // Update category mutation
  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CategoryFormData> }) => {
      const response = await fetch(`/api/categories/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update category: ${response.statusText}`);
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Category updated successfully" });
      setEditingCategory(null);
      resetForm();
      refetch();
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error?.message || "Failed to update category",
        variant: "destructive" 
      });
    },
  });

  // Delete category mutation
  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/categories/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error(`Failed to delete category: ${response.statusText}`);
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Category deleted successfully" });
      refetch();
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error?.message || "Failed to delete category",
        variant: "destructive" 
      });
    },
  });

  const resetForm = () => {
    setCategoryFormData({
      name: '',
      description: '',
      parentId: null,
      level: 1,
      sortOrder: 1,
      isActive: true
    });
    setShowCategoryForm(false);
    setEditingCategory(null);
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setCategoryFormData({
      name: category.name,
      description: category.description || '',
      parentId: category.parentId,
      level: category.level,
      sortOrder: category.sortOrder || 1,
      isActive: category.isActive !== false
    });
    setShowCategoryForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingCategory) {
      updateCategoryMutation.mutate({ 
        id: editingCategory.id, 
        data: categoryFormData 
      });
    } else {
      createCategoryMutation.mutate(categoryFormData);
    }
  };

  const toggleExpanded = (categoryId: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  const renderCategory = (category: CategoryWithChildren, depth: number = 0) => {
    const hasChildren = category.children && category.children.length > 0;
    const isExpanded = expandedCategories.has(category.id);

    return (
      <div key={category.id} className="w-full">
        <div
          className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-gray-50 border border-gray-200 mb-2"
          style={{ marginLeft: `${depth * 20}px` }}
        >
          {hasChildren ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => toggleExpanded(category.id)}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          ) : (
            <div className="w-6" />
          )}

          {depth === 0 ? (
            isExpanded ? (
              <FolderOpen className="h-4 w-4 text-yellow-600" />
            ) : (
              <Folder className="h-4 w-4 text-yellow-600" />
            )
          ) : depth === 1 ? (
            <Folder className="h-4 w-4 text-blue-500" />
          ) : (
            <Package className="h-4 w-4 text-green-500" />
          )}

          <span className="flex-1 font-medium text-sm">
            {category.name}
          </span>

          <Badge variant="outline" className="text-xs">
            L{category.level}
          </Badge>

          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleEdit(category)}
              className="h-8 w-8 p-0"
            >
              <Edit className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => deleteCategoryMutation.mutate(category.id)}
              disabled={hasChildren}
              className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className="mt-1">
            {category.children!.map(child => renderCategory(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const getParentOptions = () => {
    const options: { value: string; label: string; level: number }[] = [
      { value: '', label: 'Root Category (Level 1)', level: 0 }
    ];
    
    const addCategoryOptions = (cats: CategoryWithChildren[], level: number) => {
      cats.forEach(cat => {
        if (level < 2) { // Only allow up to level 2 as parents (max 3 levels)
          options.push({
            value: cat.id,
            label: `${'  '.repeat(level)}${cat.name} (Level ${level + 1})`,
            level: level + 1
          });
          if (cat.children) {
            addCategoryOptions(cat.children, level + 1);
          }
        }
      });
    };
    
    addCategoryOptions(hierarchy, 0);
    return options;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading categories...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[#6E6F71] uppercase tracking-[0.5px]">
            CATEGORY MANAGEMENT
          </h3>
          <p className="text-[#6E6F71]">Manage 3-level hierarchical category structure</p>
        </div>
        <Dialog open={showCategoryForm} onOpenChange={setShowCategoryForm}>
          <DialogTrigger asChild>
            <Button
              onClick={() => {
                resetForm();
                setShowCategoryForm(true);
              }}
              className="bg-[#FFB20F] hover:bg-[#e6a00e] text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              ADD CATEGORY
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingCategory ? 'Edit Category' : 'Create New Category'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Category Name</Label>
                <Input
                  id="name"
                  value={categoryFormData.name}
                  onChange={(e) => setCategoryFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter category name"
                  required
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={categoryFormData.description}
                  onChange={(e) => setCategoryFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Optional description"
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="parent">Parent Category</Label>
                <Select
                  value={categoryFormData.parentId || ''}
                  onValueChange={(value) => {
                    const parent = allCategories.find((cat: Category) => cat.id === value);
                    setCategoryFormData(prev => ({
                      ...prev,
                      parentId: value || null,
                      level: parent ? parent.level + 1 : 1
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select parent category" />
                  </SelectTrigger>
                  <SelectContent>
                    {getParentOptions().map(option => (
                      <SelectItem 
                        key={option.value || 'root'} 
                        value={option.value}
                        disabled={option.level >= 3}
                      >
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="sortOrder">Sort Order</Label>
                <Input
                  id="sortOrder"
                  type="number"
                  value={categoryFormData.sortOrder}
                  onChange={(e) => setCategoryFormData(prev => ({ 
                    ...prev, 
                    sortOrder: parseInt(e.target.value) || 1 
                  }))}
                  min="1"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={resetForm}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={createCategoryMutation.isPending || updateCategoryMutation.isPending}
                  className="bg-[#FFB20F] hover:bg-[#e6a00e] text-white"
                >
                  {editingCategory ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-yellow-600" />
            Category Hierarchy ({allCategories.length} total)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {hierarchy.length > 0 ? (
              hierarchy.map(category => renderCategory(category))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No categories found</p>
                <p className="text-sm mt-2">Click "Add Category" to create your first category</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}