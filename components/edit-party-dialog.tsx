'use client';

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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { X, Plus } from 'lucide-react';
import { toast } from 'sonner';

const billingAddressSchema = z.object({
  line1: z.preprocess(v => (v === null ? '' : v), z.string().default('')),
  line2: z.preprocess(v => (v === null ? '' : v), z.string().default('')),
  landmark: z.preprocess(v => (v === null ? '' : v), z.string().default('')),
  city: z.preprocess(v => (v === null ? '' : v), z.string().default('')),
  state: z.preprocess(v => (v === null ? '' : v), z.string().default('')),
  postalCode: z.preprocess(v => (v === null ? '' : v), z.string().default('')),
  country: z.preprocess(v => (v === null ? '' : v), z.string().default('')),
}).optional().nullable();

const editPartySchema = z.object({
  displayName: z.string().min(1, 'Name is required').max(160),
  legalName: z.string().optional().nullable(),
  partyType: z.enum(['customer', 'supplier', 'both']).default('customer'),
  status: z.enum(['active', 'inactive', 'blocked']).default('active'),
  email: z.string().email('Invalid email address').optional().nullable(),
  phoneNumber: z.string().optional().nullable(),
  alternatePhoneNumber: z.string().optional().nullable(),
  gstin: z.string().optional().nullable(),
  pan: z.string().optional().nullable(),
  taxTreatment: z.enum(['registered', 'unregistered', 'consumer', 'overseas']).default('unregistered'),
  address: z.string().max(300).optional().nullable(),
  billingAddress: billingAddressSchema,
  creditLimit: z.coerce.number().min(0).default(0),
  openingBalance: z.coerce.number().default(0),
  notes: z.string().max(2000).optional().nullable(),
  tags: z.array(z.string()).default([]),
});

type EditPartyFormData = z.infer<typeof editPartySchema>;

