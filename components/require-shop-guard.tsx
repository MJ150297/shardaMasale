'use client';

import { type ReactNode } from 'react';
import { Store, ShieldAlert } from 'lucide-react';
import { useActiveShop } from '@/components/providers/shop-provider';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import CreateShopDialog from '@/components/create-shop-dialog';

interface RequireShopGuardProps {
  children: ReactNode;
}

export default function RequireShopGuard({ children }: RequireShopGuardProps) {
  const { availableShops, activeShopId, hasOwnedShops } = useActiveShop();

  // User has a shop and it's active — allow through
  if (availableShops.length > 0 && activeShopId) {
    return <>{children}</>;
  }

  // User has shops in the system but access was revoked by Super Owner
  if (availableShops.length === 0 && hasOwnedShops) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={0}>
              <Button disabled className="pointer-events-none opacity-50">
                <ShieldAlert className="size-4 mr-2" />
                Access Revoked
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="w-64">
            <div className="p-3 space-y-2">
              <p className="text-sm font-medium">No shop access</p>
              <p className="text-xs text-muted-foreground">
                Your access to shops has been revoked. Contact your administrator to restore access.
              </p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // No shops exist at all — prompt to create one
  if (availableShops.length === 0 && !hasOwnedShops) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={0}>
              <Button disabled className="pointer-events-none opacity-50">
                <Store className="size-4 mr-2" />
                Create Shop First
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="w-64 p-0 overflow-hidden rounded-lg">
            <div className="p-3 space-y-2">
              <p className="text-sm font-medium">No shop found</p>
              <p className="text-xs text-muted-foreground">
                You need to create a shop before adding items, parties, or transactions.
              </p>
              <CreateShopDialog
                autoSwitch={true}
                trigger={
                  <Button size="sm" className="w-full gap-2">
                    <Store className="size-3.5" />
                    Create Your First Shop
                  </Button>
                }
              />
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Shops exist but none selected — prompt to select one
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0}>
            <Button disabled className="pointer-events-none opacity-50">
              <Store className="size-4 mr-2" />
              Select a Shop
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-sm">Select a shop from the header dropdown first</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
