'use client';

import { useState, useEffect, useCallback } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Eye, EyeOff, Loader2, Building2, UserCog } from 'lucide-react';

const editOwnerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(120),
  email: z.string().email('Please enter a valid email address'),
  phoneNumber: z.string().optional(),
  status: z.enum(['active', 'inactive', 'suspended']).default('active'),
  password: z.string().min(6, 'Password must be at least 6 characters').optional().or(z.literal('')),
  confirmPassword: z.string().optional().or(z.literal('')),
  subscriptionPlan: z.string().optional(),
  subscriptionStatus: z.string().optional(),
}).refine((data) => {
  if (data.password && data.password !== data.confirmPassword) {
    return false;
  }
  return true;
}, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type EditOwnerFormValues = z.infer<typeof editOwnerSchema>;

interface Owner {
  _id: string;
  name: string;
  email: string;
  phoneNumber?: string | null;
  status: string;
  allowedShops?: string[];
  subscription?: {
    plan: string;
    status: string;
    expiryDate?: string | null;
    trialEndsAt?: string | null;
  };
}

interface ShopItem {
  _id: string;
  name: string;
  displayName?: string | null;
  isActive: boolean;
}

interface EditOwnerDialogProps {
  owner: Owner;
  shops: ShopItem[];
  onOwnerUpdated?: () => void;
  children?: React.ReactNode;
}

export default function EditOwnerDialog({
  owner,
  shops,
  onOwnerUpdated,
  children
}: EditOwnerDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingOwner, setIsLoadingOwner] = useState(false);
  const [fullOwner, setFullOwner] = useState<Owner | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');

  // Selected shop IDs — initialize from owner prop synchronously
  const [selectedShopIds, setSelectedShopIds] = useState<string[]>(
    () => owner.allowedShops ?? []
  );
  const [shopSearchQuery, setShopSearchQuery] = useState('');

  const form = useForm<EditOwnerFormValues>({
    resolver: zodResolver(editOwnerSchema) as any,
    defaultValues: {
      name: owner.name,
      email: owner.email,
      phoneNumber: owner.phoneNumber || '',
      status: owner.status as 'active' | 'inactive' | 'suspended',
      password: '',
      confirmPassword: '',
      subscriptionPlan: owner.subscription?.plan || 'free',
      subscriptionStatus: owner.subscription?.status || 'active',
    },
  });

  // Load full owner data when dialog opens (e.g., subscription details not in the list)
  const loadOwnerData = useCallback(async () => {
    setIsLoadingOwner(true);
    try {
      const response = await fetch(`/api/super/owners/${owner._id}`);
      if (!response.ok) throw new Error('Failed to load owner data');
      const data = await response.json();
      setFullOwner(data.owner);
      // Only update shops from the API if allowedShops is present — otherwise keep the prop's value
      if (data.owner.allowedShops && Array.isArray(data.owner.allowedShops)) {
        setSelectedShopIds(data.owner.allowedShops.map((s: any) =>
          typeof s === 'string' ? s : s.toString()
        ));
      }
    } catch (error) {
      console.error('Error loading owner details:', error);
      // Keep the synchronous shop IDs — don't toast as this may be a minor network issue
    } finally {
      setIsLoadingOwner(false);
    }
  }, [owner._id]);

  useEffect(() => {
    if (open) {
      // Reset shop selection from the prop synchronously
      setSelectedShopIds(owner.allowedShops ?? []);
      // Reset form to original owner values
      form.reset({
        name: owner.name,
        email: owner.email,
        phoneNumber: owner.phoneNumber || '',
        status: owner.status as 'active' | 'inactive' | 'suspended',
        password: '',
        confirmPassword: '',
        subscriptionPlan: owner.subscription?.plan || 'free',
        subscriptionStatus: owner.subscription?.status || 'active',
      });
      setActiveTab('basic');
      // Load full details in the background
      loadOwnerData();
    }
  }, [open, owner, form, loadOwnerData]);

  // Filter shops based on search query
  const filteredShops = shopSearchQuery
    ? shops.filter(s =>
        s.name.toLowerCase().includes(shopSearchQuery.toLowerCase()) ||
        s.displayName?.toLowerCase().includes(shopSearchQuery.toLowerCase())
      )
    : shops;

  // Sort: active first, then inactive
  const sortedFilteredShops = [...filteredShops].sort((a, b) => {
    if (a.isActive && !b.isActive) return -1;
    if (!a.isActive && b.isActive) return 1;
    return 0;
  });

  const onSubmit = async (formData: EditOwnerFormValues) => {
    setIsSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        name: formData.name,
        email: formData.email,
        phoneNumber: formData.phoneNumber || null,
        status: formData.status,
        allowedShops: selectedShopIds,
      };

      if (formData.password) {
        payload.password = formData.password;
      }

      payload.subscription = {
        plan: formData.subscriptionPlan || 'free',
        status: formData.subscriptionStatus || 'active',
      };

      const response = await fetch(`/api/super/owners/${owner._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update owner');
      }

      toast.success('Owner updated successfully!');
      setOpen(false);
      onOwnerUpdated?.();
    } catch (error) {
      console.error('Error updating owner:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update owner');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || <Button variant="default" size="sm">Edit Owner</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl bg-white/80 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5" />
            Edit Owner: {owner.name}
          </DialogTitle>
          <DialogDescription>
            Update owner profile, shop access, and subscription settings.
          </DialogDescription>
        </DialogHeader>

        {isLoadingOwner ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-3 text-muted-foreground">Loading owner details...</span>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList variant="segmented" className="grid w-full grid-cols-3">
                  <TabsTrigger value="basic">Basic Info</TabsTrigger>
                  <TabsTrigger value="shops">Shop Access</TabsTrigger>
                  <TabsTrigger value="advanced">Advanced</TabsTrigger>
                </TabsList>

                {/* === TAB 1: Basic Info === */}
                <TabsContent value="basic" className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="Owner name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email Address *</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="owner@example.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="phoneNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone Number</FormLabel>
                          <FormControl>
                            <Input placeholder="+91 98765 43210" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Account Status</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="inactive">Inactive</SelectItem>
                              <SelectItem value="suspended">Suspended</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </TabsContent>

                {/* === TAB 2: Shop Access === */}
                <TabsContent value="shops" className="space-y-4 pt-4">
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Assigned Shops ({selectedShopIds.length})</span>
                    </div>

                    {/* Search filter */}
                    <Input
                      placeholder="Search shops..."
                      value={shopSearchQuery}
                      onChange={(e) => setShopSearchQuery(e.target.value)}
                      className="mb-3"
                    />

                    {/* Scrollable shop list with checkboxes */}
                    <div className="max-h-48 overflow-y-auto space-y-1 rounded-md border p-2">
                      {sortedFilteredShops.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-2 text-center">No shops found</p>
                      ) : (
                        sortedFilteredShops.map((shop) => {
                          const isSelected = selectedShopIds.includes(shop._id);
                          return (
                            <label
                              key={shop._id}
                              className={cn(
                                "flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer text-sm",
                                "hover:bg-accent hover:text-accent-foreground",
                                isSelected && "bg-primary/5"
                              )}
                            >
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => {
                                  setSelectedShopIds(prev =>
                                    isSelected
                                      ? prev.filter(id => id !== shop._id)
                                      : [...prev, shop._id]
                                  );
                                }}
                              />
                              <span className="flex-1">
                                {shop.displayName || shop.name}
                              </span>
                              {!shop.isActive && (
                                <span className="text-xs text-muted-foreground">(inactive)</span>
                              )}
                            </label>
                          );
                        })
                      )}
                    </div>

                    {/* Quick actions */}
                    <div className="flex gap-2 mt-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedShopIds(shops.filter(s => s.isActive).map(s => s._id))}
                      >
                        Select All Active
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedShopIds([])}
                      >
                        Clear All
                      </Button>
                    </div>

                    <p className="text-xs text-muted-foreground mt-2">
                      Select the shops this owner can access. Owners can only manage shops they are assigned to.
                    </p>
                  </div>

                  {/* Shop allocation summary */}
                  {selectedShopIds.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-sm font-medium">Currently assigned shops:</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedShopIds.map((shopId) => {
                          const shop = shops.find(s => s._id === shopId);
                          return shop ? (
                            <span
                              key={shopId}
                              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                            >
                              {shop.displayName || shop.name}
                            </span>
                          ) : null;
                        })}
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* === TAB 3: Advanced === */}
                <TabsContent value="advanced" className="space-y-4 pt-4">
                  {/* Subscription Section */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 border-b pb-2">
                      <span className="text-sm font-semibold">Subscription</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="subscriptionPlan"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Plan</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select plan" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="free">Free</SelectItem>
                                <SelectItem value="trial">Trial</SelectItem>
                                <SelectItem value="paid">Paid</SelectItem>
                                <SelectItem value="enterprise">Enterprise</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="subscriptionStatus"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Subscription Status</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="trial">Trial</SelectItem>
                                <SelectItem value="expired">Expired</SelectItem>
                                <SelectItem value="suspended">Suspended</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Password Reset Section */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 border-b pb-2">
                      <span className="text-sm font-semibold">Reset Password</span>
                      <span className="text-xs text-muted-foreground">(Optional)</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Leave blank to keep the current password.
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>New Password</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  type={showPassword ? 'text' : 'password'}
                                  placeholder="Enter new password"
                                  {...field}
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                  onClick={() => setShowPassword(!showPassword)}
                                >
                                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="confirmPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Confirm Password</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  type={showConfirmPassword ? 'text' : 'password'}
                                  placeholder="Confirm new password"
                                  {...field}
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                >
                                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

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
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    'Update Owner'
                  )}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}