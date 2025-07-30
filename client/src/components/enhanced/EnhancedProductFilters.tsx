import React, { useState } from 'react';
import { Search, Filter, X, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { HierarchicalCategoryFilter } from '@/components/HierarchicalCategoryFilter';
import { CategoryBreadcrumbs } from '@/components/CategoryBreadcrumbs';
import { cn } from '@/lib/utils';

export interface ProductFilters {
  search: string;
  categoryId: string | null;
  region: string;
  priceRange: {
    min: number | null;
    max: number | null;
  };
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

interface EnhancedProductFiltersProps {
  filters: ProductFilters;
  onFiltersChange: (filters: ProductFilters) => void;
  className?: string;
}

export function EnhancedProductFilters({
  filters,
  onFiltersChange,
  className
}: EnhancedProductFiltersProps) {
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen] = useState(true);

  const updateFilters = (updates: Partial<ProductFilters>) => {
    onFiltersChange({ ...filters, ...updates });
  };

  const clearFilters = () => {
    onFiltersChange({
      search: '',
      categoryId: null,
      region: '',
      priceRange: { min: null, max: null },
      sortBy: 'name',
      sortOrder: 'asc'
    });
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.search) count++;
    if (filters.categoryId) count++;
    if (filters.region) count++;
    if (filters.priceRange.min !== null || filters.priceRange.max !== null) count++;
    return count;
  };

  const activeFilterCount = getActiveFilterCount();

  return (
    <div className={cn("space-y-4", className)}>
      {/* Search Bar with Quick Actions */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search products..."
            value={filters.search}
            onChange={(e) => updateFilters({ search: e.target.value })}
            className="pl-10"
          />
          {filters.search && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => updateFilters({ search: '' })}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <Button
          variant="outline"
          onClick={() => setIsFiltersOpen(!isFiltersOpen)}
          className="relative"
        >
          <Filter className="h-4 w-4 mr-2" />
          Filters
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-2 h-5 w-5 p-0 text-xs">
              {activeFilterCount}
            </Badge>
          )}
        </Button>

        {activeFilterCount > 0 && (
          <Button variant="ghost" onClick={clearFilters} size="sm">
            Clear All
          </Button>
        )}
      </div>

      {/* Category Breadcrumbs */}
      {filters.categoryId && (
        <CategoryBreadcrumbs
          categoryId={filters.categoryId}
          onCategorySelect={(categoryId) => updateFilters({ categoryId })}
          className="px-4 py-2 bg-gray-50 dark:bg-gray-900 rounded-lg"
        />
      )}

      {/* Advanced Filters Panel */}
      <Collapsible open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
        <CollapsibleContent className="space-y-6 border rounded-lg p-4">
          {/* Hierarchical Category Filter */}
          <div className="space-y-3">
            <Collapsible open={isCategoryOpen} onOpenChange={setIsCategoryOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="flex items-center justify-between w-full p-0">
                  <Label className="text-sm font-medium">Categories</Label>
                  <ChevronDown className={cn(
                    "h-4 w-4 transition-transform",
                    isCategoryOpen && "rotate-180"
                  )} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <HierarchicalCategoryFilter
                  selectedCategoryId={filters.categoryId || undefined}
                  onCategorySelect={(categoryId) => updateFilters({ categoryId })}
                  showProductCounts={true}
                  className="mt-3"
                />
              </CollapsibleContent>
            </Collapsible>
          </div>

          <Separator />

          {/* Region Filter */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Region</Label>
            <Select value={filters.region} onValueChange={(region) => updateFilters({ region })}>
              <SelectTrigger>
                <SelectValue placeholder="Select region" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Regions</SelectItem>
                <SelectItem value="EUR">Europe (EUR)</SelectItem>
                <SelectItem value="KM">Konvertible Mark (KM)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Price Range Filter */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Price Range</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Min price"
                value={filters.priceRange.min || ''}
                onChange={(e) => updateFilters({
                  priceRange: {
                    ...filters.priceRange,
                    min: e.target.value ? parseFloat(e.target.value) : null
                  }
                })}
              />
              <span className="flex items-center text-gray-500">to</span>
              <Input
                type="number"
                placeholder="Max price"
                value={filters.priceRange.max || ''}
                onChange={(e) => updateFilters({
                  priceRange: {
                    ...filters.priceRange,
                    max: e.target.value ? parseFloat(e.target.value) : null
                  }
                })}
              />
            </div>
          </div>

          {/* Sort Options */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Sort By</Label>
            <div className="flex gap-2">
              <Select value={filters.sortBy} onValueChange={(sortBy) => updateFilters({ sortBy })}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="price">Price</SelectItem>
                  <SelectItem value="createdAt">Date Added</SelectItem>
                  <SelectItem value="category">Category</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={filters.sortOrder} onValueChange={(sortOrder: 'asc' | 'desc') => updateFilters({ sortOrder })}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">Ascending</SelectItem>
                  <SelectItem value="desc">Descending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Active Filters Summary */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.search && (
            <Badge variant="secondary" className="gap-1">
              Search: "{filters.search}"
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => updateFilters({ search: '' })}
              />
            </Badge>
          )}
          
          {filters.region && (
            <Badge variant="secondary" className="gap-1">
              Region: {filters.region}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => updateFilters({ region: '' })}
              />
            </Badge>
          )}
          
          {(filters.priceRange.min !== null || filters.priceRange.max !== null) && (
            <Badge variant="secondary" className="gap-1">
              Price: {filters.priceRange.min || '0'} - {filters.priceRange.max || '∞'}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => updateFilters({ priceRange: { min: null, max: null } })}
              />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}