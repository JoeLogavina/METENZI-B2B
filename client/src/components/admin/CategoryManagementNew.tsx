import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { 
  Plus, Edit, Trash2, Search, Filter, MoreHorizontal, 
  Folder, Package, FileText, ChevronRight, Eye, EyeOff 
} from 'lucide-react';
import { type Category } from '@shared/schema';

interface CategoryFormData {
  name: string;
  description: string;
  parentId: string | null;
  level: number;
  sortOrder: number;
  isActive: boolean;
}

export default function CategoryManagement() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // State management
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

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
      toast({
        title: "Success",
        description: "Category created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      resetForm();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to create category: ${error.message}`,
        variant: "destructive",
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
      toast({
        title: "Success",
        description: "Category updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      resetForm();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update category: ${error.message}`,
        variant: "destructive",
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
      toast({
        title: "Success",
        description: "Category deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to delete category: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Helper functions
  const getParentCategoryName = (parentId: string | null): string => {
    if (!parentId) return 'Root';
    const parent = allCategories.find(cat => cat.id === parentId);
    return parent ? parent.name : 'Unknown';
  };

  const getCategoryPath = (category: Category): string => {
    return category.pathName || category.name;
  };

  const getParentOptions = () => {
    const options = [{ value: 'root', label: 'Root Category (Level 1)', level: 0 }];
    
    allCategories
      .filter(cat => cat.level < 3 && cat.isActive !== false)
      .forEach(cat => {
        options.push({
          value: cat.id,
          label: `${cat.name} (Level ${cat.level})`,
          level: cat.level
        });
      });
    
    return options;
  };

  // Filtered and paginated data
  const filteredCategories = useMemo(() => {
    return allCategories.filter(category => {
      const matchesSearch = category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (category.description && category.description.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesLevel = filterLevel === 'all' || category.level.toString() === filterLevel;
      
      const matchesStatus = filterStatus === 'all' || 
                           (filterStatus === 'active' && category.isActive !== false) ||
                           (filterStatus === 'inactive' && category.isActive === false);
      
      return matchesSearch && matchesLevel && matchesStatus;
    });
  }, [allCategories, searchTerm, filterLevel, filterStatus]);

  const paginatedCategories = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredCategories.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredCategories, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredCategories.length / itemsPerPage);

  // Event handlers
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

  const handleSelectCategory = (categoryId: string, checked: boolean) => {
    const newSelected = new Set(selectedCategories);
    if (checked) {
      newSelected.add(categoryId);
    } else {
      newSelected.delete(categoryId);
    }
    setSelectedCategories(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedCategories(new Set(paginatedCategories.map(cat => cat.id)));
    } else {
      setSelectedCategories(new Set());
    }
  };

  const handleBulkDelete = () => {
    if (selectedCategories.size === 0) return;
    
    if (confirm(`Are you sure you want to delete ${selectedCategories.size} categories?`)) {
      selectedCategories.forEach(categoryId => {
        deleteCategoryMutation.mutate(categoryId);
      });
      setSelectedCategories(new Set());
    }
  };

  const toggleCategoryStatus = (category: Category) => {
    updateCategoryMutation.mutate({
      id: category.id,
      data: { 
        name: category.name,
        description: category.description || '',
        parentId: category.parentId,
        level: category.level,
        sortOrder: category.sortOrder || 1,
        isActive: !category.isActive 
      }
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading categories...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-2xl font-bold text-[#6E6F71]">
            Category Management
          </CardTitle>
          <Dialog open={showCategoryForm} onOpenChange={setShowCategoryForm}>
            <DialogTrigger asChild>
              <Button className="bg-[#FFB20F] hover:bg-[#e6a00e] text-white">
                <Plus className="h-4 w-4 mr-2" />
                Add Category
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
                    value={categoryFormData.parentId || 'root'}
                    onValueChange={(value) => {
                      const parent = allCategories.find((cat) => cat.id === value);
                      setCategoryFormData(prev => ({
                        ...prev,
                        parentId: value === 'root' ? null : value,
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
                          value={option.value || 'root'}
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
      </CardHeader>

      <CardContent>
        {/* Search and Filter Controls */}
        <div className="mb-6 space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search categories..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="flex gap-2">
              <Select value={filterLevel} onValueChange={setFilterLevel}>
                <SelectTrigger className="w-[140px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  <SelectItem value="1">Level 1</SelectItem>
                  <SelectItem value="2">Level 2</SelectItem>
                  <SelectItem value="3">Level 3</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedCategories.size > 0 && (
            <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600">
                {selectedCategories.size} selected
              </span>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleBulkDelete}
                disabled={deleteCategoryMutation.isPending}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete Selected
              </Button>
            </div>
          )}
        </div>

        {/* Categories Table */}
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={paginatedCategories.length > 0 && selectedCategories.size === paginatedCategories.length}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Path</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Parent</TableHead>
                <TableHead>Sort</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedCategories.map((category) => (
                <TableRow key={category.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedCategories.has(category.id)}
                      onCheckedChange={(checked) => handleSelectCategory(category.id, checked as boolean)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {category.level === 1 ? (
                        <Folder className="h-4 w-4 text-yellow-600" />
                      ) : category.level === 2 ? (
                        <Package className="h-4 w-4 text-blue-500" />
                      ) : (
                        <FileText className="h-4 w-4 text-green-500" />
                      )}
                      <div>
                        <div className="font-medium">{category.name}</div>
                        {category.description && (
                          <div className="text-sm text-gray-500 truncate max-w-[200px]">
                            {category.description}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-mono text-gray-600">
                      {getCategoryPath(category)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      Level {category.level}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-gray-600">
                      {getParentCategoryName(category.parentId)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{category.sortOrder || 1}</span>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggleCategoryStatus(category)}
                      className="h-8 px-2"
                    >
                      {category.isActive !== false ? (
                        <div className="flex items-center gap-1">
                          <Eye className="h-3 w-3 text-green-600" />
                          <span className="text-xs text-green-600">Active</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <EyeOff className="h-3 w-3 text-gray-400" />
                          <span className="text-xs text-gray-400">Inactive</span>
                        </div>
                      )}
                    </Button>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(category)}
                        className="h-8 w-8 p-0"
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this category?')) {
                            deleteCategoryMutation.mutate(category.id);
                          }
                        }}
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-gray-600">
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredCategories.length)} of {filteredCategories.length} categories
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <Button
                  key={page}
                  size="sm"
                  variant={currentPage === page ? "default" : "outline"}
                  onClick={() => setCurrentPage(page)}
                  className={currentPage === page ? "bg-[#FFB20F] hover:bg-[#e6a00e]" : ""}
                >
                  {page}
                </Button>
              ))}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}

        {filteredCategories.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            {searchTerm || filterLevel !== 'all' || filterStatus !== 'all' 
              ? 'No categories match your filters.' 
              : 'No categories found. Create your first category to get started.'}
          </div>
        )}
      </CardContent>
    </Card>
  );
}