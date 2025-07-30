import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, ChevronDown, Folder, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { type CategoryWithChildren } from '@shared/schema';

interface HierarchicalCategoryFilterProps {
  selectedCategoryId?: string;
  onCategorySelect?: (categoryId: string | null) => void;
  showProductCounts?: boolean;
  className?: string;
}

export function HierarchicalCategoryFilter({
  selectedCategoryId,
  onCategorySelect,
  showProductCounts = true,
  className
}: HierarchicalCategoryFilterProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [selectedPath, setSelectedPath] = useState<string[]>([]);

  // Fetch category hierarchy
  const { data: hierarchy = [], isLoading, error } = useQuery<CategoryWithChildren[]>({
    queryKey: ['/api/categories/hierarchy'],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch selected category path for breadcrumbs  
  const { data: categoryPath } = useQuery<CategoryWithChildren[]>({
    queryKey: ['/api/categories', selectedCategoryId, 'path'],
    enabled: !!selectedCategoryId,
    staleTime: 5 * 60 * 1000,
  });

  // Update selected path when category changes
  useEffect(() => {
    if (categoryPath && categoryPath.length > 0) {
      setSelectedPath(categoryPath.map(cat => cat.id));
      // Auto-expand path to selected category
      const pathIds = categoryPath.map(cat => cat.id);
      setExpandedCategories(prev => new Set([...Array.from(prev), ...pathIds]));
    }
  }, [categoryPath]);

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

  const handleCategorySelect = (category: CategoryWithChildren) => {
    onCategorySelect?.(category.id);
  };

  const handleClearSelection = () => {
    onCategorySelect?.(null);
    setSelectedPath([]);
  };

  const renderCategory = (category: CategoryWithChildren, depth: number = 0) => {
    const hasChildren = category.children && category.children.length > 0;
    const isExpanded = expandedCategories.has(category.id);
    const isSelected = selectedCategoryId === category.id;
    const isInPath = selectedPath.includes(category.id);

    return (
      <div key={category.id} className={cn("w-full", depth > 0 && "ml-4")}>
        <div
          className={cn(
            "flex items-center gap-2 py-2 px-3 rounded-lg transition-colors cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800",
            isSelected && "bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800",
            isInPath && !isSelected && "bg-gray-50 dark:bg-gray-900"
          )}
          onClick={() => handleCategorySelect(category)}
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
          ) : (
            <div className={cn(
              "h-2 w-2 rounded-full",
              depth === 1 ? "bg-blue-500" : "bg-green-500"
            )} />
          )}

          <span className={cn(
            "flex-1 text-sm",
            isSelected && "font-medium text-yellow-800 dark:text-yellow-200",
            depth === 0 && "font-medium",
            depth === 1 && "text-gray-700 dark:text-gray-300",
            depth === 2 && "text-gray-600 dark:text-gray-400"
          )}>
            {category.name}
          </span>

          {showProductCounts && category.productCount !== undefined && (
            <Badge variant="secondary" className="text-xs">
              {category.productCount}
            </Badge>
          )}
        </div>

        {hasChildren && isExpanded && (
          <div className="mt-1">
            {category.children!.map(child => renderCategory(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className={cn("space-y-2", className)}>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-yellow-500 border-t-transparent" />
          Loading categories...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("p-4 text-center", className)}>
        <p className="text-sm text-red-600 dark:text-red-400">
          Failed to load categories
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-gray-900 dark:text-gray-100">
          Categories
        </h3>
        {selectedCategoryId && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearSelection}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Clear
          </Button>
        )}
      </div>

      {/* Breadcrumbs for selected category */}
      {categoryPath && categoryPath.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 text-xs text-gray-600 dark:text-gray-400 p-2 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <span>Selected:</span>
          {categoryPath.map((cat, index) => (
            <React.Fragment key={cat.id}>
              {index > 0 && <ChevronRight className="h-3 w-3" />}
              <span className={index === categoryPath.length - 1 ? "font-medium text-yellow-600" : ""}>
                {cat.name}
              </span>
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Category Tree */}
      <div className="h-[400px] overflow-y-auto">
        <div className="space-y-1">
          {hierarchy.map(category => renderCategory(category))}
        </div>
      </div>

      {/* Footer Statistics */}
      <div className="text-xs text-gray-500 pt-2 border-t">
        {hierarchy.length} root categories
      </div>
    </div>
  );
}