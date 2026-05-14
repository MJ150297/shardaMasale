'use client';

import { SessionProvider } from 'next-auth/react';
import { ShopProvider } from '@/components/providers/shop-provider';

export default function SessionProviderWrapper({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ShopProvider>{children}</ShopProvider>
    </SessionProvider>
  );
}