interface BillingAddress {
  line1: string;
  line2?: string | null;
  landmark?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

interface Party {
  _id: string;
  displayName?: string;
  name?: string;
  legalName?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  alternatePhoneNumber?: string | null;
  partyType: 'customer' | 'supplier' | 'both';
  status: string;
  gstin?: string | null;
  pan?: string | null;
  taxTreatment?: string;
  address?: string | null;
  billingAddress?: BillingAddress | null;
  creditLimit?: number;
  openingBalance?: number;
  notes?: string | null;
  tags?: string[];
}

interface EditPartyDialogProps {
  party: Party;
  onPartyUpdated?: () => void;
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export default function EditPartyDialog({
  party,
  onPartyUpdated,
  children,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: EditPartyDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;

  function handleOpenChange(nextOpen: boolean) {
    if (controlledOnOpenChange) {
      controlledOnOpenChange(nextOpen);
    } else {
      setInternalOpen(nextOpen);
    }
  }

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tagInput, setTagInput] = useState('');

  const form = useForm<EditPartyFormData>({
    resolver: zodResolver(editPartySchema) as never,
    defaultValues: {
      displayName: party.displayName || '',
      legalName: party.legalName || null,
      partyType: party.partyType,
      status: (party.status as 'active' | 'inactive' | 'blocked') || 'active',
      email: party.email || null,
      phoneNumber: party.phoneNumber || null,
      alternatePhoneNumber: party.alternatePhoneNumber || null,
      gstin: party.gstin || null,
      pan: party.pan || null,
      taxTreatment: (party.taxTreatment as 'registered' | 'unregistered' | 'consumer' | 'overseas') || 'unregistered',
      address: party.address || null,
      billingAddress: {
        line1: party.billingAddress?.line1 || '',
        line2: party.billingAddress?.line2 || '',
        landmark: party.billingAddress?.landmark || '',
        city: party.billingAddress?.city || '',
        state: party.billingAddress?.state || '',
        postalCode: party.billingAddress?.postalCode || '',
        country: party.billingAddress?.country || '',
      },
      creditLimit: party.creditLimit || 0,
      openingBalance: party.openingBalance || 0,
      notes: party.notes || null,
      tags: party.tags || [],
    },
  });

  const selectedPartyType = form.watch('partyType');
  const isCustomerOnly = selectedPartyType === 'customer';

  const onSubmit = async (data: EditPartyFormData) => {
    setIsSubmitting(true);
    try {
      // Sanitize billingAddress: convert null/empty object to null to avoid Zod errors
      const payload: Record<string, unknown> = { id: party._id, ...data };
      if (payload.billingAddress && typeof payload.billingAddress === 'object') {
        const addr = payload.billingAddress as Record<string, string | null | undefined>;
        // If all fields are empty/blank, set to null
        if (!addr.line1 && !addr.city && !addr.state && !addr.postalCode && !addr.country) {
          payload.billingAddress = null;
        } else {
          // Ensure no null values - convert to empty string
          payload.billingAddress = {
            line1: addr.line1 || '',
            line2: addr.line2 || '',
            landmark: addr.landmark || '',
            city: addr.city || '',
            state: addr.state || '',
            postalCode: addr.postalCode || '',
            country: addr.country || '',
          };
        }
      }

      const response = await fetch('/api/parties', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update party');
      }

      toast.success('Party updated successfully!');
      handleOpenChange(false);
      onPartyUpdated?.();
    } catch (error) {
      console.error('Error updating party:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update party');
    } finally {
      setIsSubmitting(false);
    }
  };

  const addTag = () => {
    const currentTags = form.getValues('tags');
    if (tagInput.trim() && !currentTags.includes(tagInput.trim())) {
      form.setValue('tags', [...currentTags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    const currentTags = form.getValues('tags');
    form.setValue('tags', currentTags.filter(tag => tag !== tagToRemove));
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {children ? (
        <DialogTrigger asChild>
          {children}
        </DialogTrigger>
      ) : null}
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto bg-background dark:bg-gray-900">
        <DialogHeader>
          <DialogTitle>Edit Party</DialogTitle>
          <DialogDescription>
            Update party details and settings.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Tabs defaultValue="basic" className="w-full">
              <TabsList variant="segmented" className="grid w-full grid-cols-4">
                <TabsTrigger value="basic">Basic</TabsTrigger>
                <TabsTrigger value="contact">Contact</TabsTrigger>
                <TabsTrigger value="financial">Financial</TabsTrigger>
                <TabsTrigger value="additional">Additional</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="displayName"
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

                  {!isCustomerOnly && (
                    <FormField
                      control={form.control}
                      name="legalName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Legal Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Legal / Registered name" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="partyType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Party Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select party type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="customer">Customer</SelectItem>
                            <SelectItem value="supplier">Supplier</SelectItem>
                            <SelectItem value="both">Both Customer & Supplier</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
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
                </div>
              </TabsContent>

              <TabsContent value="contact" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="email@example.com" {...field} value={field.value || ''} />
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
                          <Input placeholder="+91 98765 43210" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="alternatePhoneNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Alternate Phone Number</FormLabel>
                        <FormControl>
                          <Input placeholder="Alternate contact number" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="border rounded-lg p-4 space-y-4">
                  <div className="font-medium text-sm text-muted-foreground">Billing Address</div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="billingAddress.line1"
                      render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel>Address Line 1</FormLabel>
                          <FormControl>
                            <Input placeholder="Building, street, area" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="billingAddress.line2"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Address Line 2</FormLabel>
                          <FormControl>
                            <Input placeholder="Additional details" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="billingAddress.landmark"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Landmark</FormLabel>
                          <FormControl>
                            <Input placeholder="Near..." {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="billingAddress.city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City</FormLabel>
                          <FormControl>
                            <Input placeholder="City" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="billingAddress.state"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>State</FormLabel>
                          <FormControl>
                            <Input placeholder="State" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="billingAddress.postalCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Postal Code</FormLabel>
                          <FormControl>
                            <Input placeholder="Postal code" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="billingAddress.country"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Country</FormLabel>
                          <FormControl>
                            <Input placeholder="Country" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {!isCustomerOnly && (
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="gstin"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>GSTIN</FormLabel>
                          <FormControl>
                            <Input placeholder="22AAAAA0000A1Z5" {...field} value={field.value || ''} />
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
                          <FormLabel>PAN Number</FormLabel>
                          <FormControl>
                            <Input placeholder="AAAAA0000A" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="taxTreatment"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tax Treatment</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select tax treatment" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="registered">Registered (GST)</SelectItem>
                          <SelectItem value="unregistered">Unregistered</SelectItem>
                          <SelectItem value="consumer">End Consumer</SelectItem>
                          <SelectItem value="overseas">Overseas / Export</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="financial" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="creditLimit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Credit Limit (₹)</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" placeholder="0" {...field} />
                        </FormControl>
                        <FormDescription>Maximum allowed credit for this party</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="openingBalance"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Opening Balance (₹)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="0" {...field} />
                        </FormControl>
                        <FormDescription>Outstanding balance at time of creation</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>

              <TabsContent value="additional" className="space-y-4">
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Any additional notes about this party"
                          className="min-h-[120px]"
                          {...field}
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-2">
                  <FormLabel>Tags</FormLabel>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add a tag"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addTag();
                        }
                      }}
                    />
                    <Button type="button" variant="outline" onClick={addTag}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {form.watch('tags').map((tag) => (
                      <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                        {tag}
                        <X
                          className="w-3 h-3 cursor-pointer"
                          onClick={() => removeTag(tag)}
                        />
                      </Badge>
                    ))}
                  </div>
                  <FormDescription>
                    Add tags to categorize and filter parties easily
                  </FormDescription>
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-3 pt-6 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
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
