import { ReactNode } from 'react';
import { requireUser } from '@/lib/auth';
import DashboardShell from '@/components/layout/dashboard-shell';
import { ShopProvider } from '@/components/providers/shop-provider';
import { SessionProvider } from 'next-auth/react';

interface DashboardLayoutProps {
  children: ReactNode;
}

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  const user = await requireUser();

  return (
    <SessionProvider>
      <ShopProvider>
        <DashboardShell user={{
          name: user.name,
          email: user.email,
          role: user.role
        }}>
          {children}
        </DashboardShell>
      </ShopProvider>
    </SessionProvider>
  );
}
