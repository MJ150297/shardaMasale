'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

const formSchema = z.object({
  adjustedQuantity: z.number().min(0, "Quantity must be at least 0"),
  reason: z.string().optional(),
});

interface StockAdjustmentDialogProps {
  item: {
    _id: string;
    name: string;
    sku?: string | null;
    stock: {
      currentQuantity: number;
      allowNegativeStock: boolean;
    };
    unitOfMeasure: string;
  };
  onAdjustmentComplete: () => void;
  children?: React.ReactNode;
}

export default function StockAdjustmentDialog({ 
  item, 
  onAdjustmentComplete,
  children 
}: StockAdjustmentDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      adjustedQuantity: item.stock.currentQuantity,
      reason: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/stock-movements/adjust', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          itemId: item._id,
          adjustedQuantity: values.adjustedQuantity,
          reason: values.reason,
        }),
      });

      if (response.status === 409) {
        form.setError('adjustedQuantity', {
          type: 'manual',
          message: 'Stock was modified by another user. Please refresh and try again.'
        });
        return;
      }

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to adjust stock');
      }

      setOpen(false);
      form.reset();
      onAdjustmentComplete();
    } catch (error: any) {
      form.setError('root', {
        type: 'manual',
        message: error.message
      });
    } finally {
      setIsLoading(false);
    }
  }

  const currentQuantity = form.watch('adjustedQuantity');
  const difference = currentQuantity - item.stock.currentQuantity;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || <Button variant="default" size="sm">Adjust Stock</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Adjust Stock</DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <div className="mb-4">
            <div className="font-medium">{item.name}</div>
            {item.sku && (
              <div className="text-sm text-gray-500">SKU: {item.sku}</div>
            )}
          </div>

          <div className="flex items-center gap-2 mb-4">
            <div className="text-sm text-gray-500">Current Stock:</div>
            <Badge variant="secondary">
              {item.stock.currentQuantity} {item.unitOfMeasure}
            </Badge>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="adjustedQuantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Quantity</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="any"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {difference !== 0 && (
                <div className={`text-sm p-2 rounded ${difference > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {difference > 0 ? '+' : ''}{difference} {item.unitOfMeasure} {difference > 0 ? 'increase' : 'decrease'}
                </div>
              )}

              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason (Optional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Enter reason for adjustment"
                        className="resize-none"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {form.formState.errors.root && (
                <div className="text-sm font-medium text-red-500">
                  {form.formState.errors.root.message}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <Button 
                  type="button" 
                  variant="secondary" 
                  onClick={() => setOpen(false)}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading || difference === 0}>
                  {isLoading ? 'Adjusting...' : 'Adjust Stock'}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}