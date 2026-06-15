'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, X } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface DateRangeFilterProps {
  startDate: Date | undefined;
  endDate: Date | undefined;
  onDateChange: (start: Date | undefined, end: Date | undefined) => void;
}

const predefinedRanges = [
  { label: 'Today', getValue: () => { const d = new Date(); d.setHours(0,0,0,0); const e = new Date(d); e.setHours(23,59,59,999); return [d, e]; } },
  { label: 'Yesterday', getValue: () => { const d = new Date(); d.setDate(d.getDate()-1); d.setHours(0,0,0,0); const e = new Date(d); e.setHours(23,59,59,999); return [d, e]; } },
  { label: 'This Week', getValue: () => { 
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    weekStart.setHours(0,0,0,0);
    const weekEnd = new Date(today);
    weekEnd.setHours(23,59,59,999);
    return [weekStart, weekEnd];
  }},
  { label: 'Last Week', getValue: () => {
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay() - 7);
    weekStart.setHours(0,0,0,0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23,59,59,999);
    return [weekStart, weekEnd];
  }},
  { label: 'Last 7 Days', getValue: () => {
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(today.getDate() - 7);
    weekAgo.setHours(0,0,0,0);
    const e = new Date(today);
    e.setHours(23,59,59,999);
    return [weekAgo, e];
  }},
  { label: 'This Month', getValue: () => {
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    monthStart.setHours(0,0,0,0);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    monthEnd.setHours(23,59,59,999);
    return [monthStart, monthEnd];
  }},
  { label: 'Last Month', getValue: () => {
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    monthStart.setHours(0,0,0,0);
    const monthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
    monthEnd.setHours(23,59,59,999);
    return [monthStart, monthEnd];
  }},
  { label: 'This Quarter', getValue: () => {
    const today = new Date();
    const quarter = Math.floor(today.getMonth() / 3);
    const quarterStart = new Date(today.getFullYear(), quarter * 3, 1);
    quarterStart.setHours(0,0,0,0);
    const quarterEnd = new Date(today.getFullYear(), quarter * 3 + 3, 0);
    quarterEnd.setHours(23,59,59,999);
    return [quarterStart, quarterEnd];
  }},
  { label: 'Last Quarter', getValue: () => {
    const today = new Date();
    const quarter = Math.floor(today.getMonth() / 3);
    const quarterStart = new Date(today.getFullYear(), (quarter - 1) * 3, 1);
    quarterStart.setHours(0,0,0,0);
    const quarterEnd = new Date(today.getFullYear(), quarter * 3, 0);
    quarterEnd.setHours(23,59,59,999);
    return [quarterStart, quarterEnd];
  }},
  { label: 'Current Fiscal Year', getValue: () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const startYear = month < 3 ? year - 1 : year;
    const fiscalStart = new Date(startYear, 3, 1);
    fiscalStart.setHours(0,0,0,0);
    const fiscalEnd = new Date(startYear + 1, 2, 31);
    fiscalEnd.setHours(23,59,59,999);
    return [fiscalStart, fiscalEnd];
  }},
  { label: 'Previous Fiscal Year', getValue: () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const startYear = (month < 3 ? year - 1 : year) - 1;
    const fiscalStart = new Date(startYear, 3, 1);
    fiscalStart.setHours(0,0,0,0);
    const fiscalEnd = new Date(startYear + 1, 2, 31);
    fiscalEnd.setHours(23,59,59,999);
    return [fiscalStart, fiscalEnd];
  }},
  { label: 'Last 365 Days', getValue: () => {
    const today = new Date();
    const yearAgo = new Date(today);
    yearAgo.setDate(today.getDate() - 365);
    yearAgo.setHours(0,0,0,0);
    const e = new Date(today);
    e.setHours(23,59,59,999);
    return [yearAgo, e];
  }},
  { label: 'Custom', getValue: () => [undefined, undefined] },
];

export function DateRangeFilter({ startDate, endDate, onDateChange }: DateRangeFilterProps) {
  const [customDialogOpen, setCustomDialogOpen] = useState(false);
  const [tempStartDate, setTempStartDate] = useState<Date | undefined>(startDate);
  const [tempEndDate, setTempEndDate] = useState<Date | undefined>(endDate);

  useEffect(() => {
    setTempStartDate(startDate);
    setTempEndDate(endDate);
  }, [startDate, endDate]);

  // Derive selectedRange from the actual startDate/endDate props
  // This ensures the dropdown always reflects what's applied
  const selectedRange = useMemo(() => {
    if (!startDate || !endDate) {
      return 'This Month';
    }

    const startTime = startDate.getTime();
    const endTime = endDate.getTime();

    for (const range of predefinedRanges) {
      if (range.label === 'Custom') continue;
      const [s, e] = range.getValue();
      if (s && e && s.getTime() === startTime && e.getTime() === endTime) {
        return range.label;
      }
    }

    return 'Custom';
  }, [startDate, endDate]);

  const handleRangeSelect = (label: string) => {
    if (label === 'Custom') {
      setCustomDialogOpen(true);
      return;
    }
    
    const range = predefinedRanges.find(r => r.label === label);
    if (range) {
      const [start, end] = range.getValue();
      onDateChange(start, end);
    }
  };

  const applyCustomDates = () => {
    onDateChange(tempStartDate, tempEndDate);
    setCustomDialogOpen(false);
  };

  const isFilterActive = startDate && endDate && selectedRange !== 'This Month';

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Select value={selectedRange} onValueChange={handleRangeSelect}>
        <SelectTrigger className={cn(
          "w-36 h-9",
          isFilterActive && "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800"
        )}>
          <SelectValue placeholder="Select range" />
        </SelectTrigger>
        <SelectContent className="max-h-72 bg-background/80">
          {predefinedRanges.map(range => (
            <SelectItem key={range.label} value={range.label} className="h-8">
              {range.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedRange === 'Custom' && (
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-9 justify-start text-left font-normal min-w-56",
            "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800"
          )}
          onClick={() => setCustomDialogOpen(true)}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {startDate && endDate ? (
            <span className="truncate">
              {format(startDate, "dd MMM yyyy")} - {format(endDate, "dd MMM yyyy")}
            </span>
          ) : (
            <span>Click to set dates</span>
          )}
        </Button>
      )}

      <Dialog open={customDialogOpen} onOpenChange={setCustomDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Select Date Range</DialogTitle>
          </DialogHeader>
          
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {tempStartDate ? format(tempStartDate, "dd MMM yyyy") : <span>Pick date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={tempStartDate}
                    onSelect={setTempStartDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="space-y-2">
              <Label>End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {tempEndDate ? format(tempEndDate, "dd MMM yyyy") : <span>Pick date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={tempEndDate}
                    onSelect={setTempEndDate}
                    initialFocus
                    disabled={(date) => tempStartDate ? date < tempStartDate : false}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setCustomDialogOpen(false)}>Cancel</Button>
            <Button onClick={applyCustomDates}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isFilterActive && (
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
          onClick={() => {
            onDateChange(undefined, undefined);
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}