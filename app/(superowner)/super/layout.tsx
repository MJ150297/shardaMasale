import { ReactNode } from 'react';
import { requireSuperOwner } from '@/lib/auth';
import DashboardShell from '@/components/layout/dashboard-shell';
import SessionProviderWrapper from '@/components/providers/session-provider-wrapper';

interface SuperOwnerLayoutProps {
  children: ReactNode;
}

export default async function SuperOwnerLayout({ children }: SuperOwnerLayoutProps) {
  const user = await requireSuperOwner();

  return (
    <SessionProviderWrapper>
      <DashboardShell user={{
        name: user.name,
        email: user.email,
        role: user.role
      }}>
        {children}
      </DashboardShell>
    </SessionProviderWrapper>
  );
}