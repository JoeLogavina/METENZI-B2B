import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Search, 
  Filter, 
  X, 
  ChevronDown, 
  ChevronRight,
  Package,
  Euro,
  Globe,
  Monitor,
  BarChart3,
  Calendar,
  Hash,
  Folder,
  SlidersHorizontal
} from 'lucide-react';
import { type Category } from '@shared/schema';
import { useTenant } from '@/contexts/TenantContext';

interface FilterState {
  search: string;
  categoryId: string;
  region: string;
  platform: string;
  priceMin: string;
  priceMax: string;
  stockLevel: string;
  dateAdded: string;
  sku: string;
  priceRange: [number, number];
  availability: string[];
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

interface AdvancedProductFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  productCount?: number;
}

const AdvancedProductFilters: React.FC<AdvancedProductFiltersProps> = ({
  filters,
  onFiltersChange,
  productCount = 0
}) => {
  console.log('🔥🔥🔥 ADVANCED PRODUCT FILTERS IS DEFINITELY RENDERING! 🔥🔥🔥');
  console.log('Filters received:', filters);
  console.log('Product count:', productCount);
  
  const { formatPrice } = useTenant();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['search', 'categories', 'price', 'availability'])
  );
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 1000]);

  // Fetch categories for the filter
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Build category hierarchy for display
  const buildCategoryHierarchy = (cats: Category[]) => {
    const categoryMap = new Map<string, Category & { children: Category[] }>();
    
    cats.forEach(cat => {
      categoryMap.set(cat.id, { ...cat, children: [] });
    });

    const rootCategories: (Category & { children: Category[] })[] = [];
    
    cats.forEach(cat => {
      const categoryWithChildren = categoryMap.get(cat.id)!;
      
      if (cat.parentId && categoryMap.has(cat.parentId)) {
        const parent = categoryMap.get(cat.parentId)!;
        parent.children.push(categoryWithChildren);
      } else {
        rootCategories.push(categoryWithChildren);
      }
    });

    const sortCategories = (categories: (Category & { children: Category[] })[]) => {
      categories.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
      categories.forEach(cat => {
        if (cat.children) sortCategories(cat.children);
      });
    };

    sortCategories(rootCategories);
    return rootCategories;
  };

  const categoryHierarchy = buildCategoryHierarchy(categories.filter(cat => cat.isActive !== false));

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  };

  const handleFilterChange = (key: keyof FilterState, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  };

  const handlePriceRangeChange = (value: [number, number]) => {
    setPriceRange(value);
    handleFilterChange('priceMin', value[0].toString());
    handleFilterChange('priceMax', value[1].toString());
  };

  const clearAllFilters = () => {
    onFiltersChange({
      search: '',
      categoryId: '',
      region: '',
      platform: '',
      priceMin: '',
      priceMax: '',
      stockLevel: '',
      dateAdded: '',
      sku: '',
      priceRange: [0, 1000],
      availability: [],
      sortBy: '',
      sortOrder: 'asc'
    });
    setPriceRange([0, 1000]);
  };

  const getActiveFilterCount = () => {
    return Object.entries(filters).filter(([key, value]) => {
      if (key === 'availability') return Array.isArray(value) && value.length > 0;
      if (key === 'priceRange') return false; // Handled by priceMin/priceMax
      return value !== '' && value !== 'all';
    }).length;
  };

  const renderCategoryOption = (category: Category & { children: Category[] }, depth: number = 0) => {
    const hasChildren = category.children && category.children.length > 0;
    const isSelected = filters.categoryId === category.id;

    return (
      <div key={category.id} className="w-full">
        <div
          className={`flex items-center gap-2 py-1.5 px-2 rounded cursor-pointer hover:bg-gray-50 ${
            isSelected ? 'bg-yellow-50 border-l-2 border-yellow-500' : ''
          }`}
          style={{ marginLeft: `${depth * 12}px` }}
          onClick={() => handleFilterChange('categoryId', isSelected ? '' : category.id)}
        >
          {hasChildren ? (
            <ChevronRight className="h-3 w-3 text-gray-400" />
          ) : (
            <div className="w-3" />
          )}
          
          {depth === 0 ? (
            <Folder className="h-3 w-3 text-yellow-600" />
          ) : depth === 1 ? (
            <Folder className="h-3 w-3 text-blue-500" />
          ) : (
            <Package className="h-3 w-3 text-green-500" />
          )}
          
          <span className={`text-xs ${isSelected ? 'font-medium text-yellow-700' : 'text-gray-700'}`}>
            {category.name}
          </span>
          
          <Badge variant="outline" className="text-xs px-1 py-0">
            L{category.level}
          </Badge>
        </div>

        {hasChildren && (
          <div>
            {category.children.map(child => renderCategoryOption(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full">
      {/* MEGA DEBUG BOX - IMPOSSIBLE TO MISS */}
      <div className="bg-red-500 text-white text-center py-8 mb-4 font-bold text-2xl border-4 border-black">
        ⚠️ ADVANCED FILTERS COMPONENT IS RENDERING! ⚠️
        <br />
        Product Count: {productCount}
      </div>
      <Card className="w-full h-fit">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <SlidersHorizontal className="h-5 w-5 text-[#FFB20F]" />
              Product Filters
            </CardTitle>
          {getActiveFilterCount() > 0 && (
            <Badge variant="secondary" className="bg-[#FFB20F] text-white">
              {getActiveFilterCount()}
            </Badge>
          )}
        </div>
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>{productCount} products found</span>
          {getActiveFilterCount() > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="h-6 px-2 text-xs"
            >
              Clear All
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
        {/* Search */}
        <Collapsible
          open={expandedSections.has('search')}
          onOpenChange={() => toggleSection('search')}
        >
          <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-medium">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              Search
            </div>
            <ChevronDown className={`h-4 w-4 transition-transform ${
              expandedSections.has('search') ? 'rotate-180' : ''
            }`} />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3">
            <div>
              <Input
                type="text"
                placeholder="Search products..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="w-full"
              />
            </div>
            <div>
              <Input
                type="text"
                placeholder="Search by SKU..."
                value={filters.sku}
                onChange={(e) => handleFilterChange('sku', e.target.value)}
                className="w-full"
              />
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Separator />

        {/* Categories */}
        <Collapsible
          open={expandedSections.has('categories')}
          onOpenChange={() => toggleSection('categories')}
        >
          <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-medium">
            <div className="flex items-center gap-2">
              <Folder className="h-4 w-4" />
              Categories
            </div>
            <ChevronDown className={`h-4 w-4 transition-transform ${
              expandedSections.has('categories') ? 'rotate-180' : ''
            }`} />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 max-h-48 overflow-y-auto">
            <div
              className={`flex items-center gap-2 py-1.5 px-2 rounded cursor-pointer hover:bg-gray-50 ${
                !filters.categoryId ? 'bg-yellow-50 border-l-2 border-yellow-500' : ''
              }`}
              onClick={() => handleFilterChange('categoryId', '')}
            >
              <Package className="h-3 w-3 text-gray-500" />
              <span className={`text-xs ${!filters.categoryId ? 'font-medium text-yellow-700' : 'text-gray-700'}`}>
                All Categories
              </span>
            </div>
            {categoryHierarchy.map(category => renderCategoryOption(category, 0))}
          </CollapsibleContent>
        </Collapsible>

        <Separator />

        {/* Price Range */}
        <Collapsible
          open={expandedSections.has('price')}
          onOpenChange={() => toggleSection('price')}
        >
          <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-medium">
            <div className="flex items-center gap-2">
              <Euro className="h-4 w-4" />
              Price Range
            </div>
            <ChevronDown className={`h-4 w-4 transition-transform ${
              expandedSections.has('price') ? 'rotate-180' : ''
            }`} />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3">
            <div className="px-2">
              <Slider
                value={priceRange}
                onValueChange={handlePriceRangeChange}
                max={1000}
                min={0}
                step={10}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-600 mt-1">
                <span>{formatPrice(priceRange[0])}</span>
                <span>{formatPrice(priceRange[1])}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Min Price</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={filters.priceMin}
                  onChange={(e) => handleFilterChange('priceMin', e.target.value)}
                  className="h-8"
                />
              </div>
              <div>
                <Label className="text-xs">Max Price</Label>
                <Input
                  type="number"
                  placeholder="1000"
                  value={filters.priceMax}
                  onChange={(e) => handleFilterChange('priceMax', e.target.value)}
                  className="h-8"
                />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Separator />

        {/* Region & Platform */}
        <Collapsible
          open={expandedSections.has('location')}
          onOpenChange={() => toggleSection('location')}
        >
          <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-medium">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Region & Platform
            </div>
            <ChevronDown className={`h-4 w-4 transition-transform ${
              expandedSections.has('location') ? 'rotate-180' : ''
            }`} />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3">
            <div>
              <Label className="text-xs font-medium">Region</Label>
              <Select value={filters.region} onValueChange={(value) => handleFilterChange('region', value)}>
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="All Regions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Regions</SelectItem>
                  <SelectItem value="worldwide">Worldwide</SelectItem>
                  <SelectItem value="europe">Europe</SelectItem>
                  <SelectItem value="north-america">North America</SelectItem>
                  <SelectItem value="asia-pacific">Asia Pacific</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium">Platform</Label>
              <Select value={filters.platform} onValueChange={(value) => handleFilterChange('platform', value)}>
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="All Platforms" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Platforms</SelectItem>
                  <SelectItem value="windows">Windows</SelectItem>
                  <SelectItem value="mac">Mac</SelectItem>
                  <SelectItem value="linux">Linux</SelectItem>
                  <SelectItem value="web">Web</SelectItem>
                  <SelectItem value="mobile">Mobile</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Separator />

        {/* Availability */}
        <Collapsible
          open={expandedSections.has('availability')}
          onOpenChange={() => toggleSection('availability')}
        >
          <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-medium">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Availability
            </div>
            <ChevronDown className={`h-4 w-4 transition-transform ${
              expandedSections.has('availability') ? 'rotate-180' : ''
            }`} />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3">
            <div>
              <Label className="text-xs font-medium">Stock Level</Label>
              <Select value={filters.stockLevel} onValueChange={(value) => handleFilterChange('stockLevel', value)}>
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Any Stock Level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Any Stock Level</SelectItem>
                  <SelectItem value="in-stock">In Stock (&gt;0)</SelectItem>
                  <SelectItem value="low-stock">Low Stock (1-10)</SelectItem>
                  <SelectItem value="high-stock">High Stock (&gt;50)</SelectItem>
                  <SelectItem value="out-of-stock">Out of Stock</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium">Availability Status</Label>
              {[
                { id: 'in-stock', label: 'In Stock', color: 'text-green-600' },
                { id: 'limited', label: 'Limited Stock', color: 'text-yellow-600' },
                { id: 'pre-order', label: 'Pre-order', color: 'text-blue-600' },
                { id: 'discontinued', label: 'Discontinued', color: 'text-red-600' }
              ].map((status) => (
                <div key={status.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={status.id}
                    checked={filters.availability.includes(status.id)}
                    onCheckedChange={(checked) => {
                      const newAvailability = checked
                        ? [...filters.availability, status.id]
                        : filters.availability.filter(id => id !== status.id);
                      handleFilterChange('availability', newAvailability);
                    }}
                  />
                  <Label htmlFor={status.id} className={`text-xs ${status.color}`}>
                    {status.label}
                  </Label>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Separator />

        {/* Sorting */}
        <Collapsible
          open={expandedSections.has('sorting')}
          onOpenChange={() => toggleSection('sorting')}
        >
          <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-medium">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Sort & Order
            </div>
            <ChevronDown className={`h-4 w-4 transition-transform ${
              expandedSections.has('sorting') ? 'rotate-180' : ''
            }`} />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3">
            <div>
              <Label className="text-xs font-medium">Sort By</Label>
              <Select value={filters.sortBy} onValueChange={(value) => handleFilterChange('sortBy', value)}>
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Default" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Default</SelectItem>
                  <SelectItem value="name">Product Name</SelectItem>
                  <SelectItem value="price">Price</SelectItem>
                  <SelectItem value="stock">Stock Level</SelectItem>
                  <SelectItem value="date">Date Added</SelectItem>
                  <SelectItem value="popularity">Popularity</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium">Order</Label>
              <Select value={filters.sortOrder} onValueChange={(value) => handleFilterChange('sortOrder', value as 'asc' | 'desc')}>
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">Ascending</SelectItem>
                  <SelectItem value="desc">Descending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
    </div>
  );
};

export default AdvancedProductFilters;