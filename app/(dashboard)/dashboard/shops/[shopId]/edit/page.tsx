'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { ChevronLeft, Save, Loader2, Store } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const editShopSchema = z.object({
  name: z
    .string()
    .min(2, 'Shop name must be at least 2 characters')
    .max(100, 'Shop name must be at most 100 characters'),
  displayName: z
    .string()
    .max(100, 'Display name must be at most 100 characters')
    .optional()
    .or(z.literal('')),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  currency: z.string().length(3, 'Currency must be a 3-letter code'),
  timezone: z.string().min(1, 'Timezone is required'),
});

type EditShopFormData = z.infer<typeof editShopSchema>;

export default function EditShopPage() {
  const params = useParams();
  const router = useRouter();
  const shopId = params.shopId as string;
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<EditShopFormData>({
    resolver: zodResolver(editShopSchema),
    defaultValues: {
      name: '',
      displayName: '',
      email: '',
      phone: '',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
    },
  });

  useEffect(() => {
    if (!shopId) return;
    loadShop();
  }, [shopId]);

  const loadShop = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/shops?id=${shopId}`);
      if (!res.ok) throw new Error('Failed to load shop');
      const data = await res.json();
      // GET /api/shops with id param returns a single shop
      const shop = data.shop || data;
      form.reset({
        name: shop.name || '',
        displayName: shop.displayName || '',
        email: shop.email || '',
        phone: shop.phone || '',
        currency: shop.currency || 'INR',
        timezone: shop.timezone || 'Asia/Kolkata',
      });
    } catch (error) {
      console.error('Error loading shop:', error);
      toast.error('Failed to load shop details');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: EditShopFormData) => {
    setIsSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        name: data.name.trim(),
        currency: data.currency,
        timezone: data.timezone,
      };
      if (data.displayName?.trim()) payload.displayName = data.displayName.trim();
      if (data.email?.trim()) payload.email = data.email.trim();
      if (data.phone?.trim()) payload.phone = data.phone.trim();

      const res = await fetch(`/api/shops?id=${shopId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => null);
        throw new Error(error?.error || 'Failed to update shop');
      }

      toast.success('Shop updated successfully');
      router.push('/dashboard/shops');
    } catch (error) {
      console.error('Error updating shop:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update shop');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/shops">
            <ChevronLeft className="size-4 mr-1" />
            Back to Shops
          </Link>
        </Button>
      </div>

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Edit Shop</h1>
          <p className="text-muted-foreground">
            Update your business location details
          </p>
        </div>
        <Button onClick={form.handleSubmit(onSubmit)} disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="size-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="size-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="size-5" />
            Shop Information
          </CardTitle>
          <CardDescription>
            Edit the basic details for this shop location
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Shop Name *</Label>
              <Input id="name" placeholder="e.g., Downtown Store" {...form.register('name')} />
              {form.formState.errors.name && (
                <p className="text-sm text-red-500">{form.formState.errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input id="displayName" placeholder="e.g., My Downtown Store" {...form.register('displayName')} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="shop@example.com" {...form.register('email')} />
                {form.formState.errors.email && (
                  <p className="text-sm text-red-500">{form.formState.errors.email.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" placeholder="+91 98765 43210" {...form.register('phone')} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Input
                  id="currency"
                  placeholder="INR"
                  maxLength={3}
                  className="uppercase"
                  {...form.register('currency')}
                />
                {form.formState.errors.currency && (
                  <p className="text-sm text-red-500">{form.formState.errors.currency.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Input id="timezone" placeholder="Asia/Kolkata" {...form.register('timezone')} />
                {form.formState.errors.timezone && (
                  <p className="text-sm text-red-500">{form.formState.errors.timezone.message}</p>
                )}
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}