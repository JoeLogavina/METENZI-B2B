// TIER 1 ENTERPRISE OPTIMIZATION: Memoized Product Filters
// Prevents unnecessary re-renders when filter options don't change

import { memo, useMemo, useCallback } from 'react';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";
import { useDebounce } from "use-debounce";

interface ProductFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  selectedRegion: string;
  onRegionChange: (value: string) => void;
  selectedPlatform: string;
  onPlatformChange: (value: string) => void;
  selectedCategory: string;
  onCategoryChange: (value: string) => void;
  priceMin: string;
  onPriceMinChange: (value: string) => void;
  priceMax: string;
  onPriceMaxChange: (value: string) => void;
  onClearFilters: () => void;
  categories: Array<{ id: string; name: string }>;
  isLoading?: boolean;
}

// Memoized ProductFilters component
const ProductFilters = memo(function ProductFilters({
  searchTerm,
  onSearchChange,
  selectedRegion,
  onRegionChange,
  selectedPlatform,
  onPlatformChange,
  selectedCategory,
  onCategoryChange,
  priceMin,
  onPriceMinChange,
  priceMax,
  onPriceMaxChange,
  onClearFilters,
  categories,
  isLoading = false
}: ProductFiltersProps) {

  // Memoized region options to prevent recreation
  const regionOptions = useMemo(() => [
    { value: "", label: "All Regions" },
    { value: "Global", label: "Global" },
    { value: "EU", label: "Europe" },
    { value: "US", label: "United States" },
    { value: "Asia", label: "Asia" },
  ], []);

  // Memoized platform options
  const platformOptions = useMemo(() => [
    { value: "", label: "All Platforms" },
    { value: "Windows", label: "Windows" },
    { value: "Mac", label: "macOS" },
    { value: "Both", label: "Windows & Mac" },
    { value: "Linux", label: "Linux" },
  ], []);

  // Memoized category options to prevent recreation when categories array reference changes
  const categoryOptions = useMemo(() => [
    { value: "", label: "All Categories" },
    ...categories.map(cat => ({ value: cat.id, label: cat.name }))
  ], [categories]);

  // Memoized handlers to prevent recreation on every render
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onSearchChange(e.target.value);
  }, [onSearchChange]);

  const handlePriceMinChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onPriceMinChange(e.target.value);
  }, [onPriceMinChange]);

  const handlePriceMaxChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onPriceMaxChange(e.target.value);
  }, [onPriceMaxChange]);

  // Memoized check for active filters
  const hasActiveFilters = useMemo(() => {
    return searchTerm || selectedRegion || selectedPlatform || selectedCategory || priceMin || priceMax;
  }, [searchTerm, selectedRegion, selectedPlatform, selectedCategory, priceMin, priceMax]);

  return (
    <div className="space-y-4 p-6 bg-background border rounded-lg">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Filters</h3>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4 mr-1" />
            Clear All
          </Button>
        )}
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search products..."
          value={searchTerm}
          onChange={handleSearchChange}
          className="pl-10"
          disabled={isLoading}
        />
      </div>

      {/* Filter Selects */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Region Filter */}
        <div>
          <label className="text-sm font-medium mb-2 block">Region</label>
          <Select value={selectedRegion} onValueChange={onRegionChange} disabled={isLoading}>
            <SelectTrigger>
              <SelectValue placeholder="Select region" />
            </SelectTrigger>
            <SelectContent>
              {regionOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Platform Filter */}
        <div>
          <label className="text-sm font-medium mb-2 block">Platform</label>
          <Select value={selectedPlatform} onValueChange={onPlatformChange} disabled={isLoading}>
            <SelectTrigger>
              <SelectValue placeholder="Select platform" />
            </SelectTrigger>
            <SelectContent>
              {platformOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Category Filter */}
        <div>
          <label className="text-sm font-medium mb-2 block">Category</label>
          <Select value={selectedCategory} onValueChange={onCategoryChange} disabled={isLoading}>
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {categoryOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Price Range Filters */}
        <div>
          <label className="text-sm font-medium mb-2 block">Price Range (€)</label>
          <div className="flex space-x-2">
            <Input
              placeholder="Min"
              type="number"
              value={priceMin}
              onChange={handlePriceMinChange}
              className="flex-1"
              min="0"
              step="0.01"
              disabled={isLoading}
            />
            <Input
              placeholder="Max"
              type="number"
              value={priceMax}
              onChange={handlePriceMaxChange}
              className="flex-1"
              min="0"
              step="0.01"
              disabled={isLoading}
            />
          </div>
        </div>
      </div>
    </div>
  );
});

export default ProductFilters;