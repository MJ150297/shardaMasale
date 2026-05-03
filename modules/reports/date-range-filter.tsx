'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';

interface DateRangeFilterProps {
  startDate: Date | undefined;
  endDate: Date | undefined;
  onDateChange: (start: Date | undefined, end: Date | undefined) => void;
}

const predefinedRanges = [
  { label: 'Today', getValue: () => { const d = new Date(); return [d, d]; } },
  { label: 'This Week', getValue: () => { 
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    return [weekStart, today];
  }},
  { label: 'This Month', getValue: () => {
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    return [monthStart, today];
  }},
  { label: 'Last 7 Days', getValue: () => {
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(today.getDate() - 7);
    return [weekAgo, today];
  }},
  { label: 'Last 30 Days', getValue: () => {
    const today = new Date();
    const monthAgo = new Date(today);
    monthAgo.setDate(today.getDate() - 30);
    return [monthAgo, today];
  }},
  { label: 'Custom', getValue: () => [undefined, undefined] },
];

export function DateRangeFilter({ startDate, endDate, onDateChange }: DateRangeFilterProps) {
  const [selectedRange, setSelectedRange] = useState('This Month');

  const handleRangeSelect = (label: string) => {
    setSelectedRange(label);
    const range = predefinedRanges.find(r => r.label === label);
    if (range) {
      const [start, end] = range.getValue();
      onDateChange(start, end);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Select value={selectedRange} onValueChange={handleRangeSelect}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Select range" />
        </SelectTrigger>
        <SelectContent>
          {predefinedRanges.map(range => (
            <SelectItem key={range.label} value={range.label}>
              {range.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-[300px] justify-start text-left font-normal",
              !startDate && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {startDate && endDate ? (
              `${format(startDate, "PPP")} - ${format(endDate, "PPP")}`
            ) : (
              <span>Pick a date range</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={startDate}
            selected={{
              from: startDate,
              to: endDate,
            }}
            onSelect={(range) => {
              onDateChange(range?.from, range?.to);
              setSelectedRange('Custom');
            }}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}