'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import EditOwnerDialog from '@/components/edit-owner-dialog';
import { formatDate } from '@/lib/date-utils';

const createOwnerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  phoneNumber: z.string().optional(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(6, 'Please confirm password'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type CreateOwnerFormValues = z.infer<typeof createOwnerSchema>;

interface Owner {
  _id: string;
  id?: string;
  name: string;
  email: string;
  status: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  lastLoginAt?: Date | string | null;
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
  displayName: string | null;
  isActive: boolean;
}

interface OwnersClientProps {
  initialOwners: Owner[];
  shops: ShopItem[];
}

type OwnerInput = Omit<Owner, '_id'> & {
  _id?: string;
  id?: string;
};

function normalizeOwner(owner: OwnerInput): Owner {
  return {
    ...owner,
    _id: owner._id ?? owner.id ?? owner.email,
    allowedShops: owner.allowedShops ?? [],
    subscription: owner.subscription ?? undefined,
  };
}

export default function OwnersClient({ initialOwners, shops }: OwnersClientProps) {
  const [owners, setOwners] = useState<Owner[]>(() => initialOwners.map(normalizeOwner));
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    setOwners(initialOwners.map(normalizeOwner));
  }, [initialOwners]);

  const form = useForm<CreateOwnerFormValues>({
    resolver: zodResolver(createOwnerSchema),
    defaultValues: {
      name: '',
      email: '',
      phoneNumber: '',
      password: '',
      confirmPassword: '',
    },
  });

  async function onSubmit(values: CreateOwnerFormValues) {
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/super/owners', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create owner');
      }

      setOwners((currentOwners) => [normalizeOwner(data.owner), ...currentOwners]);
      
      toast.success('Owner created successfully');

      form.reset();
      setIsOpen(false);
      router.refresh();

    } catch (error: unknown) {
      toast.error('Error creating owner', {
        description: error instanceof Error ? error.message : 'Failed to create owner',
      });
    } finally {
      setIsLoading(false);
    }
  }

  const handleOwnerUpdated = () => {
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Owners Management</h1>
          <p className="text-muted-foreground">
            Manage all platform owner accounts
          </p>
        </div>
        
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button>Add Owner</Button>
          </DialogTrigger>
          <DialogContent className='bg-white/80'>
            <DialogHeader>
              <DialogTitle>Create New Owner</DialogTitle>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input placeholder="John Doe" {...field} />
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
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="owner@example.com" {...field} />
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
                      <FormLabel>Phone Number (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="+91 98765 43210" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input 
                            type={showPassword ? "text" : "password"} 
                            placeholder="Enter password" 
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
                            type={showConfirmPassword ? "text" : "password"} 
                            placeholder="Confirm password" 
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
                
                <div className="flex justify-end space-x-2 pt-4">
                  <Button type="button" variant="secondary" onClick={() => setIsOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? 'Creating...' : 'Create Owner'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Owners ({owners.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Sub. Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {owners.map((owner: Owner) => (
                <TableRow key={owner._id}>
                  <TableCell className="font-medium">{owner.name}</TableCell>
                  <TableCell>{owner.email}</TableCell>
                  <TableCell>
                    <Badge variant={owner.status === 'active' ? 'default' : 'secondary'}>
                      {owner.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="capitalize text-sm font-medium">
                      {owner.subscription?.plan || 'free'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        owner.subscription?.status === 'active' || owner.subscription?.status === 'trial'
                          ? 'default'
                          : 'destructive'
                      }
                      className="capitalize"
                    >
                      {owner.subscription?.status || 'trial'}
                    </Badge>
                  </TableCell>
                  <TableCell>{owner.createdAt ? formatDate(owner.createdAt) : '-'}</TableCell>
                  <TableCell>{owner.lastLoginAt ? formatDate(owner.lastLoginAt) : 'Never'}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <EditOwnerDialog
                      owner={owner}
                      shops={shops}
                      onOwnerUpdated={handleOwnerUpdated}
                    >
                      <Button size="sm" variant="secondary">Edit</Button>
                    </EditOwnerDialog>
                    <Button size="sm" variant="default">Impersonate</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
