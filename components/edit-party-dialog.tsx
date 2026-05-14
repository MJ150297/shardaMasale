'use client';
// @ts-nocheck - Zod v4 and React Hook Form type incompatibility, same as create-item-dialog

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const editPartySchema = z.object({
  name: z.string().min(1, 'Name is required').max(160),
  email: z.string().email('Invalid email address').optional().nullable(),
  phoneNumber: z.string().optional().nullable(),
  partyType: z.enum(['customer', 'supplier', 'both']).default('customer'),
  status: z.enum(['active', 'inactive', 'blocked']).default('active'),
  gstin: z.string().optional().nullable(),
  pan: z.string().optional().nullable(),
  address: z.string().max(300).optional().nullable(),
  creditLimit: z.coerce.number().min(0).default(0),
});

type EditPartyFormData = z.infer<typeof editPartySchema>;

interface Party {
  _id: string;
  name: string;
  email?: string | null;
  phoneNumber?: string | null;
  partyType: 'customer' | 'supplier' | 'both';
  status: string;
  gstin?: string | null;
  pan?: string | null;
  address?: string | null;
  creditLimit?: number;
}

interface EditPartyDialogProps {
  party: Party;
  onPartyUpdated?: () => void;
  children?: React.ReactNode;
}

export default function EditPartyDialog({
  party,
  onPartyUpdated,
  children
}: EditPartyDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm({
    // @ts-ignore - Zod v4 resolver type compatibility issue
    resolver: zodResolver(editPartySchema),
      defaultValues: {
        name: party.name,
        email: party.email || '',
        phoneNumber: party.phoneNumber || '',
        partyType: party.partyType,
        status: party.status as 'active' | 'inactive' | 'blocked',
        gstin: party.gstin || '',
        pan: party.pan || '',
        address: party.address || '',
        creditLimit: party.creditLimit || 0,
      },
  });

  const onSubmit = async (formData: EditPartyFormData) => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/parties', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: party._id,
          ...formData,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update party');
      }

      toast.success('Party updated successfully!');
      setOpen(false);
      onPartyUpdated?.();
    } catch (error) {
      console.error('Error updating party:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update party');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || <Button variant="default" size="sm">Edit Party</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl bg-white/80" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Edit Party</DialogTitle>
          <DialogDescription>
            Update party details and settings.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Party Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter party name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="partyType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Party Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="customer">Customer</SelectItem>
                        <SelectItem value="supplier">Supplier</SelectItem>
                        <SelectItem value="both">Both</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="email@example.com" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phoneNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter phone number" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Input placeholder="123 Main St, Springfield, 12345" {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="gstin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>GSTIN</FormLabel>
                    <FormControl>
                      <Input placeholder="GST Number" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="pan"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>PAN</FormLabel>
                    <FormControl>
                      <Input placeholder="PAN Number" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="creditLimit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Credit Limit (₹)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        placeholder="0"
                        {...field}
                        value={field.value as number ?? ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="blocked">Blocked</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-6 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Updating...' : 'Update Party'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}