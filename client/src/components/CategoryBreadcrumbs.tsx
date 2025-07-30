import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { type Category } from '@shared/schema';

interface CategoryBreadcrumbsProps {
  categoryId?: string;
  onCategorySelect?: (categoryId: string | null) => void;
  className?: string;
  showHome?: boolean;
}

export function CategoryBreadcrumbs({
  categoryId,
  onCategorySelect,
  className,
  showHome = true
}: CategoryBreadcrumbsProps) {
  const { data: categoryPath = [], isLoading } = useQuery<Category[]>({
    queryKey: ['/api/categories', categoryId, 'path'],
    enabled: !!categoryId,
    staleTime: 5 * 60 * 1000,
  });

  if (!categoryId || isLoading || categoryPath.length === 0) {
    return null;
  }

  const handleBreadcrumbClick = (targetCategoryId: string | null) => {
    onCategorySelect?.(targetCategoryId);
  };

  return (
    <nav className={cn("flex items-center space-x-1 text-sm", className)}>
      {showHome && (
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleBreadcrumbClick(null)}
            className="h-8 px-2 text-gray-500 hover:text-gray-700"
          >
            <Home className="h-4 w-4" />
          </Button>
          <ChevronRight className="h-4 w-4 text-gray-400" />
        </>
      )}

      {categoryPath.map((category, index) => (
        <React.Fragment key={category.id}>
          {index > 0 && <ChevronRight className="h-4 w-4 text-gray-400" />}
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleBreadcrumbClick(category.id)}
            className={cn(
              "h-8 px-3 text-gray-600 hover:text-gray-900 hover:bg-gray-100",
              index === categoryPath.length - 1 && "text-gray-900 font-medium bg-gray-100"
            )}
          >
            {category.name}
          </Button>
        </React.Fragment>
      ))}
    </nav>
  );
}