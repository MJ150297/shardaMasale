'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';

interface Shop {
  id: string;
  name: string;
  displayName?: string | null;
}

interface ShopContextType {
  activeShopId: string | null;
  availableShops: Shop[];
  currentShop: Shop | null;
  switchShop: (shopId: string) => Promise<void>;
  isLoading: boolean;
  hasOwnedShops: boolean;
}

const ShopContext = createContext<ShopContextType | undefined>(undefined);

export function ShopProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status, update } = useSession();
  const [activeShopId, setActiveShopId] = useState<string | null>(null);
  const [availableShops, setAvailableShops] = useState<Shop[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasOwnedShops, setHasOwnedShops] = useState(false);
  const hasSyncedFallbackShopRef = useRef(false);

  useEffect(() => {
    if (session?.user?.activeShopId) {
      setActiveShopId(session.user.activeShopId);
    }
  }, [session]);

  // Fetch available shops when session is ready
  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      let isCancelled = false;

      const loadShops = async () => {
        setIsLoading(true);

        try {
          const response = await fetch('/api/shops');
          const data = await response.json();

          if (isCancelled || !data.shops) {
            return;
          }

          setAvailableShops(data.shops);
          setHasOwnedShops(data.hasOwnedShops ?? false);

          if (session.user.activeShopId) {
            hasSyncedFallbackShopRef.current = false;
            return;
          }

          if (data.shops.length > 0) {
            const fallbackShopId = data.shops[0].id;
            setActiveShopId(fallbackShopId);

            if (!hasSyncedFallbackShopRef.current) {
              hasSyncedFallbackShopRef.current = true;
              await update({ activeShopId: fallbackShopId });
            }
          }
        } catch (err) {
          console.error('Failed to fetch shops:', err);
        } finally {
          if (!isCancelled) {
            setIsLoading(false);
          }
        }
      };

      void loadShops();

      return () => {
        isCancelled = true;
      };
    }
  }, [status, session, update]);

  const switchShop = useCallback(async (shopId: string) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/shop/switch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ shopId }),
      });

      if (response.ok) {
        setActiveShopId(shopId);
        // First, persist the new shopId to the JWT token via NextAuth's update()
        await update({ activeShopId: shopId });
        // Then reload to re-render Server Components with the new shop data
        window.location.reload();
      }
    } catch (error) {
      console.error('Failed to switch shop:', error);
    } finally {
      setIsLoading(false);
    }
  }, [update]);

  const currentShop = availableShops.find(shop => shop.id === activeShopId) || null;

  return (
    <ShopContext.Provider
      value={{
        activeShopId,
        availableShops,
        currentShop,
        switchShop,
        isLoading,
        hasOwnedShops,
      }}
    >
      {children}
    </ShopContext.Provider>
  );
}

export function useActiveShop() {
  const context = useContext(ShopContext);
  if (context === undefined) {
    throw new Error('useActiveShop must be used within a ShopProvider');
  }
  return context;
}
