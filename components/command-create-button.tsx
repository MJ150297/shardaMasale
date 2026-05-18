'use client';

import { Plus } from 'lucide-react';
import type { ComponentProps } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CommandCreateButtonProps extends ComponentProps<typeof Button> {
  className?: string;
}

export default function CommandCreateButton({
  children,
  className,
  ...props
}: CommandCreateButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      className={cn(
        'h-9 w-full justify-start px-2 text-sm font-medium text-primary hover:text-primary',
        className,
      )}
      {...props}
    >
      <Plus className="mr-2 h-4 w-4" />
      {children}
    </Button>
  );
}
