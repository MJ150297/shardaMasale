'use client';

import { useState, useCallback } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { debounce } from '@/lib/utils';

interface FilterOption {
  value: string;
  label: string;
}

interface DataTableToolbarProps {
  onSearch: (query: string) => void;
  onFilter?: (key: string, value: string) => void;
  searchPlaceholder?: string;
  filters?: {
    key: string;
    label: string;
    options: FilterOption[];
  }[];
  actions?: React.ReactNode;
}

export default function DataTableToolbar({
  onSearch,
  onFilter,
  searchPlaceholder = "Search...",
  filters = [],
  actions
}: DataTableToolbarProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const debouncedSearch = useCallback(
    debounce((query: string) => {
      onSearch(query);
    }, 300),
    [onSearch]
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    debouncedSearch(value);
  };

  return (
    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between py-4">
      <div className="flex flex-1 items-center gap-3 w-full sm:w-auto">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
          <Input
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={handleSearchChange}
            className="pl-8"
          />
        </div>

        {filters.map((filter) => (
          <Select
            key={filter.key}
            onValueChange={(value) => onFilter?.(filter.key, value)}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder={filter.label} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All {filter.label}</SelectItem>
              {filter.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}
      </div>

      {actions && (
        <div className="flex items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}