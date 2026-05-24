'use client';

import { SessionProvider } from 'next-auth/react';
import { ShopProvider } from '@/components/providers/shop-provider';

export default function SessionProviderWrapper({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchInterval={5 * 60} refetchOnWindowFocus={true}>
      <ShopProvider>{children}</ShopProvider>
    </SessionProvider>
  );
}
