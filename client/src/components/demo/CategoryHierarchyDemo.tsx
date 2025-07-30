import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, ChevronDown, Folder, FolderOpen, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { type CategoryWithChildren } from '@shared/schema';

export function CategoryHierarchyDemo() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['software-cat']));

  // Fetch all categories to build hierarchy manually
  const { data: allCategories = [], isLoading } = useQuery({
    queryKey: ['/api/categories'],
    staleTime: 5 * 60 * 1000,
  });

  // Build hierarchy from flat array
  const buildHierarchy = (categories: any[]): CategoryWithChildren[] => {
    const categoryMap = new Map<string, CategoryWithChildren>();
    const rootCategories: CategoryWithChildren[] = [];

    // Create map of all categories
    categories.forEach((cat: any) => {
      categoryMap.set(cat.id, { ...cat, children: [] });
    });

    // Build tree structure
    categories.forEach((cat: any) => {
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

  const hierarchy = buildHierarchy(allCategories.filter((cat: any) => cat.isActive !== false));

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
    const isSelected = selectedCategory === category.id;

    return (
      <div key={category.id} className="w-full">
        <div
          className={`flex items-center gap-2 py-2 px-3 rounded-lg transition-colors cursor-pointer hover:bg-gray-100 ${
            isSelected ? 'bg-yellow-50 border border-yellow-200' : ''
          }`}
          style={{ marginLeft: `${depth * 20}px` }}
          onClick={() => setSelectedCategory(category.id)}
        >
          {hasChildren ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpanded(category.id);
              }}
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

          <span className={`flex-1 text-sm ${isSelected ? 'font-medium text-yellow-800' : ''} ${
            depth === 0 ? 'font-medium' : depth === 1 ? 'text-gray-700' : 'text-gray-600'
          }`}>
            {category.name}
          </span>

          <Badge variant="secondary" className="text-xs">
            L{category.level}
          </Badge>
        </div>

        {hasChildren && isExpanded && (
          <div className="mt-1">
            {category.children!.map(child => renderCategory(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const selectedCategoryDetails = allCategories.find((cat: any) => cat.id === selectedCategory);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-yellow-500 border-t-transparent" />
            Loading category hierarchy...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Category Tree */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Folder className="h-5 w-5 text-yellow-600" />
            3-Level Category Hierarchy
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1 max-h-[500px] overflow-y-auto">
            {hierarchy.map(category => renderCategory(category))}
          </div>
          
          <div className="mt-4 pt-4 border-t text-xs text-gray-500">
            <div className="flex justify-between">
              <span>Root categories: {hierarchy.length}</span>
              <span>Total categories: {allCategories.filter((cat: any) => cat.isActive !== false).length}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Selected Category Details */}
      <Card>
        <CardHeader>
          <CardTitle>Category Details</CardTitle>
        </CardHeader>
        <CardContent>
          {selectedCategoryDetails ? (
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-lg">{selectedCategoryDetails.name}</h3>
                {selectedCategoryDetails.description && (
                  <p className="text-gray-600 mt-1">{selectedCategoryDetails.description}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Level:</span>
                  <Badge variant="outline" className="ml-2">
                    {selectedCategoryDetails.level}
                  </Badge>
                </div>
                <div>
                  <span className="font-medium">Sort Order:</span>
                  <span className="ml-2">{selectedCategoryDetails.sortOrder || 0}</span>
                </div>
              </div>

              <div>
                <span className="font-medium text-sm">Materialized Path:</span>
                <code className="block mt-1 p-2 bg-gray-100 rounded text-xs">
                  {selectedCategoryDetails.path}
                </code>
              </div>

              <div>
                <span className="font-medium text-sm">Human-Readable Path:</span>
                <div className="mt-1 p-2 bg-gray-50 rounded text-sm">
                  {selectedCategoryDetails.pathName}
                </div>
              </div>

              {selectedCategoryDetails.parentId && (
                <div>
                  <span className="font-medium text-sm">Parent ID:</span>
                  <code className="ml-2 text-xs">{selectedCategoryDetails.parentId}</code>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Select a category to view details</p>
              <p className="text-xs mt-2">Click on any category in the tree to see its properties</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}