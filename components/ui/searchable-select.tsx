'use client';

import * as React from 'react';
import { Command as CommandPrimitive } from 'cmdk';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { CheckIcon, ChevronDownIcon } from 'lucide-react';

export interface SearchableSelectOption {
  value: string;
  label: string;
  /** Additional data passed through for custom rendering */
  data?: any;
}

interface SearchableSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  triggerClassName?: string;
  emptyMessage?: string;
  /** Custom render for each item label area */
  renderItem?: (option: SearchableSelectOption) => React.ReactNode;
  disabled?: boolean;
  /** Slot rendered at the bottom of the dropdown (e.g. "Create new" button) */
  actionSlot?: React.ReactNode;
}

export function SearchableSelect({
  value,
  onValueChange,
  options,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  triggerClassName,
  emptyMessage = 'No results found.',
  renderItem,
  disabled = false,
  actionSlot,
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false);
  const listRef = React.useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  // Handle wheel scrolling on the list — cmdk captures wheel events for keyboard
  // navigation but we want mouse/trackpad scrolling to work natively.
  const handleWheel = React.useCallback((e: React.WheelEvent) => {
    const el = listRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const atTop = scrollTop === 0;
    const atBottom = scrollTop + clientHeight >= scrollHeight;
    // Only stop propagation if we're not at the boundary
    if ((e.deltaY < 0 && !atTop) || (e.deltaY > 0 && !atBottom)) {
      e.stopPropagation();
    }
  }, []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'flex h-9 w-full items-center justify-between rounded-lg border border-input bg-background px-3 py-2 text-sm whitespace-nowrap transition-colors outline-none select-none',
            'hover:bg-accent/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
            'disabled:cursor-not-allowed disabled:opacity-50',
            !value && 'text-muted-foreground',
            triggerClassName
          )}
        >
          <span className="truncate">
            {selectedOption
              ? renderItem
                ? renderItem(selectedOption)
                : selectedOption.label
              : placeholder}
          </span>
          <ChevronDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0 bg-background dark:bg-background"
        align="start"
      >
        <Command className="overflow-visible">
          <CommandInput placeholder={searchPlaceholder} />
          <CommandPrimitive.List
            ref={listRef}
            data-slot="command-list"
            className="max-h-[260px] overflow-y-auto outline-none py-1"
            onWheel={handleWheel}
          >
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => {
                    onValueChange(option.value);
                    setOpen(false);
                  }}
                >
                  <CheckIcon
                    className={cn(
                      'mr-2 h-4 w-4 shrink-0',
                      value === option.value ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {renderItem ? renderItem(option) : option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandPrimitive.List>
          {actionSlot && (
            <div className="border-t px-1 py-1">
              {actionSlot}
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}