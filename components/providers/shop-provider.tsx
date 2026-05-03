'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
}

const ShopContext = createContext<ShopContextType | undefined>(undefined);

export function ShopProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [activeShopId, setActiveShopId] = useState<string | null>(null);
  const [availableShops, setAvailableShops] = useState<Shop[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (session?.user?.activeShopId) {
      setActiveShopId(session.user.activeShopId);
    }
  }, [session]);

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
        window.location.reload();
      }
    } catch (error) {
      console.error('Failed to switch shop:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const currentShop = availableShops.find(shop => shop.id === activeShopId) || null;

  return (
    <ShopContext.Provider
      value={{
        activeShopId,
        availableShops,
        currentShop,
        switchShop,
        isLoading,
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