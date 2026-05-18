'use client';

import { useRouter } from 'next/navigation';
import CreateShopDialog from '@/components/create-shop-dialog';

export default function NewShopPage() {
  const router = useRouter();

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-bold">Create a New Shop</h1>
        <p className="text-muted-foreground">
          Add a new business location to start managing your operations.
        </p>
        <CreateShopDialog
          onSuccess={() => router.push('/dashboard/shops')}
          autoSwitch={true}
        />
      </div>
    </div>
  );
}